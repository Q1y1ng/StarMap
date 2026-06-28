/**
 * 种子数据脚本 — 生成测试用的 Exam + AnalysisReport 数据
 *
 * 用法: npx tsx src/scripts/seed-trends.ts
 */

import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { PrismaClient } from '../generated/prisma/client'

const connectionString = process.env.DATABASE_URL ?? ''
const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ── 科目配置 ──

const SUBJECTS = ['数学', '物理', '化学', '英语', '语文'] as const

type SubjectConfig = {
  totalScore: number
  knowledgePoints: { name: string; score: number; total: number }[]
  strengths: { name: string; scoreRate: number; comment: string }[]
}

function makeSubjectConfig(subject: string, dateIndex: number): SubjectConfig {
  // 随着 dateIndex 增加，分数有提升趋势，模拟学习进步
  const base = dateIndex * 3 // 逐步提升 base score
  const variance = Math.floor(Math.random() * 8) - 4 // -4 ~ +4

  const configs: Record<string, () => SubjectConfig> = {
    '数学': () => ({
      totalScore: 66,
      knowledgePoints: [
        { name: '导数单调性', score: clamp(3 + base + variance, 0, 12), total: 12 },
        { name: '函数最值', score: clamp(4 + base + Math.floor(variance * 0.5), 0, 10), total: 10 },
        { name: '概率', score: clamp(7 + base - variance, 0, 10), total: 10 },
        { name: '数列求和', score: clamp(5 + base + Math.floor(variance * 0.7), 0, 10), total: 10 },
        { name: '向量运算', score: clamp(8 + base, 0, 10), total: 10 },
        { name: '立体几何', score: clamp(2 + base + variance, 0, 12), total: 12 },
      ],
      strengths: [
        { name: '向量运算', scoreRate: 80, comment: '空间想象能力强，向量计算准确' },
        { name: '概率', scoreRate: 75, comment: '概率模型理解透彻' },
      ],
    }),
    '物理': () => ({
      totalScore: 66,
      knowledgePoints: [
        { name: '牛顿第二定律', score: clamp(6 + base + variance, 0, 15), total: 15 },
        { name: '匀变速运动', score: clamp(8 + base + Math.floor(variance * 0.3), 0, 15), total: 15 },
        { name: '力的合成', score: clamp(3 + base - variance, 0, 12), total: 12 },
        { name: '功和能', score: clamp(5 + base + Math.floor(variance * 1.2), 0, 18), total: 18 },
        { name: '圆周运动', score: clamp(6 + base, 0, 16), total: 16 },
      ],
      strengths: [
        { name: '匀变速运动', scoreRate: 70, comment: '运动学公式熟练运用' },
      ],
    }),
    '化学': () => ({
      totalScore: 54,
      knowledgePoints: [
        { name: '氧化还原反应', score: clamp(5 + base + variance, 0, 10), total: 10 },
        { name: '离子方程式', score: clamp(6 + base - variance, 0, 10), total: 10 },
        { name: '元素周期律', score: clamp(2 + base + Math.floor(variance * 0.5), 0, 12), total: 12 },
        { name: '化学键', score: clamp(7 + base, 0, 10), total: 10 },
        { name: '有机反应类型', score: clamp(4 + base + variance, 0, 14), total: 14 },
      ],
      strengths: [
        { name: '化学键', scoreRate: 75, comment: '化学键类型判断准确' },
      ],
    }),
    '英语': () => ({
      totalScore: 100,
      knowledgePoints: [
        { name: '语法填空', score: clamp(8 + base + variance, 0, 15), total: 15 },
        { name: '完形填空', score: clamp(10 + base - variance, 0, 20), total: 20 },
        { name: '阅读理解A', score: clamp(7 + base + Math.floor(variance * 0.5), 0, 10), total: 10 },
        { name: '阅读理解B', score: clamp(5 + base + variance, 0, 10), total: 10 },
        { name: '书面表达', score: clamp(14 + base, 0, 25), total: 25 },
        { name: '听力理解', score: clamp(12 + base + Math.floor(variance * 0.7), 0, 20), total: 20 },
      ],
      strengths: [
        { name: '听力理解', scoreRate: 75, comment: '听力辨音能力强' },
        { name: '阅读理解A', scoreRate: 72, comment: '细节定位准确' },
      ],
    }),
    '语文': () => ({
      totalScore: 150,
      knowledgePoints: [
        { name: '现代文阅读', score: clamp(8 + base + variance, 0, 12), total: 12 },
        { name: '诗歌鉴赏', score: clamp(4 + base - Math.floor(variance * 0.5), 0, 9), total: 9 },
        { name: '文言文翻译', score: clamp(3 + base + variance, 0, 10), total: 10 },
        { name: '名篇默写', score: clamp(5 + base, 0, 6), total: 6 },
        { name: '语言文字运用', score: clamp(10 + base + Math.floor(variance * 0.3), 0, 15), total: 15 },
        { name: '作文', score: clamp(30 + base + variance * 2, 0, 60), total: 60 },
      ],
      strengths: [
        { name: '名篇默写', scoreRate: 85, comment: '背诵扎实' },
      ],
    }),
  }

  return configs[subject]!()
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// ── 日期生成 ──

function makeDates(count: number): Date[] {
  const dates: Date[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date('2026-03-01')
    d.setDate(d.getDate() + i * 14) // 每两周一次
    dates.push(d)
  }
  return dates
}

// ── 知识点诊断（薄弱点） ──

function pickWeaknesses(kps: { name: string; score: number; total: number }[]): {
  name: string
  scoreRate: number
  diagnosis: string
}[] {
  const DIAGNOSES: Record<string, string[]> = {
    '导数单调性': ['导函数符号判断不熟练', '复合函数求导常出错', '导数与单调性关系理解不深'],
    '函数最值': ['最值点定位不准确', '闭区间最值易遗漏端点', '二次函数最值分类讨论不完整'],
    '概率': ['古典概型计数有遗漏', '条件概率公式应用不熟练'],
    '数列求和': ['裂项相消法掌握不牢', '错位相减计算易出错'],
    '向量运算': ['坐标运算偶尔出错'],
    '立体几何': ['空间坐标系建立困难', '法向量求解慢', '几何体体积公式混淆'],
    '牛顿第二定律': ['受力分析遗漏', '整体法与隔离法选择不当'],
    '匀变速运动': ['公式选择不灵活'],
    '力的合成': ['正交分解角度计算错误', '动态平衡分析弱'],
    '功和能': ['动能定理应用场景判断不准确', '能量守恒表达式书写不规范'],
    '圆周运动': ['向心力来源分析不清', '临界条件判断不准确'],
    '氧化还原反应': ['电子转移数计算易错', '氧化性还原性强弱判断混淆'],
    '离子方程式': ['拆分规则记忆不清'],
    '元素周期律': ['周期表定位慢', '半径比较规律记忆不牢'],
    '化学键': ['极性非极性判断偶尔出错'],
    '有机反应类型': ['反应条件与反应类型对应不清'],
    '语法填空': ['非谓语动词形式选择常错', '时态语态混用'],
    '完形填空': ['上下文逻辑推理弱', '固定搭配积累不足'],
    '阅读理解A': ['主旨大意题把握不准确'],
    '阅读理解B': ['推理判断题常出错', '长难句理解困难'],
    '书面表达': ['高级句式应用不自然', '篇章逻辑连接词使用单一'],
    '听力理解': ['连读辨音有困难', '细节信息捕捉弱'],
    '现代文阅读': ['论述文论证分析不深入', '文学类文本主旨把握偏'],
    '诗歌鉴赏': ['意象分析流于表面', '手法赏析缺少术语'],
    '文言文翻译': ['关键词采分点遗漏', '特殊句式翻译不准确'],
    '名篇默写': ['生僻字书写错误'],
    '语言文字运用': ['语病辨析不敏感', '表达连贯题排序易错'],
    '作文': ['立意深度不够', '论证素材单一'],
  }

  return kps
    .filter((kp) => {
      const rate = kp.score / kp.total
      return rate < 0.55 // 得分率低于55%视为薄弱点
    })
    .map((kp) => {
      const diags = DIAGNOSES[kp.name] ?? ['基础概念掌握不牢']
      return {
        name: kp.name,
        scoreRate: Math.round((kp.score / kp.total) * 100),
        diagnosis: diags[Math.floor(Math.random() * diags.length)],
      }
    })
}

// ── 学习建议 ──

function makeSuggestions(kps: { name: string; score: number; total: number }[]): {
  priority: number
  content: string
  type: 'PRACTICE' | 'REVIEW' | 'VIDEO' | 'READING'
}[] {
  const result: {
    priority: number
    content: string
    type: 'PRACTICE' | 'REVIEW' | 'VIDEO' | 'READING'
  }[] = []
  for (const kp of kps) {
    if (kp.score / kp.total < 0.7) {
      result.push({
        priority: result.length + 1,
        content: `巩固「${kp.name}」：得分率 ${Math.round((kp.score / kp.total) * 100)}%，建议针对性练习。`,
        type: 'PRACTICE',
      })
    }
  }

  if (result.length === 0) {
    result.push({
      priority: 1,
      content: '当前知识点掌握良好，保持定期复习即可。',
      type: 'REVIEW',
    })
  }

  return result
}

async function main() {
  console.log('🧹 清理现有数据...')
  await prisma.analysisReport.deleteMany()
  await prisma.exam.deleteMany()
  console.log('✅ 已清理')

  const dates = makeDates(8) // 8 个考试日期（跨度约 4 个月）
  let examCount = 0

  for (let di = 0; di < dates.length; di++) {
    for (const subject of SUBJECTS) {
      const date = dates[di]
      const config = makeSubjectConfig(subject, di)

      const totalScore = config.knowledgePoints.reduce((s, kp) => s + kp.score, 0)
      // 每个日期前后浮动
      const displayScore = totalScore + Math.floor(Math.random() * 10) - 5

      // 确保我们生成的数据看起来是"已完成分析"的
      await prisma.exam.create({
        data: {
          title: `${subject}${di === 0 ? '摸底' : di === dates.length - 1 ? '期末' : `第${di + 1}次`}`,
          subject,
          grade: '高三',
          examDate: date,
          totalScore: Math.max(displayScore, 10),
          aiStatus: 'COMPLETED',
          analysisReports: {
            create: {
              subject,
              summary: `${subject}${di < 3 ? '基础尚可，部分章节需强化' : di < 6 ? '持续进步中，薄弱项明显' : '整体提升显著，冲刺阶段保持'}。`,
              knowledgePoints: config.knowledgePoints,
              weaknesses: pickWeaknesses(config.knowledgePoints),
              strengths: config.strengths,
              studySuggestions: makeSuggestions(config.knowledgePoints),
              inputContent: `${subject}${date.toISOString().slice(0, 10)}测试`,
              promptTokens: 400 + Math.floor(Math.random() * 200),
              completionTokens: 300 + Math.floor(Math.random() * 400),
              totalTokens: 800 + Math.floor(Math.random() * 500),
              durationMs: 2000 + Math.floor(Math.random() * 3000),
              status: 'SUCCESS',
            },
          },
        },
      })

      examCount++
      if (examCount % 5 === 0) {
        console.log(`  已创建 ${examCount} 条考试记录...`)
      }
    }
  }

  // 统计结果
  const [exams, reports] = await Promise.all([
    prisma.exam.count(),
    prisma.analysisReport.count(),
  ])

  console.log(`\n✅ 种子数据生成完成！`)
  console.log(`  考试记录: ${exams} 条`)
  console.log(`  分析报告: ${reports} 条`)
  console.log(`  科目: ${SUBJECTS.join(', ')}`)
  console.log(`  时间跨度: ${dates[0].toISOString().slice(0, 10)} ~ ${dates[dates.length - 1].toISOString().slice(0, 10)}`)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('种子数据生成失败:', err)
  process.exit(1)
})
