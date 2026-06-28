// ── VisionDocumentParser — Vision 结构化解析（Phase 15-R） ──
// Phase 15-R: 移除 ExamDocumentParser 依赖
// Vision 模式下 rawText 是唯一数据源，无需二次解析
// 此文件保留用于未来结构化标签输入场景

import type { ParsedSections } from '@/services/exam-document-parser/types'

export type DocumentParseResult = {
  metadata: {
    title?: string
    subject?: string
    grade?: string
    date?: string
    totalScore?: number
  }
  questions: Array<{
    questionNo: string
    type: 'choice' | 'fill' | 'subjective' | 'unknown'
    content: string
    fullScore: number | null
    knowledgePoints: string[]
  }>
  studentAnswers: Array<{
    questionNo: string
    answer: string
    confidence: number
  }>
  scoreBreakdowns: Array<{
    questionNo: string
    score: number
    fullScore: number
  }>
  mistakes: Array<{
    questionNo: string
    lostScore: number
    rate: string
    knowledgePoint?: string
  }>
  model: string
  durationMs: number
  sections: ParsedSections
}

export class VisionDocumentParser {
  /**
   * 自动检测输入格式并解析
   * Phase 15-R: Markdown 解析已移除（Vision 模式使用 rawText）
   */
  parse(_rawText: string, meta: {
    sourceImages: string[]
    model: string
    durationMs: number
  }): DocumentParseResult {
    // Phase 15-R: 直接返回空结构，rawText 是唯一数据源
    return {
      metadata: {},
      questions: [],
      studentAnswers: [],
      scoreBreakdowns: [],
      mistakes: [],
      model: meta.model,
      durationMs: meta.durationMs,
      sections: {},
    }
  }
}
