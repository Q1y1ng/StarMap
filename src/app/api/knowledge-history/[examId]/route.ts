// ── Knowledge History API ──────────────────────────────
// GET /api/knowledge-history/[examId]
// 返回某次考试的知识点历史掌握率

import { NextRequest, NextResponse } from 'next/server'
import { KnowledgeHistoryService } from '@/services/knowledge-history.service'
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

    const records = await KnowledgeHistoryService.getByExam(examId)
    return NextResponse.json({ success: true, data: records })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取知识历史失败'
    console.error('[api/knowledge-history/:examId] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
