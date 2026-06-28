// ── 用户账户 API ──
// GET    /api/auth/account — 获取当前用户资料
// PATCH  /api/auth/account — 修改密码
// DELETE /api/auth/account — 删除自己的账户

import { NextRequest, NextResponse } from 'next/server'
import { requireUser, hashPassword, verifyPassword } from '@/lib/auth-utils'
import { UserService } from '@/services/user.service'
import { prisma } from '@/lib/prisma'
import { z, ZodError } from 'zod'

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, '当前密码不能为空'),
  newPassword: z.string().min(6, '新密码至少 6 位').max(64, '新密码最长 64 位'),
})

// ── GET ──

export async function GET() {
  try {
    const auth = await requireUser()
    if (auth.error) return auth.error

    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { id: true, username: true, name: true, role: true, createdAt: true, updatedAt: true },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        roleLabel: user.role === 'ADMIN' ? '管理员' : '普通用户',
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取账户信息失败'
    console.error('[api/auth/account] GET Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// ── PATCH ──

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireUser()
    if (auth.error) return auth.error

    const body = await request.json()
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(body)

    // 验证当前密码
    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { passwordHash: true },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 })
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ success: false, error: '当前密码不正确' }, { status: 400 })
    }

    // 更新密码
    const newHash = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: auth.user.id },
      data: { passwordHash: newHash },
    })

    return NextResponse.json({ success: true, message: '密码修改成功' })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: err.issues.map((e) => e.message).join('；') },
        { status: 400 },
      )
    }
    const message = err instanceof Error ? err.message : '修改密码失败'
    console.error('[api/auth/account] PATCH Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// ── DELETE ──

export async function DELETE() {
  try {
    const auth = await requireUser()
    if (auth.error) return auth.error

    const { user } = auth

    await UserService.deleteUser(user.id)

    return NextResponse.json({ success: true, message: '账号已注销' })
  } catch (err) {
    const message = err instanceof Error ? err.message : '注销账号失败'
    console.error('[api/auth/account] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
