// ── Knowledge Mastery By Subject API ───────────────────
// GET /api/knowledge-mastery/subject/[subject]?limit=10

import { NextRequest, NextResponse } from 'next/server'
import { KnowledgeMasteryService } from '@/services/knowledge-mastery.service'
import { auth } from '@/lib/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ subject: string }> },
) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const { subject } = await params
    const url = new URL(_request.url)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '10') || 10, 1), 50)

    const mastery = await KnowledgeMasteryService.getBySubject(
      decodeURIComponent(subject),
      limit,
      userId,
    )

    return NextResponse.json({ success: true, data: mastery })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取知识点掌握率失败'
    console.error('[api/knowledge-mastery/subject/:subject] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
