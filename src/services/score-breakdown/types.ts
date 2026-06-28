// ── 小分识别类型定义（Phase 13） ─────────────────────────

/** 单题小分 */
export type ScoreBreakdownItem = {
  questionNo: number
  fullScore: number
  score: number
  lostScore: number
}

/** OCR 识别结果 */
export type ScoreBreakdownOcrResult = {
  success: boolean
  items: ScoreBreakdownItem[]
  rawText: string
  totalScore?: number
  totalFullScore?: number
}

/** 保存请求 */
export type ScoreBreakdownSaveInput = {
  examId: string
  items: ScoreBreakdownItem[]
}
