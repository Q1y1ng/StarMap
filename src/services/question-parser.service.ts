// ── 题目解析服务 ──────────────────────────────────
// 业务逻辑层：封装 AI 解析、保存 / 查询题目

import { parseQuestionsFromOcr } from '@/ai/workflows/question-parser'
import { prisma } from '@/lib/prisma'
import type { Question, QuestionParseResult, SubQuestion } from '@/lib/questions/types'
import type { VisionDocument } from '@/types/vision-document'

export type ParseProgress = {
  status: 'parsing' | 'done' | 'error'
  percent?: number
  message?: string
}

export class QuestionParserService {
  /**
   * 从 OCR 文本中解析题目
   *
   * @param ocrText    - OCR 识别后的文本
   * @param onProgress - 进度回调
   */
  static async parse(
    ocrText: string,
    onProgress?: (progress: ParseProgress) => void,
  ): Promise<QuestionParseResult> {
    onProgress?.({ status: 'parsing', percent: 50, message: '正在解析题目...' })

    try {
      const { data } = await parseQuestionsFromOcr(ocrText)
      onProgress?.({ status: 'done', percent: 100, message: `解析完成，共 ${data.questionCount} 题` })
      return data
    } catch (err) {
      const msg = err instanceof Error ? err.message : '题目解析失败'
      onProgress?.({ status: 'error', message: msg })
      throw err
    }
  }

  /**
   * 将题目列表批量保存到指定考试
   *
   * @param examId    - 考试 ID
   * @param questions - 题目列表
   */
  static async saveToExam(examId: string, questions: Question[]): Promise<void> {
    // Question 模型已在 schema 中定义
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = questions.map((q, index) => ({
      examId,
      questionNo: q.questionNo,
      questionType: q.questionType,
      fullScore: q.fullScore,
      questionText: q.questionText,
      ...(q.subQuestions ? { subQuestions: q.subQuestions } : {}),
      ...(q.pageNumber != null ? { pageNumber: q.pageNumber } : {}),
      sortOrder: index,
    }))
    await prisma.question.createMany({ data })
  }

  /**
   * 按 examId 查询题目，按 sortOrder 升序排列
   *
   * @param examId - 考试 ID
   */
  static async getByExamId(examId: string): Promise<Question[]> {
    const records = await prisma.question.findMany({
      where: { examId },
      orderBy: { sortOrder: 'asc' },
    })

    return records.map((r) => ({
      questionNo: r.questionNo,
      questionType: r.questionType,
      fullScore: r.fullScore,
      questionText: r.questionText,
      hasSubQuestions: Array.isArray(r.subQuestions) && r.subQuestions.length > 0,
      subQuestions: Array.isArray(r.subQuestions) ? r.subQuestions as SubQuestion[] : undefined,
      pageNumber: r.pageNumber ?? undefined,
    }))
  }
}

