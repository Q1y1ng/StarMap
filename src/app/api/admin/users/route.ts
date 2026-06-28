// ── 管理员用户列表 API（Phase 11） ──

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-utils'
import { UserService } from '@/services/user.service'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '20', 10)),
    )

    const result = await UserService.list({ page, pageSize })

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取用户列表失败'
    console.error('[api/admin/users] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
