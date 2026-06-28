import { readFileSync, writeFileSync } from 'fs'

const INPUT = 'e:/exam-pilot/docs/copyright/source-code-extracted.txt'
let text = readFileSync(INPUT, 'utf-8')

// ── 标记锚点 ──
const START_MARKER = '// src/services/vision/vision-provider.ts'
const END_MARKER   = '// src/app/dashboard/page.tsx'

const startIdx = text.indexOf(START_MARKER)
const endIdx   = text.indexOf(END_MARKER)

if (startIdx < 0 || endIdx < 0) {
  console.error('Markers not found')
  process.exit(1)
}

const before = text.slice(0, startIdx)
const after  = text.slice(endIdx)

// ── 重构后的 vision 层 ──
const replacement = `// src/services/vision/default-vision-provider.ts
import { createHash } from 'crypto'
import type { VisionDocument } from '@/types/vision-document'

const DEFAULT_CONFIG = {
  apiKey: process.env.DOUBAO_API_KEY ?? 'xxxx-xxxx-xxxx-xxxx',
  model: process.env.DOUBAO_MODEL ?? 'ep-demo-00000000',
  baseUrl: process.env.DOUBAO_BASE_URL ?? 'https://demo-api.example.com/v3/chat/completions',
}

// FIXME: 等换模型了把系统提示抽到单独文件
const EXAM_DOCUMENT_SYSTEM_PROMPT = \`你是一个教育文档 OCR 引擎，解析试卷、答题卡、成绩单、小分页、手写答题等全部考试信息。

这些图片来自同一次考试，已按以下顺序排列：
1. 试卷页（题目）
2. 答题卡 / 学生作答
3. 小分 / 成绩单

请综合全部图片信息输出，不要分页或按文件名分隔。

输出规则：
- 仅输出 Markdown，无额外解释、无总结、无 JSON

提取内容（按以下顺序）：

## 考试信息
- 考试名称（从试卷标题提取）
- 科目
- 年级
- 日期
- 总分
不确定的字段标注「未识别」，不要编造。

## 试卷内容
- 选择题：按题号依次输出题目、选项
- 非选择题：按题号输出题干、小题
- 完整保留数学表达式、公式、图表说明

## 学生作答
- 选择题答案：按题号 + 选项罗列
- 主观题答案：完整保留手写内容，格式和换行不变

## 成绩信息
- 总分、班级排名、年级排名、平均分、最高分、最低分（无则省略）

## 小分 / 错题汇总
逐条列出：题号、得分、满分、扣分、知识点（无则省略）

要求：精准识别题号、得分、扣分，所有内容统一为 Markdown 格式。\`

export class DefaultVisionProvider {
  readonly name = 'default-vision'

  async analyzeImages(
    images: Array<{ buffer: Buffer; filename: string; mimeType: string }>,
    options?: { apiKey?: string; systemPrompt?: string; signal?: AbortSignal },
  ): Promise<VisionDocument> {
    const start = performance.now()

    const MAX_IMAGES = 20
    if (images.length > MAX_IMAGES) {
      images = images.slice(0, MAX_IMAGES)
    }

    if (images.length === 0) {
      throw new Error('一张图都没有')
    }

    const apiKey = options?.apiKey || DEFAULT_CONFIG.apiKey
    const systemPrompt = options?.systemPrompt || EXAM_DOCUMENT_SYSTEM_PROMPT

    const imageContents = images.map((img) => {
      const base64 = img.buffer.toString('base64')
      const mimeType = img.mimeType || 'image/jpeg'
      return {
        type: 'image_url' as const,
        image_url: { url: \`data:\${mimeType};base64,\${base64}\` },
      }
    })

    const res = await fetch(DEFAULT_CONFIG.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${apiKey}\`,
      },
      body: JSON.stringify({
        model: DEFAULT_CONFIG.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: \`这是同一份考试的全部 \${images.length} 张图片。所有图片来自同一份文档，综合全部图片信息输出。\` },
              ...imageContents,
            ],
          },
        ],
        max_tokens: 20480,
        temperature: 0.1,
      }),
      signal: options?.signal ?? AbortSignal.timeout(300_000),
    })

    if (!res.ok) {
      const errBody = await res.text()
      throw new Error(\`Vision API error (\${res.status}): \${errBody}\`)
    }

    const data = await res.json() as {
      choices: { message: { content: string } }[]
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
      model?: string
    }

    const rawText = data.choices?.[0]?.message?.content ?? ''
    const modelUsed = data.model || DEFAULT_CONFIG.model
    const durationMs = Math.round(performance.now() - start)

    const visionDoc: VisionDocument = {
      metadata: this.extractMetadata(rawText),
      questions: [],
      studentAnswers: [],
      scoreBreakdowns: [],
      mistakes: [],
      sourceImages: images.map(i => i.filename),
      model: modelUsed,
      durationMs,
      rawText,
    }

    return visionDoc
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    try {
      const res = await fetch(DEFAULT_CONFIG.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${DEFAULT_CONFIG.apiKey}\`,
        },
        body: JSON.stringify({
          model: DEFAULT_CONFIG.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) return { ok: false, detail: \`HTTP \${res.status}\` }
      return { ok: true }
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : '连不上' }
    }
  }

  private extractMetadata(rawText: string): VisionDocument['metadata'] {
    const metadata: VisionDocument['metadata'] = {}
    for (const line of rawText.split('\\n')) {
      const t = line.trim()
      if (!t) continue
      if (!metadata.title && t.startsWith('试卷标题')) {
        const v = t.replace(/^试卷标题[：:]\\s*/, '')
        if (v) metadata.title = v
      } else if (!metadata.subject && (t.startsWith('科目') || t.startsWith('学科'))) {
        const v = t.replace(/^(?:科目|学科)[：:]\\s*/, '')
        if (v) metadata.subject = v
      } else if (!metadata.grade && (t.startsWith('年级'))) {
        const v = t.replace(/^年级[：:]\\s*/, '')
        if (v) metadata.grade = v
      } else if (!metadata.date && (t.startsWith('考试时间'))) {
        const v = t.replace(/^考试时间[：:]\\s*/, '')
        if (v) metadata.date = v
      } else if (metadata.totalScore == null && t.startsWith('总分')) {
        const m = t.match(/(\\d+)/)
        if (m) metadata.totalScore = parseInt(m[1], 10)
      }
    }
    return metadata
  }
}

// src/services/vision/cache.ts
import { createHash } from 'crypto'

const cache = new Map<string, { result: unknown; timestamp: number }>()
const MAX_SIZE = 50
const TTL_MS = 30 * 60 * 1000

export function fingerprintImages(buffers: { buffer: Buffer; filename: string }[]): string {
  const hash = createHash('sha256')
  for (const { buffer, filename } of buffers) {
    hash.update(filename)
    hash.update(buffer)
  }
  return hash.digest('hex')
}

export function cacheGet<T>(fingerprint: string): T | null {
  const entry = cache.get(fingerprint)
  if (!entry) return null
  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(fingerprint)
    return null
  }
  return entry.result as T
}

export function cacheSet<T>(fingerprint: string, result: T): void {
  if (cache.size >= MAX_SIZE) {
    const oldest = cache.entries().next().value
    if (oldest) cache.delete(oldest[0])
  }
  cache.set(fingerprint, { result, timestamp: Date.now() })
}

// src/services/vision.ts
import { ImageBatchBuilder } from '@/services/vision/pdf-handler'
import { DefaultVisionProvider } from './vision/default-vision-provider'
import { fingerprintImages, cacheGet, cacheSet } from './vision/cache'
import type { VisionDocument } from '@/types/vision-document'

const activeProvider = new DefaultVisionProvider()

export type VisionResult = {
  document: VisionDocument
  batch: { files: File[]; sourceFiles: { filename: string; size: number; type: string }[]; totalPages: number }
  timeline: { imageBatch: number; vision: number; total: number }
  cacheHit: boolean
  retried: boolean
}

export async function analyzeVision(
  fileBuffers: { buffer: Buffer; filename: string; size: number; mimeType: string }[],
  options?: { apiKey?: string; useCache?: boolean; useFallback?: boolean },
): Promise<VisionResult> {
  const overallStart = performance.now()

  const t0 = performance.now()
  const batch = await ImageBatchBuilder.build(fileBuffers)
  const imageBatchTime = Math.round(performance.now() - t0)

  const useCache = options?.useCache ?? true
  const fingerprint = fingerprintImages(
    fileBuffers.map(f => ({ buffer: f.buffer, filename: f.filename })),
  )

  if (useCache) {
    const cached = cacheGet<VisionDocument>(fingerprint)
    if (cached) {
      return {
        document: cached,
        batch,
        timeline: { imageBatch: imageBatchTime, vision: 0, total: Math.round(performance.now() - overallStart) },
        cacheHit: true,
        retried: false,
      }
    }
  }

  const t1 = performance.now()
  const imageContexts = fileBuffers.map(f => ({
    buffer: f.buffer,
    filename: f.filename,
    mimeType: f.mimeType || 'image/jpeg',
  }))

  const initialDoc = await activeProvider.analyzeImages(imageContexts, {
    apiKey: options?.apiKey,
  })
  const visionTime = Math.round(performance.now() - t1)

  let retried = false
  let finalDoc = initialDoc

  // HACK: 空结果重试，有时候模型抽风返回空
  if (options?.useFallback ?? true) {
    const rawLen = initialDoc.rawText?.length ?? 0
    if (rawLen < 50) {
      console.warn(\`[vision] retry — rawText only \${rawLen} chars\`)
      try {
        const retryResult = await activeProvider.analyzeImages(imageContexts, {
          apiKey: options?.apiKey,
        })
        finalDoc = retryResult
        retried = true
      } catch (err) {
        console.error('[vision] retry failed:', err)
      }
    }
  }

  if (useCache) {
    cacheSet(fingerprint, finalDoc)
  }

  return {
    document: finalDoc,
    batch,
    timeline: { imageBatch: imageBatchTime, vision: visionTime, total: Math.round(performance.now() - overallStart) },
    cacheHit: false,
    retried,
  }
}

export async function healthCheck() {
  return activeProvider.healthCheck()
}

// src/services/vision/pdf-handler.ts
// PDF 转图片 + 文件批次构建
import { PdfToImagesService } from '@/services/ocr/pdf-to-images.service'

export type ImageBatchResult = {
  files: File[]
  sourceFiles: { filename: string; size: number; type: string }[]
  totalPages: number
}

export class ImageBatchBuilder {
  static async build(
    fileBuffers: { buffer: Buffer; filename: string; size: number; mimeType: string }[],
  ): Promise<ImageBatchResult> {
    const files: File[] = []
    const sourceFiles: { filename: string; size: number; type: string }[] = []

    for (const fb of fileBuffers) {
      const ext = fb.filename.split('.').pop()?.toLowerCase()

      if (ext === 'pdf') {
        const { pages: imageBuffers, mimeType } = await PdfToImagesService.convert(fb.buffer, fb.filename)
        const pageExt = mimeType === 'image/png' ? 'png' : 'jpg'
        for (let i = 0; i < imageBuffers.length; i++) {
          const pageName = \`\${fb.filename.replace(/\\.pdf$/i, '')}-p\${i + 1}.\${pageExt}\`
          files.push(new File([imageBuffers[i] as BlobPart], pageName, { type: mimeType }))
        }
        sourceFiles.push({ filename: fb.filename, size: fb.size, type: fb.mimeType })
      } else {
        const mimeType = fb.mimeType && fb.mimeType !== 'application/octet-stream'
          ? fb.mimeType
          : 'image/jpeg'
        files.push(new File([fb.buffer as BlobPart], fb.filename, { type: mimeType }))
        sourceFiles.push({ filename: fb.filename, size: fb.size, type: mimeType })
      }
    }

    return { files, sourceFiles, totalPages: files.length }
  }
}`

text = before + replacement + '\n' + after

writeFileSync(INPUT, text, 'utf-8')
console.log('✅ Vision 层替换完成')
console.log(`   文件大小: ${(text.length / 1024).toFixed(0)} KB`)
