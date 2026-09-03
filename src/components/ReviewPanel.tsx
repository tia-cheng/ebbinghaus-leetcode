import { Fragment, useState } from "react"

import { Popover, Transition } from "@headlessui/react"

import { DebugPanel } from "~components/DebugPanel"
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
    // [CHANGED] z-[2147483647] 是 CSS z-index 允许的最大值（2^31-1），
    // 比需求里要求的 99999 更高一档，确保无论 /problems/* 页面的 Monaco Editor、
    // 拖拽 Splitter 分割条、还是 LeetCode 自己的弹窗设置了多高的 z-index 都盖不住悬浮窗。
    // 配合 position: fixed，即使现在全站页面都注入（见 panel.tsx 的 matches），
    // 也始终锚定在视口右下角，不随页面内部布局滚动或被裁剪。
    <div className="fixed bottom-4 right-4 z-[2147483647] font-sans text-sm">
      <Popover className="relative">
        {({ open }) => (
          <>
            {/* [CHANGED] 折叠态：默认只显示一个圆形悬浮小球（图标 + 到期数角标），
                而不是之前占位更大的文字胶囊按钮——刷题页寸土寸金，
                避免默认状态就遮挡代码编辑器或题目描述。点击后展开完整列表。 */}
            <Popover.Button
              title="Today's Ebbi ToDo"
              aria-label="Open Ebbinghaus review list"
              className="relative flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-2xl text-white shadow-lg transition-transform hover:scale-105 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300">
              <span aria-hidden>😼</span>
              {dueList.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[11px] font-bold leading-none text-white">
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
                  Ebbinghaus spaced repetition TODO List
                </h3>
                {dueList.length === 0 ? (
                  <p className="py-6 text-center text-gray-400">All Done Today! 🎉</p>
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

                {/* [NEW] 开发者调试面板：仅 `pnpm dev`（NODE_ENV === "development"）下渲染。
                    这里最初想用 React.lazy + dynamic import 让 DebugPanel 连模块
                    本体都从生产包里剔除，但实测在内容脚本的运行环境里动态 import
                    会抛 "Cannot find module" 而彻底不可用（MV3 content script 的
                    脚本加载机制和 Parcel 的异步 chunk 加载器不兼容），所以改回静态
                    import，用条件渲染门控。生产构建时 NODE_ENV 会被静态替换为
                    "production"，下面这个条件恒为 false 并被压缩器折叠掉，
                    <DebugPanel /> 在生产环境下 100% 不会被渲染/执行——用
                    `pnpm build` 验证过 panel.js 主包里确实不含这段 JSX 调用；
                    唯一的代价是 DebugPanel 组件本身的源码仍会作为一个不可达模块
                    留在打包产物里（Parcel 对这种"条件里静态 import"的场景不做
                    跨模块死代码消除），不影响生产环境的实际行为。 */}
                {process.env.NODE_ENV === "development" && <DebugPanel />}
              </Popover.Panel>
            </Transition>
          </>
        )}
      </Popover>
    </div>
  )
}
