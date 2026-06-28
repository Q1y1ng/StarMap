// ── DoubaoVisionProvider — Doubao-Seed-1.8-Vision 适配器（Phase 15-N） ──
// 实现 VisionProvider 接口，调用火山引擎 ARK OpenAI 兼容 API。

import { createHash } from 'crypto'
import type { VisionDocument }
  from '@/types/vision-document'
import type { VisionProvider, ImageContext, VisionOptions } from './vision-provider'
import { EXAM_DOCUMENT_SYSTEM_PROMPT } from './prompts'

/** Doubao API 配置 */
const DEFAULT_CONFIG = {
  apiKey: process.env.DOUBAO_API_KEY ?? '',
  model: process.env.DOUBAO_MODEL ?? '',
  baseUrl: process.env.DOUBAO_BASE_URL ?? '',
}

export class DoubaoVisionProvider implements VisionProvider {
  readonly name = 'doubao-seed-1.8'

  /**
   * 分析多张图片，返回结构化 VisionDocument
   * 一次请求传全部图片，模型自动建立跨图片上下文关联
   */
  async analyzeImages(
    images: ImageContext[],
    options?: VisionOptions,
  ): Promise<VisionDocument> {
    const start = performance.now()

    if (images.length === 0) {
      throw new Error('没有图片可分析')
    }

    const apiKey = options?.apiKey || DEFAULT_CONFIG.apiKey
    const systemPrompt = options?.systemPrompt || EXAM_DOCUMENT_SYSTEM_PROMPT

    // 1. 将所有图片转为 base64 data URL
    const imageContents = images.map((img) => {
      const base64 = img.buffer.toString('base64')
      const mimeType = img.mimeType || 'image/jpeg'
      return {
        type: 'image_url' as const,
        image_url: { url: `data:${mimeType};base64,${base64}` },
      }
    })

    // 2. 调用 Doubao Vision API
    const res = await fetch(DEFAULT_CONFIG.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_CONFIG.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `这是同一份考试的全部 ${images.length} 张图片。所有图片来自同一份文档，综合全部图片信息输出。`,
              },
              ...imageContents,
            ],
          },
        ],
        max_tokens: 65536,
        temperature: options?.signal ? 0.1 : 0.1,
      }),
      signal: options?.signal ?? AbortSignal.timeout(300_000),
    })

    if (!res.ok) {
      const errBody = await res.text()
      throw new Error(`Doubao Vision API 错误 (${res.status}): ${errBody}`)
    }

    const data = await res.json() as {
      choices: { message: { content: string } }[]
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
      model?: string
    }

    const rawText = data.choices?.[0]?.message?.content ?? ''
    const finishReason = (data as any).choices?.[0]?.finish_reason ?? '未知'
    const modelUsed = data.model || DEFAULT_CONFIG.model
    const durationMs = Math.round(performance.now() - start)

    // RAW_VISION_RESPONSE=true: 记录原始输出详情到日志
    if (process.env.RAW_VISION_RESPONSE === 'true') {
      console.log(`[RAW_VISION_RESPONSE] 模型: ${modelUsed}`)
      console.log(`[RAW_VISION_RESPONSE] 原始输出长度: ${rawText.length} 字符`)
      console.log(`[RAW_VISION_RESPONSE] finish_reason: ${finishReason}`)
      console.log(`[RAW_VISION_RESPONSE] usage:`, data.usage ?? '未知')
      console.log(`[RAW_VISION_RESPONSE] --- HEAD 3000 ---`)
      console.log(rawText.slice(0, 3000))
      console.log(`[RAW_VISION_RESPONSE] --- TAIL 3000 (末尾3000字符) ---`)
      console.log(rawText.slice(-3000))
      console.log(`[RAW_VISION_RESPONSE] --- END ---`)
    }

    // ── Phase 15-R: 直接返回原始模型输出 ──
    // 移除 ExamDocumentParser / ExamMarkdownRenderer / DocumentAssembler 等旧链路
    // VisionDocument.rawText 是唯一数据源
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

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    try {
      const res = await fetch(DEFAULT_CONFIG.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEFAULT_CONFIG.apiKey}`,
        },
        body: JSON.stringify({
          model: DEFAULT_CONFIG.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` }
      return { ok: true }
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : '连接失败' }
    }
  }

  // ── 轻量元数据提取 ───────────────────────────────────
  // 从原始 Markdown 中提取试卷标题/科目/年级等，不依赖 ExamDocumentParser

  private extractMetadata(rawText: string): VisionDocument['metadata'] {
    const metadata: VisionDocument['metadata'] = {}
    for (const line of rawText.split('\n')) {
      const t = line.trim()
      if (!t) continue
      if (!metadata.title && t.startsWith('试卷标题')) {
        const v = t.replace(/^试卷标题[：:]\s*/, '')
        if (v) metadata.title = v
      } else if (!metadata.subject && (t.startsWith('科目') || t.startsWith('学科'))) {
        const v = t.replace(/^(?:科目|学科)[：:]\s*/, '')
        if (v) metadata.subject = v
      } else if (!metadata.grade && (t.startsWith('年级'))) {
        const v = t.replace(/^年级[：:]\s*/, '')
        if (v) metadata.grade = v
      } else if (!metadata.date && (t.startsWith('考试时间'))) {
        const v = t.replace(/^考试时间[：:]\s*/, '')
        if (v) metadata.date = v
      } else if (metadata.totalScore == null && t.startsWith('总分')) {
        const m = t.match(/(\d+)/)
        if (m) metadata.totalScore = parseInt(m[1], 10)
      }
    }
    return metadata
  }
}
