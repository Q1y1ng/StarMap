// ── 管理员统计 API（Phase 11） ──

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-utils'
import { UserService } from '@/services/user.service'

export async function GET() {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const stats = await UserService.getStats()

    return NextResponse.json({ success: true, data: stats })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取统计数据失败'
    console.error('[api/admin/stats] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
