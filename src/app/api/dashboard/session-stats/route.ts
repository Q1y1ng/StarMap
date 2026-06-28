import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ExamSessionService } from '@/services/exam-session.service'

// GET /api/dashboard/session-stats — 基于 Exam Session 的仪表盘统计
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 })
  }

  try {
    const stats = await ExamSessionService.getDashboardStats(session.user.id)
    return NextResponse.json({ success: true, data: stats }, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    })
  } catch (err) {
    console.error('[dashboard/session-stats] 加载失败:', err)
    return NextResponse.json({ success: false, error: '加载失败' }, { status: 500 })
  }
}
