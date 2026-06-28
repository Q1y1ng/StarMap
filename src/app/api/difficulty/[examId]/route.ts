// ── 考试难度 API ───────────────────────────────────
// GET /api/difficulty/[examId]
// 返回考试难度评分及各项指标

import { NextRequest, NextResponse } from 'next/server'
import { DifficultyEngineService } from '@/services/difficulty-engine.service'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ examId: string }> },
) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const { examId } = await params

    // 校验考试所有权
    const exam = await prisma.exam.findFirst({ where: { id: examId, userId }, select: { id: true } })
    if (!exam) {
      return NextResponse.json({ success: false, error: '考试记录不存在' }, { status: 404 })
    }

    const result = await DifficultyEngineService.getOrCreate(examId)

    if (!result) {
      return NextResponse.json({ success: false, error: '考试记录不存在' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        difficultyScore: result.difficultyScore,
        difficultyLevel: result.difficultyLevel,
        metrics: {
          averageScoreRate: result.averageScoreRate,
          questionCount: result.questionCount,
          objectiveQuestionRatio: result.objectiveQuestionRatio,
          subjectiveQuestionRatio: result.subjectiveQuestionRatio,
          knowledgeCoverage: result.knowledgeCoverage,
        },
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '难度分析失败'
    console.error('[api/difficulty] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
