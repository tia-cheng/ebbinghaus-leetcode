import { Fragment } from "react"

import { Transition } from "@headlessui/react"

import { REVIEW_INTERVALS_DAYS } from "~lib/spaced-repetition"
import type { ProblemRecord } from "~lib/types"

interface ReviewItemProps {
  problem: ProblemRecord
  removing: boolean
  onMarkReviewed: () => void
}

/** 单个复习项：题目标题（可点击跳转）+ 阶段信息 + "标记为已复习"按钮 */
export function ReviewItem({ problem, removing, onMarkReviewed }: ReviewItemProps) {
  const stageLabel = `第 ${problem.currentStage + 1}/${REVIEW_INTERVALS_DAYS.length} 次复习`

  return (
    <Transition
      as={Fragment}
      show={!removing}
      appear
      enter="transition ease-out duration-150"
      enterFrom="opacity-0 scale-95"
      enterTo="opacity-100 scale-100"
      leave="transition ease-in duration-200"
      leaveFrom="opacity-100 scale-100"
      leaveTo="opacity-0 scale-90">
      <li className="flex items-center justify-between gap-2 rounded-md border border-gray-100 bg-gray-50 px-2 py-2">
        {/* 用原生 <a> 而不是 onClick + JS 跳转，即便 React 事件失效也能正常导航 */}
        <a
          href={problem.url}
          target="_self"
          title={problem.title}
          className="min-w-0 flex-1 truncate text-blue-600 hover:underline">
          {problem.title}
        </a>
        <div className="flex shrink-0 items-center gap-2">
          <span className="whitespace-nowrap text-xs text-gray-400">{stageLabel}</span>
          <button
            type="button"
            onClick={onMarkReviewed}
            className="whitespace-nowrap rounded bg-green-500 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-300">
            标记为已复习
          </button>
        </div>
      </li>
    </Transition>
  )
}
