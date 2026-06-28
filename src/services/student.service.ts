import { prisma } from '@/lib/prisma'
import type { PaginationParams } from '@/types/common'

export class StudentService {
  static async list(params: PaginationParams & { class?: string; grade?: string }) {
    const { page = 1, pageSize = 20, class: className, grade } = params
    const where = { ...(className && { class: className }), ...(grade && { grade }) }
    const [items, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { studentNumber: 'asc' },
      }),
      prisma.student.count({ where }),
    ])
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  static async getProfile(id: string) {
    return prisma.student.findUnique({
      where: { id },
      include: {
        scores: {
          include: { exam: { select: { id: true, title: true, subject: true, examDate: true, totalScore: true } } },
          orderBy: { exam: { examDate: 'desc' } },
        },
        studentKnowledgeMastery: { include: { knowledgePoint: { select: { name: true, subject: true } } } },
        learningSuggestions: { where: { isCompleted: false }, orderBy: { priority: 'asc' } },
      },
    })
  }

  static async create(data: { studentNumber: string; name: string; grade: string; class: string }) {
    return prisma.student.create({ data })
  }

  static async update(id: string, data: { name?: string; class?: string }) {
    return prisma.student.update({ where: { id }, data })
  }
}
