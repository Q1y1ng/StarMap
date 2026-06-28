// ── Orphan Exam Migration Script ────────────────────────
// 用途：将 userId 为 NULL 的存量考试分配给指定的管理员用户
// 使用：npx tsx scripts/assign-orphan-exams.ts
// 安全：幂等操作，可重复执行

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { PrismaClient } from '../src/generated/prisma/client'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? '' })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('=== Orphan Exam Migration ===')
  console.log('')

  // 1. 查找所有 userId 为 NULL 的考试
  const orphans = await prisma.exam.findMany({
    where: { userId: null },
    select: { id: true, title: true, subject: true, grade: true, examDate: true },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`找到 ${orphans.length} 条无主考试记录`)
  if (orphans.length === 0) {
    console.log('✅ 没有需要迁移的考试记录')
    return
  }

  // 2. 查找第一个 ADMIN 用户
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true, username: true, name: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!admin) {
    console.error('❌ 未找到 ADMIN 用户，无法分配无主考试')
    console.log('   请先通过注册创建一个管理员账户')
    process.exit(1)
  }

  console.log(`目标用户: ${admin.name} (${admin.username}) [${admin.id}]`)
  console.log('')

  // 3. 分配
  const ids = orphans.map((o) => o.id)
  const result = await prisma.exam.updateMany({
    where: { id: { in: ids } },
    data: { userId: admin.id },
  })

  console.log(`✅ 迁移完成: ${result.count} 条考试记录已分配给 ${admin.name}`)
  console.log('')

  // 4. 显示迁移详情
  console.log('=== 迁移详情 ===')
  for (const exam of orphans) {
    const date = exam.examDate.toISOString().slice(0, 10)
    console.log(`  ${exam.id.slice(0, 8)}... | ${exam.title} | ${exam.subject} | ${exam.grade} | ${date}`)
  }

  console.log('')
  console.log('=== 完成 ===')
}

main()
  .catch((err) => {
    console.error('迁移失败:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
