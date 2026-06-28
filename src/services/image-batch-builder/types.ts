// ── Image Batch Builder 类型定义（Phase 15-M） ──────────────
// 多图片文档智能识别架构：图片直接进入视觉模型，无 PDF 中间层

/** 源文件信息（用于响应元数据） */
export type ImageBatchSource = {
  filename: string
  size: number
  type: string
}

/** ImageBatchBuilder 构建结果 */
export type ImageBatchResult = {
  /** 可直接传入 OCR recognizeBatch 的 File 数组（保持上传顺序） */
  files: File[]
  /** 源文件清单（PDF 仍记为一个源文件，不展开为多页） */
  sourceFiles: ImageBatchSource[]
  /** 总图片数（PDF 按页展开后计数） */
  totalPages: number
}
