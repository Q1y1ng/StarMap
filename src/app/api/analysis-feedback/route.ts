// ── 分析反馈 API ─────────────────────────────────
// POST /api/analysis-feedback — 创建/更新反馈
// GET  /api/analysis-feedback — 获取反馈（需 ?reportId=xxx 或 ?examId=xxx）

import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { AnalysisFeedbackService } from '@/services/analysis-feedback.service'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const UpsertSchema = z.object({
  reportId: z.string().min(1, 'reportId 不能为空'),
  accurate: z.boolean(),
  helpful: z.boolean(),
  comment: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const body = await request.json()
    const data = UpsertSchema.parse(body)

    // 校验：该 feedback 对应的报告必须属于当前用户
    const owned = await AnalysisFeedbackService.verifyReportOwnership(data.reportId, userId)
    if (!owned) {
      return NextResponse.json({ success: false, error: '报告不存在或无权操作' }, { status: 404 })
    }

    const feedback = await AnalysisFeedbackService.upsert(data)

    return NextResponse.json({
      success: true,
      data: feedback,
      message: '感谢您的反馈！',
    })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: '数据格式有误：' + err.issues.map((e) => e.message).join('；') },
        { status: 400 },
      )
    }
    const message = err instanceof Error ? err.message : '提交反馈失败'
    console.error('[api/analysis-feedback] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const url = new URL(request.url)
    const reportId = url.searchParams.get('reportId')
    const examId = url.searchParams.get('examId')

    if (reportId) {
      const feedback = await AnalysisFeedbackService.getByReportId(reportId, userId)
      return NextResponse.json({
        success: true,
        data: feedback, // null 表示未评价
      })
    }

    if (examId) {
      // examId 对应考试，需校验所有权
      const exam = await prisma.exam.findFirst({ where: { id: examId, userId }, select: { id: true } })
      if (!exam) {
        return NextResponse.json({ success: false, error: '考试记录不存在' }, { status: 404 })
      }
      const feedbacks = await AnalysisFeedbackService.getByExamId(examId)
      return NextResponse.json({
        success: true,
        data: feedbacks,
      })
    }

    return NextResponse.json(
      { success: false, error: '请指定 reportId 或 examId' },
      { status: 400 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取反馈失败'
    console.error('[api/analysis-feedback] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
