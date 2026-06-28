// ── 系统指标聚合服务（Beta 监控） ──────────────
// 从真实数据库聚合：OCR / AI / 反馈 / 数据规模
// ────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'

// ── 类型 ──

export type SystemAnalyticsData = {
  ocr: {
    totalCalls: number
    successRate: number  // 0–100
    avgDuration: number  // 秒
    paddleCount: number
    doubaoCount: number
    smartModeCount: number
    avgQuality: number
    avgOcrDuration: number
  }
  ai: {
    totalCalls: number
    schemaPassRate: number  // 0–100
    avgTokens: number
    avgDuration: number  // 秒
  }
  feedback: {
    totalFeedback: number
    accuracyRate: number  // 0–100
    helpfulRate: number   // 0–100
  }
  dataScale: {
    examCount: number
    questionCount: number
    questionResultCount: number
    knowledgePointCount: number
  }
  scoreBreakdown: {
    totalCount: number
    matchedQuestionCount: number
    successRate: number
  }
}

// ── 服务 ──

export class SystemAnalyticsService {
  /**
   * 聚合全部系统指标 — 使用 count/aggregate 代替全表扫描
   */
  static async getMetrics(): Promise<SystemAnalyticsData> {
    const [
      reportTotal,
      reportSuccess,
      reportAvgDuration,
      reportAvgTotalTokens,
      fbTotal,
      fbAccurate,
      fbHelpful,
      examCount,
      questionCount,
      questionResultCount,
      knowledgePointCount,
      knowledgeNodeCount,
      // OCR 引擎统计
      paddleCount,
      doubaoCount,
      smartModeCount,
      reportAvgQuality,
      reportAvgOcrDuration,
      // ScoreBreakdown 统计
      scoreBreakdownTotal,
      scoreBreakdownMatched,
    ] = await Promise.all([
      // 分析报告统计（同时作为 OCR 和 AI 分析的数据源）
      prisma.analysisReport.count(),
      prisma.analysisReport.count({ where: { status: 'SUCCESS' } }),
      prisma.analysisReport.aggregate({
        _avg: { durationMs: true },
        where: { status: 'SUCCESS', durationMs: { not: null } },
      }),
      // 平均 Token 量（从 AnalysisReport 的总 token 统计）
      prisma.analysisReport.aggregate({
        _avg: { totalTokens: true },
        where: { status: 'SUCCESS', totalTokens: { not: null } },
      }),

      // 用户反馈统计
      prisma.analysisFeedback.count(),
      prisma.analysisFeedback.count({ where: { accurate: true } }),
      prisma.analysisFeedback.count({ where: { helpful: true } }),

      // 数据规模
      prisma.exam.count(),
      prisma.question.count(),
      prisma.questionResult.count(),
      prisma.knowledgePoint.count(),
      prisma.knowledgeNode.count(), // 知识图谱种子节点

      // OCR 引擎统计
      prisma.analysisReport.count({ where: { ocrEngine: 'PADDLE' } }),
      prisma.analysisReport.count({ where: { ocrEngine: 'DOUBAO' } }),
      prisma.analysisReport.count({ where: { ocrMode: 'SMART' } }),
      prisma.analysisReport.aggregate({
        _avg: { ocrQuality: true },
        where: { ocrQuality: { not: null } },
      }),
      prisma.analysisReport.aggregate({
        _avg: { ocrDurationMs: true },
        where: { ocrDurationMs: { not: null } },
      }),
      // ScoreBreakdown 统计
      prisma.scoreBreakdown.count(),
      prisma.questionResult.count({
        where: { lostScore: { not: null } },
      }),
    ])

    // ── OCR / 流水线指标 ──
    const ocr = {
      totalCalls: reportTotal,
      successRate: reportTotal > 0 ? Math.round((reportSuccess / reportTotal) * 100) : 0,
      avgDuration:
        reportAvgDuration._avg.durationMs != null
          ? Math.round((reportAvgDuration._avg.durationMs / 1000) * 10) / 10
          : 0,
      paddleCount,
      doubaoCount,
      smartModeCount,
      avgQuality:
        reportAvgQuality._avg.ocrQuality != null
          ? Math.round(reportAvgQuality._avg.ocrQuality * 10) / 10
          : 0,
      avgOcrDuration:
        reportAvgOcrDuration._avg.ocrDurationMs != null
          ? Math.round((reportAvgOcrDuration._avg.ocrDurationMs / 1000) * 10) / 10
          : 0,
    }

    // ── AI 分析指标（从 AnalysisReport 统计，AiAnalysisLog 表暂未写入） ──
    const ai = {
      totalCalls: reportTotal,
      schemaPassRate: reportTotal > 0 ? Math.round((reportSuccess / reportTotal) * 100) : 0,
      avgTokens:
        reportAvgTotalTokens._avg.totalTokens != null
          ? Math.round(reportAvgTotalTokens._avg.totalTokens)
          : 0,
      avgDuration:
        reportAvgDuration._avg.durationMs != null
          ? Math.round((reportAvgDuration._avg.durationMs / 1000) * 10) / 10
          : 0,
    }

    // ── 用户反馈指标 ──
    const feedback = {
      totalFeedback: fbTotal,
      accuracyRate: fbTotal > 0 ? Math.round((fbAccurate / fbTotal) * 100) : 0,
      helpfulRate: fbTotal > 0 ? Math.round((fbHelpful / fbTotal) * 100) : 0,
    }

    // ── 数据规模 ──
    const dataScale = {
      examCount,
      questionCount,
      questionResultCount,
      knowledgePointCount: knowledgePointCount + knowledgeNodeCount, // 合并两种知识点表
    }

    // ── 小分识别指标 ──
    const scoreBreakdown = {
      totalCount: scoreBreakdownTotal,
      matchedQuestionCount: scoreBreakdownMatched,
      successRate: scoreBreakdownTotal > 0
        ? Math.round((scoreBreakdownMatched / scoreBreakdownTotal) * 100)
        : 0,
    }

    return { ocr, ai, feedback, dataScale, scoreBreakdown }
  }
}
