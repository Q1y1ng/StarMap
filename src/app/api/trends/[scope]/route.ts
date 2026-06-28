import { NextRequest, NextResponse } from 'next/server'
import { TrendService } from '@/services/trend.service'
import { auth } from '@/lib/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ scope: string }> },
) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const { scope } = await params

    const cacheHeader = { 'Cache-Control': 'private, max-age=60' }

    switch (scope) {
      case 'overall': {
        const scoreTrend = await TrendService.getScoreTrend(userId)
        return NextResponse.json({ success: true, data: scoreTrend }, { headers: cacheHeader })
      }
      case 'subjects': {
        const subjectTrends = await TrendService.getSubjectTrends(userId)
        return NextResponse.json({ success: true, data: subjectTrends }, { headers: cacheHeader })
      }
      case 'weaknesses': {
        const weaknessTrends = await TrendService.getWeaknessTrends(userId)
        return NextResponse.json({ success: true, data: weaknessTrends }, { headers: cacheHeader })
      }
      case 'stats': {
        const stats = await TrendService.getStats(userId)
        return NextResponse.json({ success: true, data: stats }, { headers: cacheHeader })
      }
      case 'difficulty': {
        const difficultyTrend = await TrendService.getDifficultyTrend(userId)
        return NextResponse.json({ success: true, data: difficultyTrend }, { headers: cacheHeader })
      }
      default:
        return NextResponse.json({ success: false, error: '无效的 scope，可选: overall, subjects, weaknesses, stats, difficulty' }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '趋势数据加载失败'
    console.error('[trends] 查询出错:', err instanceof Error ? `${err.name}: ${err.message}\n${err.stack?.slice(0, 200)}` : JSON.stringify(err))
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
