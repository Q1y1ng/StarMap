'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, Calendar, Clock, BookOpen, Target, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/ui-system/PageHeader'
import { GlassCard } from '@/components/ui-system/GlassCard'
import { Badge } from '@/components/ui-system/Badge'
import { Button } from '@/components/ui-system/Button'
import { StatCard } from '@/components/ui-system/StatCard'
import { Spinner } from '@/components/ui-system/Spinner'

// ── Types ──

type StudyPlanTask = {
  title: string
  knowledgePoint: string
  duration: number
  reason: string
}

type StudyPlanItem = {
  id: string
  subject: string
  planDate: string
  tasks: StudyPlanTask[]
  estimatedMinutes: number
  priority: number
}

// ── Animation ──

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 } as const,
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
}

const listItem = {
  hidden: { opacity: 0, x: -8 } as const,
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const } },
}

// ── Helpers ──

function getPriorityInfo(title: string): { badge: 'danger' | 'warning' | 'info'; label: string } {
  if (title.startsWith('巩固:')) return { badge: 'danger', label: '薄弱' }
  if (title.startsWith('复习:')) return { badge: 'warning', label: '退步' }
  if (title.startsWith('纠错:')) return { badge: 'info', label: '错题' }
  return { badge: 'info', label: '任务' }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
}

// ═══════════════════ Page ═══════════════════

export default function StudyPlanPage() {
  const [plans, setPlans] = useState<StudyPlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryCounter, setRetryCounter] = useState(0)

  // ── Data fetching ──

  useEffect(() => {
    let mounted = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    fetch('/api/study-plan')
      .then(r => r.json())
      .then(json => {
        if (!mounted) return
        if (json.success) setPlans(json.data)
        else setError(json.error)
      })
      .catch(() => { if (mounted) setError('加载失败') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [retryCounter])

  // ── Generate ──

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/study-plan/generate', { method: 'POST' })
      const json = await res.json()
      if (json.success) setPlans(json.data)
      else setError(json.error)
    } catch {
      setError('生成失败，请重试')
    } finally {
      setGenerating(false)
    }
  }, [])

  // ── Computed stats ──

  const stats = useMemo(() => {
    if (plans.length === 0) return null
    const totalTasks = plans.reduce((s, p) => s + p.tasks.length, 0)
    const totalMinutes = plans.reduce((s, p) => s + p.estimatedMinutes, 0)
    const subjects = [...new Set(plans.map((p) => p.subject))]
    return { totalDays: plans.length, totalTasks, totalMinutes, subjects }
  }, [plans])

  // ── Build 7-day grid ──

  const dayPlans = useMemo(() => {
    const startDate = new Date()
    startDate.setHours(0, 0, 0, 0)

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString()
      const plan = plans.find((p) => {
        const pd = new Date(p.planDate)
        return pd.toDateString() === date.toDateString()
      })
      return { index: i + 1, dateStr, plan: plan ?? null }
    })
  }, [plans])

  // ── Render ──

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
      {/* Header */}
      <motion.div variants={fadeUp}>
        <PageHeader
          title="📋 学习计划"
          subtitle="基于学习画像与错题数据，自动生成未来 7 天每日学习计划"
          actions={
            <Button
              variant="primary"
              size="md"
              loading={generating}
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={handleGenerate}
            >
              {generating ? '生成中…' : '重新生成'}
            </Button>
          }
        />
      </motion.div>

      {/* Loading */}
      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" label="加载学习计划…" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <motion.div variants={fadeUp}>
          <GlassCard gradient="red" className="p-6 text-center">
            <p className="text-text-primary font-medium">加载失败</p>
            <p className="mt-1 text-sm text-text-secondary">{error}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => setRetryCounter(c => c + 1)}>
              重试
            </Button>
          </GlassCard>
        </motion.div>
      )}

      {/* Empty State */}
      {!loading && !error && plans.length === 0 && (
        <motion.div variants={fadeUp}>
          <GlassCard gradient="amber" className="p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-subtle">
              <Calendar className="h-8 w-8 text-accent" />
            </div>
            <p className="text-lg font-semibold text-text-primary">暂无学习计划</p>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed max-w-md mx-auto">
              请先完成以下步骤：
            </p>
            <ul className="mt-3 text-xs text-text-tertiary space-y-1.5 max-w-sm mx-auto text-left">
              <li>1. 上传考试数据并完成 AI 分析</li>
              <li>2. 刷新学习档案（学习档案页面）</li>
              <li>3. 点击下方按钮生成计划</li>
            </ul>
            <Button
              variant="primary"
              size="md"
              className="mt-6"
              loading={generating}
              onClick={handleGenerate}
            >
              立即生成
            </Button>
          </GlassCard>
        </motion.div>
      )}

      {/* Data */}
      {!loading && !error && plans.length > 0 && (
        <>
          {/* Summary Bar */}
          <motion.div variants={fadeUp}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="计划天数"
                value={stats?.totalDays ?? 0}
                icon={<Calendar className="h-4 w-4" />}
                gradient="blue"
              />
              <StatCard
                label="学习任务"
                value={stats?.totalTasks ?? 0}
                icon={<BookOpen className="h-4 w-4" />}
                gradient="purple"
              />
              <StatCard
                label="总时长"
                value={`${stats?.totalMinutes ?? 0}min`}
                icon={<Clock className="h-4 w-4" />}
                gradient="green"
              />
              <StatCard
                label="涉及科目"
                value={stats?.subjects.length ?? 0}
                icon={<Target className="h-4 w-4" />}
                gradient="amber"
              />
            </div>
          </motion.div>

          {/* 7-Day Grid */}
          <motion.div
            variants={fadeUp}
            className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          >
            {dayPlans.map((day) => (
              <DayCard key={day.index} day={day} />
            ))}
          </motion.div>

          {/* Legend */}
          <motion.div variants={fadeUp}>
            <GlassCard gradient="none" className="p-4">
              <div className="flex flex-wrap items-center gap-6 text-xs text-text-secondary">
                <span className="font-medium text-text-primary">优先级说明：</span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-danger" />
                  薄弱知识点（最高优先）
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-warning" />
                  退步知识点
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
                  高频错题
                </span>
              </div>
            </GlassCard>
          </motion.div>
        </>
      )}
    </motion.div>
  )
}

// ═══════════════════ DayCard Component ═══════════════════

function DayCard({
  day,
}: {
  day: { index: number; dateStr: string; plan: StudyPlanItem | null }
}) {
  const hasPlan = day.plan !== null && day.plan.tasks.length > 0

  return (
    <motion.div variants={fadeUp}>
      <GlassCard gradient={hasPlan ? 'blue' : 'none'} className="p-5 h-full">
        {/* Day Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`
                flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold
                ${hasPlan
                  ? 'bg-accent-subtle text-accent'
                  : 'bg-surface-tertiary text-text-tertiary'
                }
              `}
            >
              {day.index}
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">Day {day.index}</h3>
              <p className="text-xs text-text-tertiary">{fmtDate(day.dateStr)}</p>
            </div>
          </div>
          {hasPlan && (
            <Badge variant={day.plan!.estimatedMinutes >= 90 ? 'accent' : 'default'} size="sm">
              {day.plan!.estimatedMinutes}min
            </Badge>
          )}
        </div>

        {/* Tasks or Empty */}
        {!hasPlan ? (
          <div className="flex flex-col items-center justify-center py-6 text-text-tertiary">
            <TrendingUp className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-xs">暂无任务</p>
            <p className="text-[10px] opacity-60 mt-0.5">休息日或数据不足</p>
          </div>
        ) : (
          <div className="space-y-3">
            {day.plan!.tasks.map((task, i) => {
              const { badge: badgeVariant, label } = getPriorityInfo(task.title)
              return (
                <motion.div
                  key={i}
                  variants={listItem}
                  className="rounded-glass-sm bg-surface-secondary p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium text-text-primary">
                          {task.title}
                        </span>
                        <Badge variant={badgeVariant as 'danger' | 'warning' | 'info'} size="sm">
                          {label}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-xs text-text-tertiary leading-relaxed">
                        {task.reason}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-sm font-semibold tabular-nums text-text-primary">
                        {task.duration}
                        <span className="text-xs text-text-tertiary ml-0.5">min</span>
                      </span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </GlassCard>
    </motion.div>
  )
}
