// ── 小分识别服务（Phase 13） ──────────────────────────────
// 解析成绩平台截图的 OCR 结果，提取题号/满分/得分/扣分

import { prisma } from '@/lib/prisma'
import type { ScoreBreakdownItem, ScoreBreakdownOcrResult } from './types'

/**
 * Doubao OCR 专用的小分页面对话系统提示词
 */
const SCORE_BREAKDOWN_SYSTEM_PROMPT = `你是一名专业成绩单解析引擎。
任务：
解析上传图片中的成绩信息。
图片是学校成绩平台的"小分页面"截图。
其中每行包含：
- 题号
- 满分
- 得分
- 扣分

必须严格按照以下格式输出。
不要输出JSON。
不要解释。
不要总结。
仅输出Markdown表格。

# 小分信息

| 题号 | 满分 | 得分 | 扣分 |
| --- | --- | --- | --- |
| 1 | 5 | 5 | 0 |
| 2 | 5 | 3 | 2 |
| 3 | 10 | 8 | 2 |

若图片包含总分信息，在表格后另起一行输出：
总分：XXX
满分：XXX

输出结束。
不得附加任何说明文字。`

export class ScoreBreakdownService {
  /**
   * 使用 Doubao Vision 识别小分页面截图
   */
  static async recognizeFromImage(file: File, doubaoApiKey?: string): Promise<ScoreBreakdownOcrResult> {
    const start = performance.now()

    // 1. 读取文件并转为 base64
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'
    const dataUrl = `data:${mimeType};base64,${base64}`

    const apiKey = doubaoApiKey ?? process.env.DOUBAO_API_KEY ?? ''
    const model = process.env.DOUBAO_MODEL ?? 'ep-20260609012758-jbjkm'
    const baseUrl = process.env.DOUBAO_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'

    if (!apiKey) {
      return { success: false, items: [], rawText: 'DOUBAO_API_KEY 未配置，请在设置中配置' }
    }

    // 2. 调用 Doubao Vision API
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SCORE_BREAKDOWN_SYSTEM_PROMPT },
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
      return { success: false, items: [], rawText: `API 错误 (${res.status}): ${errBody}` }
    }

    const data = await res.json() as {
      choices: { message: { content: string } }[]
    }

    const text = data.choices?.[0]?.message?.content ?? ''
    const elapsed = (performance.now() - start) / 1000
    console.log(`[ScoreBreakdown] OCR 完成，耗时 ${elapsed.toFixed(1)}s`)

    // 3. 解析 Markdown 表格提取小分数据
    const items = this.parseMarkdownTable(text)

    return {
      success: items.length > 0,
      items,
      rawText: text,
    }
  }

  /**
   * 解析 Markdown 表格，提取题号/满分/得分/扣分
   */
  static parseMarkdownTable(markdown: string): ScoreBreakdownItem[] {
    const items: ScoreBreakdownItem[] = []

    // 匹配 Markdown 表格行：| 1 | 5 | 5 | 0 |
    const tableRowRegex = /^\|\s*(\d+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/gm

    let match: RegExpExecArray | null
    while ((match = tableRowRegex.exec(markdown)) !== null) {
      const questionNo = parseInt(match[1], 10)
      const fullScore = parseFloat(match[2])
      const score = parseFloat(match[3])
      const lostScore = parseFloat(match[4])

      if (!isNaN(questionNo) && !isNaN(fullScore) && !isNaN(score)) {
        items.push({
          questionNo,
          fullScore,
          score,
          lostScore: !isNaN(lostScore) ? lostScore : Math.max(0, fullScore - score),
        })
      }
    }

    // 也尝试匹配非表格格式：题号：1 得分：5 满分：5 扣分：0
    if (items.length === 0) {
      const kvRegex = /题号[：:]\s*(\d+)[\s\S]*?得分[：:]\s*([\d.]+)[\s\S]*?满分[：:]\s*([\d.]+)[\s\S]*?扣分[：:]\s*([\d.]+)/gi
      let kvMatch: RegExpExecArray | null
      while ((kvMatch = kvRegex.exec(markdown)) !== null) {
        const questionNo = parseInt(kvMatch[1], 10)
        const score = parseFloat(kvMatch[2])
        const fullScore = parseFloat(kvMatch[3])
        const lostScore = parseFloat(kvMatch[4])

        if (!isNaN(questionNo) && !isNaN(fullScore) && !isNaN(score)) {
          items.push({
            questionNo,
            fullScore,
            score,
            lostScore: !isNaN(lostScore) ? lostScore : Math.max(0, fullScore - score),
          })
        }
      }
    }

    return items.sort((a, b) => a.questionNo - b.questionNo)
  }

  /**
   * 保存小分识别结果到数据库
   * 同时更新对应考试的 QuestionResult 数据
   */
  static async save(
    examId: string,
    items: ScoreBreakdownItem[],
  ): Promise<{ count: number; matchedCount: number }> {
    // 1. 先清除该考试现有的小分记录
    await prisma.scoreBreakdown.deleteMany({
      where: { examId },
    })

    // 2. 批量创建新记录
    await prisma.scoreBreakdown.createMany({
      data: items.map((item) => ({
        examId,
        questionNo: item.questionNo,
        fullScore: item.fullScore,
        score: item.score,
        lostScore: item.lostScore,
        source: 'SCORE_BREAKDOWN',
      })),
    })

    // 3. 匹配题号，更新 QuestionResult
    const questions = await prisma.question.findMany({
      where: { examId },
      orderBy: { sortOrder: 'asc' },
    })
    const questionMap = new Map(questions.map((q) => [q.questionNo, q]))

    let matchedCount = 0
    for (const item of items) {
      const question = questionMap.get(item.questionNo)
      if (!question) continue

      const scoreRate = item.fullScore > 0 ? Math.round((item.score / item.fullScore) * 100) / 100 : 0
      const isCorrect = item.score >= item.fullScore

      // Upsert: 存在则更新，不存在则创建
      await prisma.questionResult.upsert({
        where: {
          questionId_examId: {
            questionId: question.id,
            examId,
          },
        },
        update: {
          score: item.score,
          fullScore: item.fullScore,
          lostScore: item.lostScore,
          scoreRate,
          isCorrect,
        },
        create: {
          questionId: question.id,
          examId,
          score: item.score,
          fullScore: item.fullScore,
          lostScore: item.lostScore,
          scoreRate,
          isCorrect,
        },
      })
      matchedCount++
    }

    return { count: items.length, matchedCount }
  }

  /**
   * 获取考试的小分识别结果
   */
  static async getByExamId(examId: string) {
    return prisma.scoreBreakdown.findMany({
      where: { examId },
      orderBy: { questionNo: 'asc' },
    })
  }
}
