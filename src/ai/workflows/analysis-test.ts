import { callDeepSeekTracked } from '@/lib/ai'
import { pushQualityLog } from '@/lib/ai-logger'
import { ANALYSIS_TEST_SYSTEM_PROMPT, buildAnalysisTestPrompt } from '@/ai/prompts/analysis-test'
import { AnalysisTestResultSchema } from '@/types/analysis-test'
import type { AnalysisTestResult } from '@/types/analysis-test'
import type { AiCallMeta, AiConfig } from '@/lib/ai'


export type AnalysisTestOutput = {
  data: AnalysisTestResult
  meta: AiCallMeta
}

export async function analyzeExamContent(content: string, config?: AiConfig): Promise<AnalysisTestOutput> {
  // 1. 调用 DeepSeek（带 Token + 耗时统计）
  const { data: raw, meta } = await callDeepSeekTracked<Record<string, unknown>>({
    systemPrompt: ANALYSIS_TEST_SYSTEM_PROMPT,
    userPrompt: buildAnalysisTestPrompt(content),
    temperature: 0.1,
    config,
  })

  // 2. Zod 校验
  let parsed: AnalysisTestResult
  let schemaValid = true

  try {
    parsed = AnalysisTestResultSchema.parse(raw)
  } catch (err) {
    schemaValid = false
    throw err // 仍然向上抛，让 API 层处理
  }

  // 如果校验失败，不记录质量日志（schemaValid = false 表示应由上游记录）

  // 3. 记录质量日志
  pushQualityLog({
    inputContent: content,
    outputData: parsed,
    meta,
    schemaValid,
  })

  return { data: parsed, meta }
}
