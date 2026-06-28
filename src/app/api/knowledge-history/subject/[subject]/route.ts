// ── Knowledge History (Subject) API ───────────────────
// GET /api/knowledge-history/subject/[subject]?limit=10
// 返回指定科目最近 N 次考试的知识点历史掌握率

import { NextRequest, NextResponse } from 'next/server'
import { KnowledgeHistoryService } from '@/services/knowledge-history.service'
import { auth } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string }> },
) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const { subject } = await params
    const url = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '10') || 10, 1), 50)

    const records = await KnowledgeHistoryService.getBySubject(subject, limit, userId)
    return NextResponse.json({ success: true, data: records })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取知识历史失败'
    console.error('[api/knowledge-history/subject/:subject] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
