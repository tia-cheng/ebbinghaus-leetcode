/**
 * 间隔重复（艾宾浩斯记忆曲线）核心算法。
 *
 * 五个复习检查点分别在首次 Accepted 后的第 1 / 3 / 7 / 15 / 30 天，
 * currentStage 表示"下一次要完成的是第几个检查点"（0-based）。
 * 每完成一次复习，stage + 1；完成第 5 个检查点（30 天）后，
 * 该题被标记为 archived（已归档），不再出现在复习清单中。
 */
import type { AcceptedSubmissionPayload, ProblemRecord, ReviewStage } from "~lib/types"

export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 15, 30] as const
export const MAX_STAGE_INDEX = (REVIEW_INTERVALS_DAYS.length - 1) as ReviewStage // 4

const DAY_MS = 24 * 60 * 60 * 1000

/** 根据当前 stage 计算下一次复习的时间戳 */
export function calcNextReviewTimestamp(stage: ReviewStage, from: number = Date.now()): number {
  const days = REVIEW_INTERVALS_DAYS[stage]
  return from + days * DAY_MS
}

/** 首次 Accepted 时创建的初始复习记录（stage = 0，1 天后复习） */
export function createInitialRecord(payload: AcceptedSubmissionPayload, now: number = Date.now()): ProblemRecord {
  const initialStage: ReviewStage = 0
  return {
    problemId: payload.problemId,
    questionId: payload.questionId,
    title: payload.title,
    url: payload.url,
    site: payload.site,
    currentStage: initialStage,
    nextReviewTimestamp: calcNextReviewTimestamp(initialStage, now),
    lastReviewedTimestamp: null,
    createdAt: now,
    archived: false
  }
}

/**
 * 用户点击"标记为已复习"后推进到下一个复习阶段；
 * 若已经完成了 30 天周期的最后一次复习，则归档该题目。
 */
export function advanceAfterReview(record: ProblemRecord, now: number = Date.now()): ProblemRecord {
  const nextStageIndex = record.currentStage + 1

  if (nextStageIndex > MAX_STAGE_INDEX) {
    return { ...record, archived: true, lastReviewedTimestamp: now }
  }

  const nextStage = nextStageIndex as ReviewStage
  return {
    ...record,
    currentStage: nextStage,
    nextReviewTimestamp: calcNextReviewTimestamp(nextStage, now),
    lastReviewedTimestamp: now
  }
}
