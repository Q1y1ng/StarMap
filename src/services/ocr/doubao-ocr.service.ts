// ── Doubao Vision OCR 服务 ─────────────────────────────────
// ⚠️ 已弃用 — Phase 15-N 迁移至 DoubaoVisionProvider / VisionService
// 保留用于向后兼容（api/answer-sheet/ocr 仍依赖此服务）
// 新代码请使用 @/services/vision
//

import { OcrMode, OcrEngine, type OcrResultWithMeta, type DoubaoConfig } from './types'
import { OcrQualityService } from './ocr-quality.service'

const DEFAULT_CONFIG: DoubaoConfig = {
  apiKey: process.env.DOUBAO_API_KEY ?? '',
  model: process.env.DOUBAO_MODEL ?? '',
  baseUrl: process.env.DOUBAO_BASE_URL ?? '',
}

const SYSTEM_PROMPT = `你是一个教育文档 OCR 引擎，解析试卷、答题卡、成绩单、小分页、手写答题等全部考试信息。

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

要求：精准识别题号、得分、扣分，所有内容统一为 Markdown 格式。`

export class DoubaoOCRService {
  /**
   * 调用 Doubao Vision 视觉模型识别单张图片
   * @param file 从 FormData 中获取的 File 对象
   */
  static async recognize(
    file: File,
    mode: OcrMode,
    apiKeyOverride?: string,
  ): Promise<OcrResultWithMeta> {
    const start = performance.now()

    // 1. 读取文件并转为 base64
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'
    const dataUrl = `data:${mimeType};base64,${base64}`

    // 2. 调用 Doubao Vision API（优先使用传入的 apiKey，其次环境变量）
    const config = { ...DEFAULT_CONFIG, apiKey: apiKeyOverride || DEFAULT_CONFIG.apiKey }
    if (!config.apiKey) {
      throw new Error('DOUBAO_API_KEY 未配置，请在设置中配置或 .env 中设置')
    }

    const res = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 16384,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(180_000),
    })

    if (!res.ok) {
      const errBody = await res.text()
      throw new Error(`Doubao Vision API 错误 (${res.status}): ${errBody}`)
    }

    const data = await res.json() as {
      choices: { message: { content: string } }[]
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    }

    const text = data.choices?.[0]?.message?.content ?? ''

    // 3. 评估质量
    const quality = OcrQualityService.evaluate(text)
    const elapsed = (performance.now() - start) / 1000

    return {
      success: true,
      text,
      pages: 1,
      chars: text.length,
      elapsed,
      filename: file.name,
      engine: OcrEngine.DOUBAO,
      mode,
      quality,
    }
  }

  /**
   * 调用 Doubao Vision 视觉模型识别图片（自定义系统提示词）
   * @param file 上传的图片文件
   * @param mode OCR 模式
   * @param systemPrompt 自定义系统提示词
   * @param apiKeyOverride 可选的 API Key 覆盖
   */
  static async recognizeWithPrompt(
    file: File,
    mode: OcrMode,
    systemPrompt: string,
    apiKeyOverride?: string,
  ): Promise<OcrResultWithMeta> {
    const start = performance.now()

    // 1. 读取文件并转为 base64
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'
    const dataUrl = `data:${mimeType};base64,${base64}`

    // 2. 调用 Doubao Vision API（优先使用传入的 apiKey，其次环境变量）
    const config = { ...DEFAULT_CONFIG, apiKey: apiKeyOverride || DEFAULT_CONFIG.apiKey }
    if (!config.apiKey) {
      throw new Error('DOUBAO_API_KEY 未配置，请在设置中配置或 .env 中设置')
    }

    const res = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(180_000),
    })

    if (!res.ok) {
      const errBody = await res.text()
      throw new Error(`Doubao Vision API 错误 (${res.status}): ${errBody}`)
    }

    const data = await res.json() as {
      choices: { message: { content: string } }[]
    }

    const text = data.choices?.[0]?.message?.content ?? ''

    // 3. 评估质量
    const quality = OcrQualityService.evaluate(text)
    const elapsed = (performance.now() - start) / 1000

    return {
      success: true,
      text,
      pages: 1,
      chars: text.length,
      elapsed,
      filename: file.name,
      engine: OcrEngine.DOUBAO,
      mode,
      quality,
    }
  }

  /**
   * 批量识别：所有图片同一次 API 调用，模型同时看到所有页面
   * @param files 多页图片文件（每页一张）
   */
  static async recognizeBatch(
    files: File[],
    mode: OcrMode,
    apiKeyOverride?: string,
  ): Promise<OcrResultWithMeta> {
    if (files.length === 0) throw new Error('没有文件')
    if (files.length === 1) {
      return this.recognize(files[0], mode, apiKeyOverride)
    }

    const start = performance.now()

    // 1. 将所有图片转为 base64 data URL
    const imageContents: { type: 'image_url'; image_url: { url: string } }[] = []
    for (const file of files) {
      // 校验：批量模式 Doubao 仅支持图片，不支持 PDF
      if (file.type === 'application/pdf') {
        throw new Error(`文件 "${file.name}" 是 PDF 格式，批量模式下仅支持图片文件（JPG/PNG）。PDF 文件请单独上传。`)
      }
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const mimeType = file.type || 'image/jpeg'
      imageContents.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } })
    }

    // 2. 调用 Doubao Vision API（优先使用传入的 apiKey，其次环境变量）
    const config = { ...DEFAULT_CONFIG, apiKey: apiKeyOverride || DEFAULT_CONFIG.apiKey }
    if (!config.apiKey) {
      throw new Error('DOUBAO_API_KEY 未配置，请在设置中配置或 .env 中设置')
    }

    const res = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `这是同一份试卷的全部 ${files.length} 页。所有图片来自同一份文档，合并输出，不要分页或按文件名分隔。`,
              },
              ...imageContents,
            ],
          },
        ],
        max_tokens: 16384,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(300_000), // 5 分钟，批处理需要更长时间
    })

    if (!res.ok) {
      const errBody = await res.text()
      throw new Error(`Doubao Vision API 错误 (${res.status}): ${errBody}`)
    }

    const data = await res.json() as {
      choices: { message: { content: string } }[]
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    }

    const text = data.choices?.[0]?.message?.content ?? ''

    // 3. 评估质量
    const quality = OcrQualityService.evaluate(text)
    const elapsed = (performance.now() - start) / 1000

    return {
      success: true,
      text,
      pages: files.length,
      chars: text.length,
      elapsed,
      filename: files.map(f => f.name).join(', '),
      engine: OcrEngine.DOUBAO,
      mode,
      quality,
    }
  }

  /**
   * 检查 Doubao API 是否可用
   */
  static async healthCheck(apiKeyOverride?: string): Promise<{ ok: boolean; detail?: string }> {
    const config = { ...DEFAULT_CONFIG, apiKey: apiKeyOverride || DEFAULT_CONFIG.apiKey }
    if (!config.apiKey) {
      return { ok: false, detail: 'DOUBAO_API_KEY 未配置' }
    }
    try {
      const res = await fetch(config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
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
}
