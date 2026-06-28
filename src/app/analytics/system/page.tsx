'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { GlassCard } from '@/components/ui-system/GlassCard'
import { StatCard } from '@/components/ui-system/StatCard'
import { Badge } from '@/components/ui-system/Badge'
import { Spinner } from '@/components/ui-system/Spinner'
import { Progress } from '@/components/ui-system/Progress'
import { PageHeader } from '@/components/ui-system/PageHeader'
import { ScanLine, BrainCircuit, ThumbsUp, Database, Gauge, CheckCircle2, Clock, FileText, Puzzle, Layers, BookOpen } from 'lucide-react'

// ── Types ──

type OcrMetrics = {
  totalCalls: number
  successRate: number
  avgDuration: number
  paddleCount: number
  doubaoCount: number
  smartModeCount: number
  avgQuality: number
  avgOcrDuration: number
}

type AiMetrics = {
  totalCalls: number
  schemaPassRate: number
  avgTokens: number
  avgDuration: number
}

type FeedbackMetrics = {
  totalFeedback: number
  accuracyRate: number
  helpfulRate: number
}

type DataScaleMetrics = {
  examCount: number
  questionCount: number
  questionResultCount: number
  knowledgePointCount: number
}

type SystemData = {
  ocr: OcrMetrics
  ai: AiMetrics
  feedback: FeedbackMetrics
  dataScale: DataScaleMetrics
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

// ── 辅助：数值格式化 ──

function fmt(n: number): string {
  return n.toLocaleString('zh-CN')
}

// ── 辅助：指标徽章 ──

function rateBadge(rate: number): 'success' | 'warning' | 'danger' {
  if (rate >= 80) return 'success'
  if (rate >= 50) return 'warning'
  return 'danger'
}

// ═══════════════════ Page ═══════════════════

export default function AnalyticsSystemPage() {
  const [data, setData] = useState<SystemData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const loadMetrics = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/analytics/system')
        const json = await res.json()
        if (mounted) {
          if (json.success) setData(json.data)
          else setError(json.error)
        }
      } catch {
        if (mounted) setError('加载系统指标失败')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadMetrics()
    return () => { mounted = false }
  }, [])

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
      {/* ── Header ── */}
      <motion.div variants={fadeUp}>
        <PageHeader
          title="📊 系统状态看板"
          subtitle="监控 OCR / AI 分析 / 用户反馈 / 数据规模，掌握产品健康度"
        />
      </motion.div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" label="加载系统指标…" />
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

      {/* ── Data ── */}
      {data && (
        <>
          {/* ═══════════════ OCR 指标 ═══════════════ */}
          <motion.div variants={fadeUp}>
            <GlassCard gradient="none" className="p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-glass-sm bg-accent/10 text-accent">
                  <ScanLine className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">🔍 OCR 识别</h2>
                  <p className="text-xs text-text-tertiary">试卷 / 答题卡光学识别</p>
                </div>
              </div>

              {/* 基础指标 */}
              <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="flex flex-col gap-1 rounded-glass-sm bg-surface-secondary p-4">
                  <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">
                    <FileText className="h-3.5 w-3.5" />
                    总调用数
                  </span>
                  <span className="text-3xl font-bold tabular-nums text-text-primary">
                    {fmt(data.ocr.totalCalls)}
                  </span>
                </div>

                <div className="flex flex-col gap-1 rounded-glass-sm bg-surface-secondary p-4">
                  <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    成功率
                  </span>
                  <div className="flex items-end justify-between">
                    <span className="text-3xl font-bold tabular-nums"
                      style={{ color: data.ocr.successRate >= 80 ? 'var(--success)' : data.ocr.successRate >= 50 ? 'var(--warning)' : 'var(--danger)' }}
                    >
                      {data.ocr.successRate}%
                    </span>
                    <Badge variant={rateBadge(data.ocr.successRate)} size="sm" dot>
                      {data.ocr.successRate >= 80 ? '良好' : data.ocr.successRate >= 50 ? '一般' : '偏低'}
                    </Badge>
                  </div>
                  <Progress
                    value={data.ocr.successRate}
                    size="sm"
                    color={data.ocr.successRate >= 80 ? 'success' : data.ocr.successRate >= 50 ? 'warning' : 'danger'}
                    animated
                  />
                </div>

                <div className="flex flex-col gap-1 rounded-glass-sm bg-surface-secondary p-4">
                  <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">
                    <Clock className="h-3.5 w-3.5" />
                    平均耗时
                  </span>
                  <span className="text-3xl font-bold tabular-nums text-text-primary">
                    {data.ocr.avgDuration}
                    <span className="ml-1 text-base font-normal text-text-tertiary">秒</span>
                  </span>
                </div>
              </div>

              {/* 引擎统计 */}
              <div className="mb-5">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">引擎使用统计</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col gap-1 rounded-glass-sm bg-surface-secondary p-3">
                    <span className="text-xs text-text-secondary">PaddleOCR</span>
                    <span className="text-xl font-bold tabular-nums text-text-primary">{fmt(data.ocr.paddleCount)}</span>
                    <span className="text-xs text-text-tertiary">次</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-glass-sm bg-surface-secondary p-3">
                    <span className="text-xs text-text-secondary">Doubao Vision</span>
                    <span className="text-xl font-bold tabular-nums text-purple-500">{fmt(data.ocr.doubaoCount)}</span>
                    <span className="text-xs text-text-tertiary">次</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-glass-sm bg-surface-secondary p-3">
                    <span className="text-xs text-text-secondary">智能模式占比</span>
                    <span className="text-xl font-bold tabular-nums text-accent">
                      {data.ocr.totalCalls > 0 ? Math.round((data.ocr.smartModeCount / data.ocr.totalCalls) * 100) : 0}%
                    </span>
                    <span className="text-xs text-text-tertiary">{fmt(data.ocr.smartModeCount)} 次</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-glass-sm bg-surface-secondary p-3">
                    <span className="text-xs text-text-secondary">平均识别质量</span>
                    <span className="text-xl font-bold tabular-nums"
                      style={{ color: data.ocr.avgQuality >= 75 ? 'var(--success)' : data.ocr.avgQuality >= 50 ? 'var(--warning)' : 'var(--danger)' }}
                    >
                      {data.ocr.avgQuality}
                    </span>
                    <span className="text-xs text-text-tertiary">/ 100</span>
                  </div>
                </div>
              </div>

              {/* 引擎用量条形图 */}
              {(data.ocr.paddleCount > 0 || data.ocr.doubaoCount > 0) && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">引擎用量对比</h3>
                  <div className="flex h-6 overflow-hidden rounded-glass-sm">
                    {data.ocr.paddleCount > 0 && (
                      <div
                        className="flex items-center justify-center bg-emerald-500/80 text-xs font-medium text-white transition-all"
                        style={{ width: `${(data.ocr.paddleCount / Math.max(1, data.ocr.paddleCount + data.ocr.doubaoCount)) * 100}%` }}
                      >
                        {data.ocr.paddleCount > 0 && `Paddle ${Math.round((data.ocr.paddleCount / Math.max(1, data.ocr.paddleCount + data.ocr.doubaoCount)) * 100)}%`}
                      </div>
                    )}
                    {data.ocr.doubaoCount > 0 && (
                      <div
                        className="flex items-center justify-center bg-purple-500/80 text-xs font-medium text-white transition-all"
                        style={{ width: `${(data.ocr.doubaoCount / Math.max(1, data.ocr.paddleCount + data.ocr.doubaoCount)) * 100}%` }}
                      >
                        {data.ocr.doubaoCount > 0 && `Doubao ${Math.round((data.ocr.doubaoCount / Math.max(1, data.ocr.paddleCount + data.ocr.doubaoCount)) * 100)}%`}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </GlassCard>
          </motion.div>

          {/* ═══════════════ AI 分析指标 ═══════════════ */}
          <motion.div variants={fadeUp}>
            <GlassCard gradient="none" className="p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-glass-sm bg-purple-500/10 text-purple-500">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">🧠 AI 分析</h2>
                  <p className="text-xs text-text-tertiary">知识点提取 / 薄弱点诊断 / 学习建议</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
                <div className="flex flex-col gap-1 rounded-glass-sm bg-surface-secondary p-4">
                  <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">
                    <FileText className="h-3.5 w-3.5" />
                    总调用数
                  </span>
                  <span className="text-2xl font-bold tabular-nums text-text-primary">
                    {fmt(data.ai.totalCalls)}
                  </span>
                </div>

                <div className="flex flex-col gap-1 rounded-glass-sm bg-surface-secondary p-4">
                  <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Schema 通过率
                  </span>
                  <div className="flex items-end justify-between">
                    <span className="text-2xl font-bold tabular-nums"
                      style={{ color: data.ai.schemaPassRate >= 80 ? 'var(--success)' : data.ai.schemaPassRate >= 50 ? 'var(--warning)' : 'var(--danger)' }}
                    >
                      {data.ai.schemaPassRate}%
                    </span>
                    <Badge variant={rateBadge(data.ai.schemaPassRate)} size="sm" dot>
                      {data.ai.schemaPassRate >= 80 ? '良好' : data.ai.schemaPassRate >= 50 ? '一般' : '偏低'}
                    </Badge>
                  </div>
                  <Progress
                    value={data.ai.schemaPassRate}
                    size="sm"
                    color={data.ai.schemaPassRate >= 80 ? 'success' : data.ai.schemaPassRate >= 50 ? 'warning' : 'danger'}
                    animated
                  />
                </div>

                <div className="flex flex-col gap-1 rounded-glass-sm bg-surface-secondary p-4">
                  <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">
                    <Gauge className="h-3.5 w-3.5" />
                    平均 Token
                  </span>
                  <span className="text-2xl font-bold tabular-nums text-text-primary">
                    {fmt(data.ai.avgTokens)}
                  </span>
                </div>

                <div className="flex flex-col gap-1 rounded-glass-sm bg-surface-secondary p-4">
                  <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">
                    <Clock className="h-3.5 w-3.5" />
                    平均耗时
                  </span>
                  <span className="text-2xl font-bold tabular-nums text-text-primary">
                    {data.ai.avgDuration}
                    <span className="ml-1 text-base font-normal text-text-tertiary">秒</span>
                  </span>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* ═══════════════ 用户反馈指标 ═══════════════ */}
          <motion.div variants={fadeUp}>
            <GlassCard gradient="none" className="p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-glass-sm bg-amber-500/10 text-amber-500">
                  <ThumbsUp className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">💬 用户反馈</h2>
                  <p className="text-xs text-text-tertiary">AI 分析质量用户评价</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="flex flex-col gap-1 rounded-glass-sm bg-surface-secondary p-4">
                  <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">
                    <MessageSquare className="h-3.5 w-3.5" />
                    总反馈数
                  </span>
                  <span className="text-3xl font-bold tabular-nums text-text-primary">
                    {fmt(data.feedback.totalFeedback)}
                  </span>
                </div>

                <div className="flex flex-col gap-1 rounded-glass-sm bg-surface-secondary p-4">
                  <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    准确率
                  </span>
                  <div className="flex items-end justify-between">
                    <span className="text-3xl font-bold tabular-nums" style={{ color: data.feedback.accuracyRate >= 80 ? 'var(--success)' : data.feedback.accuracyRate >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                      {data.feedback.accuracyRate}%
                    </span>
                    <Badge variant={rateBadge(data.feedback.accuracyRate)} size="sm" dot>
                      {data.feedback.accuracyRate >= 80 ? '良好' : data.feedback.accuracyRate >= 50 ? '一般' : '偏低'}
                    </Badge>
                  </div>
                  <Progress value={data.feedback.accuracyRate} size="sm" color={data.feedback.accuracyRate >= 80 ? 'success' : data.feedback.accuracyRate >= 50 ? 'warning' : 'danger'} animated />
                </div>

                <div className="flex flex-col gap-1 rounded-glass-sm bg-surface-secondary p-4">
                  <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">
                    <ThumbsUp className="h-3.5 w-3.5" />
                    帮助率
                  </span>
                  <div className="flex items-end justify-between">
                    <span className="text-3xl font-bold tabular-nums" style={{ color: data.feedback.helpfulRate >= 80 ? 'var(--success)' : data.feedback.helpfulRate >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                      {data.feedback.helpfulRate}%
                    </span>
                    <Badge variant={rateBadge(data.feedback.helpfulRate)} size="sm" dot>
                      {data.feedback.helpfulRate >= 80 ? '良好' : data.feedback.helpfulRate >= 50 ? '一般' : '偏低'}
                    </Badge>
                  </div>
                  <Progress value={data.feedback.helpfulRate} size="sm" color={data.feedback.helpfulRate >= 80 ? 'success' : data.feedback.helpfulRate >= 50 ? 'warning' : 'danger'} animated />
                </div>
              </div>
            </GlassCard>
          </motion.div>


          {/* ═══════════════ 数据规模 ═══════════════ */}
          <motion.div variants={fadeUp}>
            <GlassCard gradient="none" className="p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-glass-sm bg-emerald-500/10 text-emerald-500">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">🗃️ 数据规模</h2>
                  <p className="text-xs text-text-tertiary">平台数据积累概况</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="考试数"
                  value={fmt(data.dataScale.examCount)}
                  icon={<FileText className="h-4 w-4" />}
                  gradient="blue"
                />
                <StatCard
                  label="题目数"
                  value={fmt(data.dataScale.questionCount)}
                  icon={<Puzzle className="h-4 w-4" />}
                  gradient="green"
                />
                <StatCard
                  label="作答记录"
                  value={fmt(data.dataScale.questionResultCount)}
                  icon={<Layers className="h-4 w-4" />}
                  gradient="purple"
                />
                <StatCard
                  label="知识点数"
                  value={fmt(data.dataScale.knowledgePointCount)}
                  icon={<BookOpen className="h-4 w-4" />}
                  gradient="amber"
                />
              </div>
            </GlassCard>
          </motion.div>
        </>
      )}
    </motion.div>
  )
}

// ── 内联图标组件（避免依赖未导出图标） ──

function MessageSquare({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
