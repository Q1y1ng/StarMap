// ── 管理员初始化种子脚本（Phase 11） ──
// 运行: npx tsx prisma/seed-admin.ts
// 自动创建默认管理员账户，并将历史考试数据归属到管理员名下

import 'dotenv/config'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { hash } from 'bcryptjs'

const connectionString = process.env.DATABASE_URL ?? ''
const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('👤 初始化管理员账户...')

  let admin = await prisma.user.findUnique({
    where: { username: 'admin' },
  })

  if (admin) {
    console.log('  ✅ 管理员账户已存在，跳过创建')
  } else {
    const passwordHash = await hash('admin123', 12)
    admin = await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash,
        role: 'ADMIN',
        name: '系统管理员',
      },
    })
    console.log('  ✅ 管理员账户创建成功 (admin / admin123)')
    console.log('  ⚠️  请在生产环境修改默认密码')
  }

  // 将现有无归属的考试记录分配给管理员
  const orphanedCount = await prisma.exam.updateMany({
    where: { userId: null },
    data: { userId: admin.id },
  })

  if (orphanedCount.count > 0) {
    console.log(`  🔗 已将 ${orphanedCount.count} 个现有考试记录归属于管理员`)
  } else {
    console.log('  ℹ️  没有需要迁移的考试记录')
  }

  console.log('')
  console.log('📊 系统概览:')
  const [userCount, examCount, reportCount] = await Promise.all([
    prisma.user.count(),
    prisma.exam.count(),
    prisma.analysisReport.count(),
  ])
  console.log(`  👥 用户总数: ${userCount}`)
  console.log(`  📝 考试总数: ${examCount}`)
  console.log(`  📊 分析报告: ${reportCount}`)
}

main()
  .catch((e) => {
    console.error('❌ 种子脚本执行失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
