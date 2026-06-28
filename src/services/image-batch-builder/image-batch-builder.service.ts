// ── ImageBatchBuilder — 多图片批次构建器（Phase 15-M） ──────
// 职责：
//   接收上传文件（图片 + PDF），按上传顺序构建统一图片批次。
//   图片 → 直接使用
//   PDF  → PdfToImagesService 逐页转为图片后加入批次
// 不分类、不合并、不转 PDF。
//
// 典型输入顺序：试卷图片 → 答题卡图片 → 小分图片
// 输出：File[] 保持原序，可直接传入 OCR recognizeBatch

import { PdfToImagesService } from '@/services/ocr/pdf-to-images.service'
import type { ImageBatchResult } from './types'

export class ImageBatchBuilder {
  /**
   * 构建图片批次
   * @param fileBuffers 上传文件的 buffer 列表（保持上传顺序）
   * @returns ImageBatchResult（File[] + 源文件信息）
   */
  static async build(
    fileBuffers: { buffer: Buffer; filename: string; size: number; mimeType: string }[],
  ): Promise<ImageBatchResult> {
    const files: File[] = []
    const sourceFiles: { filename: string; size: number; type: string }[] = []

    for (const fb of fileBuffers) {
      const ext = fb.filename.split('.').pop()?.toLowerCase()

      if (ext === 'pdf') {
        // PDF → 逐页转为图片后加入批次
        const { pages: imageBuffers, mimeType } = await PdfToImagesService.convert(fb.buffer, fb.filename)
        const pageExt = mimeType === 'image/png' ? 'png' : 'jpg'
        for (let i = 0; i < imageBuffers.length; i++) {
          const pageName = `${fb.filename.replace(/\.pdf$/i, '')}-p${i + 1}.${pageExt}`
          files.push(new File([imageBuffers[i] as BlobPart], pageName, { type: mimeType }))
        }
        // 源文件清单中 PDF 仍记为一条（不展开为多页）
        sourceFiles.push({ filename: fb.filename, size: fb.size, type: fb.mimeType })
      } else {
        // 图片文件直接使用
        const mimeType = fb.mimeType && fb.mimeType !== 'application/octet-stream'
          ? fb.mimeType
          : 'image/jpeg'
        files.push(new File([fb.buffer as BlobPart], fb.filename, { type: mimeType }))
        sourceFiles.push({ filename: fb.filename, size: fb.size, type: mimeType })
      }
    }

    return { files, sourceFiles, totalPages: files.length }
  }
}
