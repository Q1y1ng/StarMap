// ── 错题本服务（Phase 7-B） ──────────────────────────
// 根据 QuestionResult.scoreRate < 0.6 自动生成错题记录
// priorityScore = wrongCount * 0.4 + (1 - latestScoreRate) * 0.4 + knowledgePointWeakness * 0.2

import { prisma } from '@/lib/prisma'

// ── Types ──

export type WrongQuestionItem = {
  id: string
  questionId: string
  examId: string
  subject: string
  knowledgePoint: string
  wrongCount: number
  latestScoreRate: number
  priorityScore: number
  createdAt: Date
  updatedAt: Date
  question: {
    questionNo: number
    questionType: string
    fullScore: number
    questionText: string
  }
  exam: {
    title: string
    examDate: Date
  }
}

export type GenerateResult = {
  count: number
  examId: string
  subject: string
}

// ── Service ──

export class WrongQuestionService {

  /**
   * 为一场考试生成/更新错题记录
   * 找出 scoreRate < 0.6 的题目，创建或更新 WrongQuestion
   * 使用批量读取消除 N+1
   */
  static async generateForExam(examId: string): Promise<GenerateResult | null> {
    // 1. 获取考试基本信息
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { subject: true },
    })
    if (!exam) return null

    // 2. 找出得分率 < 0.6 的题目结果
    const wrongResults = await prisma.questionResult.findMany({
      where: { examId, scoreRate: { lt: 0.6 } },
      include: {
        question: { select: { questionNo: true, questionType: true } },
      },
    })
    if (wrongResults.length === 0) return { count: 0, examId, subject: exam.subject }

    // 3. 获取该考试所有知识点关联
    const examKps = await prisma.examKnowledgePoint.findMany({
      where: { examId },
      include: {
        knowledgePoint: { select: { id: true, name: true } },
      },
    })

    // 4. 构建 questionNo → knowledgePoint 映射（避免在循环中 .find）
    const kpByQuestionNo = new Map<string, { id: string; name: string }>()
    for (const ekp of examKps) {
      for (const qNo of ekp.questionNumbers) {
        kpByQuestionNo.set(qNo, { id: ekp.knowledgePoint.id, name: ekp.knowledgePoint.name })
      }
    }

    // 5. 批量查询已有 WrongQuestion 记录
    const questionIds = wrongResults.map((r) => r.questionId)
    const existingWQs = await prisma.wrongQuestion.findMany({
      where: { questionId: { in: questionIds } },
    })
    const existingMap = new Map(existingWQs.map((wq) => [wq.questionId, wq]))

    // 6. 批量查询知识点薄弱度
    const kpIds = [...new Set(examKps.map((ekp) => ekp.knowledgePoint.id))]
    const student = await prisma.student.findFirst()
    const masteryMap = new Map<string, number>()
    if (student && kpIds.length > 0) {
      const masteries = await prisma.studentKnowledgeMastery.findMany({
        where: {
          studentId: student.id,
          knowledgePointId: { in: kpIds },
        },
        select: { knowledgePointId: true, masteryLevel: true },
      })
      for (const m of masteries) {
        masteryMap.set(m.knowledgePointId, m.masteryLevel)
      }
    }

    // 7. 批量 upsert
    const operations = wrongResults.map((r) => {
      const kpInfo = kpByQuestionNo.get(String(r.question.questionNo))
      const knowledgePointName = kpInfo?.name ?? '未知'
      const knowledgePointWeakness = kpInfo
        ? masteryMap.has(kpInfo.id)
          ? Math.round((100 - masteryMap.get(kpInfo.id)!) ) / 100
          : 0.5
        : 0.5

      const existing = existingMap.get(r.questionId)
      const wrongCount = (existing?.wrongCount ?? 0) + 1
      const latestScoreRate = r.scoreRate
      const priorityScore = roundNumber(
        wrongCount * 0.4 +
        (1 - latestScoreRate) * 0.4 +
        knowledgePointWeakness * 0.2,
        4,
      )

      return prisma.wrongQuestion.upsert({
        where: { questionId: r.questionId },
        create: {
          questionId: r.questionId,
          examId,
          subject: exam.subject,
          knowledgePoint: knowledgePointName,
          wrongCount: 1,
          latestScoreRate,
          priorityScore,
        },
        update: {
          examId,
          wrongCount,
          latestScoreRate,
          priorityScore,
        },
      })
    })

    await prisma.$transaction(operations)
    return { count: wrongResults.length, examId, subject: exam.subject }
  }

  /**
   * 按科目获取错题列表，按优先级降序排列
   */
  static async getBySubject(params: {
    subject?: string
    limit?: number
    userId?: string
  } = {}): Promise<WrongQuestionItem[]> {
    const { subject, limit = 50, userId } = params

    const records = await prisma.wrongQuestion.findMany({
      where: {
        ...(subject ? { subject } : {}),
        ...(userId ? { exam: { userId } } : {}),
      },
      orderBy: { priorityScore: 'desc' },
      take: limit,
      include: {
        question: {
          select: {
            questionNo: true,
            questionType: true,
            fullScore: true,
            questionText: true,
          },
        },
        exam: {
          select: { title: true, examDate: true },
        },
      },
    })

    return records.map((r) => ({
      ...r,
      exam: {
        ...r.exam,
        examDate: r.exam.examDate,
      },
    })) as WrongQuestionItem[]
  }

  /**
   * 获取优先级最高的错题（默认前 10 条）
   */
  static async getTopPriority(limit = 10): Promise<WrongQuestionItem[]> {
    return this.getBySubject({ limit })
  }

  /**
   * 获取所有涉及到的科目（用于筛选）
   */
  static async getSubjects(userId?: string): Promise<string[]> {
    const result = await prisma.wrongQuestion.findMany({
      where: userId ? { exam: { userId } } : {},
      select: { subject: true },
      distinct: ['subject'],
      orderBy: { subject: 'asc' },
    })
    return result.map((r) => r.subject)
  }

  /**
   * 统计错题总数
   */
  static async getCount(params: { subject?: string; userId?: string } = {}): Promise<number> {
    return prisma.wrongQuestion.count({
      where: {
        ...(params.subject ? { subject: params.subject } : {}),
        ...(params.userId ? { exam: { userId: params.userId } } : {}),
      },
    })
  }

  /**
   * 根据 ID 删除错题记录
   */
  static async delete(id: string): Promise<boolean> {
    try {
      await prisma.wrongQuestion.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  }
}

// ── Helpers ──

function roundNumber(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
