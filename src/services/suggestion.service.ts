import { prisma } from '@/lib/prisma'

export class SuggestionService {
  static async listByStudent(studentId: string) {
    return prisma.learningSuggestion.findMany({
      where: { studentId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    })
  }

  static async markCompleted(id: string) {
    return prisma.learningSuggestion.update({
      where: { id },
      data: { isCompleted: true },
    })
  }
}
