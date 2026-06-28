// ── AnswerSheet 解析器（规则 + AI 混合） ──────────────
// 将 OCR 文本中的得分表解析为结构化数据
//
// 支持的格式：
//   表格格式：1  5  5
//   内联格式：1. 5分  2. 3分
//   行列格式：选择题（每题5分）1 2 3 / 5 5 5

import type { AnswerSheetEntry, AnswerSheetResult } from './types'

// ── 正则模式 ──────────────────────────────────────

/** 三列格式：题号 得分 满分 */
const TRIPLE_RE = /^\s*(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/

/** 两列格式：题号 得分（满分从表头推断） */
const PAIR_RE = /^\s*(\d+)\s+(\d+(?:\.\d+)?)\s*$/

/** 内联格式：1. 5/5 或 1. 5分(5分) */
const INLINE_RE = /(\d+)\s*[.、）)]\s*(\d+(?:\.\d+)?)\s*[分/（(]\s*(\d+(?:\.\d+)?)\s*[分)）]?/g

/** 简单分数格式：1: 5/5 */
const SLASH_RE = /(\d+)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/g

// ── 核心解析策略 ──────────────────────────────────

/**
 * 策略1：按行解析三列表格
 */
function parseTripleColumns(lines: string[]): AnswerSheetEntry[] {
  const entries: AnswerSheetEntry[] = []
  for (const line of lines) {
    const m = line.match(TRIPLE_RE)
    if (m) {
      entries.push({
        questionNo: parseInt(m[1]),
        score: parseFloat(m[2]),
        fullScore: parseFloat(m[3]),
      })
    }
  }
  return entries
}

/**
 * 策略2：提取内联格式 `1. 5/5  2. 3/5`
 */
function parseInlineFormat(text: string): AnswerSheetEntry[] {
  const entries: AnswerSheetEntry[] = []
  const seen = new Set<number>()

  // Try SLASH format first
  let m: RegExpExecArray | null
  const slashRe = new RegExp(SLASH_RE.source, 'g')
  while ((m = slashRe.exec(text)) !== null) {
    const questionNo = parseInt(m[1])
    const score = parseFloat(m[2])
    const fullScore = parseFloat(m[3])
    if (!seen.has(questionNo)) {
      seen.add(questionNo)
      entries.push({ questionNo, score, fullScore })
    }
  }

  // Try INLINE format
  const inlineRe = new RegExp(INLINE_RE.source, 'g')
  while ((m = inlineRe.exec(text)) !== null) {
    const questionNo = parseInt(m[1])
    const score = parseFloat(m[2])
    const fullScore = parseFloat(m[3])
    if (!seen.has(questionNo)) {
      seen.add(questionNo)
      entries.push({ questionNo, score, fullScore })
    }
  }

  return entries.sort((a, b) => a.questionNo - b.questionNo)
}

/**
 * 策略3：从表头提取满分，然后解析两列数据
 * 格式："选择题（每题5分）" + 多行 "1 5"
 */
function parseWithHeaderFullScore(lines: string[]): AnswerSheetEntry[] {
  let currentFullScore = 0
  const entries: AnswerSheetEntry[] = []

  for (const line of lines) {
    // 检查表头：满分声明
    const headerMatch = line.match(/(?:每[题目]\s*)?(\d+(?:\.\d+)?)\s*分/)
    if (headerMatch) {
      currentFullScore = parseFloat(headerMatch[1])
      continue
    }

    // 检查两列数据
    if (currentFullScore > 0) {
      const pairMatch = line.match(PAIR_RE)
      if (pairMatch) {
        entries.push({
          questionNo: parseInt(pairMatch[1]),
          score: parseFloat(pairMatch[2]),
          fullScore: currentFullScore,
        })
      }
    }
  }

  return entries
}

/**
 * 策略4：最简单的自动配对
 * 当文本几乎全是数字时，尝试两两/三三配对
 */
function parseSimpleNumberPairs(lines: string[]): AnswerSheetEntry[] {
  const allNumbers: number[] = []
  for (const line of lines) {
    const nums = line.match(/\d+(?:\.\d+)?/g)
    if (nums) {
      allNumbers.push(...nums.map(Number))
    }
  }

  if (allNumbers.length < 2) return []

  // 假设三分一组：questionNo, score, fullScore
  if (allNumbers.length >= 3) {
    const entries: AnswerSheetEntry[] = []
    for (let i = 0; i + 2 < allNumbers.length; i += 3) {
      entries.push({
        questionNo: allNumbers[i],
        score: allNumbers[i + 1],
        fullScore: allNumbers[i + 2],
      })
    }
    if (entries.length > 0) return entries
  }

  // 假设两分一组：questionNo, score（使用常见满分 5）
  const entries: AnswerSheetEntry[] = []
  for (let i = 0; i + 1 < allNumbers.length; i += 2) {
    entries.push({
      questionNo: allNumbers[i],
      score: allNumbers[i + 1],
      fullScore: 5,
    })
  }
  return entries
}

/**
 * 策略5：解析 Doubao 输出的键值对格式
 * 题号：12\n得分：8\n满分：12\n扣分：4
 * 以及 Markdown 表格格式：
 * | 题号 | 满分 | 得分 | 扣分 |
 * | 1 | 5 | 5 | 0 |
 */
function parseKvFormat(text: string): AnswerSheetEntry[] {
  const entries: AnswerSheetEntry[] = []

  // 尝试匹配 Markdown 表格行：| 1 | 5 | 5 | 0 |
  const tableRowRegex = /^\|\s*(\d+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/gm
  let m: RegExpExecArray | null
  while ((m = tableRowRegex.exec(text)) !== null) {
    const questionNo = parseInt(m[1], 10)
    const fullScore = parseFloat(m[2])
    const score = parseFloat(m[3])
    if (!isNaN(questionNo) && !isNaN(fullScore) && !isNaN(score)) {
      entries.push({ questionNo, score, fullScore })
    }
  }
  if (entries.length > 0) return entries

  // 尝试匹配键值对格式：题号：XX 得分：XX 满分：XX
  const seen = new Set<number>()
  const kvBlockRegex = /题号[：:]\s*(\d+)[\s\S]*?得分[：:]\s*([\d.]+)[\s\S]*?满分[：:]\s*([\d.]+)/gi
  while ((m = kvBlockRegex.exec(text)) !== null) {
    const questionNo = parseInt(m[1], 10)
    const score = parseFloat(m[2])
    const fullScore = parseFloat(m[3])
    if (!isNaN(questionNo) && !isNaN(fullScore) && !isNaN(score) && !seen.has(questionNo)) {
      seen.add(questionNo)
      entries.push({ questionNo, score, fullScore })
    }
  }

  return entries
}

/**
 * 将 OCR 文本解析为结构化答题卡数据
 * 尝试多种策略，返回匹配条目最多的结果
 */
export function parseAnswerSheetText(ocrText: string): AnswerSheetResult {
  const lines = ocrText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  // 尝试各策略
  const strategies = [
    () => parseTripleColumns(lines),
    () => parseWithHeaderFullScore(lines),
    () => parseInlineFormat(ocrText),
    () => parseKvFormat(ocrText),
    () => parseSimpleNumberPairs(lines),
  ]

  let best: AnswerSheetEntry[] = []
  for (const strategy of strategies) {
    const result = strategy()
    if (result.length > best.length) {
      best = result
    }
  }

  // 去重（保留每个题号第一个）
  const seen = new Set<number>()
  const deduped = best.filter((e) => {
    if (seen.has(e.questionNo)) return false
    seen.add(e.questionNo)
    return true
  })

  // 按题号排序
  deduped.sort((a, b) => a.questionNo - b.questionNo)

  const totalScore = deduped.reduce((s, e) => s + e.score, 0)
  const totalFullScore = deduped.reduce((s, e) => s + e.fullScore, 0)

  return {
    entries: deduped,
    totalScore,
    totalFullScore,
    entryCount: deduped.length,
  }
}
