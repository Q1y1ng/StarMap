import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ExamSessionService } from '@/services/exam-session.service'

// GET /api/exam-sessions — 获取当前用户的所有考试分类
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 })
  }

  try {
    const data = await ExamSessionService.list(session.user.id)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[exam-sessions] 列表加载失败:', err)
    return NextResponse.json({ success: false, error: '加载失败' }, { status: 500 })
  }
}

// POST /api/exam-sessions — 新建考试分类
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { name, grade, semester, examType, date } = body

    if (!name || !grade || !date) {
      return NextResponse.json(
        { success: false, error: '名称、年级和日期为必填项' },
        { status: 400 },
      )
    }

    const data = await ExamSessionService.create(
      {
        name,
        grade,
        semester,
        examType,
        date: new Date(date),
      },
      session.user.id,
    )

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[exam-sessions] 创建失败:', err)
    return NextResponse.json({ success: false, error: '创建失败' }, { status: 500 })
  }
}
