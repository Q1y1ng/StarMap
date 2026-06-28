import { prisma } from '@/lib/prisma'

export class AnalysisService {
  static async getStatus(taskId: string) {
    return prisma.aiAnalysisLog.findUnique({ where: { id: taskId } })
  }

  static async logResult(data: {
    examId: string
    studentId?: string
    type: 'KNOWLEDGE_POINT' | 'WEAKNESS' | 'SUGGESTION' | 'TREND'
    inputData: Record<string, unknown> | unknown[]
    outputData: Record<string, unknown> | unknown[]
    modelVersion: string
    tokenUsage?: Record<string, number | undefined> | null
    duration?: number
    status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED'
    errorMessage?: string
  }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return prisma.aiAnalysisLog.create({ data: data as any })
  }
}
