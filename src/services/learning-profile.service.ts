// ── Learning Profile Service（Phase 5） ────────────────
// 学习画像服务
// 基于知识掌握率和成长趋势，生成学习画像
//
//  strongPoints: 掌握率最高的 3 个知识点
//  weakPoints:   掌握率最低的 3 个知识点
//  improvingPoints: 进步中的知识点
//  decliningPoints: 退步中的知识点

import { prisma } from '@/lib/prisma'
import { KnowledgeMasteryService } from './knowledge-mastery.service'
import { GrowthAnalysisService } from './growth-analysis.service'

export type ProfileKnowledgeItem = {
  name: string
  mastery: number
}

export type ProfileTrendItem = {
  name: string
  delta: number
}

export type LearningProfileData = {
  subject: string
  strongPoints: ProfileKnowledgeItem[]
  weakPoints: ProfileKnowledgeItem[]
  improvingPoints: ProfileTrendItem[]
  decliningPoints: ProfileTrendItem[]
  generatedAt: string
}

export class LearningProfileService {
  /**
   * 生成（或刷新）指定科目的学习画像
   * 调用 KnowledgeMasteryService + GrowthAnalysisService
   * 结果写入 LearningProfile 表（upsert）
   */
  static async refresh(subject: string, userId?: string): Promise<LearningProfileData> {
    // 1. 获取各知识点平均掌握率（最近 10 次考试）
    const masteryItems = await KnowledgeMasteryService.getBySubject(subject, 10, userId)

    // 按掌握率排序
    const sortedByMastery = [...masteryItems].sort(
      (a, b) => a.mastery - b.mastery,
    )

    // 强项：最高 3 个（取尾部，倒序使显示为从高到低）
    const strongPoints = sortedByMastery
      .slice(-3)
      .reverse()
      .filter((_, i, arr) => i < 3 && arr.length > 0)
      .map((item) => ({
        name: item.knowledgePoint,
        mastery: item.mastery,
      }))

    // 薄弱项：最低 3 个
    const weakPoints = sortedByMastery
      .slice(0, 3)
      .map((item) => ({
        name: item.knowledgePoint,
        mastery: item.mastery,
      }))

    // 2. 获取成长趋势分析
    const growthResult = await GrowthAnalysisService.analyze(subject, 5, userId)

    const improvingPoints: ProfileTrendItem[] = growthResult.improving
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .map((item) => ({ name: item.name, delta: item.delta }))

    const decliningPoints: ProfileTrendItem[] = growthResult.declining
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .map((item) => ({ name: item.name, delta: item.delta }))

    // 3. 存入数据库（upsert）
    const profile: LearningProfileData = {
      subject,
      strongPoints,
      weakPoints,
      improvingPoints,
      decliningPoints,
      generatedAt: new Date().toISOString(),
    }

    if (userId) {
      await prisma.learningProfile.upsert({
        where: { userId_subject: { userId, subject } },
        update: {
          strongPoints: profile.strongPoints,
          weakPoints: profile.weakPoints,
          improvingPoints: profile.improvingPoints,
          decliningPoints: profile.decliningPoints,
          generatedAt: new Date(),
        },
        create: {
          userId,
          subject,
          strongPoints: profile.strongPoints,
          weakPoints: profile.weakPoints,
          improvingPoints: profile.improvingPoints,
          decliningPoints: profile.decliningPoints,
        },
      })
    }

    return profile
  }

  /**
   * 获取指定科目当前的学习画像
   */
  static async get(subject: string, userId?: string): Promise<LearningProfileData | null> {
    const record = userId
      ? await prisma.learningProfile.findUnique({
          where: { userId_subject: { userId, subject } },
        })
      : await prisma.learningProfile.findFirst({
          where: { subject },
        })

    if (!record) return null

    return {
      subject: record.subject,
      strongPoints: record.strongPoints as ProfileKnowledgeItem[],
      weakPoints: record.weakPoints as ProfileKnowledgeItem[],
      improvingPoints: record.improvingPoints as ProfileTrendItem[],
      decliningPoints: record.decliningPoints as ProfileTrendItem[],
      generatedAt: record.generatedAt.toISOString(),
    }
  }
}
