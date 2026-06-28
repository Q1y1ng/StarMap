import { callDeepSeek } from '@/lib/ai'
import type { AiConfig } from '@/lib/ai'
import { KNOWLEDGE_POINT_SYSTEM_PROMPT, buildKnowledgePointPrompt } from '@/ai/prompts/knowledge-point'
import type { KnowledgePointResult } from '@/types/common'

export async function extractKnowledgePoints(examTitle: string, subject: string, ocrText: string, config?: AiConfig) {
  return callDeepSeek<KnowledgePointResult>({
    systemPrompt: KNOWLEDGE_POINT_SYSTEM_PROMPT,
    userPrompt: buildKnowledgePointPrompt(examTitle, subject, ocrText),
    temperature: 0.3,
    config,
  })
}
