// GET /api/study-plan
// 查询已生成的学习计划（当前用户独享）
// Query: ?day=0-6（可选，指定第几天；不传则返回全部 7 天）

import { NextRequest, NextResponse } from 'next/server'
import { StudyPlanService } from '@/services/study-plan.service'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dayParam = searchParams.get('day')
    let day: number | undefined

    if (dayParam !== null) {
      day = parseInt(dayParam, 10)
      if (isNaN(day) || day < 0 || day > 6) {
        return NextResponse.json(
          { success: false, error: 'day 参数需为 0-6 之间的整数' },
          { status: 400 },
        )
      }
    }

    const plans = await StudyPlanService.getPlans(day, userId)

    return NextResponse.json({
      success: true,
      data: plans,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '加载学习计划失败'
    console.error('[api/study-plan] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
