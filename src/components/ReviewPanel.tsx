import { Fragment, useState } from "react"

import { Popover, Transition } from "@headlessui/react"

import { ReviewItem } from "~components/ReviewItem"
import { useReviewQueue } from "~lib/use-review-queue"

// 从点击"标记为已复习"到真正从列表移除之间的过渡动画时长（毫秒），
// 需要和 ReviewItem 里 Transition 的 leave duration 保持一致
const REMOVE_ANIMATION_MS = 200

/** 右下角悬浮复习清单面板 */
export function ReviewPanel() {
  const { dueList, markReviewed } = useReviewQueue()
  // 记录"正在移除动画中"的题目 id，先播放退场动画，动画结束后再真正写入 storage
  const [pendingRemoval, setPendingRemoval] = useState<Record<string, boolean>>({})

  const handleMarkReviewed = (problemId: string) => {
    setPendingRemoval((prev) => ({ ...prev, [problemId]: true }))
    window.setTimeout(async () => {
      await markReviewed(problemId)
      setPendingRemoval((prev) => {
        const next = { ...prev }
        delete next[problemId]
        return next
      })
    }, REMOVE_ANIMATION_MS)
  }

  return (
    <div className="fixed bottom-4 right-4 z-[2147483647] font-sans text-sm">
      <Popover className="relative">
        {({ open }) => (
          <>
            <Popover.Button className="flex items-center gap-2 rounded-full bg-orange-500 px-4 py-3 text-white shadow-lg transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300">
              <span aria-hidden>📚</span>
              <span>今日待复习</span>
              {dueList.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-orange-600">
                  {dueList.length}
                </span>
              )}
            </Popover.Button>

            <Transition
              as={Fragment}
              show={open}
              enter="transition ease-out duration-150"
              enterFrom="opacity-0 translate-y-2"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-2">
              <Popover.Panel
                static
                className="absolute bottom-full right-0 mb-2 max-h-96 w-80 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 shadow-2xl">
                <h3 className="mb-2 border-b border-gray-100 pb-2 text-base font-semibold text-gray-800">
                  艾宾浩斯复习清单
                </h3>
                {dueList.length === 0 ? (
                  <p className="py-6 text-center text-gray-400">今天没有需要复习的题目 🎉</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {dueList.map((problem) => (
                      <ReviewItem
                        key={problem.problemId}
                        problem={problem}
                        removing={!!pendingRemoval[problem.problemId]}
                        onMarkReviewed={() => handleMarkReviewed(problem.problemId)}
                      />
                    ))}
                  </ul>
                )}
              </Popover.Panel>
            </Transition>
          </>
        )}
      </Popover>
    </div>
  )
}
