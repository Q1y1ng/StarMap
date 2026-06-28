// ── 数据导入器（Phase 16-C） ─────────────────────────────
// 从 sample-XXX 目录自动读取考试数据

import * as fs from 'fs'
import * as path from 'path'
import { loadDataset, getSample } from '@/research/dataset'
import { parseGroundTruth } from '@/research/ground-truth'
import type { ExamGroundTruth } from '@/research/ground-truth'

/** 导入结果 */
export interface ImportResult {
  sampleId: string
  groundTruth: ExamGroundTruth
  imageCount: number
  paperImageCount: number
  answerSheetImageCount: number
  scoreReportImageCount: number
  success: boolean
  error?: string
}

/**
 * 导入单个样本目录
 *
 * 读取 ground-truth.md 和三个图片子目录，
 * 返回结构化 ExamGroundTruth + 图片统计。
 */
export function importExamFolder(sampleId: string): ImportResult {
  const sample = getSample(sampleId)
  if (!sample) {
    return {
      sampleId,
      groundTruth: { metadata: { examName: '', subject: '', grade: '', totalScore: 0 }, questions: [], answers: [], scores: [], mistakes: [] },
      imageCount: 0, paperImageCount: 0, answerSheetImageCount: 0, scoreReportImageCount: 0,
      success: false, error: `样本 ${sampleId} 不存在`,
    }
  }

  if (!sample.groundTruthPath || !fs.existsSync(sample.groundTruthPath)) {
    return {
      sampleId,
      groundTruth: { metadata: { examName: '', subject: '', grade: '', totalScore: 0 }, questions: [], answers: [], scores: [], mistakes: [] },
      imageCount: 0, paperImageCount: 0, answerSheetImageCount: 0, scoreReportImageCount: 0,
      success: false, error: `ground-truth.md 不存在: ${sample.groundTruthPath}`,
    }
  }

  try {
    const markdown = fs.readFileSync(sample.groundTruthPath, 'utf-8')
    const groundTruth = parseGroundTruth(markdown, sampleId, sample.groundTruthPath)

    // 统计图片
    const countDir = (dir?: string) => {
      if (!dir || !fs.existsSync(dir)) return 0
      return fs.readdirSync(dir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f)).length
    }

    const paperCount = countDir(sample.paperDir)
    const answerSheetCount = countDir(sample.answerSheetDir)
    const scoreReportCount = countDir(sample.scoreReportDir)

    return {
      sampleId,
      groundTruth,
      imageCount: paperCount + answerSheetCount + scoreReportCount,
      paperImageCount: paperCount,
      answerSheetImageCount: answerSheetCount,
      scoreReportImageCount: scoreReportCount,
      success: true,
    }
  } catch (error) {
    return {
      sampleId,
      groundTruth: { metadata: { examName: '', subject: '', grade: '', totalScore: 0 }, questions: [], answers: [], scores: [], mistakes: [] },
      imageCount: 0, paperImageCount: 0, answerSheetImageCount: 0, scoreReportImageCount: 0,
      success: false, error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * 批量导入全部样本
 */
export function importAllExamFolders(): ImportResult[] {
  const dataset = loadDataset()
  return dataset.samples.map(s => importExamFolder(s.id))
}

/**
 * 导入并生成 Ground Truth JSON 文件
 */
export function importAndExport(sampleId: string, outputDir?: string): ImportResult {
  const result = importExamFolder(sampleId)
  if (!result.success) return result

  const outDir = outputDir
    ? path.resolve(process.cwd(), outputDir)
    : path.dirname(result.groundTruth.sourcePath || '')

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const jsonPath = path.join(outDir, `${sampleId}-ground-truth.json`)
  fs.writeFileSync(jsonPath, JSON.stringify(result.groundTruth, null, 2), 'utf-8')
  console.log(`  📄 Ground Truth JSON: ${jsonPath}`)

  return result
}
