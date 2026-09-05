import { Fragment } from "react"

import { Transition } from "@headlessui/react"

import { formatQuestionTitle } from "~lib/format"
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
        {/* 用原生 <a> 而不是 onClick + JS 跳转，即便 React 事件失效也能正常导航。
            title 属性放完整的"题号 + 题名"，鼠标悬浮时即使正文被截断也能看全。
            题号单独用一个小 badge 展示在最前面，方便刷题时快速定位题号；
            没解析出题号的旧数据（questionId 为 null）就不渲染 badge，直接退化成纯标题。 */}
        <a
          href={problem.url}
          target="_self"
          title={formatQuestionTitle(problem)}
          className="min-w-0 flex-1 truncate text-blue-600 hover:underline">
          {problem.questionId && (
            <span className="mr-1.5 rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-bold text-orange-700">
              #{problem.questionId}
            </span>
          )}
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
