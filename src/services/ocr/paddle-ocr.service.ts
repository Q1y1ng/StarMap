// ── PaddleOCR 服务 ─────────────────────────────────────────
// 封装对本地 PaddleOCR FastAPI 服务的调用

import { OcrMode, OcrEngine, type OcrResultWithMeta } from './types'
import { OcrQualityService } from './ocr-quality.service'

const PADDLE_OCR_URL = process.env.OCR_SERVICE_URL ?? 'http://localhost:8000'

export class PaddleOCRService {
  /**
   * 调用本地 PaddleOCR 服务识别图片/PDF
   * @param file 从 FormData 中获取的 File 对象
   */
  static async recognize(
    file: File,
    mode: OcrMode,
  ): Promise<OcrResultWithMeta> {
    const start = performance.now()

    // 先做快速健康检查，避免连接超时等待 3 分钟
    const health = await this.healthCheck()
    if (!health.ok) {
      throw new Error(`PaddleOCR 服务连接失败: ${health.detail ?? '服务未启动'}`)
    }

    // 转发到 PaddleOCR FastAPI 服务
    const formData = new FormData()
    formData.append('file', file, file.name)

    const res = await fetch(`${PADDLE_OCR_URL}/ocr`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(300_000),
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
      throw new Error(errBody.detail ?? `PaddleOCR 服务错误 (${res.status})`)
    }

    const data = await res.json() as {
      text: string
      page_count: number
      char_count: number
      elapsed: number
    }

    // 评估质量
    const quality = OcrQualityService.evaluate(data.text ?? '')

    const elapsed = (performance.now() - start) / 1000

    return {
      success: true,
      text: data.text ?? '',
      pages: data.page_count ?? 1,
      chars: data.char_count ?? 0,
      elapsed,
      filename: file.name,
      engine: OcrEngine.PADDLE,
      mode,
      quality,
    }
  }

  /**
   * PaddleOCR 健康检查
   */
  static async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    try {
      const res = await fetch(`${PADDLE_OCR_URL}/health`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` }
      return { ok: true }
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : '连接失败' }
    }
  }

  /**
   * 批量识别：并行调用 PaddleOCR 处理多张图片，合并结果
   * @param files 多页图片文件
   */
  static async recognizeBatch(
    files: File[],
    mode: OcrMode,
  ): Promise<OcrResultWithMeta> {
    if (files.length === 0) throw new Error('没有文件')
    if (files.length === 1) {
      return this.recognize(files[0], mode)
    }

    const start = performance.now()

    // 并行识别所有文件
    const results = await Promise.all(
      files.map(f => this.recognize(f, mode)),
    )

    // 合并结果
    const combinedText = results.map(r => r.text).join('\n\n---\n\n')
    const totalChars = results.reduce((sum, r) => sum + r.chars, 0)
    const totalElapsed = (performance.now() - start) / 1000

    const quality = OcrQualityService.evaluate(combinedText)

    return {
      success: true,
      text: combinedText,
      pages: results.reduce((sum, r) => sum + r.pages, 0),
      chars: totalChars,
      elapsed: totalElapsed,
      filename: files.map(f => f.name).join(', '),
      engine: OcrEngine.PADDLE,
      mode,
      quality,
      details: results,
    }
  }
}
