// ── 密码与权限工具函数（Phase 11） ──

import { hash, compare } from 'bcryptjs'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

/**
 * 密码哈希
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12)
}

/**
 * 注册新用户（仅 USER 角色）
 */
export async function registerUser(
  username: string,
  name: string,
  password: string,
): Promise<{
  id: string
  username: string
  name: string
  role: string
  createdAt: Date
}> {
  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({
    data: {
      username,
      name,
      passwordHash,
      role: 'USER',
    },
    select: { id: true, username: true, name: true, role: true, createdAt: true },
  })
  return user
}

/**
 * 验证密码
 */
export async function verifyPassword(
  password: string,
  hashed: string,
): Promise<boolean> {
  return compare(password, hashed)
}

/**
 * API 路由用：验证用户已登录
 * 返回 { session, user } 或 { error: NextResponse }
 */
export async function requireUser(): Promise<{
  session: { user: { id: string; role: string; name: string; email: string } }
  user: { id: string; role: string; name: string; email: string }
  error?: undefined
} | {
  error: NextResponse
  session?: undefined
  user?: undefined
}> {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      error: NextResponse.json(
        { success: false, error: '未登录，请先登录' },
        { status: 401 },
      ),
    }
  }
  return { session: session as typeof session & { user: { id: string; role: string; name: string; email: string } }, user: session.user as { id: string; role: string; name: string; email: string } }
}

/**
 * API 路由用：验证用户为 ADMIN
 */
export async function requireAdmin(): Promise<{
  session: { user: { id: string; role: string; name: string; email: string } }
  user: { id: string; role: string; name: string; email: string }
  error?: undefined
} | {
  error: NextResponse
  session?: undefined
  user?: undefined
}> {
  const result = await requireUser()
  if (result.error) return result

  if (result.user.role !== 'ADMIN') {
    return {
      error: NextResponse.json(
        { success: false, error: '无管理员权限' },
        { status: 403 },
      ),
    }
  }

  return result
}
