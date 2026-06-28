// ── 统一 OCR API 路由 ─────────────────────────────────────
// 支持三种模式：
//   LOCAL         → PaddleOCR（本地 FastAPI 服务）
//   SMART         → PaddleOCR → 质量评估 → <75 → Doubao Vision
//   HIGH_ACCURACY → Doubao Vision（视觉大模型）
//
// POST /api/ocr      — OCR 识别（支持 mode 参数）
// GET  /api/ocr/health — 各引擎健康状态

import { NextRequest, NextResponse } from 'next/server'
import { HybridOCRService, OcrMode } from '@/services/ocr'

export async function POST(request: NextRequest) {
  try {
    // 1. 解析表单数据
    let formData: FormData
    try {
      formData = await request.formData()
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : '请求体解析失败'
      console.error('[api/ocr] FormData 解析失败:', msg)
      return NextResponse.json(
        { success: false, error: `请求体解析失败: ${msg}. 请检查文件是否完整或重新上传.` },
        { status: 400 },
      )
    }

    // 2. 获取 OCR 模式（默认 SMART）
    const modeStr = (formData.get('mode') as string | null) ?? 'SMART'
    let mode: OcrMode
    switch (modeStr) {
      case 'LOCAL':
        mode = OcrMode.LOCAL
        break
      case 'HIGH_ACCURACY':
        mode = OcrMode.HIGH_ACCURACY
        break
      case 'SMART':
      default:
        mode = OcrMode.SMART
        break
    }

    // 3. 获取文件（支持单文件和多文件批量上传）
    const files = formData.getAll('file').filter((f): f is File => f instanceof File)

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: '请上传文件' },
        { status: 400 },
      )
    }

    // 4. 校验文件类型和大小（所有文件逐一校验）
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ext || !['jpg', 'jpeg', 'png', 'pdf'].includes(ext)) {
        return NextResponse.json(
          { success: false, error: `文件 "${file.name}" 格式不支持，仅支持 JPG / PNG / PDF` },
          { status: 400 },
        )
      }
      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: `文件 "${file.name}" 超过 50MB 限制` },
          { status: 413 },
        )
      }
    }

    // 5b. 获取可选的 doubaoApiKey（用户通过设置传入，覆盖环境变量）
    const doubaoApiKey = formData.get('doubaoApiKey') as string | null

    // 6. 调用 Hybrid OCR 服务（批量或单张）
    const result = files.length === 1
      ? await HybridOCRService.recognize(files[0], mode, doubaoApiKey ?? undefined)
      : await HybridOCRService.recognizeBatch(files, mode, doubaoApiKey ?? undefined)

    // 7. 返回结果（兼容旧版字段 + 新增 OCR 元数据）
    return NextResponse.json({
      success: true,
      text: result.text,
      pages: result.pages,
      page_count: result.pages,
      char_count: result.chars,
      elapsed: result.elapsed,
      filename: result.filename,
      // 新增 OCR 元数据
      ocrMode: result.mode,
      ocrEngine: result.engine,
      ocrQuality: result.quality.score,
      ocrQualityReason: result.quality.reason,
      ocrDurationMs: Math.round(result.elapsed * 1000),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OCR 请求失败'
    console.error('[api/ocr] Error:', message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}

/**
 * GET /api/ocr/health — 各 OCR 引擎健康状态
 */
export async function GET() {
  try {
    const health = await HybridOCRService.healthCheck()
    return NextResponse.json({
      success: true,
      data: health,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '健康检查失败'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
