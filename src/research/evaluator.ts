// ── 基线对照框架（Phase 16-B） ────────────────────────────
//
// 预留三种方案：
//   PaddleOCR    — 本地 OCR 引擎基线
//   SingleVision — 单页 Vision API 调用
//   StarMap      — 多页联合 Vision 解析（本系统方案）
//
// 统一接口 runBenchmark(method) 供后期实验对照调用。

import { ExamBenchmarkRunner } from './benchmark'
import { BenchmarkMethod } from './dataset'
import type { BenchmarkResult } from './dataset'

// ════════════════════════════════════════════════════════════
// 类型定义
// ════════════════════════════════════════════════════════════

/** 基线对照评测器统一接口 */
export interface BenchmarkEvaluator {
  /** 运行指定方法的完整评测 */
  runBenchmark(method: BenchmarkMethod): Promise<BenchmarkResult[]>

  /** 运行全部方法的对比评测 */
  runAllBenchmarks(): Promise<Map<BenchmarkMethod, BenchmarkResult[]>>

  /** 获取方法名称 */
  readonly name: string
}

/** 基线对照结果摘要 */
export interface BenchmarkSummary {
  /** 各方法平均指标 */
  methods: Array<{
    method: string
    avgMetrics: { qa: number; aa: number; sa: number; dsr: number }
    sampleCount: number
  }>
  /** 最佳方法（按 QA 排序） */
  bestMethod: string
  /** 评测时间 */
  timestamp: string
}

// ════════════════════════════════════════════════════════════
// 基线对照评测器
// ════════════════════════════════════════════════════════════

/**
 * ExamBenchEvaluator — 基线对照评测器
 *
 * 封装三种识别方案的统一评测入口。
 * 后期接入真实 API 后，通过 .runBenchmark(method) 一键触发。
 */
export class ExamBenchEvaluator implements BenchmarkEvaluator {
  readonly name = 'ExamBench-v1 Evaluator'
  private runner: ExamBenchmarkRunner

  constructor() {
    this.runner = new ExamBenchmarkRunner({ verbose: true })
  }

  /**
   * 运行指定方法的完整评测
   *
   * @param method  PaddleOCR | SingleVision | StarMap
   * @returns       该方法的全部评测结果
   */
  async runBenchmark(method: BenchmarkMethod): Promise<BenchmarkResult[]> {
    console.log(`\n═══════════════════════════════════════════`)
    console.log(`  开始评测: ${method}`)
    console.log(`═══════════════════════════════════════════\n`)

    const results = await this.runner.runAll(method)

    if (results.length > 0) {
      // 计算平均指标
      const avg = this.computeAverage(results)
      console.log(`\n📊 ${method} 平均指标:`)
      console.log(`   QA (题目准确率):  ${avg.qa.toFixed(2)}%`)
      console.log(`   AA (答案准确率):  ${avg.aa.toFixed(2)}%`)
      console.log(`   SA (成绩准确率):  ${avg.sa.toFixed(2)}%`)
      console.log(`   DSR (文档成功率): ${avg.dsr.toFixed(2)}%`)
    } else {
      console.warn(`\n⚠️  ${method}: 无有效评测结果。请确认 research-data/exambench-v1/ 中有样本数据。`)
    }

    return results
  }

  /**
   * 运行全部三种方法的对比评测
   */
  async runAllBenchmarks(): Promise<Map<BenchmarkMethod, BenchmarkResult[]>> {
    const allResults = new Map<BenchmarkMethod, BenchmarkResult[]>()

    for (const method of [BenchmarkMethod.PaddleOCR, BenchmarkMethod.SingleVision, BenchmarkMethod.StarMap]) {
      try {
        const results = await this.runBenchmark(method)
        allResults.set(method, results)
      } catch (error) {
        console.error(`[ExamBenchEvaluator] ${method} 评测失败:`, error)
        allResults.set(method, [])
      }
    }

    return allResults
  }

  // ── 工具方法 ──────────────────────────────────────────

  /**
   * 计算一组结果的平均指标
   */
  computeAverage(results: BenchmarkResult[]): { qa: number; aa: number; sa: number; dsr: number } {
    if (results.length === 0) {
      return { qa: 0, aa: 0, sa: 0, dsr: 0 }
    }
    const sum = results.reduce(
      (acc, r) => ({
        qa: acc.qa + r.metrics.qa,
        aa: acc.aa + r.metrics.aa,
        sa: acc.sa + r.metrics.sa,
        dsr: acc.dsr + r.metrics.dsr,
      }),
      { qa: 0, aa: 0, sa: 0, dsr: 0 },
    )
    const count = results.length
    return {
      qa: parseFloat((sum.qa / count).toFixed(2)),
      aa: parseFloat((sum.aa / count).toFixed(2)),
      sa: parseFloat((sum.sa / count).toFixed(2)),
      dsr: parseFloat((sum.dsr / count).toFixed(2)),
    }
  }

  /**
   * 生成对比摘要
   */
  generateSummary(allResults: Map<BenchmarkMethod, BenchmarkResult[]>): BenchmarkSummary {
    const methods = Array.from(allResults.entries()).map(([method, results]) => {
      const avgMetrics = this.computeAverage(results)
      return {
        method: String(method),
        avgMetrics,
        sampleCount: results.length,
      }
    })

    // 找出 QA 最佳方法
    let bestMethod = 'N/A'
    let bestQA = -1
    for (const m of methods) {
      if (m.avgMetrics.qa > bestQA) {
        bestQA = m.avgMetrics.qa
        bestMethod = m.method
      }
    }

    return {
      methods,
      bestMethod,
      timestamp: new Date().toISOString(),
    }
  }
}

// ════════════════════════════════════════════════════════════
// 便捷函数
// ════════════════════════════════════════════════════════════

/**
 * 运行单种方法的快捷方式
 *
 * @param method  评测方法
 * @returns       评测结果数组
 */
export async function runBenchmark(method: BenchmarkMethod): Promise<BenchmarkResult[]> {
  const evaluator = new ExamBenchEvaluator()
  return evaluator.runBenchmark(method)
}

/**
 * 运行全部三种方法的对比评测（快捷方式）
 */
export async function runAllBenchmarks(): Promise<Map<BenchmarkMethod, BenchmarkResult[]>> {
  const evaluator = new ExamBenchEvaluator()
  return evaluator.runAllBenchmarks()
}
