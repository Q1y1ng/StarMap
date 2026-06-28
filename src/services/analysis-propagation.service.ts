// ── Analysis Propagation Service ──────────────────────
// 在 AI 分析快速保存后，将分析结果传播到下游模块：
//   1. knowledge_mastery_history（成长趋势 / 风险预警的基础）
//   2. learning_profile（学习画像）
//   3. learning_risk（风险预警）
//
// 由 POST /api/analysis/save 在保存成功后调用。
// ───────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { LearningProfileService } from './learning-profile.service'
import { RiskAnalysisService } from './risk-analysis.service'

export type KnowledgePointInput = {
  name: string
  score: string
  total: string
  mastery: string // 如 "16.7%"
}

export type WeaknessInput = {
  name: string
  scoreRate: number // 0–100
  diagnosis: string
}

export class AnalysisPropagationService {
  /**
   * 将分析结果中的知识点掌握率写入 KnowledgeMasteryHistory
   * 幂等：先删除该考试已有记录，再批量创建
   */
  static async syncKnowledgeHistory(
    examId: string,
    subject: string,
    knowledgePoints: KnowledgePointInput[],
  ): Promise<number> {
    // 1. 获取考试日期
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { examDate: true },
    })
    if (!exam) {
      console.warn(`[AnalysisPropagation] Exam ${examId} not found, skipping history sync`)
      return 0
    }

    if (knowledgePoints.length === 0) {
      console.warn(`[AnalysisPropagation] No knowledge points to sync for exam ${examId}`)
      return 0
    }

    // 2. 将 AI 分析的知识点名称匹配到标准节点名
    const standardNames = await AnalysisPropagationService.matchKnowledgeNames(subject, knowledgePoints.map(kp => kp.name))

    // 3. 构建历史记录数据（使用标准化后的名称）
    const rawRecords = knowledgePoints.map((kp) => {
      const score = parseFloat(kp.score) || 0
      const total = parseFloat(kp.total) || 0
      // mastery 可能是 "16.7%" 或 "0.167" 格式
      let mastery: number
      if (kp.mastery.includes('%')) {
        mastery = parseFloat(kp.mastery.replace('%', '')) / 100
      } else {
        mastery = parseFloat(kp.mastery) || 0
      }
      // 如果解析失败，从 score/total 推算
      if (mastery === 0 && total > 0) {
        mastery = score / total
      }

      const standardizedName = standardNames.get(kp.name) ?? kp.name
      if (standardizedName !== kp.name) {
        console.log(`[AnalysisPropagation] 名称映射: "${kp.name}" → "${standardizedName}"`)
      }

      return {
        subject,
        knowledgePoint: standardizedName,
        examId,
        mastery: Math.round(mastery * 10000) / 10000,
        score,
        fullScore: total,
        examDate: exam.examDate,
      }
    })

    // 3a. 去重：同名知识点合并（AI 返回的多个知识点名可能映射到同一标准名）
    const dedupMap = new Map<string, typeof rawRecords[0]>()
    for (const r of rawRecords) {
      const key = `${r.subject}|${r.knowledgePoint}|${r.examId}`
      const existing = dedupMap.get(key)
      if (existing) {
        // 合并：分数累加，掌握率取较高的（倾向于对该知识点的整体评估）
        existing.score += r.score
        existing.fullScore += r.fullScore
        if (r.mastery > existing.mastery) existing.mastery = r.mastery
      } else {
        dedupMap.set(key, { ...r })
      }
    }
    const records = Array.from(dedupMap.values())
    if (records.length !== rawRecords.length) {
      console.log(
        `[AnalysisPropagation] 去重合并: ${rawRecords.length} → ${records.length} 条`,
      )
    }

    // 3b. 幂等删除已有记录
    await prisma.knowledgeMasteryHistory.deleteMany({
      where: { examId },
    })

    // 4. 批量创建
    const created = await prisma.knowledgeMasteryHistory.createMany({
      data: records,
    })

    console.log(
      `[AnalysisPropagation] Synced ${created.count} knowledge history records for exam ${examId} (${subject})`,
    )
    return created.count
  }

  /**
   * 执行完整传播：
   *   1. KnowledgeMasteryHistory
   *   2. LearningProfile.refresh()
   *   3. RiskAnalysis.refresh()
   *
   * 所有步骤独立容错，任一失败不影响其余。
   */
  static async propagateAll(
    examId: string,
    subject: string,
    knowledgePoints: KnowledgePointInput[],
    weaknesses?: WeaknessInput[],
  ): Promise<void> {
    const errors: string[] = []

    // 1. 同步掌握率历史
    try {
      await AnalysisPropagationService.syncKnowledgeHistory(examId, subject, knowledgePoints)
    } catch (err) {
      const msg = `syncKnowledgeHistory: ${err instanceof Error ? err.message : err}`
      console.error(`[AnalysisPropagation] ${msg}`)
      errors.push(msg)
    }

    // 2. 生成错题记录（从 AI 分析弱点）
    try {
      if (weaknesses && weaknesses.length > 0) {
        const count = await AnalysisPropagationService.generateWrongQuestions(examId, subject, weaknesses)
        console.log(`[AnalysisPropagation] WrongQuestions generated: ${count}`)
      }
    } catch (err) {
      const msg = `generateWrongQuestions: ${err instanceof Error ? err.message : err}`
      console.error(`[AnalysisPropagation] ${msg}`)
      errors.push(msg)
    }

    // 3. 刷新学习画像
    try {
      await LearningProfileService.refresh(subject)
      console.log(`[AnalysisPropagation] LearningProfile refreshed for ${subject}`)
    } catch (err) {
      const msg = `LearningProfile.refresh: ${err instanceof Error ? err.message : err}`
      console.error(`[AnalysisPropagation] ${msg}`)
      errors.push(msg)
    }

    // 4. 刷新风险预警（全量重算）
    try {
      await RiskAnalysisService.refresh()
      console.log(`[AnalysisPropagation] RiskAnalysis refreshed`)
    } catch (err) {
      const msg = `RiskAnalysis.refresh: ${err instanceof Error ? err.message : err}`
      console.error(`[AnalysisPropagation] ${msg}`)
      errors.push(msg)
    }

    if (errors.length > 0) {
      console.warn(`[AnalysisPropagation] Completed with ${errors.length} error(s):`, errors.join('; '))
    } else {
      console.log(`[AnalysisPropagation] All propagation complete for exam ${examId}`)
    }
  }

  /**
   * 从 AI 分析弱点生成错题记录
   * 对得分率 < 60% 的知识点，创建 WrongQuestion 记录（每题一个）
   * 若该考试已有 Question 记录，关联到全分最高的题；否则自动创建虚拟题
   */
  static async generateWrongQuestions(
    examId: string,
    subject: string,
    weaknesses: WeaknessInput[],
  ): Promise<number> {
    // 筛选得分率 < 60% 的弱点
    const weakItems = weaknesses.filter((w) => w.scoreRate < 60)
    if (weakItems.length === 0) return 0

    // 获取该考试已有的题目
    const existingQuestions = await prisma.question.findMany({
      where: { examId },
      orderBy: { fullScore: 'desc' },
    })

    let created = 0

    for (const weak of weakItems) {
      const scoreRate = weak.scoreRate / 100

      // 找已有的题，没有则创建虚拟题
      let questionId: string

      if (existingQuestions.length > 0) {
        // 用全分最高的题代表该知识点错题
        questionId = existingQuestions[0].id
      } else {
        // 创建虚拟题
        const virtual = await prisma.question.create({
          data: {
            examId,
            questionNo: 0,
            questionType: '综合分析',
            fullScore: 100,
            questionText: weak.diagnosis || `薄弱知识点：${weak.name}`,
          },
        })
        questionId = virtual.id
      }

      // 计算优先级分数（与 WrongQuestionService 公式一致）
      const priorityScore = Math.round(
        (1 * 0.4 + (1 - scoreRate) * 0.4 + 0.5 * 0.2) * 10000,
      ) / 10000

      // upsert 错题记录（按 questionId 唯一）
      await prisma.wrongQuestion.upsert({
        where: { questionId },
        update: {
          wrongCount: { increment: 1 },
          latestScoreRate: scoreRate,
          priorityScore,
        },
        create: {
          questionId,
          examId,
          subject,
          knowledgePoint: weak.name,
          wrongCount: 1,
          latestScoreRate: scoreRate,
          priorityScore,
        },
      })
      created++
    }

    return created
  }

  /**
   * 将 AI 分析的知识点名称匹配到标准 KnowledgeNode 名称
   * 匹配策略（按优先级）：
   *   1. 完全匹配
   *   2. AI 名包含标准名（如 "交通运输区位因素" → "交通运输"）
   *   3. 标准名包含 AI 名
   * 无匹配则保留原名称，不影响写入
   */
  private static async matchKnowledgeNames(
    subject: string,
    aiNames: string[],
  ): Promise<Map<string, string>> {
    // 获取该科目的所有标准节点名
    const nodes = await prisma.knowledgeNode.findMany({
      where: { subject },
      select: { name: true },
    })
    const standardNames = nodes.map((n) => n.name)

    const mapping = new Map<string, string>()

    for (const aiName of aiNames) {
      // 1. 完全匹配
      if (standardNames.includes(aiName)) {
        mapping.set(aiName, aiName)
        continue
      }

      // 2. 查找包含或反向包含的匹配
      let matched: string | undefined
      for (const stdName of standardNames) {
        if (aiName.includes(stdName) || stdName.includes(aiName)) {
          // 优先选更长的匹配（更精确）
          if (!matched || stdName.length > matched.length) {
            matched = stdName
          }
        }
      }

      if (matched) {
        mapping.set(aiName, matched)
      }
    }

    return mapping
  }
}
