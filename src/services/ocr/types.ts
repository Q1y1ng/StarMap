// ── OCR 服务类型定义 ──────────────────────────────────────

/** OCR 模式枚举（与 Prisma OcrMode 一致） */
export enum OcrMode {
  LOCAL = 'LOCAL',
  SMART = 'SMART',
  HIGH_ACCURACY = 'HIGH_ACCURACY',
}

/** OCR 引擎枚举（与 Prisma OcrEngine 一致） */
export enum OcrEngine {
  PADDLE = 'PADDLE',
  DOUBAO = 'DOUBAO',
}

/** OCR 质量评估结果 */
export type OcrQualityResult = {
  score: number // 0–100
  reason: string
}

/** OCR 识别结果（含引擎元数据） */
export type OcrResultWithMeta = {
  success: boolean
  text: string
  pages: number
  chars: number
  elapsed: number // 秒
  filename: string
  engine: OcrEngine
  mode: OcrMode
  quality: OcrQualityResult
  error?: string
  /** 批量处理时，每个文件的独立结果（仅 Hybrid 层设置） */
  details?: OcrResultWithMeta[]
}

/** PaddleOCR 服务原始响应 */
export type PaddleOcrResponse = {
  success: boolean
  text: string
  pages: { page: number; text: string; boxes: { text: string; confidence: number; box: { x: number; y: number }[] }[] }[]
  page_count: number
  char_count: number
  elapsed: number
  filename: string
  file_size: number
}

/** Doubao Vision API 配置 */
export type DoubaoConfig = {
  apiKey: string
  model: string
  baseUrl: string
}
