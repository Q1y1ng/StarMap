import { NextRequest, NextResponse } from 'next/server'
import { WrongQuestionService } from '@/services/wrong-question.service'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/wrong-book
 *
 * Query params:
 *   - subject: 科目筛选（可选）
 *   - limit:   返回条数（默认 50，最大 500）
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const subject = searchParams.get('subject') || undefined
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 500)

    const [items, subjects, total] = await Promise.all([
      WrongQuestionService.getBySubject({ subject, limit, userId }),
      WrongQuestionService.getSubjects(userId),
      WrongQuestionService.getCount({ subject, userId }),
    ])

    return NextResponse.json({
      success: true,
      data: { items, subjects, total },
    }, {
      headers: { 'Cache-Control': 'private, max-age=30, s-maxage=60' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '错题本加载失败'
    console.error('[wrong-book] 查询出错:', err instanceof Error ? `${err.name}: ${err.message}` : JSON.stringify(err))
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * POST /api/wrong-book
 *
 * Body:
 *   - action: "generate" | "delete"
 *   - examId: 配合 action=generate — 为该考试生成错题
 *   - id:     配合 action=delete — 删除该错题记录
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const body = await request.json()
    const { action, examId, id } = body

    switch (action) {
      case 'generate': {
        if (!examId) {
          return NextResponse.json({ success: false, error: '缺少 examId' }, { status: 400 })
        }
        // 校验考试所有权
        const exam = await prisma.exam.findFirst({ where: { id: examId, userId }, select: { id: true } })
        if (!exam) {
          return NextResponse.json({ success: false, error: '考试记录不存在' }, { status: 404 })
        }
        const result = await WrongQuestionService.generateForExam(examId)
        if (!result) {
          return NextResponse.json({ success: false, error: '考试记录不存在' }, { status: 404 })
        }
        return NextResponse.json({ success: true, data: result })
      }

      case 'delete': {
        if (!id) {
          return NextResponse.json({ success: false, error: '缺少 id' }, { status: 400 })
        }
        const deleted = await WrongQuestionService.delete(id)
        if (!deleted) {
          return NextResponse.json({ success: false, error: '记录不存在或删除失败' }, { status: 404 })
        }
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ success: false, error: '无效的 action，可选: generate, delete' }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '操作失败'
    console.error('[wrong-book] 操作出错:', err instanceof Error ? `${err.name}: ${err.message}` : JSON.stringify(err))
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
