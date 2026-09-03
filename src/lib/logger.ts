/**
 * 统一日志工具。
 * 所有日志都带有固定前缀，方便你在 Chrome DevTools 的 Console 中
 * 过滤（搜索 "Ebbinghaus-LeetCode"），并在反馈报错时直接复制日志内容给我修复。
 */
const PREFIX = "[Ebbinghaus-LeetCode]"

export const logger = {
  info: (...args: unknown[]) => console.log(PREFIX, ...args),
  warn: (...args: unknown[]) => console.warn(PREFIX, ...args),
  error: (...args: unknown[]) => console.error(PREFIX, ...args)
}
