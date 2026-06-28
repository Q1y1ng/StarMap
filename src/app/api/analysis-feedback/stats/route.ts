// ── 分析反馈统计 API ────────────────────────────
// GET /api/analysis-feedback/stats?limit=10
// 返回当前用户自己的反馈统计

import { NextRequest, NextResponse } from 'next/server'
import { AnalysisFeedbackService } from '@/services/analysis-feedback.service'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const url = new URL(request.url)
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '10', 10)))

    const stats = await AnalysisFeedbackService.getStats(limit, userId)

    return NextResponse.json({ success: true, data: stats })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取反馈统计失败'
    console.error('[api/analysis-feedback/stats] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
