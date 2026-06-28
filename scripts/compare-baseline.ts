// ── Phase 20A-R: Three-Method Comparison ──
// 读取 PaddleOCR / SingleVision / StarMap 结果
// 对比 case-study ground truth，计算 QA/AA/SA/DSR
// 用法: npx tsx scripts/compare-baseline.ts

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '..')
const CASE_DIR = path.join(ROOT, 'research-data', 'case-study')
const BENCHMARK_DIR = path.join(ROOT, 'research-data', 'benchmark')
const COMPARISON_DIR = path.join(BENCHMARK_DIR, 'comparison')

// ── Types ──

interface GroundTruth {
  sampleId: string
  caseId: string
  subject: string
  totalScore: number
  score: number
  questionCount: number
  answerCount: number
  processingTime: number | null
  outputLength: number | null
  /** Score correctness verified by human */
  scoreVerified: boolean
  /** Answer extraction verified by human */
  answerVerified: boolean
  /** Question identification verified by human */
  questionVerified: boolean
}

interface MethodMetrics {
  QA: number     // Question Accuracy (%)
  AA: number     // Answer Accuracy (%)
  SA: number     // Score Accuracy (%)
  DSR: number    // Document Success Rate (%)
  details: {
    questionsFound: number
    questionsTotal: number
    answersFound: number
    answersTotal: number
    scoreCorrect: number
    scoreTotal: number
    sectionsFound: number
    sectionsTotal: number
  }
}

interface PerSampleComparison {
  sampleId: string
  subject: string
  groundTruth: {
    questionCount: number
    answerCount: number
    score: number
    totalScore: number
  }
  StarMap: MethodMetrics | null
  SingleVision: MethodMetrics | null
  PaddleOCR: MethodMetrics | null
}

interface ComparisonOutput {
  meta: {
    generatedAt: string
    script: string
    methods: string[]
    totalSamples: number
  }
  comparison: {
    StarMap: { avgQA: number; avgAA: number; avgSA: number; avgDSR: number } | null
    SingleVision: { avgQA: number; avgAA: number; avgSA: number; avgDSR: number } | null
    PaddleOCR: { avgQA: number; avgAA: number; avgSA: number; avgDSR: number } | null
  }
  perSample: PerSampleComparison[]
  keyTable: Array<{
    method: string
    QA: number | string
    AA: number | string
    SA: number | string
    DSR: number | string
  }>
}

// ── Helpers ──

function readFile(p: string): string {
  try { return fs.readFileSync(p, 'utf-8') } catch { return '' }
}
function readJson<T>(p: string): T | null {
  try { return JSON.parse(readFile(p)) } catch { return null }
}
function avg(nums: number[]): number {
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
}

// ── Section detection (same logic as run-real-benchmark.ts) ──

const REQUIRED_SECTIONS = ['考试信息', '试卷内容', '学生作答', '成绩信息', '小分/错题汇总']

const SECTION_PATTERNS: Record<string, string[]> = {
  '考试信息': ['考试信息', '考试名称', '科目', '年级：'],
  '试卷内容': ['试卷内容', '选择题', '非选择题', '一、', '二、', '三、', '四、'],
  '学生作答': ['学生作答', '答题卡与作答', '作答内容', '选择题答案'],
  '成绩信息': ['成绩信息', '总分'],
  '小分/错题汇总': ['错题汇总', '小分', '得分汇总'],
}

function detectSections(text: string): string[] {
  const found: string[] = []
  for (const sec of REQUIRED_SECTIONS) {
    const patterns = SECTION_PATTERNS[sec]
    if (patterns && patterns.some(p => text.includes(p))) {
      found.push(sec)
    }
  }
  return found
}

function countQuestions(text: string): number {
  const lines = text.split('\n')
  return lines.filter(line => {
    const t = line.trim()
    if (!/^\d+[.、）)]/.test(t)) return false
    const num = parseInt(t.match(/^(\d+)/)?.[1] || '0')
    if (num < 1 || num > 200) return false
    if (/^\|\s*\d+\s*\|/.test(t)) return false
    if (t.match(/^\d+\.\s*$/)) return false
    return true
  }).length
}

function countAnswers(text: string): number {
  const answerSection = text.match(/答题卡与作答内容[\s\S]*?(?=(?:##|$))/) ||
                         text.match(/学生作答[\s\S]*?(?=(?:##|$))/) ||
                         text.match(/选择题答案[\s\S]*?(?=(?:##|$))/)
  if (!answerSection) return 0

  const combined = answerSection[0]
  return combined.split('\n').filter(l => /^\d+[.、）)]/.test(l.trim())).length
}

// ── Load ground truth from case-study ──

function loadGroundTruth(): GroundTruth[] {
  const results: GroundTruth[] = []

  for (let i = 1; i <= 5; i++) {
    const id = String(i).padStart(3, '0')
    const caseDir = path.join(CASE_DIR, `case-${id}`)
    if (!fs.existsSync(caseDir)) continue

    const meta = readJson<any>(path.join(caseDir, 'metadata.json'))
    const outputMd = readFile(path.join(caseDir, 'output.md'))
    const caseInfoMd = readFile(path.join(caseDir, 'case-info.md'))

    if (!meta) {
      console.warn(`⚠️  No metadata for case-${id}, skipping`)
      continue
    }

    // Priority: human-verified count from case-info.md > parsed count from output.md
    const verifiedQCount = parseInt(caseInfoMd.match(/(\d+)题全部正确识别/)?.[1] || '0')
    const parsedQCount = countQuestions(outputMd)
    const qCount = verifiedQCount > 0 ? verifiedQCount : parsedQCount

    const aCount = countAnswers(outputMd)

    results.push({
      sampleId: `real-${id}`,
      caseId: `case-${id}`,
      subject: meta.subject,
      totalScore: meta.totalScore,
      score: meta.score,
      questionCount: qCount || 1,  // avoid division by zero
      answerCount: Math.max(aCount, qCount) || 1,
      processingTime: meta.processingTime ?? null,
      outputLength: meta.outputLength ?? null,
      scoreVerified: caseInfoMd.includes('总分识别') && caseInfoMd.includes('正确'),
      answerVerified: caseInfoMd.includes('答案') && caseInfoMd.includes('完整提取'),
      questionVerified: caseInfoMd.includes('全部正确识别'),
    })
  }

  return results
}

// ── Compute StarMap metrics from case-study ──

function computeStarMapMetrics(gt: GroundTruth, outputMd: string, caseInfoMd: string): MethodMetrics {
  const sections = detectSections(outputMd)
  const qFound = countQuestions(outputMd)
  const aFound = countAnswers(outputMd)

  // By default use human verification from case-info.md
  const QA = gt.questionVerified ? 100 : (gt.questionCount > 0 ? Math.min(100, (qFound / gt.questionCount) * 100) : 0)
  const AA = gt.answerVerified ? 100 : (gt.answerCount > 0 ? Math.min(100, (aFound / gt.answerCount) * 100) : 0)
  const SA = gt.scoreVerified ? 100 : (gt.totalScore > 0 ? 50 : 0)
  const DSR = (sections.length / REQUIRED_SECTIONS.length) * 100

  return {
    QA: Math.round(QA * 100) / 100,
    AA: Math.round(AA * 100) / 100,
    SA: Math.round(SA * 100) / 100,
    DSR: Math.round(DSR * 100) / 100,
    details: {
      questionsFound: qFound,
      questionsTotal: gt.questionCount,
      answersFound: aFound,
      answersTotal: gt.answerCount,
      scoreCorrect: gt.scoreVerified ? 1 : 0,
      scoreTotal: 1,
      sectionsFound: sections.length,
      sectionsTotal: REQUIRED_SECTIONS.length,
    },
  }
}

// ── Compute SingleVision metrics ──

interface SingleVisionSample {
  sampleId: string
  subject: string
  questions: { number: number; type?: string }[]
  answers: { number: number; content?: string }[]
  scores: { total?: number | null; max?: number | null }
  sections: string[]
  totalProcessingTime: number
  totalOutputLength: number
}

function computeSingleVisionMetrics(sv: SingleVisionSample, gt: GroundTruth): MethodMetrics {
  const svQCount = sv.questions.length
  const svACount = sv.answers.length
  const sections = sv.sections

  // QA: questions found / total (capped at 100%)
  const QA = Math.min(100, gt.questionCount > 0 ? (svQCount / gt.questionCount) * 100 : 0)

  // AA: answers found / total (capped at 100%)
  const AA = Math.min(100, gt.answerCount > 0 ? (svACount / gt.answerCount) * 100 : 0)

  // SA: score matches? (check if extracted score matches ground truth)
  const scoreCorrect = sv.scores.total != null && sv.scores.max != null &&
    sv.scores.total === gt.score && sv.scores.max === gt.totalScore
  const SA = scoreCorrect ? 100 : 0

  // DSR: sections found / required
  const DSR = (sections.length / REQUIRED_SECTIONS.length) * 100

  return {
    QA: Math.round(QA * 100) / 100,
    AA: Math.round(AA * 100) / 100,
    SA,
    DSR: Math.round(DSR * 100) / 100,
    details: {
      questionsFound: svQCount,
      questionsTotal: gt.questionCount,
      answersFound: svACount,
      answersTotal: gt.answerCount,
      scoreCorrect: scoreCorrect ? 1 : 0,
      scoreTotal: 1,
      sectionsFound: sections.length,
      sectionsTotal: REQUIRED_SECTIONS.length,
    },
  }
}

// ── Main ──

function main() {
  console.log('🚀 Phase 20A-R: Three-Method Comparison\n')
  fs.mkdirSync(COMPARISON_DIR, { recursive: true })

  // 1. Load ground truth
  const groundTruth = loadGroundTruth()
  console.log(`📊 Ground truth: ${groundTruth.length} samples`)
  for (const gt of groundTruth) {
    console.log(`   ${gt.sampleId} (${gt.subject}): ${gt.questionCount} questions, ${gt.answerCount} answers, ${gt.score}/${gt.totalScore}`)
  }

  // 2. Load StarMap results (from case-study directly)
  const starMapResults: Map<string, MethodMetrics> = new Map()
  for (const gt of groundTruth) {
    const outputMd = readFile(path.join(CASE_DIR, gt.caseId, 'output.md'))
    const caseInfoMd = readFile(path.join(CASE_DIR, gt.caseId, 'case-info.md'))
    if (outputMd) {
      starMapResults.set(gt.sampleId, computeStarMapMetrics(gt, outputMd, caseInfoMd))
    }
  }

  // 3. Load SingleVision results
  const svPath = path.join(BENCHMARK_DIR, 'singlevision', 'results.json')
  const svData = readJson<any>(svPath)
  const singleVisionResults: Map<string, SingleVisionSample> = new Map()
  if (svData?.samples) {
    for (const s of svData.samples) {
      singleVisionResults.set(s.sampleId, {
        sampleId: s.sampleId,
        subject: s.subject,
        questions: s.questions || [],
        answers: s.answers || [],
        scores: s.scores || {},
        sections: s.sections || [],
        totalProcessingTime: s.totalProcessingTime || 0,
        totalOutputLength: s.totalOutputLength || 0,
      })
    }
  }
  console.log(`📊 SingleVision: ${singleVisionResults.size} samples loaded`)

  // 4. Load PaddleOCR results
  const paddlePath = path.join(BENCHMARK_DIR, 'paddle', 'results.json')
  const paddleData = readJson<any>(paddlePath)
  const paddleStatus = paddleData?.status || 'UNKNOWN'
  console.log(`📊 PaddleOCR: status=${paddleStatus}`)

  // ── Helper: compute PaddleOCR per-sample metrics ──

  function computePaddleMetrics(paddleCase: any, gt: GroundTruth): MethodMetrics {
    // QA: heuristic question detection (paper images only — score sheets massively overcount)
    const paperQuestions = (paddleCase.images || [])
      .filter((i: any) => i.category === 'paper')
      .reduce((s: number, i: any) => s + (i.questions || 0), 0)
    const QA = Math.min(100, gt.questionCount > 0 ? (paperQuestions / gt.questionCount) * 100 : 0)

    // PaddleOCR has no semantic answer/score/section extraction
    const AA = 0
    const SA = 0
    const DSR = 0

    return {
      QA: Math.round(QA * 100) / 100,
      AA,
      SA,
      DSR,
      details: {
        questionsFound: paperQuestions,
        questionsTotal: gt.questionCount,
        answersFound: 0,
        answersTotal: gt.answerCount,
        scoreCorrect: 0,
        scoreTotal: 1,
        sectionsFound: 0,
        sectionsTotal: REQUIRED_SECTIONS.length,
      },
    }
  }

  // 5. Build per-sample comparison
  const perSample: PerSampleComparison[] = []
  const starMetricsList: MethodMetrics[] = []
  const svMetricsList: MethodMetrics[] = []
  const paddleMetricsList: MethodMetrics[] = []

  for (const gt of groundTruth) {
    const sm = starMapResults.get(gt.sampleId) || null
    if (sm) starMetricsList.push(sm)

    const svRaw = singleVisionResults.get(gt.sampleId)
    const sv = svRaw ? computeSingleVisionMetrics(svRaw, gt) : null
    if (sv) svMetricsList.push(sv)

    // PaddleOCR: find matching case by caseId
    const paddleCase = paddleData?.cases?.find((c: any) => c.caseId === gt.caseId)
    const paddle = paddleCase && gt.caseId !== 'N/A'
      ? computePaddleMetrics(paddleCase, gt)
      : null
    if (paddle) paddleMetricsList.push(paddle)

    perSample.push({
      sampleId: gt.sampleId,
      subject: gt.subject,
      groundTruth: {
        questionCount: gt.questionCount,
        answerCount: gt.answerCount,
        score: gt.score,
        totalScore: gt.totalScore,
      },
      StarMap: sm,
      SingleVision: sv,
      PaddleOCR: paddle,
    })

    console.log(`\n${gt.sampleId} (${gt.subject}):`)
    if (sm) console.log(`   StarMap:       QA=${sm.QA.toFixed(1)}%  AA=${sm.AA.toFixed(1)}%  SA=${sm.SA.toFixed(1)}%  DSR=${sm.DSR.toFixed(1)}%`)
    if (sv) console.log(`   SingleVision:  QA=${sv.QA.toFixed(1)}%  AA=${sv.AA.toFixed(1)}%  SA=${sv.SA.toFixed(1)}%  DSR=${sv.DSR.toFixed(1)}%`)
    if (paddle) console.log(`   PaddleOCR:     QA=${paddle.QA.toFixed(1)}%  AA=N/A  SA=N/A  DSR=N/A  (heuristic, paper-only)`)
    else console.log(`   PaddleOCR:     ${paddleStatus}`)
  }

  // 6. Compute averages
  const avgQA_sm = avg(starMetricsList.map(m => m.QA))
  const avgAA_sm = avg(starMetricsList.map(m => m.AA))
  const avgSA_sm = avg(starMetricsList.map(m => m.SA))
  const avgDSR_sm = avg(starMetricsList.map(m => m.DSR))

  const avgQA_sv = svMetricsList.length > 0 ? avg(svMetricsList.map(m => m.QA)) : 0
  const avgAA_sv = svMetricsList.length > 0 ? avg(svMetricsList.map(m => m.AA)) : 0
  const avgSA_sv = svMetricsList.length > 0 ? avg(svMetricsList.map(m => m.SA)) : 0
  const avgDSR_sv = svMetricsList.length > 0 ? avg(svMetricsList.map(m => m.DSR)) : 0

  const avgQA_pd = paddleMetricsList.length > 0 ? avg(paddleMetricsList.map(m => m.QA)) : 0
  const avgAA_pd = paddleMetricsList.length > 0 ? avg(paddleMetricsList.map(m => m.AA)) : 0
  const avgSA_pd = paddleMetricsList.length > 0 ? avg(paddleMetricsList.map(m => m.SA)) : 0
  const avgDSR_pd = paddleMetricsList.length > 0 ? avg(paddleMetricsList.map(m => m.DSR)) : 0

  // 7. Build output
  const output: ComparisonOutput = {
    meta: {
      generatedAt: new Date().toISOString(),
      script: 'scripts/compare-baseline.ts',
      methods: ['StarMap', 'SingleVision', 'PaddleOCR'],
      totalSamples: groundTruth.length,
    },
    comparison: {
      StarMap: { avgQA: avgQA_sm, avgAA: avgAA_sm, avgSA: avgSA_sm, avgDSR: avgDSR_sm },
      SingleVision: svMetricsList.length > 0
        ? { avgQA: avgQA_sv, avgAA: avgAA_sv, avgSA: avgSA_sv, avgDSR: avgDSR_sv }
        : null,
      PaddleOCR: paddleMetricsList.length > 0
        ? { avgQA: avgQA_pd, avgAA: avgAA_pd, avgSA: avgSA_pd, avgDSR: avgDSR_pd }
        : null,
    },
    perSample,
    keyTable: [
      {
        method: 'PaddleOCR',
        QA: paddleMetricsList.length > 0 ? Math.round(avgQA_pd) : 'N/A',
        AA: 'N/A (只检测文字)',
        SA: 'N/A (无语义)',
        DSR: 'N/A (无语义)',
      },
      {
        method: 'SingleVision',
        QA: svMetricsList.length > 0 ? Math.round(avgQA_sv) : 'N/A',
        AA: svMetricsList.length > 0 ? Math.round(avgAA_sv) : 'N/A',
        SA: svMetricsList.length > 0 ? Math.round(avgSA_sv) : 'N/A',
        DSR: svMetricsList.length > 0 ? Math.round(avgDSR_sv) : 'N/A',
      },
      {
        method: 'StarMap',
        QA: starMetricsList.length > 0 ? Math.round(avgQA_sm) : 'N/A',
        AA: starMetricsList.length > 0 ? Math.round(avgAA_sm) : 'N/A',
        SA: starMetricsList.length > 0 ? Math.round(avgSA_sm) : 'N/A',
        DSR: starMetricsList.length > 0 ? Math.round(avgDSR_sm) : 'N/A',
      },
    ],
  }

  fs.writeFileSync(path.join(COMPARISON_DIR, 'benchmark-summary.json'), JSON.stringify(output, null, 2))
  console.log(`\n✅ Comparison complete!`)
  console.log(`   Output: ${path.join(COMPARISON_DIR, 'benchmark-summary.json')}`)

  // Print key table
  console.log(`\n📊 Key Comparison Table:`)
  console.log(`   ${'Method'.padEnd(16)} ${'QA'.padEnd(8)} ${'AA'.padEnd(8)} ${'SA'.padEnd(8)} ${'DSR'.padEnd(8)}`)
  console.log(`   ${'─'.repeat(16)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(8)}`)
  for (const row of output.keyTable) {
    const qa = typeof row.QA === 'number' ? `${row.QA}%` : row.QA
    const aa = typeof row.AA === 'number' ? `${row.AA}%` : row.AA
    const sa = typeof row.SA === 'number' ? `${row.SA}%` : row.SA
    const dsr = typeof row.DSR === 'number' ? `${row.DSR}%` : row.DSR
    console.log(`   ${row.method.padEnd(16)} ${qa.padEnd(8)} ${aa.padEnd(8)} ${sa.padEnd(8)} ${dsr.padEnd(8)}`)
  }
}

main()
