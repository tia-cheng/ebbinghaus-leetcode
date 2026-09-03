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
const CHECK_URL_PATTERN = /\/submissions\/detail\/\d+\/check\/?/
const EVENT_NAME = "__ebbinghaus_lc_submission_result__"

const log = (...args: unknown[]) => console.log("[Ebbinghaus-LeetCode][interceptor]", ...args)
const warn = (...args: unknown[]) => console.warn("[Ebbinghaus-LeetCode][interceptor]", ...args)

function getProblemIdFromLocation(): string | null {
  const match = window.location.pathname.match(/\/problems\/([^/]+)\/?/)
  return match ? match[1] : null
}

/**
 * 解析判题接口的响应体。
 * state === "SUCCESS" 表示"判题流程已跑完"（并不代表通过），
 * 真正决定是否通过的是 status_msg 是否等于 "Accepted"，
 * 由下游 capture.ts 做最终判断，这里只负责如实广播。
 */
function broadcastResult(data: Record<string, unknown>) {
  try {
    const state = String(data?.state ?? "")
    if (state !== "SUCCESS") return

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
          url: `${window.location.origin}/problems/${problemId}/`
        }
      })
    )
    log(`捕获判题结果: ${problemId} -> ${statusMsg || "(空)"}`)
  } catch (err) {
    // LeetCode 接口结构一旦调整，大概率会先在这里报错，
    // 把这里的日志和响应体截图发给我即可定位修复。
    warn("解析判题结果响应体失败，可能是 LeetCode 接口结构发生了变化：", err)
  }
}

// ---------- 拦截 fetch ----------
const originalFetch = window.fetch
window.fetch = async function patchedFetch(...args: Parameters<typeof fetch>) {
  const response = await originalFetch.apply(this, args)
  try {
    const input = args[0]
    const url = typeof input === "string" ? input : (input as Request).url
    if (url && CHECK_URL_PATTERN.test(url)) {
      response
        .clone()
        .json()
        .then(broadcastResult)
        .catch((err) => warn("读取 fetch 响应 JSON 失败：", err))
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
    if (CHECK_URL_PATTERN.test(this._ebbinghausUrl)) {
      this.addEventListener("load", () => {
        try {
          broadcastResult(JSON.parse(this.responseText))
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
