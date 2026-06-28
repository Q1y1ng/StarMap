import { prisma } from '@/lib/prisma'

// ── 类型 ──

export type ExamSessionData = {
  id: string
  name: string
  grade: string
  semester: string | null
  examType: string | null
  date: string
  averageScore: number | null
  totalScore: number | null
  growthIndex: string | null
  summary: string | null
  subjectCount: number
  subjects: Array<{
    id: string
    title: string
    subject: string
    totalScore: number
    aiStatus: string
    analysisReportId?: string
    scoreRate?: number | null
  }>
  createdAt: string
  updatedAt: string
}

export type ExamSessionListItem = {
  id: string
  name: string
  grade: string
  semester: string | null
  examType: string | null
  date: string
  averageScore: number | null
  totalScore: number | null
  growthIndex: string | null
  summary: string | null
  subjectCount: number
  completedCount: number
  aiStatusSummary: 'COMPLETED' | 'PROCESSING' | 'PENDING' | 'PARTIAL'
  createdAt: string
}

export type CreateExamSessionInput = {
  name: string
  grade: string
  semester?: string
  examType?: string
  date: Date
}

// ── Service ──

export class ExamSessionService {
  /**
   * 获取当前用户的所有 Exam Session，按日期降序
   */
  static async list(userId: string): Promise<ExamSessionListItem[]> {
    const sessions = await prisma.examSession.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      include: {
        subjects: {
          select: {
            id: true,
            title: true,
            subject: true,
            totalScore: true,
            aiStatus: true,
          },
        },
      },
    })

    return sessions.map((s) => {
      const completedCount = s.subjects.filter((sub) => sub.aiStatus === 'COMPLETED').length
      const totalCount = s.subjects.length

      let aiStatusSummary: ExamSessionListItem['aiStatusSummary'] = 'PENDING'
      if (completedCount === totalCount && totalCount > 0) {
        aiStatusSummary = 'COMPLETED'
      } else if (completedCount > 0) {
        aiStatusSummary = 'PARTIAL'
      } else if (s.subjects.some((sub) => sub.aiStatus === 'PROCESSING')) {
        aiStatusSummary = 'PROCESSING'
      }

      return {
        id: s.id,
        name: s.name,
        grade: s.grade,
        semester: s.semester,
        examType: s.examType,
        date: s.date.toISOString().slice(0, 10),
        averageScore: s.averageScore,
        totalScore: s.totalScore,
        growthIndex: s.growthIndex,
        summary: s.summary,
        subjectCount: totalCount,
        completedCount,
        aiStatusSummary,
        createdAt: s.createdAt.toISOString(),
      }
    })
  }

  /**
   * 获取单个 Exam Session 详情（含所有科目及分析报告）
   */
  static async getById(id: string, userId: string): Promise<ExamSessionData | null> {
    const session = await prisma.examSession.findFirst({
      where: { id, userId },
      include: {
        subjects: {
          orderBy: { subject: 'asc' },
          include: {
            analysisReports: {
              where: { status: 'SUCCESS' },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    })

    if (!session) return null

    const subjects = session.subjects.map((exam) => {
      // 计算得分率
      let scoreRate: number | null = null
      const avgScore = exam.analysisReports.length > 0 ? exam.totalScore : null
      if (avgScore != null && exam.totalScore > 0) {
        scoreRate = Math.round((avgScore / exam.totalScore) * 100)
      }

      return {
        id: exam.id,
        title: exam.title,
        subject: exam.subject,
        totalScore: exam.totalScore,
        aiStatus: exam.aiStatus,
        analysisReportId: exam.analysisReports[0]?.id ?? undefined,
        scoreRate,
      }
    })

    // 重新计算平均分
    const scores = subjects
      .map((s) => s.totalScore)
      .filter((s): s is number => s > 0)
    const averageScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : session.averageScore

    return {
      id: session.id,
      name: session.name,
      grade: session.grade,
      semester: session.semester,
      examType: session.examType,
      date: session.date.toISOString().slice(0, 10),
      averageScore,
      totalScore: session.totalScore,
      growthIndex: session.growthIndex,
      summary: session.summary,
      subjectCount: subjects.length,
      subjects,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    }
  }

  /**
   * 创建 Exam Session
   */
  static async create(input: CreateExamSessionInput, userId: string) {
    return prisma.examSession.create({
      data: {
        name: input.name,
        grade: input.grade,
        semester: input.semester ?? null,
        examType: input.examType ?? null,
        date: input.date,
        userId,
      },
    })
  }

  /**
   * 更新 Exam Session
   */
  static async update(
    id: string,
    userId: string,
    data: {
      name?: string
      grade?: string
      semester?: string | null
      examType?: string | null
      date?: Date
      averageScore?: number | null
      totalScore?: number | null
      growthIndex?: string | null
      summary?: string | null
    },
  ) {
    const session = await prisma.examSession.findFirst({
      where: { id, userId },
    })
    if (!session) return null

    return prisma.examSession.update({
      where: { id },
      data,
    })
  }

  /**
   * 删除 Exam Session（不删除关联的 Exam）
   */
  static async delete(id: string, userId: string): Promise<boolean> {
    const session = await prisma.examSession.findFirst({
      where: { id, userId },
    })
    if (!session) return false

    // 先断开 exams 的关联
    await prisma.exam.updateMany({
      where: { examSessionId: id },
      data: { examSessionId: null },
    })

    await prisma.examSession.delete({ where: { id } })
    return true
  }

  /**
   * 将 exam 归入 session
   */
  static async addExamToSession(examId: string, sessionId: string, userId: string) {
    const session = await prisma.examSession.findFirst({
      where: { id: sessionId, userId },
    })
    if (!session) throw new Error('ExamSession not found')

    const exam = await prisma.exam.findFirst({
      where: { id: examId, userId },
    })
    if (!exam) throw new Error('Exam not found')

    return prisma.exam.update({
      where: { id: examId },
      data: { examSessionId: sessionId },
    })
  }

  /**
   * 从 session 中移除 exam
   */
  static async removeExamFromSession(examId: string, userId: string) {
    const exam = await prisma.exam.findFirst({
      where: { id: examId, userId },
    })
    if (!exam) throw new Error('Exam not found')

    return prisma.exam.update({
      where: { id: examId },
      data: { examSessionId: null },
    })
  }

  /**
   * 获取 Dashboard 统计数据（基于 Exam Session）
   */
  static async getDashboardStats(userId: string) {
    const [sessionCount, examCount, reportCount, distinctSubjects, recentSessions, allSessions] =
      await Promise.all([
        prisma.examSession.count({ where: { userId } }),
        prisma.exam.count({ where: { userId } }),
        prisma.analysisReport.count({ where: { exam: { userId } } }),
        prisma.exam.findMany({
          where: { userId },
          select: { subject: true },
          distinct: ['subject'],
        }),
        prisma.examSession.findMany({
          where: { userId },
          orderBy: { date: 'desc' },
          take: 5,
          include: {
            subjects: {
              select: { totalScore: true, aiStatus: true },
            },
          },
        }),
        prisma.examSession.findMany({
          where: { userId },
          select: { averageScore: true },
          orderBy: { date: 'asc' },
        }),
      ])

    // 计算平均分
    const avgScores = allSessions
      .map((s) => s.averageScore)
      .filter((s): s is number => s != null)
    const overallAverage =
      avgScores.length > 0
        ? Math.round(avgScores.reduce((a, b) => a + b, 0) / avgScores.length)
        : null

    // 计算成长指数
    let growthIndex: string | null = null
    if (avgScores.length >= 2) {
      const firstHalf = avgScores.slice(0, Math.ceil(avgScores.length / 2))
      const secondHalf = avgScores.slice(Math.ceil(avgScores.length / 2))
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
      const diff = secondAvg - firstAvg
      if (diff > 3) growthIndex = '持续进步'
      else if (diff < -3) growthIndex = '需关注'
      else growthIndex = '保持稳定'
    }

    // 最近 sessions
    const recentSessionsData = recentSessions.map((s) => {
      const completedCount = s.subjects.filter((sub) => sub.aiStatus === 'COMPLETED').length
      const scores = s.subjects.map((sub) => sub.totalScore).filter(Boolean)
      const avgScore =
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null
      return {
        id: s.id,
        name: s.name,
        date: s.date.toISOString().slice(0, 10),
        averageScore: s.averageScore ?? avgScore,
        completedCount,
        subjectCount: s.subjects.length,
      }
    })

    return {
      sessionCount,
      examCount,
      reportCount,
      subjectCount: distinctSubjects.length,
      overallAverage,
      growthIndex,
      recentSessions: recentSessionsData,
    }
  }
}
