import { callDeepSeekTracked } from '@/lib/ai'
import { pushQualityLog } from '@/lib/ai-logger'
import { QUESTION_PARSER_SYSTEM_PROMPT, buildQuestionParserPrompt } from '@/ai/prompts/question-parser'
import type { AiCallMeta, AiConfig } from '@/lib/ai'
import { z } from 'zod'

// ── Zod 校验模型 ──

export const SubQuestionSchema = z.object({
  label: z.string().describe('子题编号，如"(1)"、"A."、"1."'),
  text: z.string().describe('子题文本内容'),
  score: z.number().optional().describe('子题分值'),
})

export const QuestionSchema = z.object({
  questionNo: z.number().describe('题号（数字）'),
  questionType: z
    .enum([
      '选择题',
      '填空题',
      '解答题',
      '判断题',
      '计算题',
      '简答题',
      '综合题',
      '阅读理解',
      '完形填空',
      '其他',
    ])
    .describe('题目类型（中文）'),
  fullScore: z.number().describe('满分分值，无标注则为0'),
  questionText: z.string().describe('题目完整原始文本'),
  hasSubQuestions: z.boolean().describe('是否包含子题'),
  subQuestions: z.array(SubQuestionSchema).optional().describe('子题列表'),
  pageNumber: z.number().optional().describe('所在页码'),
})

export const QuestionParseResultSchema = z.object({
  questions: z.array(QuestionSchema).describe('题目列表'),
  totalScore: z.number().describe('全卷总分'),
  questionCount: z.number().describe('题目总数'),
})

// ── 推导类型 ──

export type QuestionParseResult = z.infer<typeof QuestionParseResultSchema>

export type ParserOutput = {
  data: QuestionParseResult
  meta: AiCallMeta
}

// ── 主函数 ──

export async function parseQuestionsFromOcr(ocrText: string, config?: AiConfig): Promise<ParserOutput> {
  // 1. 调用 DeepSeek（带 Token + 耗时统计）
  const { data: raw, meta } = await callDeepSeekTracked<Record<string, unknown>>({
    systemPrompt: QUESTION_PARSER_SYSTEM_PROMPT,
    userPrompt: buildQuestionParserPrompt(ocrText),
    temperature: 0.1,
    config,
  })

  // 2. Zod 校验
  let parsed: QuestionParseResult
  let schemaValid = true

  try {
    parsed = QuestionParseResultSchema.parse(raw)
  } catch (err) {
    schemaValid = false
    throw err // 仍然向上抛，让 API 层处理
  }

  // 3. 记录质量日志
  pushQualityLog({
    inputContent: ocrText,
    outputData: parsed,
    meta,
    schemaValid,
  })

  return { data: parsed, meta }
}
