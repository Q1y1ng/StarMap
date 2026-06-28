import { NextRequest, NextResponse } from 'next/server'
import { AnalysisTestRequestSchema } from '@/types/analysis-test'
import { analyzeExamContent } from '@/ai/workflows/analysis-test'
import { pushQualityLog } from '@/lib/ai-logger'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ZodError } from 'zod'

export async function POST(request: NextRequest) {
  let rawBody: unknown = undefined

  try {
    // 1. 解析并校验请求体
    rawBody = await request.json()
    const { content } = AnalysisTestRequestSchema.parse(rawBody)

    // 2. 获取当前用户的 AI 配置（如果有）
    let aiConfig: { apiKey?: string; model?: string } | undefined
    try {
      const session = await auth()
      if (session?.user?.id) {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { apiKey: true, model: true },
        })
        if (user?.apiKey || user?.model) {
          aiConfig = {
            ...(user.apiKey ? { apiKey: user.apiKey } : {}),
            ...(user.model ? { model: user.model } : {}),
          }
        }
      }
    } catch {
      // 忽略 session 错误，使用默认配置
    }

    // 3. 调用 AI 工作流（传入用户配置）
    const { data, meta } = await analyzeExamContent(content, aiConfig)

    // 4. 返回结构化结果 + 元数据
    return NextResponse.json({
      success: true,
      data,
      meta: {
        durationMs: meta.durationMs,
        usage: meta.usage,
      },
    })
  } catch (err) {
    // Zod 校验失败（请求体）
    if (err instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: '输入数据格式有误：' + err.issues.map((e) => e.message).join('；') },
        { status: 400 },
      )
    }

    const message = err instanceof Error ? err.message : '分析失败，请稍后重试'
    console.error('[analysis-test] AI 分析出错:', err)

    // 记录失败日志（尝试提取 body 中的 content）
    const bodyObj = rawBody as Record<string, unknown> | undefined
    pushQualityLog({
      inputContent: (typeof bodyObj?.content === 'string' ? bodyObj.content : '(unknown)') as string,
      outputData: null,
      meta: { usage: null, durationMs: 0, rawOutput: '' },
      schemaValid: false,
      error: message,
    })

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
