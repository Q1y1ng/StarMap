// ── OCR 质量评估服务 ─────────────────────────────────────
// 评分维度：文本长度、中文占比、题号识别率、有效行比例、特殊字符
// 评分范围 0–100

import type { OcrQualityResult } from './types'

/** 中文 Unicode 范围 */
const CJK_RE = /[一-鿿㐀-䶿]/

/** 题号正则：行首数字后跟 . 、) 或 ） */
const QUESTION_NO_RE = /^\s*(\d+)\s*[.、）)]/

/** 有效行：清除空白后至少 3 个字符 */
const MIN_LINE_LENGTH = 3

/** 乱码特征字符 */
const GARBLED_RE = /[�□■※＊＠＆＃％＋＝～＾￥＄]/

export class OcrQualityService {
  /**
   * 评估 OCR 文本质量
   * @param text OCR 识别文本
   * @returns 质量评分 0–100 及原因说明
   */
  static evaluate(text: string): OcrQualityResult {
    if (!text || text.trim().length === 0) {
      return { score: 0, reason: '文本为空' }
    }

    const lines = text.split('\n')
    const nonEmptyLines = lines.filter((l) => l.trim().length > 0)
    const totalChars = text.length
    const totalNonEmptyLines = nonEmptyLines.length

    // 1. 文本长度评分 (权重 20%)
    const lengthScore = Math.min(100, (totalChars / 50) * 100) // 50 字满分
    const lengthWeight = 0.20

    // 2. 中文占比评分 (权重 25%)
    let chineseChars = 0
    for (const char of text) {
      if (CJK_RE.test(char)) chineseChars++
    }
    const chineseRatio = totalChars > 0 ? chineseChars / totalChars : 0
    const chineseScore = Math.min(100, (chineseRatio / 0.3) * 100) // 30% 占比满分
    const chineseWeight = 0.25

    // 3. 题号识别率 (权重 25%)
    let questionNoLines = 0
    for (const line of nonEmptyLines) {
      if (QUESTION_NO_RE.test(line)) questionNoLines++
    }
    const questionScore = totalNonEmptyLines > 0
      ? Math.min(100, (questionNoLines / Math.max(1, totalNonEmptyLines * 0.15)) * 100) // 约 15% 行含题号满分
      : 0
    const questionWeight = 0.25

    // 4. 有效行比例 (权重 15%)
    let validLines = 0
    for (const line of lines) {
      if (line.trim().length >= MIN_LINE_LENGTH) validLines++
    }
    const validRatio = lines.length > 0 ? validLines / lines.length : 0
    const validLineScore = Math.min(100, (validRatio / 0.5) * 100) // 50% 有效行满分
    const validLineWeight = 0.15

    // 5. 特殊字符惩罚 (权重 15%)
    let garbledCount = 0
    for (const char of text) {
      if (GARBLED_RE.test(char)) garbledCount++
    }
    const garbledPenalty = Math.min(100, (garbledCount / Math.max(1, totalChars)) * 1000) // 每 0.1% 乱码扣全分
    const garbledScore = Math.max(0, 100 - garbledPenalty)
    const garbledWeight = 0.15

    // 加权总分
    const totalScore = Math.round(
      lengthScore * lengthWeight +
      chineseScore * chineseWeight +
      questionScore * questionWeight +
      validLineScore * validLineWeight +
      garbledScore * garbledWeight
    )

    // 生成原因说明
    const reasons: string[] = []
    if (totalChars < 50) reasons.push(`文本较短(${totalChars}字)`)
    if (chineseRatio < 0.3) reasons.push(`中文占比偏低(${(chineseRatio * 100).toFixed(0)}%)`)
    if (questionNoLines === 0) reasons.push('未检测到题号')
    if (validRatio < 0.5) reasons.push(`有效行比例偏低(${(validRatio * 100).toFixed(0)}%)`)
    if (garbledCount > 0) reasons.push(`检测到${garbledCount}个乱码字符`)

    const finalScore = Math.max(0, Math.min(100, totalScore))
    return {
      score: finalScore,
      reason: reasons.length > 0 ? reasons.join('；') : '质量良好',
    }
  }
}
