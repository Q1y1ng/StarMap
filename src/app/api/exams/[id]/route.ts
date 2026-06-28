import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const { id } = await params

    const exam = await prisma.exam.findFirst({
      where: { id, userId },
      include: {
        analysisReports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        questions: {
          orderBy: { sortOrder: 'asc' },
        },
        questionResults: {
          include: { question: true },
          orderBy: { question: { sortOrder: 'asc' } },
        },
        examSession: { select: { id: true, name: true } },
      },
    })

    if (!exam) {
      return NextResponse.json({ success: false, error: '考试记录不存在' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: exam }, {
      headers: { 'Cache-Control': 'private, max-age=60, s-maxage=120' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取考试详情失败'
    console.error('[exams/:id] 查询出错:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { title } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ success: false, error: '考试名称不能为空' }, { status: 400 })
    }
    if (title.length > 128) {
      return NextResponse.json({ success: false, error: '考试名称不能超过128个字符' }, { status: 400 })
    }

    // 校验所有权
    const owned = await prisma.exam.findFirst({ where: { id, userId }, select: { id: true } })
    if (!owned) {
      return NextResponse.json({ success: false, error: '考试记录不存在' }, { status: 404 })
    }

    const exam = await prisma.exam.update({
      where: { id },
      data: { title: title.trim() },
    })

    return NextResponse.json({ success: true, data: exam })
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
      return NextResponse.json({ success: false, error: '考试记录不存在' }, { status: 404 })
    }
    const message = err instanceof Error ? err.message : '更新失败'
    console.error('[exams/:id] PATCH 出错:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const { id } = await params

    // 校验所有权
    const owned = await prisma.exam.findFirst({ where: { id, userId }, select: { id: true } })
    if (!owned) {
      return NextResponse.json({ success: false, error: '考试记录不存在' }, { status: 404 })
    }

    // 使用 delete（而非 deleteMany）以触发 Prisma onDelete: Cascade
    // deleteMany 不会级联删除关联的 KnowledgeMasteryHistory / WrongQuestion 等
    await prisma.exam.delete({ where: { id } })
    return NextResponse.json({ success: true, message: '考试记录已删除' })
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
      return NextResponse.json({ success: false, error: '考试记录不存在' }, { status: 404 })
    }
    const message = err instanceof Error ? err.message : '删除失败'
    console.error('[exams/:id] 删除出错:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
