import { prisma } from '@/lib/prisma'
import { DifficultyEngineService } from './difficulty-engine.service'
import type { DifficultyTrendItem } from './difficulty-engine.service'

// ── 类型 ──

export type ScoreTrendItem = {
  examId: string
  examDate: string
  title: string
  subject: string
  totalScore: number
}

export type SubjectTrendItem = {
  subject: string
  data: { examDate: string; avgScore: number; examCount: number }[]
}

export type WeaknessTrendItem = {
  name: string
  frequency: number
  avgScoreRate: number
  lastDiagnosis: string
  trend: 'improving' | 'stable' | 'declining'
}

export type TrendStats = {
  totalExams: number
  totalReports: number
  subjectCount: number
  recentExams: { title: string; subject: string; examDate: string; totalScore: number }[]
}

// ── 服务 ──

export class TrendService {
  /**
   * 1. 成绩趋势 — 所有考试按时间升序
   */
  static async getScoreTrend(userId: string): Promise<ScoreTrendItem[]> {
    const exams = await prisma.exam.findMany({
      where: { aiStatus: 'COMPLETED', userId },
      orderBy: { examDate: 'asc' },
      select: { id: true, examDate: true, title: true, subject: true, totalScore: true },
    })
    return exams.map((e) => ({
      examId: e.id,
      examDate: e.examDate.toISOString().slice(0, 10),
      title: e.title,
      subject: e.subject,
      totalScore: e.totalScore,
    }))
  }

  /**
   * 2. 各科平均分趋势 — 按月聚合，每科一条线
   */
  static async getSubjectTrends(userId: string): Promise<SubjectTrendItem[]> {
    const exams = await prisma.exam.findMany({
      where: { aiStatus: 'COMPLETED', userId },
      orderBy: { examDate: 'asc' },
      select: { subject: true, examDate: true, totalScore: true },
    })

    // subject → [{ month, scores[] }]
    const grouped = new Map<string, Map<string, number[]>>()
    for (const exam of exams) {
      const month = exam.examDate.toISOString().slice(0, 7) // YYYY-MM
      if (!grouped.has(exam.subject)) grouped.set(exam.subject, new Map())
      const monthMap = grouped.get(exam.subject)!
      if (!monthMap.has(month)) monthMap.set(month, [])
      monthMap.get(month)!.push(exam.totalScore)
    }

    return Array.from(grouped.entries()).map(([subject, monthMap]) => ({
      subject,
      data: Array.from(monthMap.entries())
        .map(([month, scores]) => ({
          examDate: month,
          avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          examCount: scores.length,
        }))
        .sort((a, b) => a.examDate.localeCompare(b.examDate)),
    }))
  }

  /**
   * 3. 薄弱知识点趋势 — 统计各知识点作为薄弱点出现的频率
   */
  static async getWeaknessTrends(userId: string): Promise<WeaknessTrendItem[]> {
    const reports = await prisma.analysisReport.findMany({
      where: { exam: { userId } },
      select: { weaknesses: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const weakMap = new Map<
      string,
      { count: number; totalRate: number; lastDiagnosis: string; rates: number[] }
    >()

    for (const report of reports) {
      const weaknesses = report.weaknesses as Array<{
        name: string
        scoreRate: number
        diagnosis: string
      }>
      for (const w of weaknesses) {
        if (!weakMap.has(w.name)) {
          weakMap.set(w.name, { count: 0, totalRate: 0, lastDiagnosis: '', rates: [] })
        }
        const entry = weakMap.get(w.name)!
        entry.count++
        entry.totalRate += w.scoreRate
        entry.rates.push(w.scoreRate)
        entry.lastDiagnosis = w.diagnosis
      }
    }

    return Array.from(weakMap.entries())
      .map(([name, data]) => {
        // 判断趋势：比较前一半和后一半的平均得分率
        const sorted = data.rates.sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        const firstHalf = sorted.slice(0, mid)
        const secondHalf = sorted.slice(mid)
        const firstAvg = firstHalf.length ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0
        const secondAvg = secondHalf.length ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0
        let trend: 'improving' | 'stable' | 'declining' = 'stable'
        const diff = secondAvg - firstAvg
        if (diff > 5) trend = 'improving'
        else if (diff < -5) trend = 'declining'

        return {
          name,
          frequency: data.count,
          avgScoreRate: Math.round(data.totalRate / data.count),
          lastDiagnosis: data.lastDiagnosis,
          trend,
        }
      })
      .sort((a, b) => b.frequency - a.frequency)
  }

  /**
   * 5. 难度趋势 — 所有有难度评分的考试按时间升序
   */
  static async getDifficultyTrend(userId?: string): Promise<DifficultyTrendItem[]> {
    return DifficultyEngineService.getAllForTrend(userId)
  }

  /**
   * 4. 最近考试统计
   */
  static async getStats(userId: string): Promise<TrendStats> {
    const [examCount, reportCount, distinctSubjects, recentExams] = await Promise.all([
      prisma.exam.count({ where: { aiStatus: 'COMPLETED', userId } }),
      prisma.analysisReport.count({ where: { exam: { userId } } }),
      prisma.exam.findMany({
        where: { aiStatus: 'COMPLETED', userId },
        select: { subject: true },
        distinct: ['subject'],
      }),
      prisma.exam.findMany({
        where: { aiStatus: 'COMPLETED', userId },
        orderBy: { examDate: 'desc' },
        take: 5,
        select: { title: true, subject: true, examDate: true, totalScore: true },
      }),
    ])

    return {
      totalExams: examCount,
      totalReports: reportCount,
      subjectCount: distinctSubjects.length,
      recentExams: recentExams.map((e) => ({
        title: e.title,
        subject: e.subject,
        examDate: e.examDate.toISOString().slice(0, 10),
        totalScore: e.totalScore,
      })),
    }
  }
}
