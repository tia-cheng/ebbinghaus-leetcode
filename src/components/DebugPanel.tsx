import { useState } from "react"

import { Disclosure, Transition } from "@headlessui/react"

import { clearAllReviewData, fastForwardOneDay, forceAllDueNow, seedMockDueProblems } from "~lib/dev-tools"

type ActionKey = "seed" | "fast-forward" | "force-due" | "clear"

/**
 * 开发调试面板：间隔重复的复习节点要等 1/3/7/15/30 天才会触发，
 * 正常流程没法立刻看到"今日待复习"列表的真实效果，这里提供几个
 * 一键操作绕开等待，方便本地调试 UI。
 *
 * 只应该在开发环境下渲染——渲染门控在 ReviewPanel.tsx 里用
 * `process.env.NODE_ENV === "development"` 做的，生产构建时那个条件
 * 分支会被 Parcel 判定为恒假代码整体删除，这个组件（以及它唯一引用的
 * ~lib/dev-tools 模块）会随之被 tree-shake 掉，不会出现在最终产物里。
 */
export function DebugPanel() {
  const [busy, setBusy] = useState<ActionKey | null>(null)

  const runAction = (key: ActionKey, action: () => Promise<void>) => async () => {
    setBusy(key)
    try {
      await action()
    } finally {
      setBusy(null)
    }
  }

  const buttonClass =
    "w-full rounded bg-slate-700 px-2 py-1.5 text-left text-xs font-medium text-slate-100 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"

  return (
    <Disclosure>
      {({ open }) => (
        <div className="mt-2 border-t border-dashed border-gray-200 pt-2">
          <Disclosure.Button className="flex w-full items-center justify-between rounded px-1 py-1 text-xs font-semibold text-purple-600 hover:bg-purple-50">
            <span>Developer Mode</span>
            <span className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
              ▾
            </span>
          </Disclosure.Button>

          <Transition
            enter="transition ease-out duration-100"
            enterFrom="opacity-0 -translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-75"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 -translate-y-1">
            <Disclosure.Panel className="mt-2 flex flex-col gap-1.5 rounded-md bg-slate-800 p-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={runAction("seed", seedMockDueProblems)}
                className={buttonClass}>
                {busy === "seed" ? "写入中..." : "🧪 注入 4 道 Mock 待复习题目"}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={runAction("fast-forward", fastForwardOneDay)}
                className={buttonClass}>
                {busy === "fast-forward" ? "处理中..." : "⏩ 全部快进 1 天"}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={runAction("force-due", forceAllDueNow)}
                className={buttonClass}>
                {busy === "force-due" ? "处理中..." : "⏰ 全部立即过期"}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={runAction("clear", clearAllReviewData)}
                className={`${buttonClass} bg-red-700 hover:bg-red-600`}>
                {busy === "clear" ? "清空中..." : "🗑️ 清空全部复习数据"}
              </button>
            </Disclosure.Panel>
          </Transition>
        </div>
      )}
    </Disclosure>
  )
}
