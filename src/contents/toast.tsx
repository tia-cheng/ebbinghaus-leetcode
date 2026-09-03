import cssText from "data-text:~style.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"

import { CaptureToast } from "~components/CaptureToast"

// 只在题目页生效——提交发生在这里，提示也应该在这里弹出
export const config: PlasmoCSConfig = {
  matches: ["https://leetcode.com/problems/*", "https://leetcode.cn/problems/*"]
}

// 与 panel.tsx 相同的 Shadow DOM 样式隔离方案，见该文件注释
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

export default function LeetCodeCaptureToast() {
  return <CaptureToast />
}
