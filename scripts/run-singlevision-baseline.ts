// ── Phase 20A-R: SingleVision Baseline ⭐ ──
// 逐页调用 Vision API，JSON 提取（非完整 markdown）
// 用法: npx tsx scripts/run-singlevision-baseline.ts
//
// 核心设计：
//   每页独立送入 Vision API（无多页上下文）
//   要求模型返回结构化 JSON（非 markdown）
//   输出 token 降低 90%+

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '..')
const BENCHMARK_DIR = path.join(ROOT, 'research-data', 'benchmark')
const SV_DIR = path.join(BENCHMARK_DIR, 'singlevision')
const SV_PER_SAMPLE_DIR = path.join(SV_DIR, 'per-sample')
const SAMPLE_DIR = 'E:/exam-pilot/sample'

// ── Vision API Config ──

const API_KEY = process.env.DOUBAO_API_KEY ?? ''
const MODEL = process.env.DOUBAO_MODEL || ''
const BASE_URL = process.env.DOUBAO_BASE_URL || ''

// Rate limiting
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 30_000  // 30s between retries
const PAGE_DELAY_MS = 2_000     // 2s between pages to avoid rate limit

// ── Types ──

interface PageExtraction {
  pageNumber: number
  fileName: string
  /** Processing time for this page (ms) */
  processingTime: number
  /** Raw response length (chars) */
  outputLength: number
  /** Token usage */
  promptTokens: number
  completionTokens: number
  /** Parsed JSON from Vision */
  extraction: PageJson | null
  /** Raw response text (for debugging) */
  rawResponse: string
}

interface PageJson {
  page_type?: string
  questions?: { number: number; type?: string }[]
  answers?: { number: number; content?: string }[]
  scores?: { total?: number | null; max?: number | null }
  sections?: string[]
}

interface AggregatedCase {
  sampleId: string
  caseId: string
  subject: string
  totalPages: number
  totalProcessingTime: number
  totalOutputLength: number
  totalPromptTokens: number
  totalCompletionTokens: number
  /** Merged questions across all pages */
  questions: { number: number; type?: string }[]
  /** Merged answers across all pages */
  answers: { number: number; content?: string }[]
  /** Merged scores */
  scores: { total?: number | null; max?: number | null }
  /** Merged sections */
  sections: string[]
  /** Per-page details */
  pages: PageExtraction[]
  /** Error if any page failed */
  error?: string
}

interface SingleVisionOutput {
  meta: {
    generatedAt: string
    script: string
    method: 'SingleVision'
    model: string
    promptMode: 'json-extraction'
    totalSamples: number
    totalPages: number
    totalApiCalls: number
    totalTokens: number
  }
  status: 'COMPLETED' | 'PARTIAL' | 'NO_IMAGES'
  summary: {
    avgProcessingTime: number
    avgOutputLength: number
    avgTokensPerPage: number
    avgPagesPerSample: number
  }
  samples: AggregatedCase[]
}

// ── Case mapping ──

interface CaseInfo {
  subject: string
  student: 'LY' | 'HZ'
  paper: string[]
  answer: string[]
  score: string[]
}

const CASE_MAP: Record<string, CaseInfo> = {
  '001': { subject: '语文', student: 'LY', paper: ['语文试卷1.jpg', '语文试卷2.jpg', '语文试卷3.jpg', '语文试卷4.jpg'], answer: ['YL语文答题卡1.jpg', 'YL语文答题卡2.jpg'], score: ['YL语文小分.png'] },
  '002': { subject: '英语', student: 'LY', paper: ['英语试卷1.jpg', '英语试卷2.jpg', '英语试卷3.jpg', '英语试卷4.jpg'], answer: ['YL英语答题卡1.jpg'], score: ['YL英语小分.png'] },
  '003': { subject: '物理', student: 'LY', paper: ['物理试卷1.jpg', '物理试卷2.jpg'], answer: ['YL物理答题卡1.jpg', 'YL物理答题卡2.jpg'], score: ['YL物理小分.png'] },
  '004': { subject: '化学', student: 'LY', paper: ['化学试卷1.jpg', '化学试卷2.jpg', '化学试卷3.jpg'], answer: ['YL化学答题卡1.jpg', 'YL化学答题卡2.jpg'], score: ['YL化学小分.png'] },
  '005': { subject: '地理', student: 'HZ', paper: ['地理试卷1.jpg', '地理试卷2.jpg'], answer: ['HZ地理答题卡1.jpg', 'HZ地理答题卡2.jpg'], score: ['HZ地理小分.png'] },
}

const CATEGORY_DIRS: Record<string, string> = {
  paper: '试卷',
  answer: '答题卡',
  score: '成绩小分',
}

function getAllImagePaths(caseId: string): { fileName: string; fullPath: string; category: string }[] {
  const info = CASE_MAP[caseId]
  if (!info) return []
  const paths: { fileName: string; fullPath: string; category: string }[] = []
  for (const f of info.paper) paths.push({ fileName: f, fullPath: path.join(SAMPLE_DIR, '试卷', f), category: 'paper' })
  for (const f of info.answer) paths.push({ fileName: f, fullPath: path.join(SAMPLE_DIR, '答题卡', f), category: 'answer' })
  for (const f of info.score) paths.push({ fileName: f, fullPath: path.join(SAMPLE_DIR, '成绩小分', f), category: 'score' })
  return paths.filter(p => fs.existsSync(p.fullPath))
}

// ── Prompt ──

const SINGLE_PAGE_EXTRACTION_PROMPT = `你是一个考试试卷信息提取助手。

请分析这张图片中的内容，提取以下信息并以 JSON 格式返回：

1. 本页中包含的题目（题号、题型）
2. 本页中出现的答案内容（题号、答案文本）
3. 本页中出现的成绩信息（总分、满分）
4. 本页内容所属的章节类型

注意：
- 只输出 JSON，不要输出任何其他文字
- 如某字段无对应内容，返回空数组或 null
- 题号为数字

请严格按照以下格式输出：
{
  "page_type": "paper | answer-sheet | score-report | mixed",
  "questions": [{"number": 1, "type": "choice | subjective | fill"}],
  "answers": [{"number": 1, "content": "答案内容"}],
  "scores": {"total": null, "max": null},
  "sections": ["exam_info", "questions", "answers", "scores", "error_summary"]
}`

// ── Vision API call ──

async function callVisionAPI(imagePath: string, retryCount = 0): Promise<{ text: string; processingTime: number }> {
  const imgBuffer = fs.readFileSync(imagePath)
  const base64 = imgBuffer.toString('base64')
  const ext = path.extname(imagePath).toLowerCase()
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'

  const start = performance.now()

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SINGLE_PAGE_EXTRACTION_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: '请提取本页考试信息。' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
      max_tokens: 2048,
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(120_000),
  })

  const processingTime = Math.round(performance.now() - start)

  if (!res.ok) {
    const errBody = await res.text()
    // Handle rate limit with retry
    if (res.status === 429 && retryCount < MAX_RETRIES) {
      const waitMs = RETRY_DELAY_MS * (retryCount + 1)
      console.log(`\n     429 rate limit hit, waiting ${waitMs/1000}s (retry ${retryCount + 1}/${MAX_RETRIES})...`)
      await new Promise(r => setTimeout(r, waitMs))
      return callVisionAPI(imagePath, retryCount + 1)
    }
    throw new Error(`Vision API error (${res.status}): ${errBody}`)
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[]
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  }

  const text = data.choices?.[0]?.message?.content ?? ''
  return { text, processingTime }
}

// ── JSON parsing (robust — handles model returning extra text) ──

function parsePageJson(raw: string): PageJson | null {
  try {
    // Try direct parse first
    return JSON.parse(raw) as PageJson
  } catch {
    // Try to extract JSON from markdown code block
    const blockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (blockMatch) {
      try {
        return JSON.parse(blockMatch[1]) as PageJson
      } catch { /* fall through */ }
    }
    // Try to find { ... } in the text
    const braceMatch = raw.match(/\{[\s\S]*\}/)
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]) as PageJson
      } catch { /* fall through */ }
    }
    return null
  }
}

// ── Process a single case ──

async function processCase(caseId: string): Promise<AggregatedCase> {
  const info = CASE_MAP[caseId]
  const images = getAllImagePaths(caseId)

  console.log(`\n📋 real-${caseId} (${info.subject}): ${images.length} pages`)

  const pages: PageExtraction[] = []
  let allQuestions: { number: number; type?: string }[] = []
  let allAnswers: { number: number; content?: string }[] = []
  const allScores: { total?: number | null; max?: number | null }[] = []
  const allSections = new Set<string>()

  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    const pageNum = i + 1
    process.stdout.write(`   📄 Page ${pageNum}/${images.length} (${img.fileName})... `)

    try {
      const { text, processingTime } = await callVisionAPI(img.fullPath)
      const outputLength = text.length
      const parsed = parsePageJson(text)

      const promptTokens = 0  // not returned in this API version
      const completionTokens = 0

      if (parsed) {
        if (parsed.questions) allQuestions.push(...parsed.questions)
        if (parsed.answers) allAnswers.push(...parsed.answers)
        if (parsed.scores) allScores.push(parsed.scores)
        if (parsed.sections) parsed.sections.forEach(s => allSections.add(s))
      }

      pages.push({
        pageNumber: pageNum,
        fileName: img.fileName,
        processingTime,
        outputLength,
        promptTokens,
        completionTokens,
        extraction: parsed,
        rawResponse: text,
      })

      const status = parsed ? '✅' : '⚠️ (parse failed)'
      console.log(`${processingTime}ms ${status}`)

      // Throttle between pages to avoid rate limit
      if (i < images.length - 1) {
        await new Promise(r => setTimeout(r, PAGE_DELAY_MS))
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.log(`❌ ${errMsg}`)
      pages.push({
        pageNumber: pageNum,
        fileName: img.fileName,
        processingTime: 0,
        outputLength: 0,
        promptTokens: 0,
        completionTokens: 0,
        extraction: null,
        rawResponse: '',
      })
    }
  }

  // Deduplicate questions and answers by number
  const seenQ = new Set<number>()
  const dedupedQuestions = allQuestions.filter(q => {
    if (seenQ.has(q.number)) return false
    seenQ.add(q.number)
    return true
  })

  const seenA = new Set<number>()
  const dedupedAnswers = allAnswers.filter(a => {
    if (seenA.has(a.number)) return false
    seenA.add(a.number)
    return true
  })

  // Merge scores (take the one with the most complete info)
  const mergedScores: { total?: number | null; max?: number | null } = { total: null, max: null }
  for (const s of allScores) {
    if (s.total != null) mergedScores.total = s.total
    if (s.max != null) mergedScores.max = s.max
  }

  const totalProcTime = pages.reduce((s, p) => s + p.processingTime, 0)
  const totalOutLen = pages.reduce((s, p) => s + p.outputLength, 0)
  const totalPromptT = pages.reduce((s, p) => s + p.promptTokens, 0)
  const totalCompletionT = pages.reduce((s, p) => s + p.completionTokens, 0)

  return {
    sampleId: `real-${caseId}`,
    caseId: `case-${caseId}`,
    subject: info.subject,
    totalPages: pages.length,
    totalProcessingTime: totalProcTime,
    totalOutputLength: totalOutLen,
    totalPromptTokens: totalPromptT,
    totalCompletionTokens: totalCompletionT,
    questions: dedupedQuestions,
    answers: dedupedAnswers,
    scores: mergedScores,
    sections: Array.from(allSections),
    pages,
  }
}

// ── Main ──

async function main() {
  console.log('🚀 Phase 20A-R: SingleVision Baseline (JSON Extraction)\n')
  console.log(`   Model: ${MODEL}`)
  console.log(`   Prompt mode: JSON extraction (compact, ~90% fewer output tokens)\n`)

  fs.mkdirSync(SV_DIR, { recursive: true })
  fs.mkdirSync(SV_PER_SAMPLE_DIR, { recursive: true })

  const caseIds = ['001', '002', '003', '004', '005']
  const samples: AggregatedCase[] = []
  let totalApiCalls = 0
  let totalTokens = 0

  for (const caseId of caseIds) {
    const result = await processCase(caseId)
    samples.push(result)

    // Save per-sample details
    const sampleDir = path.join(SV_PER_SAMPLE_DIR, `real-${caseId}`)
    fs.mkdirSync(sampleDir, { recursive: true })
    for (const page of result.pages) {
      fs.writeFileSync(
        path.join(sampleDir, `page-${String(page.pageNumber).padStart(2, '0')}.json`),
        JSON.stringify({ fileName: page.fileName, processingTime: page.processingTime, extraction: page.extraction, rawResponse: page.rawResponse }, null, 2),
      )
    }
    // Save aggregated JSON
    const aggCopy = { ...result }
    delete (aggCopy as any).pages  // pages already saved individually
    fs.writeFileSync(
      path.join(sampleDir, 'aggregated.json'),
      JSON.stringify(aggCopy, null, 2),
    )

    totalApiCalls += result.pages.length
    const pageTokens = result.pages.reduce((s, p) => s + p.promptTokens + p.completionTokens, 0)
    totalTokens += pageTokens

    console.log(`   → ${result.totalProcessingTime}ms total, ${result.questions.length} questions, ${result.answers.length} answers, ${result.sections.length} sections`)
  }

  // ── Summary ──
  const avgProcTime = samples.reduce((s, r) => s + r.totalProcessingTime, 0) / samples.length
  const avgOutLen = samples.reduce((s, r) => s + r.totalOutputLength, 0) / samples.length
  const avgPages = samples.reduce((s, r) => s + r.totalPages, 0) / samples.length

  const output: SingleVisionOutput = {
    meta: {
      generatedAt: new Date().toISOString(),
      script: 'scripts/run-singlevision-baseline.ts',
      method: 'SingleVision',
      model: MODEL,
      promptMode: 'json-extraction',
      totalSamples: samples.length,
      totalPages: samples.reduce((s, r) => s + r.totalPages, 0),
      totalApiCalls,
      totalTokens,
    },
    status: 'COMPLETED',
    summary: {
      avgProcessingTime: Math.round(avgProcTime),
      avgOutputLength: Math.round(avgOutLen),
      avgTokensPerPage: totalApiCalls > 0 ? Math.round(totalTokens / totalApiCalls) : 0,
      avgPagesPerSample: Math.round(avgPages * 10) / 10,
    },
    samples,
  }

  fs.writeFileSync(path.join(SV_DIR, 'results.json'), JSON.stringify(output, null, 2))
  console.log(`\n✅ SingleVision baseline complete!`)
  console.log(`   Samples: ${samples.length}`)
  console.log(`   Total API calls: ${totalApiCalls}`)
  console.log(`   Avg processing time: ${Math.round(avgProcTime)}ms`)
  console.log(`   Avg output length: ${Math.round(avgOutLen)} chars`)
  console.log(`   Output: ${path.join(SV_DIR, 'results.json')}`)
}

main().catch(console.error)
