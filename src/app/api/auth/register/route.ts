// ── 用户注册 API（Phase 11） ──

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { registerUser } from '@/lib/auth-utils'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, name, password } = body

    // ── 参数验证 ──

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { success: false, error: '用户名不能为空' },
        { status: 400 },
      )
    }
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { success: false, error: '姓名不能为空' },
        { status: 400 },
      )
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: '密码不能为空' },
        { status: 400 },
      )
    }

    const trimmedUsername = username.trim()
    const trimmedName = name.trim()

    if (trimmedUsername.length < 3 || trimmedUsername.length > 32) {
      return NextResponse.json(
        { success: false, error: '用户名长度需在 3-32 个字符之间' },
        { status: 400 },
      )
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      return NextResponse.json(
        {
          success: false,
          error: '用户名只能包含字母、数字和下划线',
        },
        { status: 400 },
      )
    }
    if (trimmedName.length < 1 || trimmedName.length > 32) {
      return NextResponse.json(
        { success: false, error: '姓名长度需在 1-32 个字符之间' },
        { status: 400 },
      )
    }
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: '密码长度至少 6 位' },
        { status: 400 },
      )
    }

    // ── 检查用户名唯一性 ──

    const existing = await prisma.user.findUnique({
      where: { username: trimmedUsername },
    })
    if (existing) {
      return NextResponse.json(
        { success: false, error: '用户名已存在' },
        { status: 400 },
      )
    }

    // ── 创建用户 ──

    const user = await registerUser(trimmedUsername, trimmedName, password)

    return NextResponse.json({ success: true, data: user })
  } catch (err) {
    console.error('Register error:', err)
    return NextResponse.json(
      { success: false, error: '注册失败，请稍后重试' },
      { status: 500 },
    )
  }
}
