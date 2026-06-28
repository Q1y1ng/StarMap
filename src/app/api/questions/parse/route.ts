// ── 题目解析 API ──────────────────────────────────
// POST  /api/questions/parse
// 接收 OCR 文本，调用 AI 解析为结构化题目

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { QuestionParserService } from '@/services/question-parser.service'

const ParseSchema = z.object({
  text: z
    .string()
    .min(10, '试题文本至少 10 个字符')
    .max(50000, '试题文本最多 50000 个字符'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = ParseSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? '参数校验失败' },
        { status: 400 },
      )
    }

    const result = await QuestionParserService.parse(parsed.data.text)

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : '解析请求失败'
    console.error('[api/questions/parse] Error:', message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
