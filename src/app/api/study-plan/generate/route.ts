// POST /api/study-plan/generate
// 重新生成未来 7 天学习计划（当前用户独享）
// Body: {}（暂无参数）

import { NextResponse } from 'next/server'
import { StudyPlanService } from '@/services/study-plan.service'
import { auth } from '@/lib/auth'

export async function POST() {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const plans = await StudyPlanService.refreshPlan(userId)

    return NextResponse.json({
      success: true,
      data: plans,
      message: `已生成 ${plans.length} 天的学习计划`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '生成学习计划失败'
    console.error('[api/study-plan/generate] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
