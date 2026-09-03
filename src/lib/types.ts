/**
 * 全局类型定义
 */

// 复习阶段：对应 1 / 3 / 7 / 15 / 30 天五个检查点，下标 0-4
export type ReviewStage = 0 | 1 | 2 | 3 | 4

export type LeetCodeSite = "leetcode.com" | "leetcode.cn"

// 存储在 chrome.storage 中的题目复习记录
export interface ProblemRecord {
  problemId: string // 题目 slug，例如 "two-sum"
  title: string
  url: string
  site: LeetCodeSite
  currentStage: ReviewStage
  nextReviewTimestamp: number // 下次复习时间（毫秒时间戳）
  lastReviewedTimestamp: number | null
  createdAt: number
  archived: boolean // 是否已完成 30 天周期的全部复习
}

// Content Script 捕获到 Accepted 提交后，上报给 background 的数据结构
export interface AcceptedSubmissionPayload {
  problemId: string
  title: string
  url: string
  site: LeetCodeSite
}
