// ── ExamBench-v1 数据集框架（Phase 16-B/C） ──────────────
// 科研化建设：高中考试多页文档联合解析基准数据集
// 支持两种目录结构：
//   新版: sample-XXX/ground-truth.md + paper/ + answer-sheet/ + score-report/
//   旧版: ground-truth/*.md + images/*/

import * as fs from 'fs'
import * as path from 'path'

// ════════════════════════════════════════════════════════════
// 类型定义
// ════════════════════════════════════════════════════════════

/** 考试样本 */
export interface ExamSample {
  id: string
  subject: string
  grade: string
  imagePaths: string[]
  groundTruthPath: string
  /** 新版目录结构中的子目录路径 */
  paperDir?: string
  answerSheetDir?: string
  scoreReportDir?: string
  /** 元数据路径 */
  metadataPath?: string
}

/** 数据集信息 */
export interface DatasetInfo {
  name: string
  version: string
  description: string
  totalSamples: number
  samples: ExamSample[]
}

/** 评测指标（百分比，保留两位小数） */
export interface BenchmarkMetrics {
  qa: number  // Question Accuracy — 题目识别准确率
  aa: number  // Answer Accuracy   — 答案识别准确率
  sa: number  // Score Accuracy    — 成绩识别准确率
  dsr: number  // Document Success Rate — 完整文档成功率
}

/** 单条评测结果 */
export interface BenchmarkResult {
  sampleId: string
  subject: string
  grade: string
  method: string
  metrics: BenchmarkMetrics
  timestamp: string
  details?: string
}

/** 数据集评测统计报告 */
export interface DatasetReport {
  datasetName: string
  datasetVersion: string
  method: string
  sampleCount: number
  overall: {
    qa: { mean: number; std: number; successRate: number }
    aa: { mean: number; std: number; successRate: number }
    sa: { mean: number; std: number; successRate: number }
    dsr: { mean: number; std: number; successRate: number }
  }
  subjectBreakdown: Array<{
    subject: string
    count: number
    avgQA: number
    avgAA: number
    avgSA: number
    avgDSR: number
  }>
  perSample: BenchmarkResult[]
  timestamp: string
}

/** 基线对照方法枚举 */
export enum BenchmarkMethod {
  PaddleOCR = 'PaddleOCR',
  SingleVision = 'SingleVision',
  StarMap = 'StarMap',
}

// ════════════════════════════════════════════════════════════
// 数据集常量
// ════════════════════════════════════════════════════════════

const DATASET_ROOT = 'research-data/exambench-v1'
const SAMPLE_PREFIX = 'sample-'

/** 获取数据集根目录的绝对路径 */
function getDatasetRoot(): string {
  return path.resolve(process.cwd(), DATASET_ROOT)
}

// ════════════════════════════════════════════════════════════
// 数据集加载
// ════════════════════════════════════════════════════════════

/**
 * 从新版 sample-XXX 目录结构加载样本
 */
function loadSamplesFromDirectories(root: string): ExamSample[] {
  const entries = fs.readdirSync(root, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.startsWith(SAMPLE_PREFIX))
    .sort((a, b) => a.name.localeCompare(b.name))

  return entries.map((entry) => {
    const sampleDir = path.join(root, entry.name)
    const gtPath = path.join(sampleDir, 'ground-truth.md')

    let subject = 'unknown'
    let grade = 'unknown'
    const metaPath = path.join(sampleDir, 'metadata.json')
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
        subject = meta.subject || subject
        grade = meta.grade || grade
      } catch { /* ignore */ }
    }

    const paperDir = path.join(sampleDir, 'paper')
    const answerSheetDir = path.join(sampleDir, 'answer-sheet')
    const scoreReportDir = path.join(sampleDir, 'score-report')

    const imagePaths: string[] = []
    for (const d of [paperDir, answerSheetDir, scoreReportDir]) {
      if (fs.existsSync(d)) {
        imagePaths.push(...fs.readdirSync(d)
          .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
          .map(f => path.join(d, f)))
      }
    }

    return {
      id: entry.name,
      subject,
      grade,
      imagePaths,
      groundTruthPath: fs.existsSync(gtPath) ? gtPath : '',
      paperDir: fs.existsSync(paperDir) ? paperDir : undefined,
      answerSheetDir: fs.existsSync(answerSheetDir) ? answerSheetDir : undefined,
      scoreReportDir: fs.existsSync(scoreReportDir) ? scoreReportDir : undefined,
      metadataPath: fs.existsSync(metaPath) ? metaPath : undefined,
    }
  })
}

/**
 * 加载 ExamBench-v1 数据集
 *
 * 自动检测目录结构，优先使用新版 sample-XXX/ 结构。
 */
export function loadDataset(): DatasetInfo {
  const root = getDatasetRoot()

  if (!fs.existsSync(root)) {
    return {
      name: 'ExamBench-v1', version: '1.0.0',
      description: '数据集目录不存在 — 请创建 research-data/exambench-v1/',
      totalSamples: 0, samples: [],
    }
  }

  const samples = loadSamplesFromDirectories(root)

  if (samples.length === 0) {
    return {
      name: 'ExamBench-v1', version: '1.0.0',
      description: '数据集目录为空 — 请创建 sample-XXX 目录并放入 ground-truth.md',
      totalSamples: 0, samples: [],
    }
  }

  return {
    name: 'ExamBench-v1',
    version: '1.1.0',
    description: '高中考试多页文档联合解析基准数据集 — 用于科技创新大赛实验评测',
    totalSamples: samples.length,
    samples,
  }
}

/**
 * 按 ID 获取单个样本
 */
export function getSample(id: string): ExamSample | null {
  const dataset = loadDataset()
  return dataset.samples.find(s => s.id === id) ?? null
}

/**
 * 列出数据集中所有样本
 */
export function listSamples(): ExamSample[] {
  return loadDataset().samples
}
