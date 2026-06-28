// ── AnswerSheet 类型定义（Phase 4） ──────────────────────

/** 答题卡单题得分 */
export type AnswerSheetEntry = {
  questionNo: number
  score: number
  fullScore: number
}

/** 答题卡解析结果 */
export type AnswerSheetResult = {
  entries: AnswerSheetEntry[]
  totalScore: number
  totalFullScore: number
  entryCount: number
}

/** 答题卡上传进度 */
export type AnswerSheetProgress = {
  status: 'uploading' | 'ocr' | 'parsing' | 'done' | 'error'
  percent: number
  message?: string
}
