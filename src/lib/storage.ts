/**
 * 存储逻辑封装层。
 *
 * 使用 @plasmohq/storage 统一读写 chrome.storage.local，
 * 所有题目记录以 { [problemId]: ProblemRecord } 的形式存放在同一个 key 下。
 * 这个文件是整个扩展"写数据"的唯一入口：
 *   - background/messages/capture-submission.ts 捕获到 Accepted 时调用 upsertOnAccepted
 *   - 悬浮窗点击"标记为已复习"时调用 markReviewed
 * 保持单一写入路径，避免 background 和 content script 各自维护一份状态导致的竞态问题。
 */
import { Storage } from "@plasmohq/storage"

import { logger } from "~lib/logger"
import { advanceAfterReview, createInitialRecord } from "~lib/spaced-repetition"
import type { AcceptedSubmissionPayload, ProblemRecord } from "~lib/types"

export const STORAGE_KEY = "leetcode-review-problems"

// area: "local" —— 不使用 sync，避免题目量大时触发 chrome.storage.sync 的容量限制
export const storage = new Storage({ area: "local" })

export async function getAllRecords(): Promise<Record<string, ProblemRecord>> {
  const data = await storage.get<Record<string, ProblemRecord>>(STORAGE_KEY)
  return data ?? {}
}

export interface UpsertResult {
  record: ProblemRecord
  isNew: boolean
}

/**
 * 收到 Accepted 提交时调用。
 * 若该题已经在复习队列中（未归档），说明是重复提交 Accepted，直接跳过，
 * 避免重复添加导致复习进度被重置。
 * 返回值附带 isNew，供调用方（比如悬浮提示）区分"新加入"和"已在队列中"两种情况。
 */
export async function upsertOnAccepted(payload: AcceptedSubmissionPayload): Promise<UpsertResult> {
  const all = await getAllRecords()
  const existing = all[payload.problemId]

  if (existing && !existing.archived) {
    logger.info(`题目 "${payload.problemId}" 已在复习队列中，跳过重复添加`)
    return { record: existing, isNew: false }
  }

  const record = createInitialRecord(payload)
  all[payload.problemId] = record
  await storage.set(STORAGE_KEY, all)
  logger.info(`新增复习记录：${payload.problemId}，将于 1 天后进行第一次复习`)
  return { record, isNew: true }
}

/** 用户点击"标记为已复习"，推进复习阶段 / 归档 */
export async function markReviewed(problemId: string): Promise<ProblemRecord | null> {
  const all = await getAllRecords()
  const existing = all[problemId]

  if (!existing) {
    logger.warn(`未找到题目记录，无法标记为已复习：${problemId}`)
    return null
  }

  const updated = advanceAfterReview(existing)
  all[problemId] = updated
  await storage.set(STORAGE_KEY, all)

  if (updated.archived) {
    logger.info(`题目 "${problemId}" 已完成 30 天复习周期，归档`)
  } else {
    logger.info(`题目 "${problemId}" 进入第 ${updated.currentStage + 1} 阶段复习`)
  }
  return updated
}

/** 获取当前到期（今天需要复习）的题目列表 */
export async function getDueRecords(now: number = Date.now()): Promise<ProblemRecord[]> {
  const all = await getAllRecords()
  return Object.values(all).filter((r) => !r.archived && r.nextReviewTimestamp <= now)
}
