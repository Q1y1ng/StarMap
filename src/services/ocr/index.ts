// ── OCR 服务入口 ───────────────────────────────────────────

export { OcrMode, OcrEngine } from './types'
export type { OcrResultWithMeta, OcrQualityResult, DoubaoConfig } from './types'
export { HybridOCRService } from './hybrid-ocr.service'
export { PaddleOCRService } from './paddle-ocr.service'
export { DoubaoOCRService } from './doubao-ocr.service'
export { OcrQualityService } from './ocr-quality.service'
