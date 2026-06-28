'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  FolderArchive,
  ArrowRight,
  CalendarDays,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/ui-system/GlassCard'
import { StatCard } from '@/components/ui-system/StatCard'
import { Button } from '@/components/ui-system/Button'
import { Badge } from '@/components/ui-system/Badge'
import { Spinner } from '@/components/ui-system/Spinner'
import { PageHeader } from '@/components/ui-system/PageHeader'
import { Dialog } from '@/components/ui-system/Dialog'
import { Input } from '@/components/ui-system/Input'

// ── Types ──

type SessionItem = {
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
  completedCount: number
  aiStatusSummary: 'COMPLETED' | 'PROCESSING' | 'PENDING' | 'PARTIAL'
  createdAt: string
}

// ── Helpers ──

function subjectEmoji(s: string): string {
  const map: Record<string, string> = {
    '语文': '📖', '数学': '📐', '英语': '🔤', '物理': '⚡',
    '化学': '🧪', '生物': '🧬', '历史': '📜', '地理': '🌍', '政治': '⚖️',
  }
  return map[s] ?? '📝'
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function statusBadge(session: SessionItem): { variant: 'success' | 'warning' | 'danger' | 'default' | 'info'; label: string } {
  if (session.aiStatusSummary === 'COMPLETED') {
    return { variant: 'success', label: '已完成' }
  }
  if (session.aiStatusSummary === 'PARTIAL') {
    return { variant: 'warning', label: `部分完成 (${session.completedCount}/${session.subjectCount})` }
  }
  if (session.aiStatusSummary === 'PROCESSING') {
    return { variant: 'info', label: '分析中' }
  }
  return { variant: 'default', label: '待分析' }
}

function growthLabel(index: string | null): { text: string; trend: 'up' | 'down' | 'stable' } {
  if (index === '持续进步') return { text: '↑ 持续进步', trend: 'up' }
  if (index === '需关注') return { text: '↓ 需关注', trend: 'down' }
  if (index === '保持稳定') return { text: '→ 保持稳定', trend: 'stable' }
  return { text: '—', trend: 'stable' }
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 } as const,
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
}

// ═══════════════════ Page ═══════════════════

export default function ExamSessionsPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newName, setNewName] = useState('')
  const [newGrade, setNewGrade] = useState('高二')
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10))
  const [newSemester, setNewSemester] = useState('')
  const [newExamType, setNewExamType] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)

    fetch('/api/exam-sessions')
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return
        if (json.success) setSessions(json.data)
        else setError(json.error ?? '加载失败')
      })
      .catch(() => {
        if (mounted) setError('网络错误，请检查连接')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => { mounted = false }
  }, [])

  const handleCreate = async () => {
    if (!newName.trim() || !newDate) return
    setCreating(true)
    try {
      const res = await fetch('/api/exam-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          grade: newGrade,
          date: newDate,
          semester: newSemester || undefined,
          examType: newExamType || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setSessions((prev) => [
          {
            id: json.data.id,
            name: json.data.name,
            grade: json.data.grade,
            semester: json.data.semester,
            examType: json.data.examType,
            date: json.data.date.toISOString?.()?.slice(0, 10) ?? newDate,
            averageScore: null,
            totalScore: null,
            growthIndex: null,
            summary: null,
            subjectCount: 0,
            completedCount: 0,
            aiStatusSummary: 'PENDING',
            createdAt: json.data.createdAt,
          },
          ...prev,
        ])
        setShowCreateDialog(false)
        setNewName('')
      } else {
        toast.error(json.error ?? '创建失败')
      }
    } catch {
      toast.error('创建失败，请重试')
    } finally {
      setCreating(false)
    }
  }

  // Stats
  const totalSessions = sessions.length
  const completedSessions = sessions.filter((s) => s.aiStatusSummary === 'COMPLETED').length
  const totalSubjects = sessions.reduce((sum, s) => sum + s.subjectCount, 0)
  const avgScore = sessions.length > 0
    ? Math.round(
        sessions
          .map((s) => s.averageScore)
          .filter((s): s is number => s != null)
          .reduce((a, b) => a + b, 0) /
          sessions.filter((s) => s.averageScore != null).length,
      )
    : null

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
      {/* ── Header ── */}
      <motion.div variants={fadeUp}>
        <PageHeader
          title="考试分类"
          subtitle="管理每一次完整考试及其全部科目"
          actions={
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setShowCreateDialog(true)}
            >
              新建考试分类
            </Button>
          }
        />
      </motion.div>

      {/* ── Stat Cards ── */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="考试次数"
          value={totalSessions}
          icon={<FolderArchive className="h-5 w-5" />}
          gradient="blue"
        />
        <StatCard
          label="平均总分"
          value={avgScore != null ? `${avgScore}` : '—'}
          trend={avgScore != null && avgScore >= 60 ? 'up' : avgScore != null ? 'down' : 'stable'}
          icon={<TrendingUp className="h-5 w-5" />}
          gradient="purple"
        />
        <StatCard
          label="已完成"
          value={completedSessions}
          icon={<CheckCircle2 className="h-5 w-5" />}
          gradient="green"
        />
        <StatCard
          label="总科目数"
          value={totalSubjects}
          icon={<BookOpen className="h-5 w-5" />}
          gradient="amber"
        />
      </motion.div>

      {/* ── Error ── */}
      {error && (
        <motion.div variants={fadeUp}>
          <div className="rounded-glass-sm border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
            {error}
          </div>
        </motion.div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" label="加载考试分类…" />
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && sessions.length === 0 && (
        <motion.div variants={fadeUp}>
          <GlassCard gradient="none" className="p-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-subtle">
              <FolderArchive className="h-8 w-8 text-accent" />
            </div>
            <p className="text-lg font-medium text-text-primary">暂无考试分类</p>
            <p className="mt-1 text-sm text-text-tertiary">
              上传试卷后系统将自动按考试分组，或手动创建考试分类
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="primary" onClick={() => setShowCreateDialog(true)}>
                新建考试分类
              </Button>
              <Link href="/upload-exam">
                <Button variant="ghost">上传试卷</Button>
              </Link>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ── Session Cards Grid ── */}
      {sessions.length > 0 && (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((session) => {
            const badge = statusBadge(session)
            const growth = growthLabel(session.growthIndex)

            return (
              <motion.div key={session.id} variants={fadeUp}>
                <Link href={`/exam-sessions/${session.id}`} className="block group">
                  <GlassCard
                    hover
                    gradient="none"
                    className="relative overflow-hidden p-6 transition-all duration-300 group-hover:translate-y-[-2px]"
                  >
                    {/* Top accent bar */}
                    <div
                      className={`absolute inset-x-0 top-0 h-1 ${
                        badge.variant === 'success'
                          ? 'bg-success'
                          : badge.variant === 'warning'
                            ? 'bg-warning'
                            : 'bg-text-tertiary/30'
                      }`}
                    />

                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-glass-sm bg-accent-subtle">
                          <FolderArchive className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-text-primary group-hover:text-accent transition-colors">
                            {session.name}
                          </h3>
                          <p className="text-xs text-text-tertiary">{session.grade}</p>
                        </div>
                      </div>
                      <Badge variant={badge.variant} size="sm">
                        {badge.label}
                      </Badge>
                    </div>

                    {/* Details */}
                    <div className="mt-5 space-y-2">
                      {/* Date */}
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <CalendarDays className="h-4 w-4 text-text-tertiary" />
                        <span>{fmtDate(session.date)}</span>
                        {session.semester && (
                          <>
                            <span className="text-text-tertiary">·</span>
                            <span>{session.semester}学期</span>
                          </>
                        )}
                        {session.examType && (
                          <>
                            <span className="text-text-tertiary">·</span>
                            <span>{session.examType}</span>
                          </>
                        )}
                      </div>

                      {/* Subjects & Scores */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                          <BookOpen className="h-4 w-4 text-text-tertiary" />
                          <span>{session.subjectCount} 科</span>
                        </div>
                        {session.averageScore != null && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <TrendingUp className="h-4 w-4 text-text-tertiary" />
                            <span className="font-medium text-text-primary">均分 {session.averageScore}</span>
                          </div>
                        )}
                      </div>

                      {/* Growth Index */}
                      {session.growthIndex && (
                        <div
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            growth.trend === 'up'
                              ? 'bg-success/10 text-success'
                              : growth.trend === 'down'
                                ? 'bg-danger/10 text-danger'
                                : 'bg-surface-tertiary/30 text-text-tertiary'
                          }`}
                        >
                          <TrendingUp className="h-3 w-3" />
                          {growth.text}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="mt-4 flex items-center justify-between border-t border-glass-border pt-3">
                      <div className="flex -space-x-1">
                        {Array.from({ length: Math.min(session.subjectCount, 6) }).map((_, i) => (
                          <div
                            key={i}
                            className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-glass-bg bg-surface-secondary text-[10px]"
                          >
                            {['📖', '📐', '🔤', '⚡', '🧪', '🌍'][i]}
                          </div>
                        ))}
                        {session.subjectCount > 6 && (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-glass-bg bg-surface-secondary text-[10px] text-text-tertiary">
                            +{session.subjectCount - 6}
                          </div>
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-xs font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                        进入考试 <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </GlassCard>
                </Link>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* ── Create Dialog ── */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} title="新建考试分类">
        <div className="space-y-4">
          <Input
            label="考试名称"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder='例如 "高二下诊断四"'
            autoFocus
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="年级"
              value={newGrade}
              onChange={(e) => setNewGrade(e.target.value)}
              placeholder="高二"
            />
            <Input
              label="考试日期"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="学期（可选）"
              value={newSemester}
              onChange={(e) => setNewSemester(e.target.value)}
              placeholder="上 / 下"
            />
            <Input
              label="考试类型（可选）"
              value={newExamType}
              onChange={(e) => setNewExamType(e.target.value)}
              placeholder="月考 / 期中 / 期末 / 诊断"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="md" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
            >
              {creating ? '创建中…' : '创建'}
            </Button>
          </div>
        </div>
      </Dialog>
    </motion.div>
  )
}
