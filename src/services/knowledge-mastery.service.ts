// ── Knowledge Mastery Service（Phase 4） ────────────────
// 统计各知识点的平均得分率
//
// 数据来源：
//   QuestionResult — 每题得分/满分
//   ExamKnowledgePoint — 知识点到题号的映射
//   通过 questionNo 关联

import { prisma } from '@/lib/prisma'

export type KnowledgeMasteryItem = {
  knowledgePoint: string
  knowledgePointId: string
  mastery: number      // 0-1
  totalScore: number
  totalFullScore: number
  examCount: number
}

export class KnowledgeMasteryService {
  /**
   * 统计指定科目最近 N 次考试的知识点掌握率
   */
  static async getBySubject(
    subject: string,
    limit = 10,
    userId?: string,
  ): Promise<KnowledgeMasteryItem[]> {
    // 1. 获取最近 limit 次有 QuestionResult 的考试
    const exams = await prisma.exam.findMany({
      where: {
        subject,
        userId,
        questionResults: { some: {} }, // 只有有成绩的考试
      },
      orderBy: { examDate: 'desc' },
      take: limit,
      select: { id: true },
    })

    if (exams.length === 0) {
      // 回退到 KnowledgeMasteryHistory（快速分析流程无 QuestionResult/ExamKnowledgePoint）
      return KnowledgeMasteryService.getBySubjectFromHistory(subject, limit, userId)
    }

    const examIds = exams.map((e) => e.id)

    // 2. 获取这些考试的知识点映射
    const examKps = await prisma.examKnowledgePoint.findMany({
      where: { examId: { in: examIds } },
      include: { knowledgePoint: { select: { name: true } } },
    })

    // 3. 获取所有 QuestionResult
    const results = await prisma.questionResult.findMany({
      where: { examId: { in: examIds } },
      include: { question: { select: { questionNo: true } } },
    })

    // 4. 按 questionNo 建立结果索引：{examId -> {questionNo -> QuestionResult}}
    const resultByExam = new Map<string, Map<number, typeof results[0]>>()
    for (const r of results) {
      if (!resultByExam.has(r.examId)) {
        resultByExam.set(r.examId, new Map())
      }
      resultByExam.get(r.examId)!.set(r.question.questionNo, r)
    }

    // 5. 统计每个知识点的总得分/满分
    const kpStats = new Map<
      string,
      {
        name: string
        totalScore: number
        totalFullScore: number
        examSet: Set<string>
      }
    >()

    for (const ekp of examKps) {
      const kpId = ekp.knowledgePointId
      const kpName = ekp.knowledgePoint.name
      const examResultMap = resultByExam.get(ekp.examId)

      if (!kpStats.has(kpId)) {
        kpStats.set(kpId, { name: kpName, totalScore: 0, totalFullScore: 0, examSet: new Set() })
      }
      const stat = kpStats.get(kpId)!

      // 遍历该知识点关联的题号
      for (const qn of ekp.questionNumbers) {
        const qno = parseInt(qn)
        const result = examResultMap?.get(qno)
        if (result) {
          stat.totalScore += result.score
          stat.totalFullScore += result.fullScore
          stat.examSet.add(ekp.examId)
        }
      }
    }

    // 6. 计算平均掌握率
    const result: KnowledgeMasteryItem[] = []
    for (const [kpId, stat] of kpStats) {
      result.push({
        knowledgePoint: stat.name,
        knowledgePointId: kpId,
        mastery: stat.totalFullScore > 0
          ? Math.round((stat.totalScore / stat.totalFullScore) * 100) / 100
          : 0,
        totalScore: stat.totalScore,
        totalFullScore: stat.totalFullScore,
        examCount: stat.examSet.size,
      })
    }

    return result.sort((a, b) => a.mastery - b.mastery) // 按掌握率升序（薄弱在前）
  }

  /**
   * 统计某次考试的知识点掌握率
   */
  static async getByExam(
    examId: string,
  ): Promise<KnowledgeMasteryItem[]> {
    // 1. 获取考试信息
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { subject: true },
    })
    if (!exam) return []

    // 2. 获取该考试的知识点映射
    const examKps = await prisma.examKnowledgePoint.findMany({
      where: { examId },
      include: { knowledgePoint: { select: { name: true } } },
    })

    // 3. 获取所有 QuestionResult
    const results = await prisma.questionResult.findMany({
      where: { examId },
      include: { question: { select: { questionNo: true } } },
    })

    // 4. 按 questionNo 索引
    const resultByQno = new Map<number, typeof results[0]>()
    for (const r of results) {
      resultByQno.set(r.question.questionNo, r)
    }

    // 5. 统计
    const kpStats = new Map<
      string,
      { name: string; totalScore: number; totalFullScore: number }
    >()

    for (const ekp of examKps) {
      const kpId = ekp.knowledgePointId
      const kpName = ekp.knowledgePoint.name

      if (!kpStats.has(kpId)) {
        kpStats.set(kpId, { name: kpName, totalScore: 0, totalFullScore: 0 })
      }
      const stat = kpStats.get(kpId)!

      for (const qn of ekp.questionNumbers) {
        const qno = parseInt(qn)
        const result = resultByQno.get(qno)
        if (result) {
          stat.totalScore += result.score
          stat.totalFullScore += result.fullScore
        }
      }
    }

    return Array.from(kpStats.entries())
      .map(([kpId, stat]) => ({
        knowledgePoint: stat.name,
        knowledgePointId: kpId,
        mastery: stat.totalFullScore > 0
          ? Math.round((stat.totalScore / stat.totalFullScore) * 100) / 100
          : 0,
        totalScore: stat.totalScore,
        totalFullScore: stat.totalFullScore,
        examCount: 1,
      }))
      .sort((a, b) => a.mastery - b.mastery)
  }

  /**
   * 从 KnowledgeMasteryHistory 回退查询（快速分析流程的数据源）
   * 当 QuestionResult/ExamKnowledgePoint 无数据时，从掌握率历史聚合计算
   */
  private static async getBySubjectFromHistory(
    subject: string,
    limit = 10,
    userId?: string,
  ): Promise<KnowledgeMasteryItem[]> {
    // 获取最近的考试
    const exams = await prisma.exam.findMany({
      where: { subject, userId },
      orderBy: { examDate: 'desc' },
      take: limit,
      select: { id: true },
    })

    if (exams.length === 0) return []
    const examIds = exams.map((e) => e.id)

    // 获取该科目最近考试的知识点掌握率
    const records = await prisma.knowledgeMasteryHistory.findMany({
      where: {
        subject,
        examId: { in: examIds },
      },
      orderBy: { examDate: 'desc' },
    })

    if (records.length === 0) return []

    // 按知识点分组聚合
    const kpMap = new Map<
      string,
      { totalScore: number; totalFullScore: number; examSet: Set<string> }
    >()

    for (const r of records) {
      if (!kpMap.has(r.knowledgePoint)) {
        kpMap.set(r.knowledgePoint, { totalScore: 0, totalFullScore: 0, examSet: new Set() })
      }
      const stat = kpMap.get(r.knowledgePoint)!
      stat.totalScore += r.score
      stat.totalFullScore += r.fullScore
      stat.examSet.add(r.examId)
    }

    return Array.from(kpMap.entries())
      .map(([name, stat]) => ({
        knowledgePoint: name,
        knowledgePointId: name, // 快速分析模式没有标准 ID，用名称替代
        mastery:
          stat.totalFullScore > 0
            ? Math.round((stat.totalScore / stat.totalFullScore) * 100) / 100
            : 0,
        totalScore: stat.totalScore,
        totalFullScore: stat.totalFullScore,
        examCount: stat.examSet.size,
      }))
      .sort((a, b) => a.mastery - b.mastery)
  }
}
