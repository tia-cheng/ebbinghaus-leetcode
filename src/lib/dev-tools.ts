/**
 * 仅供本地开发调试使用的 storage 快捷操作，不参与正式的间隔重复算法逻辑。
 * 唯一的引用方是 DebugPanel.tsx，而 DebugPanel 只在
 * process.env.NODE_ENV === "development" 时才会被渲染（见 ReviewPanel.tsx）。
 * `pnpm build` 时 Parcel 会把 process.env.NODE_ENV 静态替换为 "production"，
 * 那个条件分支连同 <DebugPanel /> 引用会被判定为恒假代码直接删掉，
 * 这个文件也就成了无人引用的模块，一并被 tree-shake 出最终产物——
 * 不需要额外的 if/打包配置去手动剔除。
 */
import { getAllRecords, storage, STORAGE_KEY } from "~lib/storage"
import type { LeetCodeSite, ProblemRecord, ReviewStage } from "~lib/types"

const DAY_MS = 24 * 60 * 60 * 1000

// questionId 和 title 分开存（对应 ProblemRecord 现在的数据结构），
// 用真实存在的题号，方便调试题号 badge 的展示效果
const MOCK_PROBLEMS: Array<{ problemId: string; questionId: string; title: string; site: LeetCodeSite }> = [
  { problemId: "two-sum", questionId: "1", title: "Two Sum", site: "leetcode.com" },
  { problemId: "container-with-most-water", questionId: "11", title: "Container With Most Water", site: "leetcode.com" },
  { problemId: "3sum", questionId: "15", title: "3Sum", site: "leetcode.com" },
  { problemId: "median-of-two-sorted-arrays", questionId: "4", title: "Median of Two Sorted Arrays", site: "leetcode.com" }
]

/**
 * 往 storage 里塞几道 mock 题目，nextReviewTimestamp 直接设成过去几分钟，
 * 立刻会出现在悬浮窗"今日待复习"列表里，不用真的等 1 天。
 */
export async function seedMockDueProblems(): Promise<void> {
  const all = await getAllRecords()
  const now = Date.now()

  MOCK_PROBLEMS.forEach((mock, index) => {
    const record: ProblemRecord = {
      problemId: mock.problemId,
      questionId: mock.questionId,
      title: mock.title,
      url: `https://${mock.site}/problems/${mock.problemId}/`,
      site: mock.site,
      currentStage: (index % 5) as ReviewStage,
      nextReviewTimestamp: now - (index + 1) * 60 * 1000,
      lastReviewedTimestamp: null,
      createdAt: now,
      archived: false
    }
    all[record.problemId] = record
  })

  await storage.set(STORAGE_KEY, all)
}

/** 把所有未归档题目的 nextReviewTimestamp 整体前移 24 小时，模拟"过了一天" */
export async function fastForwardOneDay(): Promise<void> {
  const all = await getAllRecords()
  for (const record of Object.values(all)) {
    if (!record.archived) {
      record.nextReviewTimestamp -= DAY_MS
    }
  }
  await storage.set(STORAGE_KEY, all)
}

/** 把所有未归档题目强行标记为"现在就要复习"，用于一次性验证清单渲染效果 */
export async function forceAllDueNow(): Promise<void> {
  const all = await getAllRecords()
  const forcedTimestamp = Date.now() - 1000
  for (const record of Object.values(all)) {
    if (!record.archived) {
      record.nextReviewTimestamp = forcedTimestamp
    }
  }
  await storage.set(STORAGE_KEY, all)
}

/** 清空所有复习记录，恢复到刚安装扩展时的初始状态 */
export async function clearAllReviewData(): Promise<void> {
  await storage.remove(STORAGE_KEY)
}
