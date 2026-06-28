// ── Phase 19: Math Validation Analyzer ──
// 分析数学样本的公式密度、知识点分布、识别难度
// 用法: npx tsx scripts/validate-math.ts
//
// 约束: 仅使用真实 ground truth 数据，不虚构识别结果

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '..')
const MATH_VALIDATION_DIR = path.join(ROOT, 'research-data', 'math-validation')
const EXAMBENCH_DIR = path.join(ROOT, 'research-data', 'exambench-v1')

interface MathSample {
  sampleId: string
  grade: string
  examType: string
  totalScore: number
  questionCount: number
  formulaCount: number
  avgFormulaPerQuestion: number
  knowledgePoints: string[]
}

// Unicode math symbols and LaTeX patterns
// Split into multiple simpler patterns to avoid parser issues with large character classes
const MATH_PATTERNS = [
  // Unicode math symbols (grouped by category)
  /[√∞π]/g,
  /[∈⊆⊂∪∩∅]/g,
  /[∑∏∫]/g,
  /[²³]/g,
  /[αβγδεθλμρσφωψΩ]/g,
  /[±×÷]/g,
  /[≥≤≠≈]/g,
  /[←→↔⇒⇔]/g,
  /[∇∂∃∀]/g,
  /[¬∧∨]/g,
  /[⊕⊗⊥∥∠∽≌]/g,
  /[∈∉⊄⊇]/g,
  // LaTeX commands
  /\\sqrt/g, /\\frac/g, /\\sum/g, /\\int/g, /\\lim/g,
  /\\log/g, /\\ln/g, /\\sin/g, /\\cos/g, /\\tan/g,
]

function countMathSymbols(text: string): number {
  return MATH_PATTERNS.reduce((sum, pattern) => {
    const matches = text.match(pattern)
    return sum + (matches ? matches.length : 0)
  }, 0)
}

const KNOWLEDGE_POINT_MAP: Record<string, string[]> = {
  '集合': ['集合运算', '集合', '子集', '并集', '交集'],
  '函数': ['函数', '定义域', '值域', '单调性', '奇偶性', '指数', '对数', '幂函数'],
  '数列': ['数列', '等差数列', '等比数列', '通项', '求和'],
  '向量': ['向量', '平面向量', '点积', '叉积'],
  '不等式': ['不等式', '二次不等式', '均值不等式'],
  '导数': ['导数', '极值', '单调性', '切线'],
  '圆锥曲线': ['椭圆', '双曲线', '抛物线', '圆锥曲线'],
  '立体几何': ['立体几何', '平行', '垂直', '二面角'],
  '三角函数': ['三角函数', 'sin', 'cos', 'tan', '诱导公式'],
  '概率统计': ['概率', '统计', '排列', '组合', '二项式'],
}

function extractKnowledgePoints(text: string): string[] {
  const found: string[] = []
  for (const [point, keywords] of Object.entries(KNOWLEDGE_POINT_MAP)) {
    if (keywords.some(kw => text.includes(kw))) {
      found.push(point)
    }
  }
  return found
}

function analyzeMathSamples(): MathSample[] {
  const samples: MathSample[] = []
  const mathIds = ['001', '010', '011', '020', '021', '030', '031', '040', '041', '050']

  for (const id of mathIds) {
    const gtPath = path.join(EXAMBENCH_DIR, `sample-${id}`, 'ground-truth.md`)
    const metaPath = path.join(EXAMBENCH_DIR, `sample-${id}`, 'metadata.json')

    if (!fs.existsSync(gtPath)) continue

    const gt = fs.readFileSync(gtPath, 'utf-8')
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))

    // Count math symbols
    const formulaCount = countMathSymbols(gt)

    // Count questions (lines starting with digit + period in 试卷内容 section)
    const contentSection = gt.match(/## 试卷内容[\s\S]*?(?=## )/)?.[0] || ''
    const questionLines = contentSection.split('\n').filter(l => /^\d+[.、）)]/.test(l.trim()))
    const questionCount = questionLines.length

    // Extract knowledge points
    const knowledgePoints = extractKnowledgePoints(gt)

    samples.push({
      sampleId: `sample-${id}`,
      grade: meta.grade,
      examType: meta.examType,
      totalScore: meta.totalScore,
      questionCount,
      formulaCount,
      avgFormulaPerQuestion: Math.round((formulaCount / Math.max(1, questionCount)) * 100) / 100,
      knowledgePoints: [...new Set(knowledgePoints)],
    })
  }

  return samples
}

function main() {
  console.log('🔢 Phase 19: Math Validation Analyzer\n')

  if (!fs.existsSync(MATH_VALIDATION_DIR)) {
    fs.mkdirSync(MATH_VALIDATION_DIR, { recursive: true })
  }

  const samples = analyzeMathSamples()
  console.log(`📊 Analyzing ${samples.length} math samples...\n`)

  // Print per-sample stats
  for (const s of samples) {
    console.log(`  ${s.sampleId}: ${s.grade} ${s.examType}`)
    console.log(`    Questions: ${s.questionCount}, Formulas: ${s.formulaCount} (${s.avgFormulaPerQuestion}/q)`)
    console.log(`    Knowledge: ${s.knowledgePoints.join(', ')}`)
    console.log('')
  }

  // Aggregate stats
  const totalFormulas = samples.reduce((sum, s) => sum + s.formulaCount, 0)
  const totalQuestions = samples.reduce((sum, s) => sum + s.questionCount, 0)
  const avgFormulas = totalFormulas / samples.length

  // Knowledge point frequency
  const kpFreq: Record<string, number> = {}
  samples.forEach(s => s.knowledgePoints.forEach(kp => {
    kpFreq[kp] = (kpFreq[kp] || 0) + 1
  }))

  console.log('═══════════════════════════════════════')
  console.log('📈 Aggregate Statistics')
  console.log('═══════════════════════════════════════')
  console.log(`  Total samples: ${samples.length}`)
  console.log(`  Total formulas: ${totalFormulas}`)
  console.log(`  Avg formulas/sample: ${avgFormulas.toFixed(1)}`)
  console.log(`  Avg formulas/question: ${(totalFormulas / totalQuestions).toFixed(2)}`)
  console.log('')
  console.log('📚 Knowledge Point Coverage:')
  Object.entries(kpFreq)
    .sort((a, b) => b[1] - a[1])
    .forEach(([kp, count]) => {
      console.log(`  ${kp}: ${count}/${samples.length} (${(count / samples.length * 100).toFixed(0)}%)`)
    })

  // Write JSON summary
  const summary = {
    totalSamples: samples.length,
    totalFormulas,
    avgFormulasPerSample: avgFormulas,
    avgFormulasPerQuestion: totalFormulas / totalQuestions,
    knowledgePointCoverage: kpFreq,
    samples,
  }
  fs.writeFileSync(
    path.join(MATH_VALIDATION_DIR, 'math-analysis-summary.json'),
    JSON.stringify(summary, null, 2)
  )
  console.log(`\n✅ Analysis written to math-validation/math-analysis-summary.json`)
}

main()
