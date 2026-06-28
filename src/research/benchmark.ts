// ── ExamBench-v1 Benchmark 引擎（Phase 16-B） ────────────
// 评测运行器 — 运行单样本 / 全数据集 / 跨方法对比

import * as fs from 'fs'
import * as path from 'path'
import type { ExamSample, BenchmarkResult, BenchmarkMetrics, DatasetReport } from './dataset'
import { loadDataset, getSample, BenchmarkMethod } from './dataset'
import { calculateAll } from './metrics'

// ════════════════════════════════════════════════════════════
// 类型定义
// ════════════════════════════════════════════════════════════

/** 评测运行选项 */
export interface BenchmarkOptions {
  /** 结果输出目录（默认 results/） */
  outputDir?: string
  /** 是否输出详细日志 */
  verbose?: boolean
}

// ════════════════════════════════════════════════════════════
// 常量
// ════════════════════════════════════════════════════════════

const DEFAULT_OUTPUT_DIR = 'research-data/exambench-v1/results'

/**
 * ExamBench-v1 评测运行器
 *
 * 核心职责：
 * 1. runSingle(sampleId, method): 对单个样本运行评测
 * 2. runAll(method):             全数据集批量评测
 * 3. compare(results[]):        跨方法比较
 */
export class ExamBenchmarkRunner {
  private outputDir: string
  private verbose: boolean

  constructor(options?: BenchmarkOptions) {
    this.outputDir = path.resolve(process.cwd(), options?.outputDir ?? DEFAULT_OUTPUT_DIR)
    this.verbose = options?.verbose ?? false
  }

  // ── 内部方法 ──────────────────────────────────────────

  /**
   * 读取 Markdown 文件内容
   */
  private readMarkdown(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8')
  }

  /**
   * 保存评测结果到文件
   */
  private saveResult(result: BenchmarkResult): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true })
    }
    const filePath = path.join(
      this.outputDir,
      `${result.method}_${result.sampleId}.json`,
    )
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8')
    if (this.verbose) {
      console.log(`  [保存] ${filePath}`)
    }
  }

  /**
   * 模拟单页 Vision API 调用输出
   *
   * Phase 16-B 预留：此处返回占位内容。
   * 实际评估时需对接真实 OCR / Vision API。
   */
  private async invokeMethod(
    _sample: ExamSample,
    _method: BenchmarkMethod,
  ): Promise<string> {
    // 预留：后续对接真实 API
    // PaddleOCR → 本地 OCR 引擎
    // SingleVision → 单页 Vision 调用
    // StarMap → 多页联合 Vision 调用
    throw new Error(
      `[ExamBenchmarkRunner] ${_method} 尚未接入真实 API。` +
      '请实现 invokeMethod() 回调以对接具体识别引擎。',
    )
  }

  // ── 公开 API ──────────────────────────────────────────

  /**
   * 对单个样本运行评测
   *
   * @param sampleId  样本 ID（文件名不含扩展名）
   * @param method    评测方法
   * @param visionOutputOverride 可选：直接传入 Vision 输出文本（用于离线评测）
   */
  async runSingle(
    sampleId: string,
    method: BenchmarkMethod | string,
    visionOutputOverride?: string,
  ): Promise<BenchmarkResult> {
    const sample = getSample(sampleId)
    if (!sample) {
      throw new Error(`样本不存在: ${sampleId}`)
    }

    const methodStr = typeof method === 'string' ? method : method

    // 读取 Ground Truth
    const groundTruthText = this.readMarkdown(sample.groundTruthPath)

    // 获取 Vision 输出（直接传入 或 调用接口）
    let visionOutput: string
    if (visionOutputOverride) {
      visionOutput = visionOutputOverride
    } else {
      visionOutput = await this.invokeMethod(sample, method as BenchmarkMethod)
    }

    // 计算指标
    const metrics: BenchmarkMetrics = calculateAll(groundTruthText, visionOutput)

    const result: BenchmarkResult = {
      sampleId: sample.id,
      subject: sample.subject,
      grade: sample.grade,
      method: methodStr,
      metrics,
      timestamp: new Date().toISOString(),
    }

    // 保存
    this.saveResult(result)
    return result
  }

  /**
   * 全数据集批量评测
   *
   * @param method  评测方法
   * @returns       全部评测结果
   */
  async runAll(method: BenchmarkMethod | string): Promise<BenchmarkResult[]> {
    const dataset = loadDataset()
    if (dataset.samples.length === 0) {
      console.warn('[ExamBenchmarkRunner] 数据集为空，跳过批量评测。')
      return []
    }

    const results: BenchmarkResult[] = []
    for (const sample of dataset.samples) {
      try {
        if (this.verbose) {
          console.log(`[评测] ${sample.id} (${method})...`)
        }
        const result = await this.runSingle(sample.id, method)
        results.push(result)
      } catch (error) {
        console.error(`[错误] 样本 ${sample.id} 评测失败:`, error)
      }
    }
    return results
  }

  /**
   * 跨方法比较
   *
   * 传入多组评测结果（每组属于同一种方法），返回矩阵格式。
   *
   * @param resultGroups  每组代表一种方法的全部结果
   * @returns             按方法分组的平均值
   */
  compare(resultGroups: BenchmarkResult[][]): Array<{
    method: string
    sampleCount: number
    avgMetrics: BenchmarkMetrics
    results: BenchmarkResult[]
  }> {
    return resultGroups.map((group) => {
      if (group.length === 0) {
        return {
          method: 'unknown',
          sampleCount: 0,
          avgMetrics: { qa: 0, aa: 0, sa: 0, dsr: 0 },
          results: [],
        }
      }

      const method = group[0].method
      const sum = group.reduce(
        (acc, r) => ({
          qa: acc.qa + r.metrics.qa,
          aa: acc.aa + r.metrics.aa,
          sa: acc.sa + r.metrics.sa,
          dsr: acc.dsr + r.metrics.dsr,
        }),
        { qa: 0, aa: 0, sa: 0, dsr: 0 },
      )

      const count = group.length
      return {
        method,
        sampleCount: count,
        avgMetrics: {
          qa: parseFloat((sum.qa / count).toFixed(2)),
          aa: parseFloat((sum.aa / count).toFixed(2)),
          sa: parseFloat((sum.sa / count).toFixed(2)),
          dsr: parseFloat((sum.dsr / count).toFixed(2)),
        },
        results: group,
      }
    })
  }

  /**
   * 计算统计值（平均值、标准差、成功率）
   */
  private computeStats(values: number[]): { mean: number; std: number; successRate: number } {
    if (values.length === 0) return { mean: 0, std: 0, successRate: 0 }
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
    const std = Math.sqrt(variance)
    const successRate = (values.filter(v => v >= 80).length / values.length) * 100
    return {
      mean: parseFloat(mean.toFixed(2)),
      std: parseFloat(std.toFixed(2)),
      successRate: parseFloat(successRate.toFixed(2)),
    }
  }

  /**
   * 全数据集评测并生成统计报告（含均值、标准差、分科统计）
   */
  async runDataset(method: BenchmarkMethod | string): Promise<DatasetReport> {
    const dataset = loadDataset()
    if (dataset.samples.length === 0) throw new Error('数据集为空')

    const results = await this.runAll(method)
    if (results.length === 0) throw new Error('评测未产生结果')

    const overall = {
      qa: this.computeStats(results.map(r => r.metrics.qa)),
      aa: this.computeStats(results.map(r => r.metrics.aa)),
      sa: this.computeStats(results.map(r => r.metrics.sa)),
      dsr: this.computeStats(results.map(r => r.metrics.dsr)),
    }

    const subjectMap = new Map<string, BenchmarkResult[]>()
    for (const r of results) {
      const list = subjectMap.get(r.subject) ?? []
      list.push(r)
      subjectMap.set(r.subject, list)
    }
    const subjectBreakdown = Array.from(subjectMap.entries()).map(([subject, group]) => ({
      subject,
      count: group.length,
      avgQA: parseFloat((group.reduce((s, r) => s + r.metrics.qa, 0) / group.length).toFixed(2)),
      avgAA: parseFloat((group.reduce((s, r) => s + r.metrics.aa, 0) / group.length).toFixed(2)),
      avgSA: parseFloat((group.reduce((s, r) => s + r.metrics.sa, 0) / group.length).toFixed(2)),
      avgDSR: parseFloat((group.reduce((s, r) => s + r.metrics.dsr, 0) / group.length).toFixed(2)),
    }))

    const report: DatasetReport = {
      datasetName: dataset.name,
      datasetVersion: dataset.version,
      method: String(method),
      sampleCount: results.length,
      overall,
      subjectBreakdown,
      perSample: results,
      timestamp: new Date().toISOString(),
    }

    if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true })
    fs.writeFileSync(path.join(this.outputDir, 'dataset-report.json'), JSON.stringify(report, null, 2), 'utf-8')
    console.log(`📊 dataset-report.json saved`)

    return report
  }
}
