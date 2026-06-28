// ── 路由保护中间件（Phase 11） ──
// 使用 Edge Runtime 兼容的配置，不导入 Prisma

import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

export default NextAuth(authConfig).auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // 公开路径：认证 API、静态资源、登录页
  const isPublic =
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/login' ||
    pathname === '/favicon.ico'

  if (isPublic) return

  // 未登录 → 重定向到登录页
  if (!session?.user?.id) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return Response.redirect(loginUrl)
  }

  // 非管理员访问 /admin → 重定向到仪表盘
  if (pathname.startsWith('/admin') && session.user.role !== 'ADMIN') {
    return Response.redirect(new URL('/dashboard', req.url))
  }
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
