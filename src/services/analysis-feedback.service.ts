// ── 分析反馈服务（Phase 6：质量验证） ──────────────
// 提供用户对 AI 分析报告的反馈收集与统计

import { prisma } from '@/lib/prisma'

export type FeedbackInput = {
  reportId: string
  accurate: boolean
  helpful: boolean
  comment?: string
}

export type FeedbackStats = {
  total: number
  accurateCount: number
  helpfulCount:  number
  accuracyRate: number  // 0–1
  helpfulRate:  number  // 0–1
  recent: RecentFeedbackItem[]
}

export type RecentFeedbackItem = {
  id: string
  accurate: boolean
  helpful: boolean
  comment: string | null
  createdAt: string
  examTitle: string
  subject: string
}

export class AnalysisFeedbackService {
  /**
   * 校验反馈所属权：report 必须属于当前用户
   */
  static async verifyReportOwnership(reportId: string, userId: string): Promise<boolean> {
    const report = await prisma.analysisReport.findFirst({
      where: { id: reportId, exam: { userId } },
      select: { id: true },
    })
    return report !== null
  }

  /**
   * 创建或更新分析反馈（每个 reportId 唯一）
   */
  static async upsert(data: FeedbackInput) {
    return prisma.analysisFeedback.upsert({
      where: { reportId: data.reportId },
      create: {
        reportId: data.reportId,
        accurate: data.accurate,
        helpful: data.helpful,
        comment: data.comment ?? null,
      },
      update: {
        accurate: data.accurate,
        helpful: data.helpful,
        comment: data.comment ?? null,
      },
    })
  }

  /**
   * 根据报告 ID 查询反馈（校验所有权）
   */
  static async getByReportId(reportId: string, userId?: string) {
    if (userId) {
      const owned = await this.verifyReportOwnership(reportId, userId)
      if (!owned) return null
    }
    return prisma.analysisFeedback.findUnique({
      where: { reportId },
    })
  }

  /**
   * 统计当前用户的反馈数、准确率、帮助率，附带最近反馈
   */
  static async getStats(limit = 10, userId?: string): Promise<FeedbackStats> {
    const baseWhere = userId ? { report: { exam: { userId } } } : {}

    const [total, accurateCount, helpfulCount, recent] = await Promise.all([
      prisma.analysisFeedback.count({ where: baseWhere }),
      prisma.analysisFeedback.count({ where: { ...baseWhere, accurate: true } }),
      prisma.analysisFeedback.count({ where: { ...baseWhere, helpful: true } }),
      prisma.analysisFeedback.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 50),
        include: {
          report: {
            select: {
              exam: { select: { title: true, subject: true } },
            },
          },
        },
      }),
    ])

    return {
      total,
      accurateCount,
      helpfulCount,
      accuracyRate: total > 0 ? accurateCount / total : 0,
      helpfulRate: total > 0 ? helpfulCount / total : 0,
      recent: recent.map((f) => ({
        id: f.id,
        accurate: f.accurate,
        helpful: f.helpful,
        comment: f.comment,
        createdAt: f.createdAt.toISOString(),
        examTitle: f.report.exam.title,
        subject: f.report.exam.subject,
      })),
    }
  }

  /**
   * 获取某次考试的所有反馈（通过 examId 关联 AnalysisReport）
   */
  static async getByExamId(examId: string) {
    const reports = await prisma.analysisReport.findMany({
      where: { examId },
      select: { id: true },
    })
    const reportIds = reports.map((r) => r.id)
    if (reportIds.length === 0) return []

    return prisma.analysisFeedback.findMany({
      where: { reportId: { in: reportIds } },
      orderBy: { createdAt: 'desc' },
    })
  }
}
