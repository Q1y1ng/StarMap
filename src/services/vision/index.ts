// ── Vision Service 入口（Phase 15-N） ──────────────────────
// Vision-Native 架构 — 模型直接输出结构化文档

export { VisionService } from './vision.service'
export type { VisionServiceResult, VisionServiceOptions } from './vision.service'
export { DoubaoVisionProvider } from './doubao-vision-provider'
export { ImageFingerprintService } from './image-fingerprint.service'
export { VisionFallbackService } from './vision-fallback.service'
export { VisionDocumentParser } from './vision-document-parser.service'
export type { DocumentParseResult } from './vision-document-parser.service'
export type { VisionProvider, ImageContext, VisionOptions, VisionProviderConstructor }
  from './vision-provider'
