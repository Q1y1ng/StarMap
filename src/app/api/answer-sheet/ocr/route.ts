// ── AnswerSheet OCR API ────────────────────────────────
// POST /api/answer-sheet/ocr
// 上传答题卡 → OCR → 解析得分 → 返回结构化结果
//
// 支持三种模式（通过 mode 字段指定）：
//   LOCAL         → PaddleOCR（本地 FastAPI 服务）
//   HIGH_ACCURACY → Doubao Vision（视觉大模型）
//   SMART         → PaddleOCR → 质量不足时自动切换到 Doubao

import { NextRequest, NextResponse } from 'next/server'
import { parseAnswerSheetText } from '@/lib/answer-sheet/parser'
import { validateAnswerSheet } from '@/lib/answer-sheet/validator'
import { DoubaoOCRService, OcrMode } from '@/services/ocr'
import { OcrQualityService } from '@/services/ocr/ocr-quality.service'
import type { AnswerSheetResult } from '@/lib/answer-sheet/types'

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL ?? 'http://localhost:8000'

/**
 * Doubao 专用的答题卡识别提示词 — 输出兼容 parseAnswerSheetText 的格式
 */
const ANSWER_SHEET_DOUBAO_PROMPT = `你是一名专业答题卡识别引擎。
识别图片中的答题卡得分信息。

输出格式要求：
每行一个题目，格式为：题号 得分 满分
例如：
1 5 5
2 3 5
3 5 5

只输出数字，不要输出其他文字、解释或 Markdown 格式。

如果图片包含总分信息，最后一行输出：
总分：XXX
满分：XXX`

export async function POST(request: NextRequest) {
  try {
    // 1. 解析表单数据
    let formData: FormData
    try {
      formData = await request.formData()
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : '请求体解析失败'
      console.error(`[api/answer-sheet/ocr] FormData 解析失败:`, msg)
      return NextResponse.json(
        { success: false, error: `请求体解析失败: ${msg}. 请检查文件是否完整或重新上传.` },
        { status: 400 },
      )
    }
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: '请上传答题卡图片' },
        { status: 400 },
      )
    }

    // 2. 校验文件
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['jpg', 'jpeg', 'png', 'pdf'].includes(ext)) {
      return NextResponse.json(
        { success: false, error: '仅支持 JPG / PNG / PDF 格式' },
        { status: 400 },
      )
    }
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: '文件超过 50MB 限制' },
        { status: 413 },
      )
    }

    // 3. 获取 OCR 模式（默认 LOCAL，保持与原有行为一致）
    const modeStr = (formData.get('mode') as string | null) ?? 'LOCAL'
    let mode: OcrMode
    switch (modeStr) {
      case 'HIGH_ACCURACY':
        mode = OcrMode.HIGH_ACCURACY
        break
      case 'SMART':
        mode = OcrMode.SMART
        break
      case 'LOCAL':
      default:
        mode = OcrMode.LOCAL
        break
    }

    // 可选的用户 doubaoApiKey
    const doubaoApiKey = formData.get('doubaoApiKey') as string | null

    // 4. 根据模式选择 OCR 引擎
    let ocrText: string
    let ocrEngine: string
    let ocrQuality: number | null = null

    if (mode === OcrMode.LOCAL) {
      // ── PaddleOCR 模式 ──
      const ocrForm = new FormData()
      ocrForm.append('file', file, file.name)

      const ocrRes = await fetch(`${OCR_SERVICE_URL}/ocr`, {
        method: 'POST',
        body: ocrForm,
        signal: AbortSignal.timeout(180_000),
      })

      if (!ocrRes.ok) {
        const errBody = await ocrRes.json().catch(() => ({ detail: 'OCR 服务错误' }))
        return NextResponse.json(
          { success: false, error: errBody.detail ?? 'OCR 识别失败' },
          { status: ocrRes.status },
        )
      }

      const ocrData = await ocrRes.json()
      ocrText = ocrData.text ?? ''
      ocrEngine = 'PADDLE'
    } else if (mode === OcrMode.HIGH_ACCURACY) {
      // ── Doubao Vision 模式 ──
      const result = await DoubaoOCRService.recognizeWithPrompt(
        file,
        OcrMode.HIGH_ACCURACY,
        ANSWER_SHEET_DOUBAO_PROMPT,
        doubaoApiKey ?? undefined,
      )
      ocrText = result.text
      ocrEngine = 'DOUBAO'
      ocrQuality = result.quality.score
    } else {
      // ── SMART 模式：先 Paddle，质量不足则 Doubao ──
      const ocrForm = new FormData()
      ocrForm.append('file', file, file.name)

      const ocrRes = await fetch(`${OCR_SERVICE_URL}/ocr`, {
        method: 'POST',
        body: ocrForm,
        signal: AbortSignal.timeout(180_000),
      })

      let paddleText = ''
      if (ocrRes.ok) {
        const ocrData = await ocrRes.json()
        paddleText = ocrData.text ?? ''
      }

      const quality = OcrQualityService.evaluate(paddleText)

      if (quality.score >= 75 && paddleText.length >= 20) {
        // Paddle 结果可用
        ocrText = paddleText
        ocrEngine = 'PADDLE'
        ocrQuality = quality.score
      } else {
        // 回退到 Doubao
        const result = await DoubaoOCRService.recognizeWithPrompt(
          file,
          OcrMode.SMART,
          ANSWER_SHEET_DOUBAO_PROMPT,
          doubaoApiKey ?? undefined,
        )
        ocrText = result.text
        ocrEngine = 'DOUBAO'
        ocrQuality = result.quality.score
      }
    }

    // 5. 解析得分
    const parsed: AnswerSheetResult = parseAnswerSheetText(ocrText)
    const validation = validateAnswerSheet(parsed.entries)

    return NextResponse.json({
      success: true,
      data: parsed,
      ocr: {
        text: ocrText,
        char_count: ocrText.length,
        engine: ocrEngine,
        quality: ocrQuality,
      },
      validation,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '答题卡识别失败'
    console.error('[api/answer-sheet/ocr] Error:', message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
