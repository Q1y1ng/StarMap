// ── 管理员用户详情 API（Phase 11） ──

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-utils'
import { UserService } from '@/services/user.service'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { id } = await params

    // 禁止管理员删除自己
    if (id === auth.user.id) {
      return NextResponse.json(
        { success: false, error: '不能删除自己的账号' },
        { status: 400 },
      )
    }

    await UserService.deleteUser(id)

    return NextResponse.json({ success: true, message: '用户已注销' })
  } catch (err) {
    const message = err instanceof Error ? err.message : '注销用户失败'
    console.error('[api/admin/users/[id]] DELETE Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { id } = await params
    const detail = await UserService.getUserDetail(id)

    if (!detail) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data: detail })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取用户详情失败'
    console.error('[api/admin/users/[id]] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
