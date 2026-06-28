import { prisma } from '@/lib/prisma'
import type { PaginationParams } from '@/types/common'
import type { AnalysisTestResult } from '@/types/analysis-test'
import type { OcrMode, OcrEngine } from '@/generated/prisma/enums'

export type CreateExamWithReportInput = {
  title: string
  subject: string
  grade: string
  examDate: Date
  totalScore: number
  content: string
  analysisData: AnalysisTestResult
  meta?: {
    durationMs?: number | null
    usage?: { promptTokens?: number | null; completionTokens?: number | null; totalTokens?: number | null } | null
    rawOutput?: string | null
  } | null
  ocrMode?: OcrMode | null
  ocrEngine?: OcrEngine | null
  ocrQuality?: number | null
  ocrDurationMs?: number | null
  userId?: string | null
}

export class ExamService {
  static async list(params: PaginationParams & { subject?: string; grade?: string }) {
    const { page = 1, pageSize = 20, subject, grade } = params
    const where = { ...(subject && { subject }), ...(grade && { grade }) }
    const [items, total] = await Promise.all([
      prisma.exam.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { examDate: 'desc' },
      }),
      prisma.exam.count({ where }),
    ])
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  static async getById(id: string) {
    return prisma.exam.findUnique({
      where: { id },
      include: {
        examKnowledgePoints: { include: { knowledgePoint: true } },
        analysisReports: true,
      },
    })
  }

  static async create(data: {
    title: string
    subject: string
    grade: string
    examDate: Date
    totalScore: number
    fileUrl?: string
    fileType?: string
  }) {
    return prisma.exam.create({ data })
  }

  static async createWithReport(input: CreateExamWithReportInput) {
    const { title, subject, grade, examDate, totalScore, content, analysisData, meta, ocrMode, ocrEngine, ocrQuality, ocrDurationMs, userId } = input

    const exam = await prisma.exam.create({
      data: {
        title,
        subject,
        grade,
        examDate,
        totalScore,
        userId,
        aiStatus: 'COMPLETED',
        analysisReports: {
          create: {
            subject,
            summary: analysisData.summary,
            knowledgePoints: analysisData.knowledgePoints,
            weaknesses: analysisData.weaknesses,
            strengths: analysisData.strengths,
            studySuggestions: analysisData.studySuggestions,
            inputContent: content,
            rawOutput: meta?.rawOutput ?? null,
            promptTokens: meta?.usage?.promptTokens ?? null,
            completionTokens: meta?.usage?.completionTokens ?? null,
            totalTokens: meta?.usage?.totalTokens ?? null,
            durationMs: meta?.durationMs ?? null,
            ocrMode: ocrMode ?? null,
            ocrEngine: ocrEngine ?? null,
            ocrQuality: ocrQuality ?? null,
            ocrDurationMs: ocrDurationMs ?? null,
            status: 'SUCCESS',
          },
        },
      },
      include: {
        analysisReports: true,
      },
    })

    // 保留：后续可在此处同步创建 AiAnalysisLog
    return exam
  }

  static async delete(id: string) {
    return prisma.exam.delete({ where: { id } })
  }
}
