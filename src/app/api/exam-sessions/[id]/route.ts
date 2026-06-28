import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ExamSessionService } from '@/services/exam-session.service'

// GET /api/exam-sessions/[id] — 获取考试分类详情
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 })
  }

  try {
    const { id } = await params
    const data = await ExamSessionService.getById(id, session.user.id)
    if (!data) {
      return NextResponse.json({ success: false, error: '未找到该考试分类' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[exam-sessions] 详情加载失败:', err)
    return NextResponse.json({ success: false, error: '加载失败' }, { status: 500 })
  }
}

// PATCH /api/exam-sessions/[id] — 更新考试分类
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const { name, grade, semester, examType, date, averageScore, totalScore, growthIndex, summary } = body

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (grade !== undefined) updateData.grade = grade
    if (semester !== undefined) updateData.semester = semester || null
    if (examType !== undefined) updateData.examType = examType || null
    if (date !== undefined) updateData.date = new Date(date)
    if (averageScore !== undefined) updateData.averageScore = averageScore
    if (totalScore !== undefined) updateData.totalScore = totalScore
    if (growthIndex !== undefined) updateData.growthIndex = growthIndex
    if (summary !== undefined) updateData.summary = summary

    const result = await ExamSessionService.update(id, session.user.id, updateData)
    if (!result) {
      return NextResponse.json({ success: false, error: '未找到或无权修改' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    console.error('[exam-sessions] 更新失败:', err)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}

// DELETE /api/exam-sessions/[id] — 删除考试分类
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 })
  }

  try {
    const { id } = await params
    const success = await ExamSessionService.delete(id, session.user.id)
    if (!success) {
      return NextResponse.json({ success: false, error: '未找到或无权删除' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[exam-sessions] 删除失败:', err)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}
