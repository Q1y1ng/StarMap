// ── POST /api/score-breakdown/ocr ──
// 上传小分页面截图 → Doubao OCR 识别 → 返回 ScoreBreakdown[]

import { NextRequest, NextResponse } from 'next/server'
import { ScoreBreakdownService } from '@/services/score-breakdown/score-breakdown.service'

export async function POST(request: NextRequest) {
  try {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { success: false, error: '请求体解析失败，请重新上传' },
        { status: 400 },
      )
    }

    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: '请上传小分页面截图' },
        { status: 400 },
      )
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['jpg', 'jpeg', 'png'].includes(ext)) {
      return NextResponse.json(
        { success: false, error: '仅支持 JPG / PNG 图片' },
        { status: 400 },
      )
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: '文件超过 20MB 限制' },
        { status: 413 },
      )
    }

    // 可选的用户 doubaoApiKey（覆盖环境变量）
    const doubaoApiKey = formData.get('doubaoApiKey') as string | null

    const result = await ScoreBreakdownService.recognizeFromImage(file, doubaoApiKey ?? undefined)

    if (!result.success || result.items.length === 0) {
      return NextResponse.json({
        success: false,
        error: '未能从小分页面中识别到有效数据，请检查图片是否清晰',
        rawText: result.rawText,
        items: [],
      })
    }

    const totalFullScore = result.items.reduce((s, i) => s + i.fullScore, 0)
    const totalScore = result.items.reduce((s, i) => s + i.score, 0)

    return NextResponse.json({
      success: true,
      data: {
        items: result.items,
        totalScore,
        totalFullScore,
        itemCount: result.items.length,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '小分识别失败'
    console.error('[api/score-breakdown/ocr] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
