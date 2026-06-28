import { prisma } from '@/lib/prisma'
import type { PaginationParams } from '@/types/common'

export class ScoreService {
  static async list(params: PaginationParams & { examId?: string; studentId?: string; class?: string }) {
    const { page = 1, pageSize = 20, examId, studentId, class: className } = params
    const where = {
      ...(examId && { examId }),
      ...(studentId && { studentId }),
      ...(className && { student: { class: className } }),
    }
    const [items, total] = await Promise.all([
      prisma.score.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          student: { select: { id: true, name: true, studentNumber: true, class: true } },
          exam: { select: { id: true, title: true, subject: true, examDate: true, totalScore: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.score.count({ where }),
    ])
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  static async getById(id: string) {
    return prisma.score.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, name: true, studentNumber: true, class: true } },
        exam: { select: { id: true, title: true, subject: true, examDate: true, totalScore: true } },
      },
    })
  }

  static async batchCreate(scores: { studentId: string; examId: string; score: number; maxScore: number; details?: unknown }[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return prisma.score.createMany({ data: scores as any })
  }
}
