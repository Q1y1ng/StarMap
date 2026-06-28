// ── Knowledge History Service（Phase 5） ───────────────
// 知识掌握率历史记录服务
// 每次保存答题卡成绩后自动生成快照，提供时间序列数据
//
// 数据来源：
//   KnowledgeMasteryService.getByExam() — 计算本次考试各知识点掌握率
//   写入 KnowledgeMasteryHistory 表

import { prisma } from '@/lib/prisma'
import { KnowledgeMasteryService } from './knowledge-mastery.service'

export type KnowledgeHistoryRecord = {
  id: string
  subject: string
  knowledgePoint: string
  examId: string
  mastery: number
  score: number
  fullScore: number
  examDate: string
  createdAt: string
}

export class KnowledgeHistoryService {
  /**
   * 为指定考试生成知识点掌握率历史记录（幂等）
   * 先删除该考试已有记录，再批量创建
   */
  static async generateForExam(examId: string): Promise<number> {
    // 1. 获取考试信息
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { subject: true, examDate: true },
    })
    if (!exam) {
      console.warn(`[KnowledgeHistory] Exam ${examId} not found, skipping history generation`)
      return 0
    }

    // 2. 获取本次考试的知识点掌握率
    const masteryItems = await KnowledgeMasteryService.getByExam(examId)
    if (masteryItems.length === 0) return 0

    // 3. 幂等删除已有记录
    await prisma.knowledgeMasteryHistory.deleteMany({
      where: { examId },
    })

    // 4. 批量创建新记录
    const created = await prisma.knowledgeMasteryHistory.createMany({
      data: masteryItems.map((item) => ({
        subject: exam.subject,
        knowledgePoint: item.knowledgePoint,
        examId,
        mastery: item.mastery,
        score: item.totalScore,
        fullScore: item.totalFullScore,
        examDate: exam.examDate,
      })),
    })

    console.log(
      `[KnowledgeHistory] Generated ${created.count} history records for exam ${examId}`,
    )
    return created.count
  }

  /**
   * 获取指定科目最近 N 次考试的掌握率历史
   */
  static async getBySubject(
    subject: string,
    limit = 10,
    userId?: string,
  ): Promise<KnowledgeHistoryRecord[]> {
    const records = userId
      ? await prisma.knowledgeMasteryHistory.findMany({
          where: { subject, exam: { userId } },
          orderBy: { examDate: 'desc' },
          take: limit,
        })
      : await prisma.knowledgeMasteryHistory.findMany({
          where: { subject },
          orderBy: { examDate: 'desc' },
          take: limit,
        })

    return records.map((r) => ({
      id: r.id,
      subject: r.subject,
      knowledgePoint: r.knowledgePoint,
      examId: r.examId,
      mastery: r.mastery,
      score: r.score,
      fullScore: r.fullScore,
      examDate: r.examDate.toISOString(),
      createdAt: r.createdAt.toISOString(),
    })).reverse() // 按时间升序返回，方便图表绘制
  }

  /**
   * 获取某次考试的掌握率历史
   */
  static async getByExam(examId: string): Promise<KnowledgeHistoryRecord[]> {
    const records = await prisma.knowledgeMasteryHistory.findMany({
      where: { examId },
      orderBy: { createdAt: 'asc' },
    })

    return records.map((r) => ({
      id: r.id,
      subject: r.subject,
      knowledgePoint: r.knowledgePoint,
      examId: r.examId,
      mastery: r.mastery,
      score: r.score,
      fullScore: r.fullScore,
      examDate: r.examDate.toISOString(),
      createdAt: r.createdAt.toISOString(),
    }))
  }
}
