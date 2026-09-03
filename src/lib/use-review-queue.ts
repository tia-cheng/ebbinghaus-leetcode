/**
 * 自定义 Hook：封装"今日待复习清单"的读取与操作，供悬浮窗组件使用。
 *
 * 使用 @plasmohq/storage 提供的 useStorage，内部通过 chrome.storage.onChanged
 * 订阅变化——因此即便数据修改发生在 background（例如另一个标签页刚捕获到
 * Accepted），当前打开的悬浮窗也会自动刷新，无需手动轮询。
 */
import { useEffect, useMemo, useState } from "react"

import { useStorage } from "@plasmohq/storage/hook"

import { markReviewed as markReviewedInStorage, storage, STORAGE_KEY } from "~lib/storage"
import type { ProblemRecord } from "~lib/types"

const REFRESH_INTERVAL_MS = 30_000 // 定期刷新"当前时间"，让跨天到期的题目能及时出现在清单里

export function useReviewQueue() {
  const [records] = useStorage<Record<string, ProblemRecord>>(
    { key: STORAGE_KEY, instance: storage },
    (stored) => stored ?? {}
  )

  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  const dueList = useMemo(() => {
    return Object.values(records ?? {})
      .filter((record) => !record.archived && record.nextReviewTimestamp <= now)
      .sort((a, b) => a.nextReviewTimestamp - b.nextReviewTimestamp)
  }, [records, now])

  const markReviewed = async (problemId: string) => {
    await markReviewedInStorage(problemId)
  }

  return {
    dueList,
    markReviewed,
    totalTracked: Object.keys(records ?? {}).length
  }
}
