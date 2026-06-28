// ── OCR 服务 ──────────────────────────────────────────────
// 业务逻辑层：封装 OCR 调用、健康检查、文件校验

import { ocrFile, checkOcrHealth } from '@/lib/ocr/client'
import type { OcrHealth, OcrResult, UploadProgress } from '@/lib/ocr/types'

/** 支持的 MIME 类型 */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const
const ALLOWED_EXT = /\.(jpg|jpeg|png|pdf)$/i

/** 最大文件大小 20MB */
const MAX_SIZE = 20 * 1024 * 1024

export class OcrService {
  /**
   * 校验文件是否可识别
   */
  static validate(file: File): string | null {
    if (!(ALLOWED_TYPES as readonly string[]).includes(file.type) && !ALLOWED_EXT.test(file.name)) {
      return '仅支持 JPG / PNG / PDF 文件'
    }
    if (file.size > MAX_SIZE) {
      return `文件过大 (${(file.size / 1024 / 1024).toFixed(1)}MB)，请压缩至 20MB 以内`
    }
    if (file.size === 0) {
      return '文件为空'
    }
    return null
  }

  /**
   * 检查 OCR 服务健康状态
   */
  static async health(): Promise<OcrHealth> {
    return checkOcrHealth()
  }

  /**
   * 执行 OCR 识别
   *
   * @param file     - 文件对象
   * @param filename - 文件名（用于传给 FastAPI）
   * @param onProgress - 进度回调
   */
  static async recognize(
    file: File | Blob,
    filename: string,
    onProgress?: (p: UploadProgress) => void,
  ): Promise<OcrResult> {
    const start = performance.now()
    onProgress?.({ status: 'processing', percent: 50, message: '正在识别...' })

    try {
      const res = await ocrFile(file, filename)

      onProgress?.({ status: 'done', percent: 100, message: '识别完成' })

      return {
        success: true,
        text: res.text,
        pages: res.page_count,
        chars: res.char_count,
        elapsed: res.elapsed,
        filename: res.filename,
        raw: res,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OCR 识别失败'
      onProgress?.({ status: 'error', percent: 0, message: msg })
      return {
        success: false,
        text: '',
        pages: 0,
        chars: 0,
        elapsed: (performance.now() - start) / 1000,
        filename,
        error: msg,
      }
    }
  }

  /**
   * 格式化 OCR 文本为简洁表示（去重 + 截断）
   */
  static formatPreview(text: string, maxLen = 2000): string {
    // 去除连续重复行
    const lines = text.split('\n').filter(Boolean)
    const deduped = lines.filter((line, i) => line !== lines[i - 1])
    const joined = deduped.join('\n')
    if (joined.length <= maxLen) return joined
    return joined.slice(0, maxLen) + `\n\n...（共 ${text.length} 字符，截断显示）`
  }
}
