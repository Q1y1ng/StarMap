import { callDeepSeek } from '@/lib/ai'
import type { AiConfig } from '@/lib/ai'
import { TREND_SYSTEM_PROMPT, buildTrendPrompt } from '@/ai/prompts/trend'
import type { TrendResult } from '@/types/common'

export async function analyzeTrend(
  studentName: string,
  subject: string,
  scoreHistory: { examDate: string; score: number; maxScore: number }[],
  masteryHistory: { name: string; history: { examDate: string; mastery: number }[] }[],
  config?: AiConfig,
) {
  return callDeepSeek<TrendResult>({
    systemPrompt: TREND_SYSTEM_PROMPT,
    userPrompt: buildTrendPrompt(studentName, subject, scoreHistory, masteryHistory),
    temperature: 0.3,
    config,
  })
}
