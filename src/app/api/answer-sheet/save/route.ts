// ── AnswerSheet Save API ───────────────────────────────
// POST /api/answer-sheet/save
// 保存答题卡得分 → 匹配题目 → 生成 QuestionResult

import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { AnswerSheetMatchService } from '@/services/answer-sheet-match.service'
import { KnowledgeHistoryService } from '@/services/knowledge-history.service'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const SaveSchema = z.object({
  examId: z.string().uuid('无效的考试 ID'),
  entries: z
    .array(
      z.object({
        questionNo: z.number().int().positive(),
        score: z.number().min(0),
        fullScore: z.number().min(0),
      }),
    )
    .min(1, '至少需要 1 个题目得分'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = SaveSchema.parse(body)

    // 校验考试所有权
    const exam = await prisma.exam.findFirst({ where: { id: parsed.examId, userId }, select: { id: true } })
    if (!exam) {
      return NextResponse.json({ success: false, error: '考试记录不存在' }, { status: 404 })
    }

    // 匹配题目
    const matched = await AnswerSheetMatchService.match(parsed.examId, parsed.entries)

    if (matched.length === 0) {
      return NextResponse.json(
        { success: false, error: '未能匹配到任何题目，请检查题号是否正确' },
        { status: 400 },
      )
    }

    // 保存结果
    const count = await AnswerSheetMatchService.saveResults(parsed.examId, matched)

    // 自动生成知识点历史掌握率（非阻塞，失败不影响保存）
    try {
      await KnowledgeHistoryService.generateForExam(parsed.examId)
    } catch (historyErr) {
      console.error('[api/answer-sheet/save] 知识历史生成失败（非阻塞）:', historyErr)
    }

    return NextResponse.json({
      success: true,
      data: {
        count,
        matchedCount: matched.length,
        unmatchedCount: parsed.entries.length - matched.length,
        results: matched,
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
    console.error('[api/answer-sheet/save] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
