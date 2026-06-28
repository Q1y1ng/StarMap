import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET() {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const exams = await prisma.exam.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        _count: { select: { analysisReports: true, questions: true } },
        examSession: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({
      success: true,
      data: exams,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取考试列表失败'
    console.error('[exams] 列表查询出错:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST() {
  // TODO: handle file upload + create exam record
  return NextResponse.json({ success: true, data: { id: 'new-exam-id' } }, { status: 201 })
}
