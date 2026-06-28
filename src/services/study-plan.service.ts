// ── 学习计划生成服务（Phase 8） ──────────────────────
// 纯规则引擎（无 LLM），基于学习画像 + 错题数据
// 按 薄弱知识点 > 退步知识点 > 高优先级错题 生成 7 天计划
// ──────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'

// ── Types ──

export type StudyPlanTask = {
  title: string
  knowledgePoint: string
  duration: number
  reason: string
}

export type StudyPlanItem = {
  id: string
  subject: string
  planDate: string
  tasks: StudyPlanTask[]
  estimatedMinutes: number
  priority: number
}

export type StudyPlanGenerateResult = {
  plans: StudyPlanItem[]
  summary: string
}

// ── Internal types for the sorting algorithm ──

type CandidateItem = {
  sourceKey: string
  subject: string
  knowledgePoint: string
  priorityTier: 1 | 2 | 3
  priorityScore: number
  task: StudyPlanTask
}

// ── Service ──

export class StudyPlanService {
  // Priority tiers (lower = more urgent)
  private static readonly TIER_WEAK = 1
  private static readonly TIER_DECLINING = 2
  private static readonly TIER_WRONG = 3

  // Duration per task type (minutes)
  private static readonly DURATION_WEAK = 40
  private static readonly DURATION_DECLINING = 30
  private static readonly DURATION_WRONG = 25

  // Daily constraints
  private static readonly MIN_DAILY_MINUTES = 60
  private static readonly MAX_DAILY_MINUTES = 120
  private static readonly MAX_TASKS_PER_DAY = 3
  private static readonly PLAN_DAYS = 7

  // ── Public API ──

  /**
   * 生成未来 7 天的学习计划
   * 基于 LearningProfile（薄弱/退步知识点）和 WrongQuestion（高频错题）
   */
  static async generateWeeklyPlan(userId?: string): Promise<StudyPlanItem[]> {
    // 1. 收集所有候选任务
    const candidates = await this.collectCandidates(userId)

    if (candidates.length === 0) return []

    // 2. 按规则排序：(tier, -priorityScore)
    candidates.sort((a, b) => {
      if (a.priorityTier !== b.priorityTier) return a.priorityTier - b.priorityTier
      return b.priorityScore - a.priorityScore
    })

    // 3. 分配到 7 天
    const startDate = new Date()
    startDate.setHours(0, 0, 0, 0)

    const plans: Array<{
      subject: string
      planDate: Date
      tasks: StudyPlanTask[]
      estimatedMinutes: number
      priority: number
    }> = []

    const remaining = [...candidates]

    for (let dayOffset = 0; dayOffset < this.PLAN_DAYS; dayOffset++) {
      if (remaining.length === 0) break

      const planDate = new Date(startDate)
      planDate.setDate(planDate.getDate() + dayOffset)

      const dayTasks: StudyPlanTask[] = []
      let dayMinutes = 0

      for (let i = 0; i < remaining.length; i++) {
        if (dayTasks.length >= this.MAX_TASKS_PER_DAY) break

        const candidate = remaining[i]
        const taskMinutes = dayMinutes + candidate.task.duration

        if (taskMinutes <= this.MAX_DAILY_MINUTES) {
          dayTasks.push(candidate.task)
          dayMinutes = taskMinutes
          remaining.splice(i, 1)
          i-- // adjust index after splice
        }
      }

      // If we have tasks but are below minimum, pad the last task
      if (dayTasks.length > 0 && dayMinutes < this.MIN_DAILY_MINUTES) {
        const deficit = this.MIN_DAILY_MINUTES - dayMinutes
        dayTasks[dayTasks.length - 1].duration += deficit
        dayMinutes += deficit
      }

      if (dayTasks.length > 0) {
        const maxPriority = Math.max(
          ...remaining
            .concat(candidates.slice(0, 1)) // fallback
            .filter((c) => dayTasks.some((t) => t.knowledgePoint === c.knowledgePoint))
            .map((c) => c.priorityScore),
          0,
        )

        // Determine the primary subject for this day (most tasks)
        const subjectCounts = new Map<string, number>()
        for (const t of dayTasks) {
          const s = this.getSubjectForKnowledgePoint(t.knowledgePoint, candidates)
          subjectCounts.set(s, (subjectCounts.get(s) ?? 0) + 1)
        }
        const primarySubject =
          [...subjectCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '综合'

        plans.push({
          subject: primarySubject,
          planDate,
          tasks: dayTasks,
          estimatedMinutes: dayMinutes,
          priority: maxPriority || dayTasks.length,
        })
      }
    }

    // 4. 写入数据库（upsert）
    if (plans.length > 0) {
      const operations = plans.map((plan) =>
        prisma.studyPlan.upsert({
          where: {
            userId_subject_planDate: {
              userId: userId!,
              subject: plan.subject,
              planDate: plan.planDate,
            },
          },
          update: {
            tasks: plan.tasks,
            estimatedMinutes: plan.estimatedMinutes,
            priority: plan.priority,
          },
          create: {
            userId,
            subject: plan.subject,
            planDate: plan.planDate,
            tasks: plan.tasks,
            estimatedMinutes: plan.estimatedMinutes,
            priority: plan.priority,
          },
        }),
      )
      await prisma.$transaction(operations)
    }

    // 5. 返回已保存的计划
    return this.getPlans(undefined, userId)
  }

  /**
   * 重新生成（别名，语义更清晰）
   */
  static async refreshPlan(userId?: string): Promise<StudyPlanItem[]> {
    return this.generateWeeklyPlan(userId)
  }

  /**
   * 获取已生成的学习计划
   * @param day 可选，0=今天，1=明天...6=第六天
   */
  static async getPlans(day?: number, userId?: string): Promise<StudyPlanItem[]> {
    const startDate = new Date()
    startDate.setHours(0, 0, 0, 0)

    const where: Record<string, unknown> = {}

    if (userId) where.userId = userId

    if (day !== undefined) {
      const targetDate = new Date(startDate)
      targetDate.setDate(targetDate.getDate() + day)
      where.planDate = targetDate
    } else {
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + this.PLAN_DAYS)
      where.planDate = {
        gte: startDate,
        lt: endDate,
      }
    }

    const records = await prisma.studyPlan.findMany({
      where,
      orderBy: [{ planDate: 'asc' }, { priority: 'desc' }],
    })

    return records.map((r) => ({
      id: r.id,
      subject: r.subject,
      planDate: r.planDate.toISOString(),
      tasks: r.tasks as StudyPlanTask[],
      estimatedMinutes: r.estimatedMinutes,
      priority: r.priority,
    }))
  }

  // ── Private helpers ──

  /**
   * 从学习画像和错题本收集所有候选任务
   */
  private static async collectCandidates(userId?: string): Promise<CandidateItem[]> {
    const candidates: CandidateItem[] = []
    const seenKeys = new Set<string>()

    // 获取所有有学习画像的科目
    const profiles = await prisma.learningProfile.findMany({
      where: userId ? { userId } : {},
    })
    const profileSubjects = new Set(profiles.map((p) => p.subject))

    // 获取所有有错题的科目
    const wrongSubjects = await this.getWrongSubjects(userId)

    // 合并科目列表
    const allSubjects = new Set([...profileSubjects, ...wrongSubjects])

    if (allSubjects.size === 0) return []

    for (const subject of allSubjects) {
      const profile = profiles.find((p) => p.subject === subject)

      // Tier 1: 薄弱知识点
      if (profile) {
        const weakPoints = profile.weakPoints as Array<{ name: string; mastery: number }> | null
        if (weakPoints && Array.isArray(weakPoints)) {
          for (const wp of weakPoints) {
            const key = `weak:${subject}:${wp.name}`
            if (seenKeys.has(key)) continue
            seenKeys.add(key)

            const masteryPercent = Math.round(wp.mastery * 100)
            candidates.push({
              sourceKey: key,
              subject,
              knowledgePoint: wp.name,
              priorityTier: this.TIER_WEAK,
              priorityScore: Math.round((1 - wp.mastery) * 100),
              task: {
                title: `巩固: ${wp.name}`,
                knowledgePoint: wp.name,
                duration: this.DURATION_WEAK,
                reason: `薄弱知识点，掌握率仅 ${masteryPercent}%`,
              },
            })
          }
        }

        // Tier 2: 退步知识点
        const decliningPoints = profile.decliningPoints as Array<{ name: string; delta: number }> | null
        if (decliningPoints && Array.isArray(decliningPoints)) {
          for (const dp of decliningPoints) {
            const key = `declining:${subject}:${dp.name}`
            if (seenKeys.has(key)) continue
            seenKeys.add(key)

            const deltaPercent = Math.round(Math.abs(dp.delta) * 100)
            candidates.push({
              sourceKey: key,
              subject,
              knowledgePoint: dp.name,
              priorityTier: this.TIER_DECLINING,
              priorityScore: Math.round(Math.abs(dp.delta) * 100),
              task: {
                title: `复习: ${dp.name}`,
                knowledgePoint: dp.name,
                duration: this.DURATION_DECLINING,
                reason: `退步知识点，较上次下降 ${deltaPercent}%`,
              },
            })
          }
        }
      }

      // Tier 3: 高优先级错题
      const wrongQuestions = await prisma.wrongQuestion.findMany({
        where: {
          subject,
          priorityScore: { gt: 0 },
          ...(userId ? { exam: { userId } } : {}),
        },
        orderBy: { priorityScore: 'desc' },
        take: 10, // 每科最多取 10 道错题
        include: {
          question: { select: { questionNo: true } },
        },
      })

      for (const wq of wrongQuestions) {
        const key = `wrong:${subject}:${wq.knowledgePoint}:${wq.questionId}`
        if (seenKeys.has(key)) continue
        seenKeys.add(key)

        const wrongCount = wq.wrongCount
        const scoreRatePercent = Math.round(wq.latestScoreRate * 100)
        candidates.push({
          sourceKey: key,
          subject,
          knowledgePoint: wq.knowledgePoint,
          priorityTier: this.TIER_WRONG,
          priorityScore: Math.round(wq.priorityScore * 10),
          task: {
            title: `纠错: ${wq.knowledgePoint}`,
            knowledgePoint: wq.knowledgePoint,
            duration: this.DURATION_WRONG,
            reason: `高频错题（第 ${wq.question.questionNo} 题），已错误 ${wrongCount} 次，得分率 ${scoreRatePercent}%`,
          },
        })
      }
    }

    return candidates
  }

  /**
   * 获取有错题记录的科目
   */
  private static async getWrongSubjects(userId?: string): Promise<string[]> {
    const result = await prisma.wrongQuestion.findMany({
      where: userId ? { exam: { userId } } : {},
      select: { subject: true },
      distinct: ['subject'],
    })
    return result.map((r) => r.subject)
  }

  /**
   * 根据知识点名称查找对应的科目
   */
  private static getSubjectForKnowledgePoint(
    knowledgePoint: string,
    candidates: CandidateItem[],
  ): string {
    const found = candidates.find((c) => c.knowledgePoint === knowledgePoint)
    return found?.subject ?? '综合'
  }
}
