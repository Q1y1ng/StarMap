// ── POST /api/upload/confirm — 上传确认（Phase 23 Upload Confirmation） ──
//
// 功能：
//   用户确认后，真正写入数据库：
//   ① 创建或加入 Exam Session
//   ② 创建 Subject Exam 记录
//   ③ 保存 Document Artifact（OCR 结果）
//   ④ 返回创建的 ID
//
// 原则：所有数据已经过用户确认，此接口只负责写入

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

// ── 类型 ──

type ConfirmRequest = {
  title: string
  subject: string
  grade: string
  examDate: string
  totalScore: number

  // Session
  sessionMode: 'existing' | 'new'
  existingSessionId?: string
  newSession?: {
    name: string
    grade?: string
    semester?: string
    examType?: string
  }

  // OCR / Document
  markdown?: string
}

// ═══════════════════ POST ═══════════════════

export async function POST(request: NextRequest) {
  try {
    const authSession = await auth()
    const userId = authSession?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const body: ConfirmRequest = await request.json()
    const { title, subject, grade, examDate, totalScore, sessionMode, existingSessionId, newSession, markdown } = body

    // ── 1. 验证 ──
    if (!title?.trim()) {
      return NextResponse.json({ success: false, error: '考试名称不能为空' }, { status: 400 })
    }
    if (!subject?.trim()) {
      return NextResponse.json({ success: false, error: '科目不能为空' }, { status: 400 })
    }
    if (!grade?.trim()) {
      return NextResponse.json({ success: false, error: '年级不能为空' }, { status: 400 })
    }
    if (!examDate) {
      return NextResponse.json({ success: false, error: '考试日期不能为空' }, { status: 400 })
    }
    if (!totalScore || totalScore <= 0) {
      return NextResponse.json({ success: false, error: '满分必须大于 0' }, { status: 400 })
    }

    let parsedDate: Date
    try {
      parsedDate = new Date(examDate)
      if (isNaN(parsedDate.getTime())) throw new Error()
    } catch {
      return NextResponse.json({ success: false, error: '日期格式无效' }, { status: 400 })
    }

    // ── 2. 获取或创建 Exam Session ──
    let examSessionId: string
    let sessionName: string

    if (sessionMode === 'existing' && existingSessionId) {
      // 验证 session 存在且属于当前用户
      const existing = await prisma.examSession.findFirst({
        where: { id: existingSessionId, userId },
      })
      if (!existing) {
        return NextResponse.json({ success: false, error: '选定的考试分类不存在' }, { status: 404 })
      }
      examSessionId = existing.id
      sessionName = existing.name
    } else if (sessionMode === 'new' && newSession?.name?.trim()) {
      const created = await prisma.examSession.create({
        data: {
          name: newSession.name.trim(),
          grade: newSession.grade || grade,
          semester: newSession.semester || null,
          examType: newSession.examType || null,
          date: parsedDate,
          userId,
        },
      })
      examSessionId = created.id
      sessionName = created.name
    } else {
      // 自动创建：用检查后的 sessionName
      const autoName = title.trim()
      const created = await prisma.examSession.create({
        data: {
          name: autoName,
          grade,
          date: parsedDate,
          userId,
        },
      })
      examSessionId = created.id
      sessionName = created.name
    }

    // ── 3. 创建 Exam 记录 ──
    const exam = await prisma.exam.create({
      data: {
        title: title.trim(),
        subject: subject.trim(),
        grade,
        examDate: parsedDate,
        totalScore,
        aiStatus: 'PENDING',
        userId,
        examSessionId,
      },
    })

    // ── 4. 保存 Document Artifact（如提供） ──
    if (markdown?.trim()) {
      try {
        await prisma.documentArtifact.create({
          data: {
            examId: exam.id,
            type: 'unified',
            sourceFile: 'upload-confirmation',
            rawOcrText: markdown,
            formattedMarkdown: markdown,
            ocrEngine: 'DOUBAO',
            ocrMode: 'VISION',
            ocrQuality: 100,
          },
        })
      } catch (dbErr) {
        console.warn('[api/upload/confirm] DocumentArtifact 保存失败（非致命）:', dbErr)
      }
    }

    // ── 5. 更新 Session 统计（平均分等） ──
    try {
      const sessionExams = await prisma.exam.findMany({
        where: { examSessionId, userId },
        select: { totalScore: true },
      })
      const scores = sessionExams.map((e) => e.totalScore).filter(Boolean)
      if (scores.length > 0) {
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        const sum = scores.reduce((a, b) => a + b, 0)
        await prisma.examSession.update({
          where: { id: examSessionId },
          data: { averageScore: avg, totalScore: sum },
        })
      }
    } catch (statsErr) {
      console.warn('[api/upload/confirm] 统计更新失败（非致命）:', statsErr)
    }

    return NextResponse.json({
      success: true,
      data: {
        examId: exam.id,
        sessionId: examSessionId,
        sessionName,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '确认上传失败'
    console.error('[api/upload/confirm] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
