// POST /api/exam-sessions/[id]/summary — 触发 AI 考试总结生成
// GET /api/exam-sessions/[id]/summary — 获取已生成的考试总结

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ExamSessionService } from '@/services/exam-session.service'
import { prisma } from '@/lib/prisma'

// GET — 获取已有 summary
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 })
  }

  try {
    const { id } = await params
    const data = await ExamSessionService.getById(id, session.user.id)
    if (!data) {
      return NextResponse.json({ success: false, error: '未找到' }, { status: 404 })
    }
    return NextResponse.json({ success: true, summary: data.summary })
  } catch (err) {
    console.error('[exam-session-summary] 加载失败:', err)
    return NextResponse.json({ success: false, error: '加载失败' }, { status: 500 })
  }
}

// POST — 生成 summary（基于所有科目的分析报告）
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 })
  }

  try {
    const { id } = await params

    // 验证 session 归属
    const examSessionData = await ExamSessionService.getById(id, session.user.id)
    if (!examSessionData) {
      return NextResponse.json({ success: false, error: '未找到' }, { status: 404 })
    }

    // 收集所有已完成科目的分析报告
    const examsWithReports = await prisma.exam.findMany({
      where: {
        examSessionId: id,
        aiStatus: 'COMPLETED',
      },
      include: {
        analysisReports: {
          where: { status: 'SUCCESS' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (examsWithReports.length === 0) {
      return NextResponse.json(
        { success: false, error: '尚无已完成的分析报告' },
        { status: 400 },
      )
    }

    // 构建 AI 总结的输入
    const subjectSummaries = examsWithReports.map((exam) => {
      const report = exam.analysisReports[0]
      return {
        subject: exam.subject,
        totalScore: exam.totalScore,
        summary: report?.summary ?? '',
        strengths: report?.strengths ?? [],
        weaknesses: report?.weaknesses ?? [],
        studySuggestions: report?.studySuggestions ?? [],
      }
    })

    // 生成综合总结（基于规则 + AI 友好格式）
    const totalSubjects = subjectSummaries.length
    const allWeaknesses = subjectSummaries.flatMap((s) =>
      (s.weaknesses as Array<{ name: string; scoreRate: number }>).map((w) => ({
        subject: s.subject,
        name: w.name,
        scoreRate: w.scoreRate,
      })),
    )
    const allStrengths = subjectSummaries.flatMap((s) =>
      (s.strengths as Array<{ name: string; scoreRate: number }>).map((st) => ({
        subject: s.subject,
        name: st.name,
        scoreRate: st.scoreRate,
      })),
    )

    // 排序取 top 薄弱/优势
    const topWeaknesses = allWeaknesses
      .sort((a, b) => a.scoreRate - b.scoreRate)
      .slice(0, 5)
    const topStrengths = allStrengths
      .sort((a, b) => b.scoreRate - a.scoreRate)
      .slice(0, 5)

    // 计算总分
    const totalScore = subjectSummaries.reduce((sum, s) => sum + s.totalScore, 0)

    // 构建总结文本
    const lines: string[] = [
      `本次考试共 ${totalSubjects} 科，满分 ${totalScore} 分。`,
      '',
      '**优势学科/知识点：**',
    ]
    if (topStrengths.length > 0) {
      topStrengths.forEach((s) => {
        lines.push(`- ${s.subject} · ${s.name}（得分率 ${s.scoreRate}%）`)
      })
    } else {
      lines.push('- 暂无显著优势')
    }

    lines.push('', '**薄弱学科/知识点：**')
    if (topWeaknesses.length > 0) {
      topWeaknesses.forEach((w) => {
        lines.push(`- ${w.subject} · ${w.name}（得分率 ${w.scoreRate}%）`)
      })
    } else {
      lines.push('- 暂无显著薄弱点')
    }

    lines.push('', '**学习建议：**')
    const topSuggestions = subjectSummaries
      .flatMap((s) =>
        (s.studySuggestions as Array<{ content: string; priority: number }>).map((sg) => ({
          subject: s.subject,
          content: sg.content,
          priority: sg.priority,
        })),
      )
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 5)

    if (topSuggestions.length > 0) {
      topSuggestions.forEach((sg) => {
        lines.push(`- [${sg.subject}] ${sg.content}`)
      })
    }

    const summaryText = lines.join('\n')

    // 保存到数据库
    await ExamSessionService.update(id, session.user.id, { summary: summaryText })

    return NextResponse.json({ success: true, summary: summaryText })
  } catch (err) {
    console.error('[exam-session-summary] 生成失败:', err)
    return NextResponse.json({ success: false, error: '生成失败' }, { status: 500 })
  }
}
