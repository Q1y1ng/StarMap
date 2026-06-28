// GET /api/risk-analysis
// 学习风险预警 API（当前用户独享）
// ─────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { RiskAnalysisService, type RiskLevel } from '@/services/risk-analysis.service'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const subject = searchParams.get('subject')
    const riskLevel = searchParams.get('riskLevel') as RiskLevel | null
    const orderBy = (searchParams.get('orderBy') ?? 'riskScore') as 'riskScore' | 'trendSlope' | 'latestMastery'
    const orderDir = (searchParams.get('orderDir') ?? 'desc') as 'asc' | 'desc'
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
    const action = searchParams.get('action')
    const knowledgePoint = searchParams.get('knowledgePoint')

    // 触发分析 / 刷新
    if (action === 'analyze') {
      const results = await RiskAnalysisService.analyze(userId)
      return NextResponse.json({ success: true, data: results, message: `已分析 ${results.length} 个知识点` })
    }
    if (action === 'refresh') {
      const results = await RiskAnalysisService.refresh(userId)
      return NextResponse.json({ success: true, data: results, message: `已刷新 ${results.length} 个知识点` })
    }

    // 获取单个知识点趋势详情
    if (subject && knowledgePoint) {
      const detail = await RiskAnalysisService.getTrendDetail(subject, knowledgePoint, userId)
      if (!detail) {
        return NextResponse.json({ success: false, error: '未找到该知识点风险数据' }, { status: 404 })
      }
      return NextResponse.json({ success: true, data: detail })
    }

    // 获取摘要统计
    if (searchParams.get('summary') === 'true') {
      const summary = await RiskAnalysisService.getSummary(userId)
      return NextResponse.json({ success: true, data: summary })
    }

    // 获取风险列表
    const risks = await RiskAnalysisService.getRisks({
      subject: subject ?? undefined,
      riskLevel: riskLevel ?? undefined,
      userId,
      orderBy,
      orderDir,
      limit,
    })

    return NextResponse.json({ success: true, data: risks })
  } catch (err) {
    const message = err instanceof Error ? err.message : '风险分析查询失败'
    console.error('[api/risk-analysis] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
