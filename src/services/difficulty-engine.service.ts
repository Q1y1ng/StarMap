// ── 考试难度引擎 ────────────────────────────────
// Phase 7-A: 为每场考试生成 Difficulty Score（0.5~2.0）
// 用于修正不同考试之间的成绩可比性

import { prisma } from '@/lib/prisma'

// ── Types ──

export type DifficultyResult = {
  id: string
  examId: string
  difficultyScore: number
  averageScoreRate: number
  questionCount: number
  objectiveQuestionRatio: number
  subjectiveQuestionRatio: number
  knowledgeCoverage: number
  difficultyLevel: string
  createdAt: Date
}

export type DifficultyTrendItem = {
  examId: string
  examDate: string
  title: string
  subject: string
  difficultyScore: number
  difficultyLevel: string
}

export type DifficultyMetrics = {
  averageScoreRate: number
  questionCount: number
  objectiveQuestionRatio: number
  subjectiveQuestionRatio: number
  knowledgeCoverage: number
}

// ── Helpers ──

const OBJECTIVE_TYPES = new Set(['选择题', '判断题', '填空题'])

function classifyQuestionType(qType: string): 'objective' | 'subjective' {
  if (OBJECTIVE_TYPES.has(qType)) return 'objective'
  return 'subjective'
}

function scoreToLevel(score: number): 'Easy' | 'Normal' | 'Hard' | 'Very Hard' {
  if (score <= 0.8) return 'Easy'
  if (score <= 1.2) return 'Normal'
  if (score <= 1.6) return 'Hard'
  return 'Very Hard'
}

// ── Service ──

export class DifficultyEngineService {

  /**
   * 获取考试难度 —— 已有缓存则直接返回，否则计算并存储
   */
  static async getOrCreate(examId: string): Promise<DifficultyResult | null> {
    // 1. 查缓存
    const existing = await prisma.examDifficulty.findUnique({ where: { examId } })
    if (existing) return existing

    // 2. 验证考试存在
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true },
    })
    if (!exam) return null

    // 3. 计算指标
    const metrics = await this.computeMetrics(examId)

    // 4. 计算难度分数
    const difficultyScore = this.calculateDifficultyScore(metrics)
    const difficultyLevel = scoreToLevel(difficultyScore)

    // 5. 存储并返回
    return prisma.examDifficulty.create({
      data: {
        examId,
        difficultyScore,
        difficultyLevel,
        ...metrics,
      },
    })
  }

  /**
   * 计算原始指标 — 三个查询并行执行
   * 若 Score/ExamKnowledgePoint 表为空（快速分析流程），则从 AnalysisReport 降级读取
   */
  private static async computeMetrics(examId: string): Promise<DifficultyMetrics> {
    const [scores, questions, knowledgeCoverage, report] = await Promise.all([
      // ── averageScoreRate：从 Score 表获取平均得分率 ──
      prisma.score.findMany({
        where: { examId },
        select: { score: true, maxScore: true },
      }),
      // ── 题目数量 & 客观/主观题比例 ──
      prisma.question.findMany({
        where: { examId },
        select: { questionType: true },
      }),
      // ── knowledgeCoverage：统计独立知识点数量 ──
      prisma.examKnowledgePoint.count({ where: { examId } }),
      // ── 同时读取 AnalysisReport 作为降级数据源 ──
      prisma.analysisReport.findFirst({
        where: { examId },
        select: { knowledgePoints: true },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const hasStandardData = scores.length > 0 || questions.length > 0 || knowledgeCoverage > 0

    if (hasStandardData) {
      // ── 标准路径：从 Score / Question / ExamKnowledgePoint 表计算 ──
      const averageScoreRate =
        scores.length > 0
          ? scores.reduce((sum, s) => sum + (s.maxScore > 0 ? s.score / s.maxScore : 0), 0) / scores.length
          : 0.5

      const questionCount = questions.length
      let objectiveCount = 0
      let subjectiveCount = 0
      for (const q of questions) {
        if (classifyQuestionType(q.questionType) === 'objective') {
          objectiveCount++
        } else {
          subjectiveCount++
        }
      }
      const safeCount = questionCount || 1
      const objectiveQuestionRatio = objectiveCount / safeCount
      const subjectiveQuestionRatio = subjectiveCount / safeCount

      return {
        averageScoreRate: round(averageScoreRate, 3),
        questionCount,
        objectiveQuestionRatio: round(objectiveQuestionRatio, 3),
        subjectiveQuestionRatio: round(subjectiveQuestionRatio, 3),
        knowledgeCoverage,
      }
    }

    // ── 降级路径：从 AnalysisReport JSON 推算（快速分析流程） ──
    const kpArray = report?.knowledgePoints as Array<{ name: string; score: string; total: string; mastery: string }> | null ?? []

    if (kpArray.length === 0) {
      // 没有任何数据，返回保守默认值
      return {
        averageScoreRate: 0.5,
        questionCount: 0,
        objectiveQuestionRatio: 0,
        subjectiveQuestionRatio: 0,
        knowledgeCoverage: 0,
      }
    }

    // 从 Question 表获取（AI 结果中的 questions 已被保存）
    const questionCount = questions.length

    // 从 knowledgePoints 推算平均得分率：每条 score/total 取平均
    let totalRate = 0
    let rateCount = 0
    for (const kp of kpArray) {
      const score = parseFloat(kp.score) || 0
      const total = parseFloat(kp.total) || 0
      if (total > 0) {
        totalRate += score / total
        rateCount++
      }
    }
    const averageScoreRate = rateCount > 0 ? totalRate / rateCount : 0.5

    // 从 Question 表得知客观/主观题比例
    let objectiveCount = 0
    let subjectiveCount = 0
    for (const q of questions) {
      if (classifyQuestionType(q.questionType) === 'objective') {
        objectiveCount++
      } else {
        subjectiveCount++
      }
    }
    const safeCount = questionCount || 1
    const subjectiveQuestionRatio = subjectiveCount / safeCount

    return {
      averageScoreRate: round(averageScoreRate, 3),
      questionCount,
      objectiveQuestionRatio: round(objectiveCount / safeCount, 3),
      subjectiveQuestionRatio: round(subjectiveQuestionRatio, 3),
      knowledgeCoverage: kpArray.length,
    }
  }

  /**
   * 计算难度分数（0.5 ~ 2.0）
   *
   * 加权公式：
   *   1. 平均得分率（反向，1 - rate）— 50%
   *   2. 题目数量（归一化到 30 题封顶）— 10%
   *   3. 知识点覆盖（归一化到 15 个封顶）— 20%
   *   4. 主观题占比 — 20%
   */
  static calculateDifficultyScore(metrics: {
    averageScoreRate: number
    questionCount: number
    subjectiveQuestionRatio: number
    knowledgeCoverage: number
  }): number {
    const scoreRateFactor = 1 - metrics.averageScoreRate
    const questionCountFactor = Math.min(metrics.questionCount / 30, 1)
    const knowledgeCoverageFactor = Math.min(metrics.knowledgeCoverage / 15, 1)
    const subjectiveRatioFactor = metrics.subjectiveQuestionRatio

    const normalized =
      0.5 * scoreRateFactor +
      0.1 * questionCountFactor +
      0.2 * knowledgeCoverageFactor +
      0.2 * subjectiveRatioFactor

    const difficultyScore = 0.5 + normalized * 1.5
    return round(difficultyScore, 2)
  }

  /**
   * 获取所有已计算难度的考试（用于趋势图）
   */
  static async getAllForTrend(userId?: string): Promise<DifficultyTrendItem[]> {
    const where = userId ? { exam: { userId } } : {}
    const records = await prisma.examDifficulty.findMany({
      where,
      include: {
        exam: {
          select: { examDate: true, title: true, subject: true },
        },
      },
      orderBy: { exam: { examDate: 'asc' } },
    })

    return records.map((r) => ({
      examId: r.examId,
      examDate: r.exam.examDate.toISOString().slice(0, 10),
      title: r.exam.title,
      subject: r.exam.subject,
      difficultyScore: r.difficultyScore,
      difficultyLevel: r.difficultyLevel,
    }))
  }
}

// ── Tiny helpers ──

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
