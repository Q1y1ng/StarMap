// ── VisionDocument — 系统一级数据源（Phase 15-N） ───────────
// Vision 模型直接输出的结构化文档，替代旧 OCR 中间层。
// 所有上层服务（QuestionParser、KnowledgeGraph、Analysis）均基于此类型工作。

/** Vision 题目类型 */
export type VisionQuestionType = 'choice' | 'fill' | 'subjective' | 'unknown'

/** Vision 题目 */
export type VisionQuestion = {
  questionNo: string
  type: VisionQuestionType
  content: string
  fullScore: number | null
  knowledgePoints: string[]
  /** 对应 sourceImages 中的索引，用于定位原始图片 */
  sourceImageIndex?: number
  /** 在源图片中的页码（PDF 按页展开后） */
  pageIndex?: number
}

/** Vision 学生答案 */
export type VisionAnswer = {
  questionNo: string
  answer: string
  confidence: number
}

/** Vision 分数条目 */
export type VisionScore = {
  questionNo: string
  score: number
  fullScore: number
}

/** Vision 错题条目 */
export type VisionMistake = {
  questionNo: string
  lostScore: number
  rate: string
  knowledgePoint?: string
}

/** Vision 完整文档 — 系统核心数据源 */
export type VisionDocument = {
  metadata: {
    subject?: string
    grade?: string
    title?: string
    date?: string
    totalScore?: number
  }
  questions: VisionQuestion[]
  studentAnswers: VisionAnswer[]
  scoreBreakdowns: VisionScore[]
  mistakes: VisionMistake[]
  /** 源图片文件名列表（保持上传顺序） */
  sourceImages: string[]
  /** 使用的模型标识 */
  model: string
  /** 处理总耗时（毫秒） */
  durationMs: number

  /** 原始模型输出文本 — Vision 模式唯一数据源（Phase 15-R） */
  rawText: string
}
