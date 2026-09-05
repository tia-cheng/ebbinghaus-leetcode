import type { PlasmoCSConfig } from "plasmo"

/**
 * 网络拦截脚本 —— 运行在页面的 MAIN world（与 LeetCode 页面共享同一个 window / fetch）。
 *
 * 设计说明：
 * Manifest V3 的 background service worker 只能通过 chrome.webRequest 观察请求的
 * "元信息"（URL、header 等），**无法读取响应体**，因此没办法在 background 里直接
 * 判断某次提交是不是 "Accepted"。业界通用做法是在页面的 MAIN world 里重写
 * window.fetch / XMLHttpRequest，拦截到判题结果接口的响应后，再通过
 * CustomEvent 把结果"广播"到 DOM 上，交给运行在 ISOLATED world 的
 * content script（见 capture.ts）转发给 background 落库。
 *
 * 之所以选择拦截网络响应而不是完全依赖 DOM 变化：
 * LeetCode 前端的 CSS 类名是构建时哈希化的，随时可能因发版而失效；
 * 而判题结果接口的字段（state / status_msg）相对稳定，抓取更可靠。
 * 我们在 capture.ts 中仍然保留了 DOM 兜底方案作为双保险。
 */
export const config: PlasmoCSConfig = {
  matches: ["https://leetcode.com/problems/*", "https://leetcode.cn/problems/*"],
  world: "MAIN",
  run_at: "document_start"
}

// LeetCode 判题结果轮询接口，形如 /submissions/detail/1234567/check/
// 注意：这个 check 接口是 Submit 和 Run（interpret_solution）共用的轮询端点，
// 光看 URL 分不出这次轮询到底是哪个操作发起的——必须先拦截发起请求的那两个
// POST 接口，记下它们各自返回的 id，才能在 check 阶段准确区分。
const CHECK_URL_PATTERN = /\/submissions\/detail\/(\d+)\/check\/?/
// 真正的"提交"接口，只有命中它返回的 submission_id 才允许后续触发 Accepted 通知
const SUBMIT_URL_PATTERN = /\/problems\/[^/]+\/submit\/?(?:$|\?)/
// "运行"（Run，仅跑示例用例）接口——命中它的 interpret_id 会被明确排除，
// 防止 Run 出的 "Accepted" 类文案被误判成一次真正的提交
const INTERPRET_URL_PATTERN = /\/problems\/[^/]+\/interpret_solution\/?(?:$|\?)/

const EVENT_NAME = "__ebbinghaus_lc_submission_result__"

const log = (...args: unknown[]) => console.log("[Ebbinghaus-LeetCode][interceptor]", ...args)
const warn = (...args: unknown[]) => console.warn("[Ebbinghaus-LeetCode][interceptor]", ...args)

function getProblemIdFromLocation(): string | null {
  const match = window.location.pathname.match(/\/problems\/([^/]+)\/?/)
  return match ? match[1] : null
}

// 记录"确认来自真正 Submit"的 id 集合；interpret_solution（Run）产生的 id 不会进这里
const knownSubmitIds = new Set<string>()

/** 拦截 /submit/ 或 /interpret_solution/ 的响应，记下这次操作产生的 id 属于哪一类 */
function trackSubmissionOrigin(url: string, data: Record<string, unknown>) {
  try {
    if (SUBMIT_URL_PATTERN.test(url)) {
      const id = String(data?.submission_id ?? "")
      if (id) {
        knownSubmitIds.add(id)
        log(`记录到一次真正的 Submit，submission_id=${id}`)
      } else {
        warn("命中 /submit/ 接口但没解析到 submission_id，响应结构可能变了：", data)
      }
      return
    }
    if (INTERPRET_URL_PATTERN.test(url)) {
      const id = String(data?.interpret_id ?? "")
      log(`检测到一次 Run（interpret_solution），interpret_id=${id || "(未知)"}，不会触发复习通知`)
    }
  } catch (err) {
    warn("解析 submit/interpret 响应失败：", err)
  }
}

/**
 * 解析判题结果轮询（check）接口的响应体。
 * state === "SUCCESS" 表示"判题流程已跑完"（并不代表通过），
 * 真正决定是否通过的是 status_msg 是否等于 "Accepted"，由下游 capture.ts
 * 做最终判断，这里只负责在确认"这次轮询对应的是 Submit 而不是 Run"之后如实广播。
 */
function broadcastCheckResult(id: string, data: Record<string, unknown>) {
  try {
    const state = String(data?.state ?? "")
    if (state !== "SUCCESS") return

    if (!knownSubmitIds.has(id)) {
      log(`忽略非 Submit 来源的判题结果（大概率是 Run 的 interpret_id=${id}）`)
      return
    }
    knownSubmitIds.delete(id) // 用完即清，避免这个 Set 无限增长

    const statusMsg = String(data?.status_msg ?? "")
    const problemId = getProblemIdFromLocation()

    if (!problemId) {
      warn("拦截到判题结果，但无法从 URL 中解析出题目 slug：", window.location.pathname)
      return
    }

    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: {
          problemId,
          statusMsg,
          submissionId: id,
          url: `${window.location.origin}/problems/${problemId}/`
        }
      })
    )
    log(`捕获判题结果: ${problemId} -> ${statusMsg || "(空)"}（submission_id=${id}）`)
  } catch (err) {
    // LeetCode 接口结构一旦调整，大概率会先在这里报错，
    // 把这里的日志和响应体截图发给我即可定位修复。
    warn("解析判题结果响应体失败，可能是 LeetCode 接口结构发生了变化：", err)
  }
}

/** 统一的响应分发入口：按 URL 判断这是 submit/interpret 的发起请求，还是 check 轮询 */
function handleInterceptedResponse(url: string, jsonPromise: Promise<Record<string, unknown>>) {
  if (SUBMIT_URL_PATTERN.test(url) || INTERPRET_URL_PATTERN.test(url)) {
    jsonPromise.then((data) => trackSubmissionOrigin(url, data)).catch((err) => warn("读取响应 JSON 失败：", err))
    return
  }

  const checkMatch = url.match(CHECK_URL_PATTERN)
  if (checkMatch) {
    jsonPromise.then((data) => broadcastCheckResult(checkMatch[1], data)).catch((err) => warn("读取响应 JSON 失败：", err))
  }
}

function isInterestingUrl(url: string): boolean {
  return SUBMIT_URL_PATTERN.test(url) || INTERPRET_URL_PATTERN.test(url) || CHECK_URL_PATTERN.test(url)
}

// ---------- 拦截 fetch ----------
const originalFetch = window.fetch
window.fetch = async function patchedFetch(...args: Parameters<typeof fetch>) {
  const response = await originalFetch.apply(this, args)
  try {
    const input = args[0]
    const url = typeof input === "string" ? input : (input as Request).url
    if (url && isInterestingUrl(url)) {
      handleInterceptedResponse(url, response.clone().json())
    }
  } catch (err) {
    warn("fetch 拦截逻辑异常：", err)
  }
  return response
}

// ---------- 拦截 XMLHttpRequest（部分轮询请求可能走 XHR）----------
const OriginalXHR = window.XMLHttpRequest

class PatchedXHR extends OriginalXHR {
  private _ebbinghausUrl = ""

  open(method: string, url: string | URL, ...rest: unknown[]) {
    this._ebbinghausUrl = url.toString()
    // @ts-expect-error 透传剩余参数给原生实现，TS 的 XHR.open 重载签名过于严格
    return super.open(method, url, ...rest)
  }

  send(...args: unknown[]) {
    if (isInterestingUrl(this._ebbinghausUrl)) {
      const url = this._ebbinghausUrl
      this.addEventListener("load", () => {
        try {
          handleInterceptedResponse(url, Promise.resolve(JSON.parse(this.responseText)))
        } catch (err) {
          warn("解析 XHR 响应 JSON 失败：", err)
        }
      })
    }
    // @ts-expect-error 同上，透传参数给原生实现
    return super.send(...args)
  }
}

window.XMLHttpRequest = PatchedXHR as unknown as typeof XMLHttpRequest

log("网络拦截已注入，等待判题结果...")
