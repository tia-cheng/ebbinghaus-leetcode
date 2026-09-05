import type { PlasmoCSConfig } from "plasmo"

import { sendToBackground } from "@plasmohq/messaging"

import { parseQuestionTitle } from "~lib/format"
import { logger } from "~lib/logger"
import type { AcceptedSubmissionPayload, LeetCodeSite } from "~lib/types"

/**
 * 运行在 ISOLATED world（默认）的捕获脚本，双通道监听 Accepted：
 *  1）网络拦截通道（首选）：接收 interceptor.ts 广播出的 CustomEvent
 *  2）DOM 兜底通道：MutationObserver 监听结果面板文案，防止网络拦截因
 *     LeetCode 接口调整而失效
 * 两个通道最终都调用 reportAccepted 上报给 background。
 * background 端的 upsertOnAccepted 对同一题目是幂等的（重复上报不会重置进度），
 * 所以这里不需要额外做去重，可以放心两个通道同时启用。
 */
export const config: PlasmoCSConfig = {
  matches: ["https://leetcode.com/problems/*", "https://leetcode.cn/problems/*"],
  run_at: "document_idle"
}

const EVENT_NAME = "__ebbinghaus_lc_submission_result__"
const TOAST_EVENT_NAME = "__ebbinghaus_lc_captured__"
const DAY_MS = 24 * 60 * 60 * 1000

function getSite(): LeetCodeSite {
  return window.location.hostname.includes("leetcode.cn") ? "leetcode.cn" : "leetcode.com"
}

/**
 * 在页面正文里找形如 "11. Container With Most Water" 的标题文本（题号 + 纯标题）。
 * 不依赖具体的哈希类名，而是扫描 h1 及所有 class 名包含 "title" 的元素，
 * 找第一个文本内容匹配"数字 + 点 + 空格 + 内容"模式的——用文本模式代替选择器，
 * 对 LeetCode 前端改版的抵抗力更强。
 * 之所以把它作为首选来源（而不是 document.title）：React 单页应用里
 * document.title 的更新有时会比正文渲染慢半拍，在 Accepted 触发的瞬间读取
 * document.title 偶尔会拿到上一次导航时的旧标题，导致题号丢失或标题对不上。
 */
function findTitleWithNumberInDom(): string | null {
  try {
    const candidates = document.querySelectorAll<HTMLElement>('h1, [class*="title" i]')
    for (const el of candidates) {
      const text = el.textContent?.trim()
      if (text && text.length < 150 && /^\d+\.\s+\S/.test(text)) {
        return text
      }
    }
  } catch (err) {
    logger.warn("DOM 扫描题号 + 标题失败：", err)
  }
  return null
}

/**
 * 提取题目标题 + 题号，返回原始组合文本（形如 "11. Container With Most Water"），
 * 由调用方统一用 parseQuestionTitle 拆出 questionId。
 * 依次尝试：正文 DOM 扫描 → document.title → 题目链接文本 → 最终兜底用 slug。
 * 任何一步失败都会打印日志，方便你反馈报错帮助我快速定位修复。
 */
function getRawTitleText(problemId: string): string {
  const fromDom = findTitleWithNumberInDom()
  if (fromDom) return fromDom

  try {
    const fromTitle = document.title.replace(/\s*-\s*LeetCode.*$/i, "").trim()
    if (fromTitle) return fromTitle
  } catch (err) {
    logger.warn("从 document.title 解析题目标题失败：", err)
  }

  try {
    const link = document.querySelector<HTMLAnchorElement>(`a[href*="/problems/${problemId}/"]`)
    const text = link?.textContent?.trim()
    if (text) return text
  } catch (err) {
    logger.warn("从 DOM 选择器解析题目标题失败：", err)
  }

  logger.warn(`无法解析题目 "${problemId}" 的标题，使用 slug 作为兜底标题`)
  return problemId
}

// 本轮提交是否已经通知过一次。这是修复"弹窗无限循环"的关键状态锁：
// 只在真正点击 Submit 按钮时（见 armNewSubmissionCycle）重新打开，
// 而不是像之前那样靠比较 DOM 节点引用是否变化来判断——LeetCode 是 React 应用，
// 同一段文本（比如结果面板的 "Accepted"）在页面其他地方重新渲染时经常会
// 生成全新的 DOM 节点实例，用节点引用做去重会被这种"内容不变但节点变了"的
// 情况反复击穿，导致 scanForAcceptedBadge 每次触发都误判成"新的一次 Accepted"。
let hasNotifiedForCurrentSubmission = false

/** 点击真正的 Submit 按钮时调用：开启新一轮提交周期，允许再次通知一次 */
function armNewSubmissionCycle() {
  hasNotifiedForCurrentSubmission = false
  lastHandledNode = null
  logger.info("检测到 Submit 点击，开启新一轮提交周期")
}

async function reportAccepted(problemId: string, source: "network" | "dom") {
  // 必须在任何 await 之前同步做"检查 + 加锁"，否则网络通道和 DOM 通道
  // 几乎同时触发时，两边都可能在对方加锁之前就已经通过了这个判断
  if (hasNotifiedForCurrentSubmission) {
    logger.info(`本轮提交已经通知过一次，忽略重复触发（来源：${source}）`)
    return
  }
  hasNotifiedForCurrentSubmission = true

  try {
    const { questionId, title } = parseQuestionTitle(getRawTitleText(problemId))
    if (!questionId) {
      logger.warn(`未能从页面中解析出题号，"${problemId}" 会先以无题号的形式入库`)
    }

    const payload: AcceptedSubmissionPayload = {
      problemId,
      questionId,
      title,
      url: `${window.location.origin}/problems/${problemId}/`,
      site: getSite()
    }

    logger.info(`检测到 Accepted（来源：${source}），上报后台：`, payload)

    const res = await sendToBackground({ name: "capture-submission", body: payload })
    if (!res?.ok) {
      logger.warn("后台未能成功记录该题目，请检查 background 日志")
      return
    }

    // 上报成功后在页面上弹一个即时提示：捕获逻辑本身是"静默"的，
    // 不加这一步的话用户提交完全看不出插件有没有生效，只能等到复习到期那天才发现。
    if (res.record) {
      const daysUntilReview = Math.ceil((res.record.nextReviewTimestamp - Date.now()) / DAY_MS)
      window.dispatchEvent(
        new CustomEvent(TOAST_EVENT_NAME, {
          detail: {
            questionId: res.record.questionId,
            title: res.record.title,
            isNew: !!res.isNew,
            daysUntilReview: Math.max(0, daysUntilReview)
          }
        })
      )
    }
  } catch (err) {
    // 上报失败（比如网络抖动）要把锁放开，否则这一轮提交就永远没机会重试通知了
    hasNotifiedForCurrentSubmission = false
    logger.error("上报 Accepted 提交失败：", err)
  }
}

// ---------- Submit / Run 按钮点击：区分"新一轮提交"与"仅仅是 Run" ----------
// LeetCode 的判题结果轮询接口（/submissions/detail/:id/check/）是 Submit 和 Run
// 共用的，interceptor.ts 已经从请求源头（/submit/ vs /interpret_solution/）
// 做了区分；这里额外用真实的按钮点击作为"新一轮提交周期开始"的权威信号，
// 用捕获阶段（capture: true）监听，避免 LeetCode 自己的事件处理器
// stopPropagation 导致我们收不到点击。
document.addEventListener(
  "click",
  (event) => {
    const target = event.target as HTMLElement | null
    if (!target) return

    if (target.closest('[data-e2e-locator="console-submit-button"]')) {
      armNewSubmissionCycle()
      return
    }
    if (target.closest('[data-e2e-locator="console-run-button"]')) {
      logger.info("检测到 Run 点击（仅跑示例用例），不会触发复习通知")
    }
  },
  true
)

// ---------- 通道一：网络拦截事件 ----------
window.addEventListener(EVENT_NAME, (event) => {
  const detail = (event as CustomEvent).detail as { problemId: string; statusMsg: string }
  if (detail?.statusMsg === "Accepted") {
    void reportAccepted(detail.problemId, "network")
  }
})

// ---------- 通道二：DOM 兜底 ----------
// 只认 "submission-result"（Submit 结果面板专属的锚点）。
// 之前还监听了 "console-result"，但那其实是 Run（跑示例用例）的结果面板——
// LeetCode 在示例用例全部通过时，那个面板同样会显示 "Accepted" 字样，
// 这正是 Bug 2（点 Run 也误触发）在 DOM 通道上的根源，去掉即可。
// 一旦 LeetCode 调整了 "submission-result" 这个属性，下面的 scanForAcceptedBadge
// 会静默失效，请留意 Console 中是否长时间没有 "DOM 兜底扫描失败" 之外的任何日志，
// 并将当时的结果面板 HTML 结构反馈给我以更新选择器。
let lastHandledNode: Element | null = null

function scanForAcceptedBadge() {
  try {
    const candidates = document.querySelectorAll<HTMLElement>('[data-e2e-locator="submission-result"]')
    for (const node of candidates) {
      const text = node.textContent?.trim()
      if (text === "Accepted" && node !== lastHandledNode) {
        lastHandledNode = node
        const match = window.location.pathname.match(/\/problems\/([^/]+)\/?/)
        if (match) {
          void reportAccepted(match[1], "dom")
        } else {
          logger.warn("DOM 检测到 Accepted, 但无法从 URL 解析题目 slug")
        }
      }
    }
  } catch (err) {
    logger.warn("DOM 兜底扫描失败, 可能是 LeetCode 页面结构已变化，请反馈此报错：", err)
  }
}

const observer = new MutationObserver(() => scanForAcceptedBadge())
observer.observe(document.body, { childList: true, subtree: true, characterData: true })

logger.info("Accepted 捕获脚本已启动（网络拦截 + DOM 兜底双通道）")
