import OpenAI from 'openai'

// ── 类型：AI 配置（支持每请求覆盖） ──

export type AiConfig = {
  apiKey?: string
  model?: string
  baseURL?: string
}

// ── 默认值 ──

export const DEFAULT_MODEL = 'deepseek-chat'

const DEFAULT_BASE_URL = 'https://api.deepseek.com'
const ENV_API_KEY = process.env.DEEPSEEK_API_KEY ?? ''
const ENV_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL

// 默认客户端（使用环境变量）
const defaultClient = new OpenAI({
  apiKey: ENV_API_KEY,
  baseURL: ENV_BASE_URL,
})

// ── 客户端解析 ──

function resolveClient(config?: AiConfig): { client: OpenAI; model: string } {
  if (config?.apiKey) {
    return {
      client: new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL ?? ENV_BASE_URL,
      }),
      model: config.model ?? DEFAULT_MODEL,
    }
  }
  return {
    client: defaultClient,
    model: config?.model ?? DEFAULT_MODEL,
  }
}

// ── AI 调用选项 ──

export type AiCallOptions = {
  systemPrompt: string
  userPrompt: string
  temperature?: number
  maxTokens?: number
  maxRetries?: number
  config?: AiConfig // 可选：覆盖 API Key / 模型
  responseFormat?: 'json' | 'text' // 默认 json；text 模式跳过 JSON 解析，返回原始字符串
}

// ── AI 调用元数据 ──

export type AiCallMeta = {
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  } | null
  durationMs: number
  rawOutput: string
}

// ── 基础调用（仅返回数据） ──

export async function callDeepSeek<T = Record<string, unknown>>(
  options: AiCallOptions,
): Promise<T> {
  const { data } = await callDeepSeekTracked<T>(options)
  return data
}

// ── 带元数据的调用（Token 统计 + 耗时 + 原始输出） ──

export async function callDeepSeekTracked<T = Record<string, unknown>>(
  options: AiCallOptions,
): Promise<{ data: T; meta: AiCallMeta }> {
  const {
    systemPrompt,
    userPrompt,
    temperature = 0.3,
    maxTokens = 4096,
    maxRetries = 3,
    config,
    responseFormat = 'json',
  } = options

  const { client, model } = resolveClient(config)

  let lastError: Error | null = null
  const start = performance.now()

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const completionPayload: Record<string, unknown> = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      }

      // text 模式不强制 JSON 输出（用于格式化等非结构化场景）
      if (responseFormat === 'json') {
        completionPayload.response_format = { type: 'json_object' }
      }

      const response = await client.chat.completions.create(completionPayload as any)

      const durationMs = Math.round(performance.now() - start)
      const content = response.choices[0]?.message?.content

      if (!content) {
        throw new Error('AI returned empty response')
      }

      // text 模式：直接返回原始文本
      if (responseFormat === 'text') {
        const meta: AiCallMeta = {
          usage: response.usage
            ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
              }
            : null,
          durationMs,
          rawOutput: content,
        }

        return { data: content as unknown as T, meta }
      }

      // json 模式：清理后解析
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

      const meta: AiCallMeta = {
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : null,
        durationMs,
        rawOutput: cleaned,
      }

      return {
        data: JSON.parse(cleaned) as T,
        meta,
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)))
      }
    }
  }

  throw lastError ?? new Error('AI call failed after all retries')
}
