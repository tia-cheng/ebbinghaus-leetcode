import type { PlasmoCSConfig } from "plasmo"

import { sendToBackground } from "@plasmohq/messaging"

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
 * 提取题目标题。
 * 优先使用 document.title（形如 "1. Two Sum - LeetCode"），这个信息来源
 * 几乎不受 LeetCode 前端改版影响；DOM 选择器仅作为兜底，且做了 try/catch，
 * 任何一步失败都会打印日志，方便你反馈报错帮助我快速定位修复。
 */
function getProblemTitle(problemId: string): string {
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

async function reportAccepted(problemId: string, source: "network" | "dom") {
  try {
    const payload: AcceptedSubmissionPayload = {
      problemId,
      title: getProblemTitle(problemId),
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
            title: res.record.title,
            isNew: !!res.isNew,
            daysUntilReview: Math.max(0, daysUntilReview)
          }
        })
      )
    }
  } catch (err) {
    logger.error("上报 Accepted 提交失败：", err)
  }
}

// ---------- 通道一：网络拦截事件 ----------
window.addEventListener(EVENT_NAME, (event) => {
  const detail = (event as CustomEvent).detail as { problemId: string; statusMsg: string }
  if (detail?.statusMsg === "Accepted") {
    void reportAccepted(detail.problemId, "network")
  }
})

// ---------- 通道二：DOM 兜底 ----------
// LeetCode 结果面板常用 data-e2e-locator 标记（"submission-result" / "console-result"），
// 这是相对稳定的测试锚点；一旦 LeetCode 调整了这些属性，下面的 scanForAcceptedBadge
// 会静默失效，请留意 Console 中是否长时间没有 "DOM 兜底扫描失败" 之外的任何日志，
// 并将当时的结果面板 HTML 结构反馈给我以更新选择器。
let lastHandledNode: Element | null = null

function scanForAcceptedBadge() {
  try {
    const candidates = document.querySelectorAll<HTMLElement>(
      '[data-e2e-locator="submission-result"], [data-e2e-locator="console-result"]'
    )
    for (const node of candidates) {
      const text = node.textContent?.trim()
      if (text === "Accepted" && node !== lastHandledNode) {
        lastHandledNode = node
        const match = window.location.pathname.match(/\/problems\/([^/]+)\/?/)
        if (match) {
          void reportAccepted(match[1], "dom")
        } else {
          logger.warn("DOM 检测到 Accepted，但无法从 URL 解析题目 slug")
        }
      }
    }
  } catch (err) {
    logger.warn("DOM 兜底扫描失败，可能是 LeetCode 页面结构已变化，请反馈此报错：", err)
  }
}

const observer = new MutationObserver(() => scanForAcceptedBadge())
observer.observe(document.body, { childList: true, subtree: true, characterData: true })

logger.info("Accepted 捕获脚本已启动（网络拦截 + DOM 兜底双通道）")
