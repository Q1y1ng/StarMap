/**
 * Phase 22 — Exam Session 数据迁移脚本
 *
 * 将现有的 Exam（单科试卷）自动分组为 ExamSession（完整考试）。
 *
 * 分组逻辑：
 * - 从 exam.title 末尾去除科目名称得到 session 名称
 * - 相同 grade + session 名称 + examDate 的 exams 归入同一 session
 *
 * 使用方式：
 *   npx ts-node scripts/migrate-exam-sessions.ts
 *   或
 *   npx tsx scripts/migrate-exam-sessions.ts
 */

import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']

/**
 * 从考试标题中去除科目，得到 session 名称
 * 例如 "高二诊四语文" → "高二诊四"
 *       "高二期末考试数学" → "高二期末考试"
 */
function extractSessionName(title: string): string {
  for (const sub of SUBJECTS) {
    if (title.endsWith(sub)) {
      return title.slice(0, -sub.length).trim()
    }
  }
  // 如果末尾没有科目，尝试去掉可能的科目代码
  return title.trim()
}

/**
 * 从考试标题中提取 semester 信息
 */
function detectSemester(title: string): string {
  if (title.includes('上')) return '上'
  if (title.includes('下')) return '下'
  return ''
}

/**
 * 从考试标题中提取 examType
 */
function detectExamType(title: string): string {
  if (title.includes('期末')) return '期末'
  if (title.includes('期中')) return '期中'
  if (title.includes('月考')) return '月考'
  if (title.includes('模拟')) return '模拟'
  if (title.includes('诊断')) return '诊断'
  if (title.includes('高考')) return '高考'
  return ''
}

async function migrate() {
  console.log('🔍 开始 Exam Session 数据迁移...')

  // 1. 获取所有未归入 session 的 exams
  const exams = await prisma.exam.findMany({
    where: { examSessionId: null },
    orderBy: [{ examDate: 'asc' }, { grade: 'asc' }],
    include: { analysisReports: true },
  })

  console.log(`  共找到 ${exams.length} 个待归组的考试`)

  // 2. 按 (grade, sessionName, date) 分组
  const groups = new Map<string, typeof exams>()

  for (const exam of exams) {
    const sessionName = extractSessionName(exam.title)
    const dateKey = exam.examDate.toISOString().slice(0, 10)
    const key = `${exam.grade}|${sessionName}|${dateKey}`

    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(exam)
  }

  console.log(`  将归入 ${groups.size} 个 Exam Session\n`)

  let created = 0
  let skipped = 0

  // 3. 为每个分组创建 ExamSession
  for (const [key, groupExams] of groups.entries()) {
    const [grade, sessionName, dateStr] = key.split('|')

    // 单科不成组，跳过（后续用户可手动归组）
    if (groupExams.length < 2) {
      skipped++
      continue
    }

    const examDate = new Date(dateStr)
    const semester = detectSemester(sessionName)
    const examType = detectExamType(sessionName)

    // 计算平均分
    const scores = groupExams.map(e => e.totalScore).filter(Boolean)
    const averageScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null
    const totalScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0)
      : null

    // 判断成长指数
    const allCompleted = groupExams.every(e => e.aiStatus === 'COMPLETED')
    const growthIndex = allCompleted ? '持续进步' : null

    try {
      const session = await prisma.examSession.create({
        data: {
          name: sessionName,
          grade,
          semester: semester || null,
          examType: examType || null,
          date: examDate,
          averageScore,
          totalScore,
          growthIndex,
          subjects: {
            connect: groupExams.map(e => ({ id: e.id })),
          },
        },
      })

      console.log(`  ✅ [${sessionName}] (${grade}, ${dateStr}) — ${groupExams.length}科, 平均分: ${averageScore ?? 'N/A'}`)
      created++
    } catch (err) {
      console.error(`  ❌ [${sessionName}] 创建失败:`, err)
    }
  }

  console.log(`\n📊 迁移完成:`)
  console.log(`  - 创建 Exam Session: ${created}`)
  console.log(`  - 跳过（不足2科）: ${skipped}`)
  console.log(`  - 总计归组: ${created * 2} 科 (估算)`)

  // 4. 验证结果
  const totalSessions = await prisma.examSession.count()
  const groupedExams = await prisma.exam.count({ where: { examSessionId: { not: null } } })
  const ungroupedExams = await prisma.exam.count({ where: { examSessionId: null } })

  console.log(`\n📋 最终统计:`)
  console.log(`  - Exam Session 总数: ${totalSessions}`)
  console.log(`  - 已归组试卷: ${groupedExams}`)
  console.log(`  - 未归组试卷: ${ungroupedExams}`)
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
