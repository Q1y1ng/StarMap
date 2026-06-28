// ── Growth Analysis API ───────────────────────────────
// GET /api/growth-analysis/[subject]?limit=5
// GET /api/growth-analysis/[subject]?type=timeline&limit=10
//
// 返回知识点成长趋势分析或时间线数据

import { NextRequest, NextResponse } from 'next/server'
import { GrowthAnalysisService } from '@/services/growth-analysis.service'
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
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '5') || 5, 1), 50)
    const type = url.searchParams.get('type') ?? 'analysis'

    if (type === 'timeline') {
      const timelines = await GrowthAnalysisService.getTimelines(subject, limit, userId)
      return NextResponse.json({ success: true, data: timelines })
    }

    const result = await GrowthAnalysisService.analyze(subject, limit, userId)
    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取成长分析失败'
    console.error('[api/growth-analysis/:subject] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
