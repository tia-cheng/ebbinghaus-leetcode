/**
 * 题号 / 标题相关的解析与展示格式化。
 * 单独抽出来是因为 capture.ts（解析）、ReviewItem.tsx / CaptureToast.tsx（展示）
 * 都需要用同一套"题号 + 纯标题"规则，避免各处格式不一致。
 */

export interface ParsedQuestionTitle {
  questionId: string | null
  title: string // 不含题号前缀的纯标题
}

/**
 * 把 "11. Container With Most Water" 这样的原始文本拆成题号和纯标题。
 * 拆不出题号（没有 "数字 + . " 前缀）时 questionId 为 null，title 原样返回。
 */
export function parseQuestionTitle(rawTitle: string): ParsedQuestionTitle {
  const trimmed = rawTitle.trim()
  const match = trimmed.match(/^(\d+)\.\s*(.+)$/)
  if (match) {
    return { questionId: match[1], title: match[2].trim() }
  }
  return { questionId: null, title: trimmed }
}

/** 拼回 "11. Container With Most Water" 这样的完整展示文本，用于 title 属性 / 提示文案等场景 */
export function formatQuestionTitle(record: { questionId: string | null; title: string }): string {
  return record.questionId ? `${record.questionId}. ${record.title}` : record.title
}
