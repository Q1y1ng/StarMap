// ── ExamDocument 类型定义（Phase 15） ─────────────────────
// 统一考试文档的结构化表示

export type QuestionType = 'choice' | 'fill' | 'subjective' | 'unknown'

/** 题目 */
export type Question = {
  questionNo: string
  questionType: QuestionType
  content: string
  fullScore: number | null
  knowledgePoints: string[]
}

/** 学生答案 */
export type StudentAnswer = {
  questionNo: string
  answer: string
  confidence: number
  source: string
}

/** 分数条目 */
export type QuestionScore = {
  questionNo: string
  score: number
  fullScore: number
  source: string
}

/** 错题条目 */
export type MistakeEntry = {
  questionNo: string
  lostScore: number
  rate: string
  knowledgePoint?: string
}

/** 考试元信息 */
export type ExamMetadata = {
  title: string | null
  subject: string | null
  grade: string | null
  date: string | null
  totalScore: number | null
}

/** 溯源信息 */
export type ExamTrace = {
  sourceFiles: { filename: string; pageNumber: number }[]
  ocrMode: string
  ocrQuality: number
  processingTime: number
}

/** OCR 质量评估明细 */
export type OcrQualityEvaluation = {
  title: number
  questionNo: number
  table: number
  score: number
  answer: number
  overall: number
}

/** 解析选项 */
export type ParseOptions = {
  ocrMode?: string
  ocrQuality?: number | null
  totalOcrDuration?: number
}

/**
 * Section Parser 识别的段落
 * 将 Markdown 按 ## 标题切分为独立段落，分别解析
 */
export type ParsedSections = {
  metadataSection?: string
  questionSection?: string
  answerSection?: string
  scoreSection?: string
  mistakeSection?: string
}

/** 完整结构化考试文档 */
export type ExamDocument = {
  metadata: ExamMetadata
  questions: Question[]
  answers: StudentAnswer[]
  scores: QuestionScore[]
  mistakes: MistakeEntry[]
  trace: ExamTrace
  warnings: string[]
  overallQuality: number
}
