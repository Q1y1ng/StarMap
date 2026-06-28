// ── Learning Profile API ──────────────────────────────
// GET /api/learning-profile?subject=数学
// 返回指定科目的学习画像（当前用户独享）

import { NextRequest, NextResponse } from 'next/server'
import { LearningProfileService } from '@/services/learning-profile.service'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const url = new URL(request.url)
    const subject = url.searchParams.get('subject')

    if (!subject) {
      return NextResponse.json(
        { success: false, error: '请指定科目 (subject)' },
        { status: 400 },
      )
    }

    const profile = await LearningProfileService.get(subject, userId)

    if (!profile) {
      return NextResponse.json(
        { success: false, error: `「${subject}」的学习画像尚未生成，请先刷新` },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data: profile })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取学习画像失败'
    console.error('[api/learning-profile] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
