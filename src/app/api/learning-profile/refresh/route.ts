// ── Learning Profile Refresh API ──────────────────────
// POST /api/learning-profile/refresh
// 刷新指定科目的学习画像（当前用户独享）
// Body: { subject: "数学" }

import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { LearningProfileService } from '@/services/learning-profile.service'
import { auth } from '@/lib/auth'

const RefreshSchema = z.object({
  subject: z.string().min(1, '科目不能为空'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const body = await request.json()
    const { subject } = RefreshSchema.parse(body)

    const profile = await LearningProfileService.refresh(subject, userId)

    return NextResponse.json({
      success: true,
      data: profile,
      message: `「${subject}」学习画像刷新完成`,
    })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: '数据格式有误：' + err.issues.map((e) => e.message).join('；') },
        { status: 400 },
      )
    }
    const message = err instanceof Error ? err.message : '刷新学习画像失败'
    console.error('[api/learning-profile/refresh] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
