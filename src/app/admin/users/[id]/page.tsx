'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, FileText, BarChart3, BookOpen, GraduationCap, Calendar } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { GlassCard } from '@/components/ui-system/GlassCard'
import { StatCard } from '@/components/ui-system/StatCard'
import { Badge } from '@/components/ui-system/Badge'
import { Spinner } from '@/components/ui-system/Spinner'

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
  },
}

type UserProfile = {
  id: string
  username: string
  name: string
  role: string
  createdAt: string
  updatedAt: string
}

type UserExam = {
  id: string
  title: string
  subject: string
  grade: string
  examDate: string
  totalScore: number
  aiStatus: string
  createdAt: string
  _count: { analysisReports: number; questions: number }
}

type MasteryRecord = {
  subject: string
  knowledgePoint: string
  mastery: number
  examDate: string
}

type UserDetailData = {
  user: UserProfile
  exams: UserExam[]
  examCount: number
  reportCount: number
  questionCount: number
  knowledgeHistory: MasteryRecord[]
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('zh-CN')
}

function statusBadge(status: string): {
  variant: 'success' | 'warning' | 'danger' | 'default'
  label: string
} {
  const map: Record<string, { variant: 'success' | 'warning' | 'danger' | 'default'; label: string }> =
    {
      COMPLETED: { variant: 'success', label: '已完成' },
      PROCESSING: { variant: 'warning', label: '分析中' },
      PENDING: { variant: 'default', label: '待分析' },
      FAILED: { variant: 'danger', label: '失败' },
    }
  return map[status] ?? { variant: 'default', label: status }
}

function subjectEmoji(s: string): string {
  const map: Record<string, string> = {
    语文: '📖',
    数学: '📐',
    英语: '🔤',
    物理: '⚡',
    化学: '🧪',
    生物: '🧬',
    历史: '📜',
    地理: '🌍',
    政治: '⚖️',
  }
  return map[s] ?? '📝'
}

const CHART_COLORS = [
  'var(--accent)',
  'var(--success)',
  'var(--warning)',
  'var(--danger)',
  'var(--info)',
]

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [id, setId] = useState<string | null>(null)
  const [detail, setDetail] = useState<UserDetailData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    params.then(({ id: userId }) => setId(userId))
  }, [params])

  useEffect(() => {
    if (!id) return
    let mounted = true
    fetch(`/api/admin/users/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (mounted && json.success) setDetail(json.data)
      })
      .catch(console.error)
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [id])

  if (loading || !id) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Spinner size="lg" label="加载用户详情…" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> 返回用户列表
        </Link>
        <GlassCard gradient="none" className="p-8 text-center">
          <p className="text-text-secondary">用户不存在</p>
        </GlassCard>
      </div>
    )
  }

  const { user, exams, examCount, reportCount, knowledgeHistory } = detail

  // 按知识点分组掌握率数据（用于图表）
  const historyByKP = new Map<string, { examDate: string; mastery: number }[]>()
  for (const h of knowledgeHistory) {
    if (!historyByKP.has(h.knowledgePoint)) {
      historyByKP.set(h.knowledgePoint, [])
    }
    historyByKP.get(h.knowledgePoint)!.push({
      examDate: fmtDate(h.examDate),
      mastery: Math.round(h.mastery * 100),
    })
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
      {/* 返回链接 */}
      <motion.div variants={fadeUp}>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> 返回用户列表
        </Link>
      </motion.div>

      {/* 顶部提示 */}
      <motion.div variants={fadeUp}>
        <GlassCard gradient="blue" className="p-4">
          <p className="text-sm text-text-secondary">
            🔍 当前正在查看：
            <span className="font-semibold text-text-primary">{user.name}</span>
            （@{user.username}）的用户数据
          </p>
        </GlassCard>
      </motion.div>

      {/* 用户信息头部 */}
      <motion.div variants={fadeUp}>
        <GlassCard gradient="blue" className="p-6">
          <div className="flex items-start gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20 text-2xl text-accent">
              <GraduationCap className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-text-primary">
                  {user.name}
                </h1>
                <Badge
                  variant={user.role === 'ADMIN' ? 'accent' : 'default'}
                  size="sm"
                >
                  {user.role === 'ADMIN' ? '管理员' : '普通用户'}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-text-secondary">
                <span className="flex items-center gap-1">
                  <GraduationCap className="h-3.5 w-3.5" /> @{user.username}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> 注册于{' '}
                  {fmtDate(user.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* 统计卡片 */}
      <motion.div
        variants={fadeUp}
        className="grid grid-cols-1 gap-5 sm:grid-cols-4"
      >
        <StatCard
          label="考试总数"
          value={examCount}
          icon={<FileText className="h-5 w-5" />}
          gradient="blue"
        />
        <StatCard
          label="分析报告"
          value={reportCount}
          icon={<BarChart3 className="h-5 w-5" />}
          gradient="purple"
        />
        <StatCard
          label="知识点记录"
          value={knowledgeHistory.length}
          icon={<BookOpen className="h-5 w-5" />}
          gradient="green"
        />
        <StatCard
          label="活跃程度"
          value={examCount > 0 ? '活跃' : '未使用'}
          icon={
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
          gradient={examCount > 0 ? 'amber' : undefined}
        />
      </motion.div>

      {/* 知识掌握趋势图 */}
      {knowledgeHistory.length > 0 && (
        <motion.div variants={fadeUp}>
          <GlassCard gradient="none" className="p-6">
            <h2 className="mb-5 text-lg font-semibold text-text-primary">
              📈 知识点掌握趋势
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--surface-tertiary)"
                  />
                  <XAxis
                    dataKey="examDate"
                    tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
                    axisLine={{ stroke: 'var(--surface-tertiary)' }}
                    tickLine={false}
                    allowDuplicatedCategory={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--glass-bg)',
                      backdropFilter: 'blur(16px)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '12px',
                    }}
                    labelStyle={{ color: 'var(--text-primary)' }}
                  />
                  {Array.from(historyByKP.entries())
                    .slice(0, 5)
                    .map(([kp, data], idx) => (
                      <Line
                        key={kp}
                        data={data}
                        type="monotone"
                        dataKey="mastery"
                        name={kp}
                        stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-text-tertiary">
              显示该用户最多 5 个知识点的掌握率变化趋势
            </p>
          </GlassCard>
        </motion.div>
      )}

      {/* 考试列表 */}
      <motion.div variants={fadeUp}>
        <GlassCard gradient="none" className="p-6">
          <h2 className="mb-5 text-lg font-semibold text-text-primary">
            📝 考试记录 ({examCount})
          </h2>
          {exams.length === 0 ? (
            <p className="text-sm text-text-tertiary">该用户暂无考试记录</p>
          ) : (
            <div className="space-y-2">
              {exams.map((exam) => {
                const st = statusBadge(exam.aiStatus)
                return (
                  <Link
                    key={exam.id}
                    href={`/exams/${exam.id}`}
                    className="flex items-center gap-4 rounded-glass-sm px-4 py-3 transition-colors hover:bg-accent-subtle"
                  >
                    <span className="text-xl">{subjectEmoji(exam.subject)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {exam.title}
                      </p>
                      <p className="mt-0.5 text-xs text-text-tertiary">
                        {exam.grade} · {fmtDate(exam.examDate)} · 满分{' '}
                        {exam.totalScore}
                      </p>
                    </div>
                    <Badge variant={st.variant} size="sm">
                      {st.label}
                    </Badge>
                  </Link>
                )
              })}
            </div>
          )}
        </GlassCard>
      </motion.div>
    </motion.div>
  )
}
