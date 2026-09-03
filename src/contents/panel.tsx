import cssText from "data-text:~style.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"

import { ReviewPanel } from "~components/ReviewPanel"

// 只在 LeetCode 首页注入悬浮窗
export const config: PlasmoCSConfig = {
  matches: ["https://leetcode.com/", "https://leetcode.cn/"]
}

/**
 * 样式隔离方案：
 * Plasmo 会为导出 React 组件的 Content Script UI 创建一个 Shadow DOM 宿主节点，
 * 组件被挂载在 Shadow Root 内部。Shadow DOM 边界天然双向隔离样式——
 * LeetCode 页面的全局 CSS 无法穿透进来影响悬浮窗，我们的 Tailwind
 * preflight（reset 样式）也不会泄漏出去影响 LeetCode 页面本身。
 * 这里通过 getStyle 把编译后的 Tailwind CSS 文本注入到该 Shadow Root 中。
 */
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

export default function LeetCodeReviewPanel() {
  return <ReviewPanel />
}
