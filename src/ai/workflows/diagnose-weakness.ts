import { callDeepSeek } from '@/lib/ai'
import type { AiConfig } from '@/lib/ai'
import { WEAKNESS_SYSTEM_PROMPT, buildWeaknessPrompt } from '@/ai/prompts/weakness'
import type { WeaknessResult } from '@/types/common'

export async function diagnoseWeaknesses(
  studentName: string,
  subject: string,
  examName: string,
  knowledgePointScores: { name: string; studentScoreRate: number; classAvgRate: number }[],
  config?: AiConfig,
) {
  return callDeepSeek<WeaknessResult>({
    systemPrompt: WEAKNESS_SYSTEM_PROMPT,
    userPrompt: buildWeaknessPrompt(studentName, subject, examName, knowledgePointScores),
    temperature: 0.3,
    config,
  })
}
