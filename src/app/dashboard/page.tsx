'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  FileText,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  ArrowRight,
  GraduationCap,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { StatCard } from '@/components/ui-system/StatCard'
import { GlassCard } from '@/components/ui-system/GlassCard'
import { Badge } from '@/components/ui-system/Badge'
import { Spinner } from '@/components/ui-system/Spinner'
import { Card } from '@/components/ui-system/Card'

// ── Types ──

type StatsData = {
  totalExams: number
  totalReports: number
  subjectCount: number
  recentExams: Array<{
    examId: string
    title: string
    subject: string
    examDate: string
    averageScore: number | null
    totalScore: number | null
  }>
}

type SessionStatsData = {
  sessionCount: number
  examCount: number
  reportCount: number
  subjectCount: number
  overallAverage: number | null
  growthIndex: string | null
  recentSessions: Array<{
    id: string
    name: string
    date: string
    averageScore: number | null
    completedCount: number
    subjectCount: number
  }>
}

type ScoreTrendItem = {
  examId: string
  title: string
  subject: string
  totalScore: number | null
  examDate: string
}

type ExamItem = {
  id: string
  title: string
  subject: string
  grade: string
  examDate: string
  totalScore: number
  aiStatus: string
  createdAt: string
  _count: { analysisReports: number }
}

// ── Helpers ──

function subjectEmoji(s: string): string {
  const map: Record<string, string> = {
    '语文': '📖', '数学': '📐', '英语': '🔤', '物理': '⚡',
    '化学': '🧪', '生物': '🧬', '历史': '📜', '地理': '🌍', '政治': '⚖️',
  }
  return map[s] ?? '📝'
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 9) return '早上好'
  if (h < 12) return '上午好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}

const statusMap: Record<string, string> = {
  COMPLETED: '已完成',
  PROCESSING: '分析中',
  PENDING: '待分析',
  FAILED: '失败',
}

// ── Animation ──

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 } as const,
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
}

// ═══════════════════ Page ═══════════════════

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [sessionStats, setSessionStats] = useState<SessionStatsData | null>(null)
  const [scoreTrend, setScoreTrend] = useState<ScoreTrendItem[]>([])
  const [exams, setExams] = useState<ExamItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const loadAll = async () => {
      setLoading(true)
      try {
        const [statsRes, sessionStatsRes, trendRes, examsRes] = await Promise.all([
          fetch('/api/trends/stats'),
          fetch('/api/dashboard/session-stats'),
          fetch('/api/trends/overall'),
          fetch('/api/exams'),
        ])

        const statsJson = await statsRes.json()
        const sessionStatsJson = await sessionStatsRes.json()
        const trendJson = await trendRes.json()
        const examsJson = await examsRes.json()

        if (mounted) {
          if (statsJson.success) setStats(statsJson.data)
          if (sessionStatsJson.success) setSessionStats(sessionStatsJson.data)
          if (trendJson.success) setScoreTrend(trendJson.data)
          if (examsJson.success) setExams(examsJson.data.slice(0, 5))
        }
      } catch (err) {
        if (mounted) console.error('[dashboard] 加载失败:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadAll()
    return () => { mounted = false }
  }, [])

  // Computations
  const weakCount = stats?.recentExams
    ? stats.recentExams.filter((e) => e.averageScore != null && e.averageScore < 60).length
    : 0

  const avgScore = sessionStats?.overallAverage ?? (
    scoreTrend.length > 0
      ? Math.round(
          scoreTrend.reduce((s, e) => s + (e.totalScore ?? 0), 0) / scoreTrend.length,
        )
      : null
  )

  const growthDisplay = sessionStats?.growthIndex ?? (
    stats?.totalExams && stats.totalExams >= 3 ? '📈' : '📊'
  )

  // ── Render ──

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Spinner size="lg" label="加载仪表盘…" />
      </div>
    )
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
      {/* ── Welcome ── */}
      <motion.div variants={fadeUp} className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <GraduationCap className="h-4 w-4" />
            <span>StarMap · 智能学情分析平台</span>
            <span>·</span>
            <span>{new Date().toLocaleDateString('zh-CN', { weekday: 'long' })}</span>
          </div>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-text-primary">
            {getGreeting()} 👋
          </h1>
          <p className="mt-1 text-text-secondary">
            {stats
              ? `共有 ${stats.totalExams} 场考试，${stats.totalReports} 份分析报告`
              : '欢迎使用 StarMap'}
          </p>
        </div>
      </motion.div>

      {/* ── Stat Cards ── */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="考试次数"
          value={sessionStats?.sessionCount ?? stats?.totalExams ?? '—'}
          icon={<FileText className="h-5 w-5" />}
          gradient="blue"
        />
        <StatCard
          label="平均总分"
          value={avgScore != null ? `${avgScore}` : '—'}
          trend={avgScore != null && avgScore >= 60 ? 'up' : 'down'}
          icon={<BarChart3 className="h-5 w-5" />}
          gradient="purple"
        />
        <StatCard
          label="薄弱知识点"
          value={weakCount}
          trend={weakCount > 0 ? 'down' : 'stable'}
          trendLabel={weakCount > 0 ? '需关注' : '暂无'}
          icon={<AlertTriangle className="h-5 w-5" />}
          gradient="red"
        />
        <StatCard
          label="成长指数"
          value={growthDisplay}
          trend={sessionStats?.growthIndex === '持续进步' ? 'up' : sessionStats?.growthIndex === '需关注' ? 'down' : stats && stats.totalExams >= 3 ? 'up' : 'stable'}
          trendLabel={sessionStats?.growthIndex ?? (stats && stats.totalExams >= 3 ? '持续进步' : '数据积累中')}
          icon={<TrendingUp className="h-5 w-5" />}
          gradient="green"
        />
      </motion.div>

      {/* ── Chart Row ── */}
      <motion.div variants={fadeUp}>
        <GlassCard className="p-6" gradient="blue">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">📈 成绩趋势</h2>
              <p className="text-sm text-text-secondary">最近考试得分趋势</p>
            </div>
          </div>
          {scoreTrend.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scoreTrend} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-tertiary)" />
                  <XAxis
                    dataKey="title"
                    tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
                    axisLine={{ stroke: 'var(--surface-tertiary)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--glass-bg)',
                      backdropFilter: 'blur(16px)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '12px',
                      boxShadow: 'var(--shadow-glass-floating)',
                    }}
                    labelStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalScore"
                    stroke="var(--accent)"
                    strokeWidth={2.5}
                    dot={{ fill: 'var(--accent)', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: 'var(--accent)', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-text-tertiary">
              暂无成绩数据
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* ── Bottom Row: Recent Exams + Quick Links ── */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Sessions */}
        <GlassCard className="p-6 lg:col-span-2" gradient="none">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">📝 最近考试</h2>
            <Link
              href="/exam-sessions"
              className="flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover transition-colors"
            >
              查看全部 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {sessionStats?.recentSessions && sessionStats.recentSessions.length > 0 ? (
            <div className="space-y-2">
              {sessionStats.recentSessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/exam-sessions/${session.id}`}
                  className="flex items-center gap-4 rounded-glass-sm px-4 py-3 transition-colors hover:bg-accent-subtle group"
                >
                  <span className="text-xl">📅</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                      {session.name}
                    </p>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {fmtDate(session.date)} · {session.completedCount}/{session.subjectCount} 科完成
                      {session.averageScore != null && ` · 均分 ${session.averageScore}`}
                    </p>
                  </div>
                  <Badge variant={
                    session.completedCount === session.subjectCount ? 'success' :
                    session.completedCount > 0 ? 'warning' : 'default'
                  } size="sm">
                    {session.completedCount === session.subjectCount ? '已完成' :
                     session.completedCount > 0 ? '部分完成' : '待分析'}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : exams.length > 0 ? (
            <div className="space-y-2">
              {exams.map((exam) => (
                <Link
                  key={exam.id}
                  href={`/exams/${exam.id}`}
                  className="flex items-center gap-4 rounded-glass-sm px-4 py-3 transition-colors hover:bg-accent-subtle group"
                >
                  <span className="text-xl">{subjectEmoji(exam.subject)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                      {exam.title}
                    </p>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {exam.grade} · {fmtDate(exam.examDate)} · 得分 {exam.totalScore}
                    </p>
                  </div>
                  <Badge
                    variant={
                      exam.aiStatus === 'COMPLETED'
                        ? 'success'
                        : exam.aiStatus === 'FAILED'
                          ? 'danger'
                          : 'warning'
                    }
                    size="sm"
                  >
                    {statusMap[exam.aiStatus] ?? exam.aiStatus}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-text-tertiary">
              <p>暂无考试记录</p>
              <Link
                href="/analysis-test"
                className="mt-2 text-accent hover:underline"
              >
                创建第一个分析
              </Link>
            </div>
          )}
        </GlassCard>

        {/* Quick Stats / Info */}
        <Card variant="glass" className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">⚡ 快速入口</h2>
          <div className="space-y-3">
            <Link
              href="/upload-exam"
              className="flex items-center gap-3 rounded-glass-sm px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-accent-subtle hover:text-accent"
            >
              <BarChart3 className="h-4 w-4" />
              <span>新建分析</span>
            </Link>
            <Link
              href="/knowledge-map"
              className="flex items-center gap-3 rounded-glass-sm px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-accent-subtle hover:text-accent"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>知识图谱</span>
            </Link>
            <Link
              href="/learning-profile"
              className="flex items-center gap-3 rounded-glass-sm px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-accent-subtle hover:text-accent"
            >
              <TrendingUp className="h-4 w-4" />
              <span>学习档案</span>
            </Link>
            <Link
              href="/trends"
              className="flex items-center gap-3 rounded-glass-sm px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-accent-subtle hover:text-accent"
            >
              <FileText className="h-4 w-4" />
              <span>成长趋势</span>
            </Link>
          </div>
          <div className="mt-6 border-t border-glass-border pt-4 text-center text-xs text-text-tertiary/50">
            StarMap v1.02 · Made by HEAOZIE
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}
