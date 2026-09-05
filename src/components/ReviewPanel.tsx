import { Fragment, useEffect, useRef, useState } from "react"
import type { RefObject } from "react"

import { Popover, Transition } from "@headlessui/react"

import { DebugPanel } from "~components/DebugPanel"
import { ReviewItem } from "~components/ReviewItem"
import { useReviewQueue } from "~lib/use-review-queue"

// 从点击"标记为已复习"到真正从列表移除之间的过渡动画时长（毫秒），
// 需要和 ReviewItem 里 Transition 的 leave duration 保持一致
const REMOVE_ANIMATION_MS = 200

/**
 * [NEW] 点击面板外部自动收起。
 *
 * 单独抽成一个组件，是因为 Popover 的 children 是一个 render-prop 回调
 * （`{({ open, close }) => ...}`），而 hooks 不能直接写在这种"传进来的
 * 箭头函数体"里——即便实际运行时不会出错，也会违反 rules-of-hooks、
 * 触发 lint 报错。拆成真正的组件后，hooks 挂在组件自身的 render 上，
 * 完全合规。这个组件不渲染任何东西，只负责挂/卸监听。
 */
function CloseOnOutsideClick({
  active,
  onClose,
  containerRef
}: {
  active: boolean
  onClose: () => void
  containerRef: RefObject<HTMLElement>
}) {
  useEffect(() => {
    if (!active) return

    function handleClick(event: MouseEvent) {
      // [关键] Plasmo 把这个面板渲染在 Shadow DOM 里。点击事件冒泡到
      // 宿主页面的 document 时会发生"重定向"（retargeting）：事件对象上
      // 的 event.target 会被替换成 Shadow Host 元素本身，而不是真正被
      // 点击的那个内部节点——用常规的 `containerRef.current.contains(event.target)`
      // 判断，哪怕点在面板正中间，也会因为 target 被重定向成了 host
      // 元素（它不是 containerRef 的后代）而误判成"点在外面"，导致面板
      // 立刻又被自己关掉。event.composedPath() 返回的是重定向之前、
      // 穿越 Shadow 边界的完整原始路径，包含真正被点击的节点，必须用它。
      const path = event.composedPath()
      if (containerRef.current && !path.includes(containerRef.current)) {
        onClose()
      }
    }

    // 用捕获阶段监听：即使 LeetCode 页面上某个元素的点击处理器调用了
    // stopPropagation（阻止事件冒泡到 document），捕获阶段也会先一步跑到，
    // 不会漏判"点在外部"的情况。
    document.addEventListener("click", handleClick, true)
    return () => document.removeEventListener("click", handleClick, true)
  }, [active, onClose, containerRef])

  return null
}

/** 右下角悬浮复习清单面板 */
export function ReviewPanel() {
  const { dueList, markReviewed } = useReviewQueue()
  // 记录"正在移除动画中"的题目 id，先播放退场动画，动画结束后再真正写入 storage
  const [pendingRemoval, setPendingRemoval] = useState<Record<string, boolean>>({})
  // [NEW] 包住"小球 + 展开面板"整体的容器引用，用来判断一次点击到底是
  // 落在我们自己身上，还是落在页面其他地方
  const containerRef = useRef<HTMLDivElement>(null)

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
    <div ref={containerRef} className="fixed bottom-4 right-4 z-[2147483647] font-sans text-sm">
      <Popover className="relative">
        {({ open, close }) => (
          <>
            {/* [NEW] containerRef 同时包住小球按钮和展开面板：点击小球本身
                走 Headless UI 自带的开关逻辑，不会触发这里的"外部点击"分支
                （因为小球也在 containerRef 范围内），两套逻辑不会打架。 */}
            <CloseOnOutsideClick active={open} onClose={close} containerRef={containerRef} />
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
                  Ebbinghaus Today's TODO
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
