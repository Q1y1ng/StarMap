// ── Knowledge Mastery API ──────────────────────────────
// GET /api/knowledge-mastery/[examId]  — 单次考试
// GET /api/knowledge-mastery/subject/[subject]?limit=10 — 全科目

import { NextRequest, NextResponse } from 'next/server'
import { KnowledgeMasteryService } from '@/services/knowledge-mastery.service'
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

    const mastery = await KnowledgeMasteryService.getByExam(examId)

    return NextResponse.json({ success: true, data: mastery })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取知识点掌握率失败'
    console.error('[api/knowledge-mastery/:examId] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
