// ── GET /api/analytics/system ──
// 返回系统健康度指标（OCR / AI / 反馈 / 数据规模）
// 仅 ADMIN 可访问

import { NextResponse } from 'next/server'
import { SystemAnalyticsService } from '@/services/system-analytics.service'
import { requireAdmin } from '@/lib/auth-utils'

export async function GET() {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const data = await SystemAnalyticsService.getMetrics()
    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取系统指标失败'
    console.error('[api/analytics/system] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
