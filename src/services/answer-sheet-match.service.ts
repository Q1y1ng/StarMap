// ── AnswerSheet Match Service（Phase 4） ─────────────────
// 将答题卡得分与考试题目自动关联，生成 QuestionResult

import { prisma } from '@/lib/prisma'
import type { AnswerSheetEntry } from '@/lib/answer-sheet/types'

export type MatchedResult = {
  questionId: string
  questionNo: number
  questionType: string
  score: number
  fullScore: number
  scoreRate: number
  isCorrect: boolean
}

export class AnswerSheetMatchService {
  /**
   * 根据 questionNo 匹配答题卡得分与考试题目
   */
  static async match(
    examId: string,
    entries: AnswerSheetEntry[],
  ): Promise<MatchedResult[]> {
    // 获取该考试的所有题目
    const questions = await prisma.question.findMany({
      where: { examId },
      orderBy: { sortOrder: 'asc' },
    })

    // 建立 questionNo → Question 的映射
    const questionMap = new Map(
      questions.map((q) => [q.questionNo, q]),
    )

    // 逐条匹配
    const results: MatchedResult[] = []
    const unmatchedNos: number[] = []

    for (const entry of entries) {
      const question = questionMap.get(entry.questionNo)
      if (!question) {
        unmatchedNos.push(entry.questionNo)
        continue
      }

      const fullScore = entry.fullScore > 0 ? entry.fullScore : question.fullScore
      const scoreRate = fullScore > 0 ? Math.round((entry.score / fullScore) * 100) / 100 : 0

      results.push({
        questionId: question.id,
        questionNo: entry.questionNo,
        questionType: question.questionType,
        score: entry.score,
        fullScore,
        scoreRate,
        isCorrect: entry.score >= fullScore,
      })
    }

    if (unmatchedNos.length > 0) {
      console.warn(`[AnswerSheetMatch] 未找到题号对应的题目: ${unmatchedNos.join(', ')}`)
    }

    return results.sort((a, b) => a.questionNo - b.questionNo)
  }

  /**
   * 保存匹配结果到数据库（创建 QuestionResult）
   */
  static async saveResults(
    examId: string,
    results: MatchedResult[],
  ): Promise<number> {
    // 先删除该考试的旧结果（幂等保存）
    await prisma.questionResult.deleteMany({
      where: { examId },
    })

    // 批量创建新结果
    await prisma.questionResult.createMany({
      data: results.map((r) => ({
        questionId: r.questionId,
        examId,
        score: r.score,
        fullScore: r.fullScore,
        lostScore: Math.max(0, r.fullScore - r.score), // Phase 13
        scoreRate: r.scoreRate,
        isCorrect: r.isCorrect,
      })),
    })

    return results.length
  }

  /**
   * 获取考试的已有 QuestionResult
   */
  static async getByExamId(examId: string) {
    const results = await prisma.questionResult.findMany({
      where: { examId },
      include: { question: true },
      orderBy: { question: { sortOrder: 'asc' } },
    })

    return results.map((r) => ({
      id: r.id,
      questionId: r.questionId,
      questionNo: r.question.questionNo,
      questionType: r.question.questionType,
      questionText: r.question.questionText,
      score: r.score,
      fullScore: r.fullScore,
      scoreRate: r.scoreRate,
      isCorrect: r.isCorrect,
    }))
  }
}
