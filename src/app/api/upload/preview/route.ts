// ── POST /api/upload/preview — 上传预览（Phase 23 Upload Confirmation） ──
//
// 功能：
//   接收 OCR 元数据，进行：
//   ① 考试信息规范化（检测学期、考试类型）
//   ② 已有 Exam Session 查询
//   ③ 重复检测
//   ④ AI 智能建议
//
// 原则：不写数据库

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

// ── Helpers ──

const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']

function detectSemester(text: string): string | null {
  if (text.includes('上')) return '上'
  if (text.includes('下')) return '下'
  return null
}

function detectExamType(text: string): string | null {
  if (text.includes('期末')) return '期末'
  if (text.includes('期中')) return '期中'
  if (text.includes('月考')) return '月考'
  if (text.includes('模拟')) return '模拟'
  if (text.includes('诊断')) return '诊断'
  if (text.includes('高考')) return '高考'
  return null
}

function extractSessionName(title: string): string {
  for (const sub of SUBJECTS) {
    if (title.endsWith(sub)) {
      return title.slice(0, -sub.length).trim()
    }
  }
  return title.trim()
}

function estimateConfidence(
  title: string | undefined,
  subject: string | undefined,
  grade: string | undefined,
  date: string | undefined,
): number {
  let score = 0
  if (title && title.length >= 2) score += 30
  if (subject && SUBJECTS.includes(subject)) score += 25
  if (grade && ['高一', '高二', '高三'].includes(grade)) score += 25
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) score += 20
  return score
}

// ── 查询参数类型 ──

type PreviewRequest = {
  title?: string
  subject?: string
  grade?: string
  examDate?: string
  totalScore?: number
}

// ═══════════════════ POST ═══════════════════

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const body: PreviewRequest = await request.json()
    const { title, subject, grade, examDate } = body

    // ── 1. 规范化 ──
    const sessionName = title ? extractSessionName(title) : title ?? ''
    const suggestedSemester = title ? detectSemester(title) : null
    const suggestedExamType = title ? detectExamType(title) : null
    const confidence = estimateConfidence(title, subject, grade, examDate)

    // ── 2. 查询已有 Session ──
    const existingSessions = await prisma.examSession.findMany({
      where: {
        userId,
        ...(sessionName ? { name: { contains: sessionName, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { date: 'desc' },
      take: 5,
      include: {
        subjects: {
          select: { subject: true },
        },
      },
    })

    const sessionResults = existingSessions.map((s) => ({
      id: s.id,
      name: s.name,
      grade: s.grade,
      semester: s.semester,
      examType: s.examType,
      date: s.date.toISOString().slice(0, 10),
      subjectCount: s.subjects.length,
      averageScore: s.averageScore,
      totalScore: s.totalScore,
      subjects: s.subjects.map((sub) => sub.subject),
    }))

    // ── 3. 重复检测 ──
    let duplicate: {
      isDuplicate: boolean
      existingExamId?: string
      existingExamName?: string
      existingSubject?: string
      message?: string
    } = { isDuplicate: false }

    if (title && subject) {
      const existing = await prisma.exam.findFirst({
        where: {
          userId,
          title: { equals: title },
          subject: { equals: subject },
        },
        select: { id: true, title: true, subject: true },
      })

      if (existing) {
        duplicate = {
          isDuplicate: true,
          existingExamId: existing.id,
          existingExamName: existing.title,
          existingSubject: existing.subject,
          message: `检测到可能重复上传：「${existing.title}」(${existing.subject}) 已存在。是否覆盖、重新分析或取消？`,
        }
      }
    }

    // ── 4. AI 建议 ──
    let suggestion: string | null = null

    if (sessionResults.length > 0 && title && subject) {
      const bestMatch = sessionResults[0]
      const hasSubject = bestMatch.subjects.includes(subject)

      if (!hasSubject) {
        suggestion =
          `检测到：这是第 ${bestMatch.subjectCount + 1} 科。建议加入「${bestMatch.name}」（已有 ${bestMatch.subjectCount} 科，${bestMatch.date}）。`
      } else if (!duplicate.isDuplicate) {
        suggestion = `「${bestMatch.name}」已有「${subject}」科目记录，确认是否为新增或补传。`
      }
    } else if (sessionName && !duplicate.isDuplicate) {
      suggestion = `检测到「${sessionName}」，数据库中暂无匹配考试分类，建议「创建新的考试」。`
    }

    return NextResponse.json({
      success: true,
      data: {
        suggestedName: sessionName,
        suggestedGrade: grade ?? '',
        suggestedSemester,
        suggestedExamType,
        suggestedSubject: subject ?? '',
        confidence,
        existingSessions: sessionResults,
        duplicate,
        suggestion,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '预览请求失败'
    console.error('[api/upload/preview] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
