import { NextRequest, NextResponse } from 'next/server'
import { ExamService } from '@/services/exam.service'
import { AnalysisPropagationService } from '@/services/analysis-propagation.service'
import { ZodError, z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import type { AnalysisTestResult } from '@/types/analysis-test'
import type { OcrMode, OcrEngine } from '@/generated/prisma/enums'

const SaveAnalysisSchema = z.object({
  title: z.string().min(1, '考试名称不能为空').max(128),
  grade: z.enum(['高一', '高二', '高三'], { error: '年级只能为 高一/高二/高三' }),
  examDate: z.string().min(1, '考试日期不能为空'),
  content: z.string().min(1, '考试内容不能为空'),
  subject: z.string().min(1),
  totalScore: z.number().optional().nullable(),
  analysisData: z.object({
    subject: z.string(),
    summary: z.string(),
    knowledgePoints: z.array(z.any()),
    weaknesses: z.array(z.any()),
    strengths: z.array(z.any()),
    studySuggestions: z.array(z.any()),
  }),
  meta: z
    .object({
      durationMs: z.number().optional().nullable(),
      usage: z
        .object({
          promptTokens: z.number().optional().nullable(),
          completionTokens: z.number().optional().nullable(),
          totalTokens: z.number().optional().nullable(),
        })
        .optional()
        .nullable(),
    })
    .optional()
    .nullable(),
  questions: z
    .array(
      z.object({
        questionNo: z.number(),
        questionType: z.string(),
        fullScore: z.number(),
        questionText: z.string(),
        hasSubQuestions: z.boolean(),
        subQuestions: z
          .array(
            z.object({
              label: z.string(),
              text: z.string(),
              score: z.number().optional(),
            }),
          )
          .optional(),
        pageNumber: z.number().optional(),
        sortOrder: z.number().optional(),
      }),
    )
    .optional()
    .default([]),
  ocrMode: z.string().optional(),
  ocrEngine: z.string().optional(),
  ocrQuality: z.number().optional(),
  ocrDurationMs: z.number().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = SaveAnalysisSchema.parse(body)

    // 获取当前登录用户
    const session = await auth()
    const userId = session?.user?.id ?? null

    // 计算总分（优先使用用户手动输入的值，其次 AI 分析的总分，最后按 knowledgePoints 求和）
    const analysisData = parsed.analysisData as unknown as AnalysisTestResult
    const totalScore =
      parsed.totalScore ??
      analysisData.totalScore ??
      analysisData.knowledgePoints.reduce((sum, kp) => {
        const total = Number(kp.total) || 0
        return sum + total
      }, 0)

    const exam = await ExamService.createWithReport({
      title: parsed.title,
      subject: parsed.subject,
      grade: parsed.grade,
      examDate: new Date(parsed.examDate),
      totalScore,
      content: parsed.content,
      analysisData,
      meta: parsed.meta ?? null,
      ocrMode: parsed.ocrMode as OcrMode | undefined,
      ocrEngine: parsed.ocrEngine as OcrEngine | undefined,
      ocrQuality: parsed.ocrQuality,
      ocrDurationMs: parsed.ocrDurationMs,
      userId,
    })

    // 保存逐题信息（优先使用前端上传的结构化题目，其次从 AI 分析结果提取）
    const questionsToSave = parsed.questions.length > 0
      ? parsed.questions
      : (analysisData.questions ?? []).map((q: { questionNo: number; questionType: string; fullScore: number }) => ({
          questionNo: q.questionNo,
          questionType: q.questionType,
          fullScore: q.fullScore,
          questionText: '',
          sortOrder: q.questionNo,
        }))

    if (questionsToSave.length > 0) {
      await prisma.question.createMany({
        data: questionsToSave.map((q) => ({
          examId: exam.id,
          questionNo: q.questionNo,
          questionType: q.questionType,
          fullScore: q.fullScore,
          questionText: 'questionText' in q ? q.questionText : '',
          sortOrder: q.sortOrder ?? q.questionNo,
        })),
      })
      console.log(`[analysis/save] 已保存 ${questionsToSave.length} 道题目给考试 ${exam.id}`)
    }

    // 将分析结果同步到下游模块（掌握率历史、学习画像、风险预警）
    // 不阻塞前端响应，失败仅记日志
    try {
      await AnalysisPropagationService.propagateAll(
        exam.id,
        parsed.subject,
        analysisData.knowledgePoints,
        analysisData.weaknesses as { name: string; scoreRate: number; diagnosis: string }[] | undefined,
      )
    } catch (propErr) {
      console.error('[analysis/save] 数据传播失败（不影响保存）:', propErr)
    }

    return NextResponse.json({
      success: true,
      data: {
        examId: exam.id,
      },
    })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: '输入数据格式有误：' + err.issues.map((e) => e.message).join('；') },
        { status: 400 },
      )
    }

    const message = err instanceof Error ? err.message : '保存失败，请稍后重试'
    console.error('[analysis/save] 保存出错:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
