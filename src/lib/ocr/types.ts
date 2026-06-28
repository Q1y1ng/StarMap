// ── OCR 服务类型定义 ────────────────────────────────────

/** OCR 文本块（带位置信息） */
export type OcrBox = {
  text: string
  confidence: number
  box: { x: number; y: number }[]
}

/** 单页 OCR 结果 */
export type OcrPage = {
  page: number
  text: string
  boxes: OcrBox[]
  width?: number
  height?: number
}

/** OCR 服务响应 */
export type OcrResponse = {
  success: boolean
  text: string
  pages: OcrPage[]
  page_count: number
  char_count: number
  elapsed: number
  filename: string
  file_size: number
}

/** OCR 服务健康检查 */
export type OcrHealth = {
  status: 'ok' | 'error'
  gpu: boolean
  model: string
  lang: string
  detail?: string
}

/** OCR 错误响应 */
export type OcrError = {
  detail: string
}

/** OCR 识别结果（OcrService 返回的业务层类型） */
export type OcrResult = {
  success: boolean
  text: string
  pages: number
  chars: number
  elapsed: number
  filename: string
  raw?: OcrResponse
  error?: string
}

// ── 上传进度 ──

export type UploadProgress = {
  status: 'uploading' | 'processing' | 'done' | 'error'
  percent: number
  message?: string
}
