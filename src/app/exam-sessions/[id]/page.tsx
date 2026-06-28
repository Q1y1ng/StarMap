'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  FolderArchive,
  ArrowLeft,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Brain,
  Sparkles,
  BarChart3,
  ExternalLink,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/ui-system/GlassCard'
import { Button } from '@/components/ui-system/Button'
import { Badge } from '@/components/ui-system/Badge'
import { Spinner } from '@/components/ui-system/Spinner'
import { StatCard } from '@/components/ui-system/StatCard'
import { Card } from '@/components/ui-system/Card'
import { Progress } from '@/components/ui-system/Progress'

// ── Types ──

type SubjectItem = {
  id: string
  title: string
  subject: string
  totalScore: number
  aiStatus: string
  analysisReportId?: string
  scoreRate: number | null
}

type SessionData = {
  id: string
  name: string
  grade: string
  semester: string | null
  examType: string | null
  date: string
  averageScore: number | null
  totalScore: number | null
  growthIndex: string | null
  summary: string | null
  subjectCount: number
  subjects: SubjectItem[]
  createdAt: string
  updatedAt: string
}

// ── Helpers ──

const SUBJECT_ICONS: Record<string, string> = {
  '语文': '📖', '数学': '📐', '英语': '🔤', '物理': '⚡',
  '化学': '🧪', '生物': '🧬', '历史': '📜', '地理': '🌍', '政治': '⚖️',
}

function subjectIcon(s: string): string {
  return SUBJECT_ICONS[s] ?? '📝'
}

function statusBadge(status: string): { variant: 'success' | 'warning' | 'danger' | 'info' | 'default'; label: string } {
  const map: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default'; label: string }> = {
    COMPLETED: { variant: 'success', label: '已完成' },
    PROCESSING: { variant: 'info', label: '分析中' },
    PENDING: { variant: 'default', label: '待分析' },
    FAILED: { variant: 'danger', label: '失败' },
  }
  return map[status] ?? { variant: 'default', label: status }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 } as const,
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
}

// ═══════════════════ Page ═══════════════════

export default function SessionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)

    fetch(`/api/exam-sessions/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return
        if (json.success) setSession(json.data)
        else setError(json.error ?? '加载失败')
      })
      .catch(() => {
        if (mounted) setError('网络错误')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => { mounted = false }
  }, [id])

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true)
    try {
      const res = await fetch(`/api/exam-sessions/${id}/summary`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        setSession((prev) => prev ? { ...prev, summary: json.summary } : null)
        toast.success('考试总结生成成功')
      } else {
        toast.error(json.error ?? '生成失败')
      }
    } catch {
      toast.error('生成失败，请重试')
    } finally {
      setGeneratingSummary(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`确定删除考试分类「${session?.name}」吗？\n\n注意：此操作不会删除关联的试卷，仅解除分组关系。`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/exam-sessions/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success('考试分类已删除')
        router.push('/exam-sessions')
      } else {
        toast.error(json.error ?? '删除失败')
      }
    } catch {
      toast.error('删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Spinner size="lg" label="加载考试详情…" />
      </div>
    )
  }

  // ── Error ──
  if (error || !session) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
        <div className="rounded-glass-sm border border-danger/20 bg-danger/5 p-6 text-center">
          <p className="text-danger">{error ?? '未找到该考试分类'}</p>
          <Link href="/exam-sessions" className="mt-3 inline-block text-sm text-accent hover:underline">
            返回考试分类
          </Link>
        </div>
      </div>
    )
  }

  const completedCount = session.subjects.filter((s) => s.aiStatus === 'COMPLETED').length
  const processingCount = session.subjects.filter((s) => s.aiStatus === 'PROCESSING').length
  const pendingCount = session.subjects.filter((s) => s.aiStatus === 'PENDING').length
  const scores = session.subjects.map((s) => s.totalScore).filter(Boolean)
  const avgScore = session.averageScore ?? (
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  )

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
      {/* ── Back ── */}
      <motion.div variants={fadeUp}>
        <Link
          href="/exam-sessions"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          返回考试分类
        </Link>
      </motion.div>

      {/* ── Header ── */}
      <motion.div variants={fadeUp} className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-glass-sm bg-accent-subtle">
              <FolderArchive className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                {session.name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                <span>{session.grade}</span>
                {session.semester && (
                  <>
                    <span>·</span><span>{session.semester}学期</span>
                  </>
                )}
                {session.examType && (
                  <>
                    <span>·</span><span>{session.examType}</span>
                  </>
                )}
                <span>·</span>
                <span>{fmtDate(session.date)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 className="h-4 w-4 text-danger" />}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? '删除中…' : '删除'}
          </Button>
        </div>
      </motion.div>

      {/* ── Stat Cards ── */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="科目数"
          value={session.subjectCount}
          icon={<BookOpen className="h-5 w-5" />}
          gradient="blue"
        />
        <StatCard
          label="平均分"
          value={avgScore != null ? `${avgScore}` : '—'}
          trend={avgScore != null && avgScore >= 60 ? 'up' : avgScore != null ? 'down' : 'stable'}
          icon={<BarChart3 className="h-5 w-5" />}
          gradient="purple"
        />
        <StatCard
          label="已完成"
          value={`${completedCount}/${session.subjectCount}`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          gradient="green"
        />
        <StatCard
          label="待分析"
          value={pendingCount + processingCount}
          icon={<Clock className="h-5 w-5" />}
          gradient="amber"
        />
      </motion.div>

      {/* ── Subject Cards ── */}
      <motion.div variants={fadeUp}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">📋 科目列表</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {session.subjects.map((exam) => {
            const badge = statusBadge(exam.aiStatus)
            const scoreRate = exam.scoreRate

            return (
              <Link key={exam.id} href={`/exams/${exam.id}`} className="block group">
                <GlassCard hover gradient="none" className="relative overflow-hidden p-5 transition-all duration-300 group-hover:translate-y-[-2px]">
                  {/* Top bar */}
                  <div
                    className={`absolute inset-x-0 top-0 h-1 ${
                      badge.variant === 'success'
                        ? 'bg-success'
                        : badge.variant === 'info'
                          ? 'bg-accent'
                          : badge.variant === 'danger'
                            ? 'bg-danger'
                            : 'bg-text-tertiary/30'
                    }`}
                  />

                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-glass-sm bg-surface-secondary text-2xl">
                      {subjectIcon(exam.subject)}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-text-primary group-hover:text-accent transition-colors">
                        {exam.subject}
                      </h3>
                      <p className="mt-0.5 text-xs text-text-tertiary truncate">
                        {exam.title}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="text-sm font-medium text-text-primary">
                          {exam.totalScore} 分
                        </span>
                        {scoreRate != null && (
                          <span className="text-xs text-text-tertiary">
                            得分率 {scoreRate}%
                          </span>
                        )}
                      </div>

                      {/* Score rate bar */}
                      {scoreRate != null && (
                        <div className="mt-2">
                          <Progress
                            value={scoreRate}
                            color={scoreRate >= 80 ? 'success' : scoreRate >= 60 ? 'warning' : 'danger'}
                            size="sm"
                          />
                        </div>
                      )}
                    </div>

                    {/* Status + Link */}
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Badge variant={badge.variant} size="sm">
                        {badge.label}
                      </Badge>
                      <ExternalLink className="h-4 w-4 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </div>
                </GlassCard>
              </Link>
            )
          })}
        </div>
      </motion.div>

      {/* ── AI Summary ── */}
      <motion.div variants={fadeUp}>
        <GlassCard gradient="none" className="p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">🧠 AI 考试总结</h2>
              <p className="text-sm text-text-secondary mt-0.5">
                基于所有已完成科目的分析报告生成
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Sparkles className="h-4 w-4" />}
              onClick={handleGenerateSummary}
              disabled={generatingSummary || completedCount === 0}
            >
              {generatingSummary ? '生成中…' : session.summary ? '重新生成' : '生成总结'}
            </Button>
          </div>

          {session.summary ? (
            <div className="whitespace-pre-wrap rounded-glass-sm bg-surface-secondary p-4 text-sm text-text-primary leading-relaxed">
              {session.summary}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-glass-sm bg-surface-secondary py-12 text-center">
              <Brain className="mb-3 h-10 w-10 text-text-tertiary/50" />
              <p className="text-sm text-text-tertiary">
                {completedCount === 0
                  ? '暂无已完成的分析报告，请先完成科目分析'
                  : '点击生成按钮创建AI考试总结'}
              </p>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* ── Future Features ── */}
      <motion.div variants={fadeUp}>
        <Card variant="glass" className="p-6">
          <h2 className="mb-3 text-base font-semibold text-text-primary">🚀 即将推出</h2>
          <div className="grid grid-cols-1 gap-3 text-sm text-text-secondary sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-glass-sm bg-surface-secondary px-3 py-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              <span>跨学科分析</span>
            </div>
            <div className="flex items-center gap-2 rounded-glass-sm bg-surface-secondary px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span>学科均衡度评估</span>
            </div>
            <div className="flex items-center gap-2 rounded-glass-sm bg-surface-secondary px-3 py-2">
              <BarChart3 className="h-4 w-4 text-success" />
              <span>考试排名与对比</span>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}
