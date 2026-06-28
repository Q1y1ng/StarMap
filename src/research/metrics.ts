// ── 评价指标实现（Phase 16-B） ────────────────────────────
// QA / AA / SA / DSR 四项核心指标
// 基于 Ground Truth Markdown 与 Vision 输出 Markdown 的结构化比较

import type { BenchmarkMetrics } from './dataset'

// ════════════════════════════════════════════════════════════
// 结构化解析
// ════════════════════════════════════════════════════════════

/** 解析后的考试数据结构 */
export interface ParsedExam {
  /** 题目列表 [题号, 题目内容][] */
  questions: Array<[string, string]>
  /** 答案列表 [题号, 答案内容][] */
  answers: Array<[string, string]>
  /** 分数列表 [题号, 得分, 满分][] */
  scores: Array<[string, number, number]>
  /** 检测到的章节列表 */
  sections: string[]
}

/** 系统提示词中定义的必含章节 */
const REQUIRED_SECTIONS = ['考试信息', '试卷内容', '学生作答', '成绩信息', '小分']

/**
 * 从 Markdown 中提取章节标题行
 */
function extractSections(markdown: string): string[] {
  const sections: string[] = []
  for (const line of markdown.split('\n')) {
    const match = line.match(/^##\s+(.+)$/)
    if (match) {
      sections.push(match[1].trim())
    }
  }
  return sections
}

/**
 * 提取指定章节下的文本内容（不含子章节）
 */
function extractSectionContent(markdown: string, sectionTitle: string): string {
  const lines = markdown.split('\n')
  let inSection = false
  const content: string[] = []

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)$/)
    if (headerMatch) {
      if (inSection) break // 遇到下一个同级标题即停止
      if (headerMatch[1].trim().startsWith(sectionTitle.replace(/[/\\]/g, '').trim())) {
        inSection = true
      }
      continue
    }
    if (inSection && line.trim()) {
      content.push(line)
    }
  }
  return content.join('\n')
}

/**
 * 从一行文本中提取题号
 * 支持格式: "1.", "1．", "**1.**", "1)", "（1）", "- 1."
 */
function extractQuestionNumber(line: string): string | null {
  const patterns = [
    /^\*\*(\d+)\*\*[．.]/,       // **1.**
    /^(\d+)[．.]\s*/,             // 1. 或 1．
    /^(\d+)\)\s*/,                // 1)
    /^[（(](\d+)[）)]\s*/,        // （1）
    /^-\s*(\d+)[．.]\s*/,         // - 1.
  ]
  for (const pattern of patterns) {
    const m = line.match(pattern)
    if (m) return m[1]
  }
  return null
}

/**
 * 提取分数行中的 [题号, 得分, 满分]
 * 支持 Markdown 表格行: "| 1 | 5 | 5 | ..." 或 "1. 5/5"
 */
function extractScoreEntry(line: string): [string, number, number] | null {
  // 表格格式: | 1 | 5 | 5 | 知识点 |
  const tableMatch = line.match(/^\|\s*(\d+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/)
  if (tableMatch) {
    return [tableMatch[1], parseFloat(tableMatch[2]), parseFloat(tableMatch[3])]
  }
  // 行内格式: 1. 5/5
  const inlineMatch = line.match(/^(\d+)[．.]\s*([\d.]+)\s*\/\s*([\d.]+)/)
  if (inlineMatch) {
    return [inlineMatch[1], parseFloat(inlineMatch[2]), parseFloat(inlineMatch[3])]
  }
  return null
}

/**
 * 解析 Markdown 为结构化考试数据
 *
 * 从 Ground Truth 或 Vision 输出的 Markdown 中提取
 * 题目、答案、分数信息，用于后续指标计算。
 */
export function parseExamMarkdown(markdown: string): ParsedExam {
  const sections = extractSections(markdown)

  // ── 解析题目 ──
  const questions: Array<[string, string]> = []
  const examContent = extractSectionContent(markdown, '试卷内容')
  for (const line of examContent.split('\n')) {
    const num = extractQuestionNumber(line.trim())
    if (num) {
      // 去除题号和格式标记
      const content = line.trim()
        .replace(/^\*\*(\d+)\*\*[．.]\s*/, '')
        .replace(/^(\d+)[．.)]\s*/, '')
        .replace(/^[（(](\d+)[）)]\s*/, '')
      questions.push([num, content])
    }
  }

  // ── 解析答案 ──
  const answers: Array<[string, string]> = []
  const answerContent = extractSectionContent(markdown, '学生作答')
  if (answerContent) {
    for (const line of answerContent.split('\n')) {
      const trimmed = line.trim()
      // 跳过表格标题行
      if (trimmed.startsWith('|') && (trimmed.includes('题号') || trimmed.includes('---'))) continue
      const num = extractQuestionNumber(trimmed)
      if (num) {
        const content = trimmed
          .replace(/^\*\*(\d+)\*\*[．.]\s*/, '')
          .replace(/^(\d+)[．.)]\s*/, '')
          .replace(/^[（(](\d+)[）)]\s*/, '')
        answers.push([num, content])
      } else {
        // 表格行: | 1 | A |
        const ansTableMatch = trimmed.match(/^\|\s*(\d+)\s*\|\s*([^|]+)\s*\|/)
        if (ansTableMatch) {
          answers.push([ansTableMatch[1], ansTableMatch[2].trim()])
        }
      }
    }
  }

  // ── 解析分数 ──
  const scores: Array<[string, number, number]> = []
  // 优先从小分/错题汇总提取
  let scoreContent = extractSectionContent(markdown, '小分')
  if (!scoreContent) {
    // 降级到成绩信息
    scoreContent = extractSectionContent(markdown, '成绩信息')
  }
  if (scoreContent) {
    for (const line of scoreContent.split('\n')) {
      const entry = extractScoreEntry(line.trim())
      if (entry) scores.push(entry)
    }
  }

  return { questions, answers, scores, sections }
}

// ════════════════════════════════════════════════════════════
// 相似度计算
// ════════════════════════════════════════════════════════════

/**
 * 计算两个字符串的编辑距离相似度（0–1）
 * 用于容忍模型输出的微小格式差异
 */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0
  if (a.length === 0 || b.length === 0) return 0.0

  // 使用 Dice 系数: 2 * |intersection| / (|a| + |b|)
  const bigramsA = new Set<string>()
  const bigramsB = new Set<string>()

  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2))
  for (let i = 0; i < b.length - 1; i++) bigramsB.add(b.slice(i, i + 2))

  let intersection = 0
  for (const bigram of bigramsA) {
    if (bigramsB.has(bigram)) intersection++
  }

  const union = bigramsA.size + bigramsB.size
  return union === 0 ? 1.0 : (2 * intersection) / union
}

// ════════════════════════════════════════════════════════════
// 指标计算
// ════════════════════════════════════════════════════════════

/**
 * Question Accuracy (QA) — 题目识别准确率
 *
 * 判断 Vision 输出是否正确识别了所有题目。
 * 算法：逐题号匹配，若题号存在于 Vision 输出中且内容相似度 ≥ 阈值，计为匹配。
 */
export function calculateQA(groundTruth: string, visionOutput: string): number {
  const gt = parseExamMarkdown(groundTruth)
  const vo = parseExamMarkdown(visionOutput)

  if (gt.questions.length === 0) return 0

  const gtMap = new Map(gt.questions)
  const voMap = new Map(vo.questions)
  let matched = 0

  for (const [num, content] of gt.questions) {
    if (!voMap.has(num)) continue
    const voContent = voMap.get(num)!
    // 严格匹配题号即认可（题号即识别成功）
    // 内容相似度作为辅助
    const sim = stringSimilarity(content, voContent)
    if (sim >= 0.3) matched++
  }

  return parseFloat(((matched / gt.questions.length) * 100).toFixed(2))
}

/**
 * Answer Accuracy (AA) — 答案识别准确率
 *
 * 判断 Vision 输出是否正确识别了学生作答。
 * 算法：逐题号匹配答案。
 */
export function calculateAA(groundTruth: string, visionOutput: string): number {
  const gt = parseExamMarkdown(groundTruth)
  const vo = parseExamMarkdown(visionOutput)

  if (gt.answers.length === 0) return 0

  const gtMap = new Map(gt.answers)
  const voMap = new Map(vo.answers)
  let matched = 0

  for (const [num, content] of gt.answers) {
    if (!voMap.has(num)) continue
    const voContent = voMap.get(num)!
    const sim = stringSimilarity(content, voContent)
    if (sim >= 0.3) matched++
  }

  return parseFloat(((matched / gt.answers.length) * 100).toFixed(2))
}

/**
 * Score Accuracy (SA) — 成绩识别准确率
 *
 * 判断 Vision 输出是否正确提取了各题得分。
 * 算法：逐题号匹配得分值。
 */
export function calculateSA(groundTruth: string, visionOutput: string): number {
  const gt = parseExamMarkdown(groundTruth)
  const vo = parseExamMarkdown(visionOutput)

  if (gt.scores.length === 0) return 0

  const gtMap = new Map(gt.scores.map(([num, score]) => [num, score]))
  const voMap = new Map(vo.scores.map(([num, score]) => [num, score]))
  let matched = 0

  for (const [num, score] of gt.scores) {
    if (!voMap.has(num)) continue
    if (voMap.get(num) === score) matched++
  }

  return parseFloat(((matched / gt.scores.length) * 100).toFixed(2))
}

/**
 * Document Success Rate (DSR) — 完整文档成功率
 *
 * 判断 Vision 输出是否覆盖了全部必含章节。
 * 算法：(识别的必含章节数 / 总必含章节数) × 100
 */
export function calculateDSR(groundTruth: string, visionOutput: string): number {
  const vo = parseExamMarkdown(visionOutput)

  const voSectionSet = new Set(vo.sections.map(s => s.trim()))
  let matched = 0

  for (const required of REQUIRED_SECTIONS) {
    for (const vs of voSectionSet) {
      if (vs.includes(required) || required.includes(vs)) {
        matched++
        break
      }
    }
  }

  return parseFloat(((matched / REQUIRED_SECTIONS.length) * 100).toFixed(2))
}

/**
 * 计算全部四项指标
 */
export function calculateAll(groundTruth: string, visionOutput: string): BenchmarkMetrics {
  return {
    qa: calculateQA(groundTruth, visionOutput),
    aa: calculateAA(groundTruth, visionOutput),
    sa: calculateSA(groundTruth, visionOutput),
    dsr: calculateDSR(groundTruth, visionOutput),
  }
}
