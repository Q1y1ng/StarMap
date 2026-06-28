// ── 用户服务（Phase 11） ──

import { prisma } from '@/lib/prisma'


export type UserListItem = {
  id: string
  username: string
  name: string
  role: string
  createdAt: Date
  updatedAt: Date
  _count: { exams: number }
}

export type UserStats = {
  totalUsers: number
  totalAdmins: number
  totalExams: number
  totalReports: number
  totalFeedback: number
}

export class UserService {
  /**
   * 根据 ID 查找用户
   */
  static async findById(id: string) {
    return prisma.user.findUnique({ where: { id } })
  }

  /**
   * 根据用户名查找用户
   */
  static async findByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } })
  }

  /**
   * 获取用户列表（分页）
   */
  static async list(params: { page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20 } = params
    const skip = (page - 1) * pageSize

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { exams: true } },
        },
      }),
      prisma.user.count(),
    ])

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  /**
   * 获取系统统计概览
   */
  static async getStats(): Promise<UserStats> {
    const [totalUsers, totalAdmins, totalExams, totalReports, totalFeedback] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: 'ADMIN' } }),
        prisma.exam.count(),
        prisma.analysisReport.count(),
        prisma.analysisFeedback.count(),
      ])

    return { totalUsers, totalAdmins, totalExams, totalReports, totalFeedback }
  }

  /**
   * 删除用户及其所有关联数据
   * 注意：Exam.userId 为 onDelete: SetNull，考试记录本身不会删除
   */
  static async deleteUser(id: string) {
    await prisma.user.delete({ where: { id } })
  }

  /**
   * 获取用户详情（含考试与知识点掌握历史）
   */
  static async getUserDetail(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) return null

    const exams = await prisma.exam.findMany({
      where: { userId },
      orderBy: { examDate: 'desc' },
      select: {
        id: true,
        title: true,
        subject: true,
        grade: true,
        examDate: true,
        totalScore: true,
        aiStatus: true,
        createdAt: true,
        _count: { select: { analysisReports: true, questions: true } },
      },
    })

    const examCount = exams.length
    const reportCount = exams.reduce(
      (sum, e) => sum + e._count.analysisReports,
      0,
    )
    const questionCount = exams.reduce(
      (sum, e) => sum + e._count.questions,
      0,
    )

    // 获取所有考试的掌握历史
    const examIds = exams.map((e) => e.id)
    const knowledgeHistory =
      examIds.length > 0
        ? await prisma.knowledgeMasteryHistory.findMany({
            where: { examId: { in: examIds } },
            orderBy: { examDate: 'asc' },
            select: {
              subject: true,
              knowledgePoint: true,
              mastery: true,
              examDate: true,
            },
          })
        : []

    return {
      user,
      exams,
      examCount,
      reportCount,
      questionCount,
      knowledgeHistory,
    }
  }
}
