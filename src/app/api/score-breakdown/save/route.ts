// ── POST /api/score-breakdown/save ──
// 保存小分识别结果到数据库，更新 QuestionResult

import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { ScoreBreakdownService } from '@/services/score-breakdown/score-breakdown.service'
import { KnowledgeHistoryService } from '@/services/knowledge-history.service'

const SaveSchema = z.object({
  examId: z.string().uuid('无效的考试 ID'),
  items: z
    .array(
      z.object({
        questionNo: z.number().int().positive(),
        fullScore: z.number().min(0),
        score: z.number().min(0),
        lostScore: z.number().min(0).optional(),
      }),
    )
    .min(1, '至少需要 1 条小分数据'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = SaveSchema.parse(body)

    // 补全 lostScore
    const items = parsed.items.map((item) => ({
      ...item,
      lostScore: item.lostScore ?? Math.max(0, item.fullScore - item.score),
    }))

    const result = await ScoreBreakdownService.save(parsed.examId, items)

    // 非阻塞：更新知识点历史掌握率
    try {
      await KnowledgeHistoryService.generateForExam(parsed.examId)
    } catch (historyErr) {
      console.error('[api/score-breakdown/save] 知识历史更新失败（非阻塞）:', historyErr)
    }

    return NextResponse.json({
      success: true,
      data: {
        count: result.count,
        matchedCount: result.matchedCount,
        unmatchedCount: result.count - result.matchedCount,
      },
    })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: '数据格式有误：' + err.issues.map((e) => e.message).join('；') },
        { status: 400 },
      )
    }
    const message = err instanceof Error ? err.message : '保存失败'
    console.error('[api/score-breakdown/save] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
