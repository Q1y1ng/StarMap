// ── 学习风险预警服务（Phase 10） ──
// 纯统计方法：基于最近5次考试掌握率趋势分析
// ───────────────────────────────────────────────

import { prisma } from '@/lib/prisma'

// ── Types ──

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical'

export type RiskAnalysisDTO = {
  id: string
  subject: string
  knowledgePoint: string
  riskScore: number
  riskLevel: RiskLevel
  trendSlope: number
  sampleSize: number
  latestMastery: number
  createdAt: string
  /** 趋势数据点（用于前端图表） */
  trendData?: { examDate: string; mastery: number }[]
  /** 可解释的原因文本 */
  reason?: string
  /** 建议干预措施 */
  suggestion?: string
}

export type RiskAnalysisSummary = {
  total: number
  critical: number
  high: number
  medium: number
  low: number
  subjects: string[]
}

// ── RiskLevel 映射 ──

const INTERVENTIONS: Record<RiskLevel, string> = {
  Low: '继续保持，定期复习巩固',
  Medium: '建议增加该知识点的练习频率，回顾错题',
  High: '需要重点突破，建议安排专项练习并寻求辅导',
  Critical: '立即采取补救措施，系统复习该知识点及前置知识',
}

const INTERVENTIONS_DETAILED: Record<RiskLevel, string> = {
  Low: '当前掌握情况良好，建议按正常节奏学习，每周回顾一次即可',
  Medium: '掌握率呈下降趋势，建议每周增加2-3次针对性练习，重点复习错题',
  High: '掌握率明显下降，已低于70%，建议：1) 暂停新知识学习，集中突破 2) 每天安排30分钟专项训练 3) 回顾相关前置知识点',
  Critical: '掌握率持续快速下降，建议：1) 立即安排全面复习计划 2) 寻求老师或同学帮助 3) 使用错题本系统练习 4) 重新学习该章节内容',
}

// ── Service ──

export class RiskAnalysisService {
  /**
   * 执行完整的风险分析
   * 扫描当前用户的知识点 → 计算趋势 → 评估风险 → 持久化
   */
  static async analyze(userId?: string): Promise<RiskAnalysisDTO[]> {
    // 1. 获取当前用户所有知识点的最新掌握率数据
    const whereGroup = userId ? { exam: { userId } } : {}
    const pairs = await prisma.knowledgeMasteryHistory.groupBy({
      by: ['subject', 'knowledgePoint'],
      where: whereGroup,
    })

    const results: RiskAnalysisDTO[] = []

    for (const { subject, knowledgePoint } of pairs) {
      const dto = await this.analyzeSingle(subject, knowledgePoint, userId)
      if (dto) results.push(dto)
    }

    // 2. 批量持久化
    await this.persistResults(results, userId)

    return results
  }

  /**
   * 刷新风险分析（先清空当前用户的数据再重新计算）
   */
  static async refresh(userId?: string): Promise<RiskAnalysisDTO[]> {
    if (userId) {
      await prisma.learningRisk.deleteMany({ where: { userId } })
    } else {
      await prisma.learningRisk.deleteMany()
    }
    return this.analyze(userId)
  }

  /**
   * 获取所有风险记录（支持筛选）
   */
  static async getRisks(options?: {
    subject?: string
    riskLevel?: RiskLevel
    userId?: string
    orderBy?: 'riskScore' | 'trendSlope' | 'latestMastery'
    orderDir?: 'asc' | 'desc'
    limit?: number
  }): Promise<RiskAnalysisDTO[]> {
    const where: Record<string, unknown> = {}
    if (options?.subject) where.subject = options.subject
    if (options?.riskLevel) where.riskLevel = options.riskLevel
    if (options?.userId) where.userId = options.userId

    const records = await prisma.learningRisk.findMany({
      where,
      orderBy: { [options?.orderBy ?? 'riskScore']: options?.orderDir ?? 'desc' },
      take: options?.limit ?? 100,
    })

    return records.map((r) => this.toDTO(r))
  }

  /**
   * 获取风险摘要统计（按用户）
   */
  static async getSummary(userId?: string): Promise<RiskAnalysisSummary> {
    const baseWhere = userId ? { userId } : {}
    const [all, subjects] = await Promise.all([
      prisma.learningRisk.findMany({
        where: baseWhere,
        select: { riskLevel: true },
      }),
      prisma.learningRisk.findMany({
        where: baseWhere,
        select: { subject: true },
        distinct: ['subject'],
        orderBy: { subject: 'asc' },
      }),
    ])

    const counts: Record<string, number> = { Low: 0, Medium: 0, High: 0, Critical: 0 }
    for (const r of all) {
      const level = r.riskLevel
      if (level in counts) counts[level]++
    }

    return {
      total: all.length,
      critical: counts.Critical,
      high: counts.High,
      medium: counts.Medium,
      low: counts.Low,
      subjects: subjects.map((s) => s.subject),
    }
  }

  /**
   * 获取单个知识点的趋势详情（用于图表）
   */
  static async getTrendDetail(
    subject: string,
    knowledgePoint: string,
    userId?: string,
  ): Promise<RiskAnalysisDTO | null> {
    const record = userId
      ? await prisma.learningRisk.findUnique({
          where: { userId_subject_knowledgePoint: { userId, subject, knowledgePoint } },
        })
      : await prisma.learningRisk.findFirst({
          where: { subject, knowledgePoint },
        })
    if (!record) return null

    // 获取原始趋势数据点
    const history = await prisma.knowledgeMasteryHistory.findMany({
      where: {
        subject,
        knowledgePoint,
        ...(userId ? { exam: { userId } } : {}),
      },
      orderBy: { examDate: 'asc' },
      select: { examDate: true, mastery: true },
      take: 5,
    })

    const dto = this.toDTO(record)
    dto.trendData = history.map((h) => ({
      examDate: h.examDate.toISOString().split('T')[0],
      mastery: h.mastery,
    }))
    dto.reason = this.explainRisk(record.trendSlope, record.latestMastery, history.length)
    dto.suggestion = INTERVENTIONS_DETAILED[record.riskLevel as RiskLevel] ?? INTERVENTIONS[record.riskLevel as RiskLevel]

    return dto
  }

  // ── Private ──

  /**
   * 分析单个知识点
   */
  private static async analyzeSingle(
    subject: string,
    knowledgePoint: string,
    userId?: string,
  ): Promise<RiskAnalysisDTO | null> {
    // 取最近5次考试数据
    const history = await prisma.knowledgeMasteryHistory.findMany({
      where: {
        subject,
        knowledgePoint,
        ...(userId ? { exam: { userId } } : {}),
      },
      orderBy: { examDate: 'asc' },
      take: 5,
    })

    if (history.length < 2) return null // 数据不足，跳过

    const values = history.map((h) => h.mastery)
    const slope = this.calculateSlope(values)

    const latestMastery = values[values.length - 1]
    const riskScore = this.calculateRiskScore(slope, latestMastery, values)

    return {
      id: '', // 暂未持久化
      subject,
      knowledgePoint,
      riskScore,
      riskLevel: this.scoreToLevel(riskScore),
      trendSlope: slope,
      sampleSize: history.length,
      latestMastery,
      createdAt: new Date().toISOString(),
      trendData: history.map((h) => ({
        examDate: h.examDate.toISOString().split('T')[0],
        mastery: h.mastery,
      })),
      reason: this.explainRisk(slope, latestMastery, history.length),
      suggestion: INTERVENTIONS[this.scoreToLevel(riskScore)],
    }
  }

  /**
   * 简单线性回归计算斜率
   * y = a + bx, 其中 x = 时间索引 (0, 1, 2, ...)
   */
  private static calculateSlope(values: number[]): number {
    const n = values.length
    if (n < 2) return 0

    // x 为时间索引 0, 1, 2, ..., n-1
    let sumX = 0
    let sumY = 0
    let sumXY = 0
    let sumX2 = 0

    for (let i = 0; i < n; i++) {
      sumX += i
      sumY += values[i]
      sumXY += i * values[i]
      sumX2 += i * i
    }

    const denominator = n * sumX2 - sumX * sumX
    if (denominator === 0) return 0

    const slope = (n * sumXY - sumX * sumY) / denominator
    return slope
  }

  /**
   * 计算风险分数 (0–100)
   *
   * 因素：
   * 1. 趋势斜率（下降越快风险越高）
   * 2. 最新掌握率（越低风险越高）
   * 3. 连续下降惩罚（连续下降且最新掌握率 < 70%）
   */
  private static calculateRiskScore(
    slope: number,
    latestMastery: number,
    values: number[],
  ): number {
    let score = 0

    // 1. 趋势贡献 (斜率 ≤ 0 时产生风险)
    if (slope < 0) {
      // 斜率每 -0.05 增加 10 分，上限 40 分
      score += Math.min(Math.abs(slope) * 200, 40)
    }

    // 2. 掌握率贡献 (掌握率越低分越高)
    if (latestMastery < 0.7) {
      // (0.7 - mastery) * 100，上限 35 分
      score += Math.min((0.7 - latestMastery) * 100, 35)
    }

    // 3. 连续下降惩罚
    if (this.isContinuouslyDeclining(values) && latestMastery < 0.7) {
      score += 25
    }

    // 封顶
    return Math.min(Math.round(score * 10) / 10, 100)
  }

  /**
   * 判断是否连续下降
   */
  private static isContinuouslyDeclining(values: number[]): boolean {
    if (values.length < 3) return false
    // 检查最近3次是否连续下降
    for (let i = values.length - 2; i >= Math.max(0, values.length - 3); i--) {
      if (values[i] <= values[i + 1]) return false
    }
    return true
  }

  /**
   * 风险分数 → 风险等级
   */
  private static scoreToLevel(score: number): RiskLevel {
    if (score >= 80) return 'Critical'
    if (score >= 60) return 'High'
    if (score >= 30) return 'Medium'
    return 'Low'
  }

  /**
   * 生成可解释的原因文本
   */
  private static explainRisk(
    slope: number,
    latestMastery: number,
    sampleCount: number,
  ): string {
    const parts: string[] = []

    // 趋势方向
    if (slope < -0.03) {
      parts.push('掌握率快速下降')
    } else if (slope < 0) {
      parts.push('掌握率呈下降趋势')
    } else if (slope > 0.03) {
      parts.push('掌握率呈上升趋势')
    } else if (slope > 0) {
      parts.push('掌握率缓慢上升')
    } else {
      parts.push('掌握率基本平稳')
    }

    // 掌握率水平
    if (latestMastery < 0.3) {
      parts.push(`当前掌握率仅 ${Math.round(latestMastery * 100)}%，处于较低水平`)
    } else if (latestMastery < 0.5) {
      parts.push(`当前掌握率 ${Math.round(latestMastery * 100)}%，需要加强`)
    } else if (latestMastery < 0.7) {
      parts.push(`当前掌握率 ${Math.round(latestMastery * 100)}%，有提升空间`)
    } else {
      parts.push(`当前掌握率 ${Math.round(latestMastery * 100)}%，基础较好`)
    }

    // 样本量
    parts.push(`基于最近 ${sampleCount} 次考试分析`)

    return parts.join('；')
  }

  /**
   * 批量持久化分析结果
   */
  private static async persistResults(results: RiskAnalysisDTO[], userId?: string): Promise<void> {
    if (results.length === 0) return

    // 使用 upsert 避免重复
    for (const r of results) {
      if (userId) {
        await prisma.learningRisk.upsert({
          where: { userId_subject_knowledgePoint: { userId, subject: r.subject, knowledgePoint: r.knowledgePoint } },
          create: {
            userId,
            subject: r.subject,
            knowledgePoint: r.knowledgePoint,
            riskScore: r.riskScore,
            riskLevel: r.riskLevel,
            trendSlope: r.trendSlope,
            sampleSize: r.sampleSize,
            latestMastery: r.latestMastery,
          },
          update: {
            riskScore: r.riskScore,
            riskLevel: r.riskLevel,
            trendSlope: r.trendSlope,
            sampleSize: r.sampleSize,
            latestMastery: r.latestMastery,
          },
        })
      } else {
        // Fallback: use old composite key without userId
        const existing = await prisma.learningRisk.findFirst({
          where: { subject: r.subject, knowledgePoint: r.knowledgePoint },
        })
        if (existing) {
          await prisma.learningRisk.update({
            where: { id: existing.id },
            data: {
              subject: r.subject,
              knowledgePoint: r.knowledgePoint,
              riskScore: r.riskScore,
              riskLevel: r.riskLevel,
              trendSlope: r.trendSlope,
              sampleSize: r.sampleSize,
              latestMastery: r.latestMastery,
            },
          })
        } else {
          await prisma.learningRisk.create({
            data: {
              subject: r.subject,
              knowledgePoint: r.knowledgePoint,
              riskScore: r.riskScore,
              riskLevel: r.riskLevel,
              trendSlope: r.trendSlope,
              sampleSize: r.sampleSize,
              latestMastery: r.latestMastery,
            },
          })
        }
      }
    }
  }

  /**
   * 数据库记录 → DTO
   */
  private static toDTO(record: {
    id: string
    subject: string
    knowledgePoint: string
    riskScore: number
    riskLevel: string
    trendSlope: number
    sampleSize: number
    latestMastery: number
    createdAt: Date
  }): RiskAnalysisDTO {
    return {
      id: record.id,
      subject: record.subject,
      knowledgePoint: record.knowledgePoint,
      riskScore: record.riskScore,
      riskLevel: record.riskLevel as RiskLevel,
      trendSlope: record.trendSlope,
      sampleSize: record.sampleSize,
      latestMastery: record.latestMastery,
      createdAt: record.createdAt.toISOString(),
      reason: this.explainRisk(record.trendSlope, record.latestMastery, record.sampleSize),
      suggestion: INTERVENTIONS_DETAILED[record.riskLevel as RiskLevel] ?? INTERVENTIONS[record.riskLevel as RiskLevel],
    }
  }
}
