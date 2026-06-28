// ── 题目保存 API ──────────────────────────────────
// POST  /api/questions/save
// 将解析后的题目批量保存至指定考试

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { QuestionParserService } from '@/services/question-parser.service'

const SubQuestionSchema = z.object({
  label: z.string(),
  text: z.string(),
  score: z.number().optional(),
})

const QuestionSchema = z.object({
  questionNo: z.number(),
  questionType: z.string(),
  fullScore: z.number(),
  questionText: z.string(),
  hasSubQuestions: z.boolean(),
  subQuestions: z.array(SubQuestionSchema).optional(),
  pageNumber: z.number().optional(),
})

const SaveSchema = z.object({
  examId: z.string().uuid('examId 必须是有效的 UUID'),
  questions: z.array(QuestionSchema).min(1, '至少需要 1 个题目'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = SaveSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? '参数校验失败' },
        { status: 400 },
      )
    }

    await QuestionParserService.saveToExam(parsed.data.examId, parsed.data.questions)

    return NextResponse.json({
      success: true,
      data: { count: parsed.data.questions.length },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '保存请求失败'
    console.error('[api/questions/save] Error:', message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
