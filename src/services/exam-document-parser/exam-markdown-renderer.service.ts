// ── ExamMarkdownRenderer — ExamDocument → Markdown 渲染器（Phase 15） ──
// 纯渲染层，将结构化 ExamDocument 渲染为固定格式 Markdown
// 用于向后兼容（QuestionParser 需要文本输入）

import type { ExamDocument } from './types'

export class ExamMarkdownRenderer {
  render(doc: ExamDocument): string {
    const parts: string[] = []

    // ── 考试信息 ──
    parts.push('# 考试信息')
    parts.push('')
    parts.push(`考试名称：${doc.metadata.title ?? '（未识别）'}`)
    parts.push(`科目：${doc.metadata.subject ?? '（未识别）'}`)
    parts.push(`年级：${doc.metadata.grade ?? '（未识别）'}`)
    parts.push(`日期：${doc.metadata.date ?? '（未识别）'}`)
    if (doc.metadata.totalScore != null) {
      parts.push(`总分：${doc.metadata.totalScore}`)
    }

    // ── 题目统计 ──
    if (doc.questions.length > 0) {
      parts.push('')
      parts.push('---')
      parts.push('')
      parts.push('# 题目统计')
      parts.push('')
      const choiceCount = doc.questions.filter((q) => q.questionType === 'choice').length
      const subjectiveCount = doc.questions.filter((q) => q.questionType === 'subjective').length
      parts.push(`总题数：${doc.questions.length}`)
      if (choiceCount > 0) parts.push(`选择题：${choiceCount}`)
      if (subjectiveCount > 0) parts.push(`主观题：${subjectiveCount}`)
    }

    // ── 试卷内容 ──
    if (doc.questions.length > 0) {
      parts.push('')
      parts.push('---')
      parts.push('')
      parts.push('# 试卷内容')
      parts.push('')
      for (const q of doc.questions) {
        parts.push(`### Q${q.questionNo}`)
        parts.push('')
        parts.push(q.content)
        if (q.fullScore != null) {
          parts.push('')
          parts.push(`> 分值：${q.fullScore} 分`)
        }
        parts.push('')
      }
    }

    // ── 学生作答 ──
    if (doc.answers.length > 0) {
      parts.push('---')
      parts.push('')
      parts.push('# 学生作答')
      parts.push('')
      for (const a of doc.answers) {
        parts.push(`### Q${a.questionNo}`)
        parts.push('')
        parts.push(a.answer)
        parts.push('')
      }
    }

    // ── 成绩统计 ──
    if (doc.scores.length > 0) {
      parts.push('---')
      parts.push('')
      parts.push('# 成绩统计')
      parts.push('')
      const totalScore = doc.scores.reduce((sum, s) => sum + s.score, 0)
      const totalFull = doc.scores.reduce((sum, s) => sum + s.fullScore, 0)
      const rate = totalFull > 0 ? Math.round((totalScore / totalFull) * 100) + '%' : 'N/A'
      parts.push(`总分：${totalScore}`)
      parts.push(`得分率：${rate}`)
      parts.push('')
      parts.push('| 题号 | 得分 | 满分 |')
      parts.push('|------|------|------|')
      for (const s of doc.scores) {
        parts.push(`| ${s.questionNo} | ${s.score} | ${s.fullScore} |`)
      }
    }

    // ── 数据来源 ──
    parts.push('')
    parts.push('---')
    parts.push('')
    parts.push('# 数据来源')
    parts.push('')
    parts.push(`OCR模式：${doc.trace.ocrMode}`)
    parts.push(`质量评分：${doc.trace.ocrQuality}`)
    parts.push(`处理时间：${doc.trace.processingTime.toFixed(1)}s`)

    return parts.join('\n')
  }
}
