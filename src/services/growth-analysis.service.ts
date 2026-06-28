// ── Growth Analysis Service（Phase 5） ─────────────────
// 成长趋势分析服务 — 全数据驱动，无 AI 依赖
//
// 算法：
//   对每个知识点，取最近 N 次考试的掌握率
//   用首尾对比法计算变化量 delta
//   delta >= +0.10 → "improving"
//   delta <= -0.10 → "declining"
//   否则 → "stable"

import { prisma } from '@/lib/prisma'

export type GrowthTrendItem = {
  name: string
  delta: number
  direction: 'improving' | 'declining' | 'stable'
  currentMastery: number
  previousMastery: number
  dataPoints: { examDate: string; mastery: number }[]
}

export type GrowthAnalysisResult = {
  subject: string
  improving: GrowthTrendItem[]
  declining: GrowthTrendItem[]
  stable: GrowthTrendItem[]
  summary: string
}

export type KpTimeline = {
  knowledgePoint: string
  data: { examId: string; examDate: string; mastery: number; score: number; fullScore: number }[]
}

export class GrowthAnalysisService {
  /**
   * 分析指定科目的知识点成长趋势
   * @param subject 科目
   * @param limit 每知识点取最近多少次考试（默认 5）
   * 使用单次查询 + 内存分组消除 N+1
   */
  static async analyze(
    subject: string,
    limit = 5,
    userId?: string,
  ): Promise<GrowthAnalysisResult> {
    // 1. 一次性查询所有记录，按知识点+日期排序
    const where = userId ? { subject, exam: { userId } } : { subject }
    const allRecords = await prisma.knowledgeMasteryHistory.findMany({
      where,
      orderBy: [{ knowledgePoint: 'asc' }, { examDate: 'asc' }],
    })

    if (allRecords.length === 0) {
      return { subject, improving: [], declining: [], stable: [], summary: '暂无数据' }
    }

    // 2. 在内存中按知识点分组
    const kpGroups = new Map<string, typeof allRecords>()
    for (const r of allRecords) {
      if (!kpGroups.has(r.knowledgePoint)) {
        kpGroups.set(r.knowledgePoint, [])
      }
      kpGroups.get(r.knowledgePoint)!.push(r)
    }

    const improving: GrowthTrendItem[] = []
    const declining: GrowthTrendItem[] = []
    const stable: GrowthTrendItem[] = []

    // 3. 遍历分组进行计算
    for (const [knowledgePoint, records] of kpGroups) {
      // 取最近 limit 条
      const recent = records.slice(-limit)
      if (recent.length < 2) continue

      const first = recent[0]
      const last = recent[recent.length - 1]
      const delta = Math.round((last.mastery - first.mastery) * 100) / 100

      const dataPoints = recent.map((r) => ({
        examDate: r.examDate.toISOString(),
        mastery: r.mastery,
      }))

      const item: GrowthTrendItem = {
        name: knowledgePoint,
        delta,
        direction: delta >= 0.1 ? 'improving' : delta <= -0.1 ? 'declining' : 'stable',
        currentMastery: last.mastery,
        previousMastery: first.mastery,
        dataPoints,
      }

      if (item.direction === 'improving') improving.push(item)
      else if (item.direction === 'declining') declining.push(item)
      else stable.push(item)
    }

    // 按 |delta| 降序排序
    const sortByAbsDelta = (a: GrowthTrendItem, b: GrowthTrendItem) =>
      Math.abs(b.delta) - Math.abs(a.delta)

    improving.sort(sortByAbsDelta)
    declining.sort(sortByAbsDelta)
    stable.sort(sortByAbsDelta)

    return {
      subject,
      improving,
      declining,
      stable,
      summary: `${improving.length} 个知识点进步，${declining.length} 个退步，${stable.length} 个稳定`,
    }
  }

  /**
   * 获取知识点时间线数据（用于图表展示）
   * 按知识点分组返回，每个知识点包含时间序列
   * 取最近 N 条记录，避免全表扫描
   */
  static async getTimelines(
    subject: string,
    limit = 10,
    userId?: string,
  ): Promise<KpTimeline[]> {
    // 1. 先获取该科目的知识点数量，估算合理上界
    const where = userId ? { subject, exam: { userId } } : { subject }
    const kpCount = await prisma.knowledgeMasteryHistory.findMany({
      where,
      distinct: ['knowledgePoint'],
      select: { knowledgePoint: true },
    })

    if (kpCount.length === 0) return []

    // 2. 限制最大获取量：limit × 知识点数 × 2（冗余余量），最高 500
    const maxFetch = Math.min(kpCount.length * limit * 2, 500)

    // 3. 获取最近记录
    const records = await prisma.knowledgeMasteryHistory.findMany({
      where,
      orderBy: { examDate: 'asc' },
      take: maxFetch,
    })

    if (records.length === 0) return []

    // 4. 按知识点分组，取每个知识点最近 limit 条记录
    const kpGroups = new Map<string, typeof records>()
    for (const r of records) {
      if (!kpGroups.has(r.knowledgePoint)) {
        kpGroups.set(r.knowledgePoint, [])
      }
      kpGroups.get(r.knowledgePoint)!.push(r)
    }

    const timelines: KpTimeline[] = []
    for (const [kpName, items] of kpGroups) {
      // 取最近 limit 条
      const recent = items.slice(-limit)
      timelines.push({
        knowledgePoint: kpName,
        data: recent.map((r) => ({
          examId: r.examId,
          examDate: r.examDate.toISOString(),
          mastery: r.mastery,
          score: r.score,
          fullScore: r.fullScore,
        })),
      })
    }

    return timelines.sort(
      (a, b) => b.data.length - a.data.length, // 考试次数多的在前
    )
  }
}
