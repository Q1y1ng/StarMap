// ── AnswerSheet Get API ────────────────────────────────
// GET /api/answer-sheet/[examId]
// 获取指定考试的答题卡成绩

import { NextRequest, NextResponse } from 'next/server'
import { AnswerSheetMatchService } from '@/services/answer-sheet-match.service'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ examId: string }> },
) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const { examId } = await params

    // 校验考试所有权
    const exam = await prisma.exam.findFirst({ where: { id: examId, userId }, select: { id: true } })
    if (!exam) {
      return NextResponse.json({ success: false, error: '考试记录不存在' }, { status: 404 })
    }

    const results = await AnswerSheetMatchService.getByExamId(examId)

    return NextResponse.json({ success: true, data: results })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取成绩失败'
    console.error('[api/answer-sheet/:examId] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
