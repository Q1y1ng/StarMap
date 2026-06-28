import { callDeepSeek } from '@/lib/ai'
import type { AiConfig } from '@/lib/ai'
import { SUGGESTION_SYSTEM_PROMPT, buildSuggestionPrompt } from '@/ai/prompts/suggestion'
import type { SuggestionResult } from '@/types/common'

export async function generateSuggestions(
  studentName: string,
  grade: string,
  subject: string,
  weaknesses: { knowledgePoint: string; diagnosis: string; scoreRate: number }[],
  config?: AiConfig,
) {
  return callDeepSeek<SuggestionResult>({
    systemPrompt: SUGGESTION_SYSTEM_PROMPT,
    userPrompt: buildSuggestionPrompt(studentName, grade, subject, weaknesses),
    temperature: 0.7,
    config,
  })
}
