'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { GlassCard } from '@/components/ui-system/GlassCard'
import { StatCard } from '@/components/ui-system/StatCard'
import { Badge } from '@/components/ui-system/Badge'
import { Spinner } from '@/components/ui-system/Spinner'
import { Progress } from '@/components/ui-system/Progress'
import { PageHeader } from '@/components/ui-system/PageHeader'

// ── Types ──

type StatsData = {
  total: number
  accurateCount: number
  helpfulCount: number
  accuracyRate: number
  helpfulRate: number
  recent: Array<{
    id: string
    accurate: boolean
    helpful: boolean
    comment: string | null
    createdAt: string
    examTitle: string
    subject: string
  }>
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

// ═══════════════════ Page ═══════════════════

export default function AnalyticsFeedbackPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const loadStats = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/analysis-feedback/stats?limit=20')
        const json = await res.json()
        if (mounted) {
          if (json.success) setStats(json.data)
          else setError(json.error)
        }
      } catch {
        if (mounted) setError('加载统计数据失败')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadStats()
    return () => { mounted = false }
  }, [])

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
      {/* ── Header ── */}
      <motion.div variants={fadeUp}>
        <PageHeader
          title="📊 分析质量看板"
          subtitle="收集用户对 AI 分析报告的反馈，持续改进分析质量"
        />
      </motion.div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" label="加载统计数据…" />
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <motion.div variants={fadeUp}>
          <div className="rounded-glass-sm border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
            {error}
          </div>
        </motion.div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && stats && stats.total === 0 && (
        <motion.div variants={fadeUp}>
          <GlassCard gradient="amber" className="p-12 text-center">
            <p className="text-lg font-medium text-text-primary">暂无反馈数据</p>
            <p className="mt-2 text-sm text-text-secondary">
              请先完成分析报告，然后在
              <Link href="/exams" className="mx-1 text-accent hover:underline">
                考试详情页
              </Link>
              提交评价。
            </p>
          </GlassCard>
        </motion.div>
      )}

      {/* ── Data ── */}
      {stats && stats.total > 0 && (
        <>
          {/* ── Stat Grid ── */}
          <motion.div variants={fadeUp} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="总反馈数" value={stats.total.toLocaleString()} gradient="blue" />
            <StatCard label="认为准确" value={stats.accurateCount.toLocaleString()} gradient="green" />
            <StatCard label="认为有帮助" value={stats.helpfulCount.toLocaleString()} gradient="purple" />
            <GlassCard gradient="none" className="p-5">
              <div className="text-center space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                    准确率
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-success">
                    {Math.round(stats.accuracyRate * 100)}%
                  </p>
                </div>
                <div className="border-t border-glass-border pt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                    帮助率
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-accent">
                    {Math.round(stats.helpfulRate * 100)}%
                  </p>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* ── Quality Metrics ── */}
          <motion.div variants={fadeUp}>
            <GlassCard gradient="none" className="p-6">
              <h2 className="mb-5 text-lg font-semibold text-text-primary">📈 质量指标</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-text-secondary">准确率</span>
                    <span className="font-bold text-success">
                      {Math.round(stats.accuracyRate * 100)}%
                    </span>
                  </div>
                  <Progress value={stats.accuracyRate * 100} size="md" color="success" />
                  <p className="mt-1.5 text-xs text-text-tertiary">
                    {stats.accurateCount}/{stats.total} 位用户认为分析准确
                  </p>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-text-secondary">建议帮助率</span>
                    <span className="font-bold text-accent">
                      {Math.round(stats.helpfulRate * 100)}%
                    </span>
                  </div>
                  <Progress value={stats.helpfulRate * 100} size="md" color="accent" />
                  <p className="mt-1.5 text-xs text-text-tertiary">
                    {stats.helpfulCount}/{stats.total} 位用户认为建议有帮助
                  </p>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* ── Recent Feedback Table ── */}
          <motion.div variants={fadeUp}>
            <GlassCard gradient="none" className="p-6">
              <h2 className="mb-5 text-lg font-semibold text-text-primary">🕐 最近反馈</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-tertiary text-left text-xs uppercase text-text-tertiary">
                      <th className="pb-3 pr-4 font-medium">考试</th>
                      <th className="pb-3 pr-4 font-medium">科目</th>
                      <th className="pb-3 pr-4 font-medium">准确？</th>
                      <th className="pb-3 pr-4 font-medium">有帮助？</th>
                      <th className="pb-3 pr-4 font-medium">反馈</th>
                      <th className="pb-3 font-medium">时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-tertiary">
                    {stats.recent.map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-accent-subtle/30">
                        <td className="py-3 pr-4 font-medium text-text-primary">{item.examTitle}</td>
                        <td className="py-3 pr-4">
                          <Badge variant="accent" size="sm">
                            {item.subject}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge size="sm" variant={item.accurate ? 'success' : 'danger'}>
                            {item.accurate ? '👍 准确' : '👎 不准确'}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge size="sm" variant={item.helpful ? 'success' : 'danger'}>
                            {item.helpful ? '👍 有帮助' : '👎 没有'}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 max-w-[200px] truncate text-text-tertiary">
                          {item.comment ?? '—'}
                        </td>
                        <td className="py-3 text-xs text-text-tertiary">
                          {new Date(item.createdAt).toLocaleString('zh-CN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </motion.div>
        </>
      )}
    </motion.div>
  )
}
