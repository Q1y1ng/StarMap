// ── AnswerSheet 校验器 ──────────────────────────────────

import type { AnswerSheetEntry } from './types'

export type ValidationError = {
  questionNo: number
  message: string
}

/**
 * 校验答题卡单个条目
 */
function validateEntry(entry: AnswerSheetEntry): ValidationError | null {
  if (entry.questionNo <= 0) {
    return { questionNo: entry.questionNo, message: '题号必须为正数' }
  }
  if (entry.score < 0) {
    return { questionNo: entry.questionNo, message: '得分不能为负数' }
  }
  if (entry.fullScore <= 0) {
    return { questionNo: entry.questionNo, message: '满分必须为正数' }
  }
  if (entry.score > entry.fullScore) {
    return { questionNo: entry.questionNo, message: `得分(${entry.score})不能超过满分(${entry.fullScore})` }
  }
  return null
}

/**
 * 校验整个答题卡结果
 */
export function validateAnswerSheet(entries: AnswerSheetEntry[]): {
  valid: boolean
  errors: ValidationError[]
  warnings: string[]
} {
  const errors: ValidationError[] = []
  const warnings: string[] = []

  // 逐个校验
  for (const entry of entries) {
    const err = validateEntry(entry)
    if (err) errors.push(err)
  }

  // 检查题号连续性
  const numbers = entries.map((e) => e.questionNo).sort((a, b) => a - b)
  if (numbers.length > 1) {
    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i] !== numbers[i - 1] + 1) {
        warnings.push(`题号不连续：${numbers[i - 1]} → ${numbers[i]}`)
      }
    }
  }

  // 检查重复题号
  const seen = new Set<number>()
  for (const n of numbers) {
    if (seen.has(n)) {
      warnings.push(`重复题号：第 ${n} 题出现多次`)
    }
    seen.add(n)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * 合并所有题目的总分
 */
export function sumScore(entries: AnswerSheetEntry[]): {
  totalScore: number
  totalFullScore: number
} {
  return entries.reduce(
    (acc, e) => ({
      totalScore: acc.totalScore + e.score,
      totalFullScore: acc.totalFullScore + e.fullScore,
    }),
    { totalScore: 0, totalFullScore: 0 },
  )
}
