// ── 单报告反馈查询 API ─────────────────────────
// GET /api/analysis-feedback/report/[reportId]
// 返回当前用户自己的反馈（校验所有权）

import { NextRequest, NextResponse } from 'next/server'
import { AnalysisFeedbackService } from '@/services/analysis-feedback.service'
import { auth } from '@/lib/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const { reportId } = await params
    const feedback = await AnalysisFeedbackService.getByReportId(reportId, userId)

    return NextResponse.json({
      success: true,
      data: feedback, // null 表示未评价或无权访问
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取反馈失败'
    console.error('[api/analysis-feedback/report] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
