import { Fragment, useEffect, useRef, useState } from "react"

import { Transition } from "@headlessui/react"

import { formatQuestionTitle } from "~lib/format"

const EVENT_NAME = "__ebbinghaus_lc_captured__"
const AUTO_DISMISS_MS = 3000

interface ToastDetail {
  questionId: string | null
  title: string
  isNew: boolean
  daysUntilReview: number
}

/**
 * 提交 Accepted 后弹出的即时反馈提示。
 * 捕获逻辑（capture.ts）本身是静默的，不加这个提示的话，用户提交完全
 * 感知不到插件有没有生效——尤其是新题第一次复习要等 1 天后，
 * 当天打开复习清单看到空的很容易误以为插件没工作。
 */
export function CaptureToast() {
  const [toast, setToast] = useState<ToastDetail | null>(null)
  const [visible, setVisible] = useState(false)
  const hideTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ToastDetail>).detail
      if (!detail) return

      setToast(detail)
      setVisible(true)

      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = window.setTimeout(() => setVisible(false), AUTO_DISMISS_MS)
    }

    window.addEventListener(EVENT_NAME, handler)
    return () => {
      window.removeEventListener(EVENT_NAME, handler)
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    }
  }, [])

  const reviewText =
    toast && toast.daysUntilReview <= 0 ? "今天就要复习" : `将于 ${toast?.daysUntilReview} 天后复习`

  return (
    <div className="fixed right-4 top-4 z-[2147483647] font-sans text-sm">
      <Transition
        as={Fragment}
        show={visible}
        enter="transition ease-out duration-200"
        enterFrom="opacity-0 -translate-y-2"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-150"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 -translate-y-2">
        <div className="flex items-start gap-2 rounded-lg border border-green-100 bg-white px-4 py-3 shadow-2xl">
          <span className="text-lg leading-none" aria-hidden>
            {toast?.isNew ? "✅" : "📌"}
          </span>
          <div>
            <p className="font-semibold text-gray-800">
              {toast?.isNew ? "Added to Ebbinghaus Repeat Plan" : "This question already in your Repeat plan"}
            </p>
            {toast && (
              <p className="mt-0.5 text-xs text-gray-500">
                {formatQuestionTitle(toast)} · {reviewText}
              </p>
            )}
          </div>
        </div>
      </Transition>
    </div>
  )
}
