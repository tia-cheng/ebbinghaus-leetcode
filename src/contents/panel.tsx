import cssText from "data-text:~style.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"

import { ReviewPanel } from "~components/ReviewPanel"

// [CHANGED] matches 已从"仅首页"放开为站内全量页面（含 /problems/*、讨论区等），
// 悬浮窗现在会在整个 leetcode.com / leetcode.cn 站内常驻显示
export const config: PlasmoCSConfig = {
  matches: ["https://leetcode.com/*", "https://leetcode.cn/*"]
}

/**
 * 样式隔离方案：
 * Plasmo 会为导出 React 组件的 Content Script UI 创建一个 Shadow DOM 宿主节点，
 * 组件被挂载在 Shadow Root 内部。Shadow DOM 边界天然双向隔离样式——
 * LeetCode 页面的全局 CSS 无法穿透进来影响悬浮窗，我们的 Tailwind
 * preflight（reset 样式）也不会泄漏出去影响 LeetCode 页面本身。
 * 这里通过 getStyle 把编译后的 Tailwind CSS 文本注入到该 Shadow Root 中。
 *
 * [CHANGED] 关于不被 /problems/* 页面的 Monaco Editor / 拖拽 Splitter 遮挡：
 * 这里没有导出 getRootContainer / getInlineAnchor / getOverlayAnchor，
 * Plasmo 在这种情况下的默认行为是把 Shadow Host 直接挂载为 <body> 的
 * 直接子节点（而不是塞进 LeetCode 自己那套很深、可能带 transform 的布局树里）。
 * position: fixed 的包含块由此稳定为视口本身，不会被 Splitter/Monaco 内部
 * 任何 transform/overflow 容器"捕获"或裁剪。z-index 的具体设置见
 * ReviewPanel.tsx（用的是 CSS 允许的最大值，比需求里的 99999 更保险）。
 */
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

export default function LeetCodeReviewPanel() {
  return <ReviewPanel />
}
