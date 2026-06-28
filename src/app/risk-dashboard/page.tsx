'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  TrendingDown,
  Activity,
  RefreshCw,
  ArrowUpDown,
  BarChart3,
  Target,
  BookOpen,
  AlertCircle,
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
import { PageHeader } from '@/components/ui-system/PageHeader'
import { GlassCard } from '@/components/ui-system/GlassCard'
import { Badge } from '@/components/ui-system/Badge'
import { Tabs } from '@/components/ui-system/Tabs'
import { Spinner } from '@/components/ui-system/Spinner'
import { StatCard } from '@/components/ui-system/StatCard'
import { Button } from '@/components/ui-system/Button'

// ── Types ──

type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical'

type RiskItem = {
  id: string
  subject: string
  knowledgePoint: string
  riskScore: number
  riskLevel: RiskLevel
  trendSlope: number
  sampleSize: number
  latestMastery: number
  createdAt: string
  reason?: string
  suggestion?: string
  trendData?: { examDate: string; mastery: number }[]
}

type RiskSummary = {
  total: number
  critical: number
  high: number
  medium: number
  low: number
  subjects: string[]
}

// ── Constants ──

const RISK_COLORS: Record<RiskLevel, string> = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
}

const SUBJECT_TABS = [
  { key: '', label: '📋 全部' },
  { key: '数学', label: '📐 数学' },
  { key: '物理', label: '⚡ 物理' },
  { key: '化学', label: '🧪 化学' },
  { key: '语文', label: '📖 语文' },
  { key: '英语', label: '🔤 英语' },
  { key: '地理', label: '🌍 地理' },
]

const RISK_LEVEL_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: '', label: '全部等级', color: '#6b7280' },
  { value: 'Critical', label: '🔴 高危', color: '#ef4444' },
  { value: 'High', label: '🟠 较高', color: '#f97316' },
  { value: 'Medium', label: '🟡 中等', color: '#eab308' },
  { value: 'Low', label: '🟢 低', color: '#22c55e' },
]

// ── Helpers ──

function masteryLabel(m: number): string {
  return `${Math.round(m * 100)}%`
}

function defaultTooltipFormatter(value: unknown): [string, string] {
  const v = Number(value) || 0
  return [`${(v * 100).toFixed(1)}%`, '掌握率']
}

function slopeLabel(s: number): string {
  if (s < -0.05) return `快速下降 ${(s * 100).toFixed(1)}%/次`
  if (s < -0.02) return `下降中 ${(s * 100).toFixed(1)}%/次`
  if (s < 0) return `缓慢下降 ${(s * 100).toFixed(1)}%/次`
  if (s > 0.05) return `快速上升 +${(s * 100).toFixed(1)}%/次`
  if (s > 0) return `上升中 +${(s * 100).toFixed(1)}%/次`
  return '平稳'
}

function sortItems(items: RiskItem[], sortBy: string): RiskItem[] {
  const sorted = [...items]
  switch (sortBy) {
    case 'riskScore':
      return sorted.sort((a, b) => b.riskScore - a.riskScore)
    case 'trendSlope':
      return sorted.sort((a, b) => a.trendSlope - b.trendSlope)
    case 'latestMastery':
      return sorted.sort((a, b) => a.latestMastery - b.latestMastery)
    default:
      return sorted
  }
}

// ═══════════════════ Page ═══════════════════

export default function RiskDashboardPage() {
  const [items, setItems] = useState<RiskItem[]>([])
  const [summary, setSummary] = useState<RiskSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [subject, setSubject] = useState('')
  const [riskLevelFilter, setRiskLevelFilter] = useState('')
  const [sortBy, setSortBy] = useState<'riskScore' | 'trendSlope' | 'latestMastery'>('riskScore')
  const [selectedItem, setSelectedItem] = useState<RiskItem | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Load data ──

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (subject) params.set('subject', subject)
      if (riskLevelFilter) params.set('riskLevel', riskLevelFilter)
      params.set('orderBy', sortBy)
      params.set('limit', '100')

      const [risksRes, summaryRes] = await Promise.all([
        fetch(`/api/risk-analysis?${params.toString()}`),
        fetch('/api/risk-analysis?summary=true'),
      ])

      const risksJson = await risksRes.json()
      const summaryJson = await summaryRes.json()

      if (risksJson.success) setItems(risksJson.data)
      if (summaryJson.success) setSummary(summaryJson.data)
    } catch {
      setError('加载风险数据失败')
    } finally {
      setLoading(false)
    }
  }, [subject, riskLevelFilter, sortBy])

  useEffect(() => {
    loadData() // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadData])

  // ── Analyze / Refresh ──

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/risk-analysis?action=refresh')
      const json = await res.json()
      if (json.success) {
        await loadData()
      }
    } catch {
      setError('分析失败')
    } finally {
      setAnalyzing(false)
    }
  }, [loadData])

  // ── Load detail ──

  const handleItemClick = useCallback(async (item: RiskItem) => {
    setDetailLoading(true)
    setSelectedItem({ ...item, trendData: undefined })
    try {
      const res = await fetch(`/api/risk-analysis?subject=${encodeURIComponent(item.subject)}&knowledgePoint=${encodeURIComponent(item.knowledgePoint)}`)
      const json = await res.json()
      if (json.success) setSelectedItem(json.data)
    } catch {
      // keep base info
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // ── Animation ──

  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
  }
  const fadeUp = {
    hidden: { opacity: 0, y: 16 } as const,
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
  }

  // ── Filtered & sorted items ──

  const displayItems = sortItems(items, sortBy)

  // ── Render ──

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-start justify-between">
        <PageHeader
          title="⚠️ 学习风险预警"
          subtitle="基于知识掌握率趋势的统计分析，自动识别退化风险"
        />
        <Button
          onClick={handleAnalyze}
          disabled={analyzing}
          variant="primary"
          className="shrink-0"
        >
          <RefreshCw className={`mr-1.5 h-4 w-4 ${analyzing ? 'animate-spin' : ''}`} />
          {analyzing ? '分析中…' : '重新分析'}
        </Button>
      </motion.div>

      {/* Summary Cards */}
      {summary && (
        <motion.div variants={fadeUp} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="总知识点"
            value={summary.total}
            icon={<Activity className="h-5 w-5" />}
          />
          <StatCard
            label="⚠️ 高危"
            value={summary.critical}
            icon={<AlertCircle className="h-5 w-5" />}
            trend="up"
            className="border-red-500/20"
          />
          <StatCard
            label="较高风险"
            value={summary.high}
            icon={<AlertTriangle className="h-5 w-5" />}
            trend="up"
            className="border-orange-500/20"
          />
          <StatCard
            label="中等风险"
            value={summary.medium}
            icon={<TrendingDown className="h-5 w-5" />}
            trend="up"
            className="border-yellow-500/20"
          />
          <StatCard
            label="低风险"
            value={summary.low}
            icon={<Target className="h-5 w-5" />}
            trend="down"
            className="border-green-500/20"
          />
        </motion.div>
      )}

      {/* Filters */}
      <motion.div variants={fadeUp} className="space-y-4">
        {/* Subject tabs */}
        <Tabs tabs={SUBJECT_TABS} activeKey={subject} onChange={setSubject} variant="pill" />

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Risk level filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-tertiary">风险等级：</span>
            <div className="flex gap-1">
              {RISK_LEVEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRiskLevelFilter(opt.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    riskLevelFilter === opt.value
                      ? 'border-accent bg-accent-subtle text-accent'
                      : 'border-glass-border text-text-secondary hover:bg-surface-secondary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-4 w-px bg-glass-border" />

          {/* Sort */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-3.5 w-3.5 text-text-tertiary" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-lg border border-glass-border bg-surface px-2.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
            >
              <option value="riskScore">按风险分数</option>
              <option value="trendSlope">按下降速度</option>
              <option value="latestMastery">按掌握率</option>
            </select>
          </div>

          {/* Count */}
          <span className="ml-auto text-xs text-text-tertiary">
            共 {displayItems.length} 个知识点
          </span>
        </div>
      </motion.div>

      {/* Main content: List + Detail */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Risk list (3/5) */}
        <motion.div variants={fadeUp} className="xl:col-span-3">
          <GlassCard gradient="none" className="p-4">
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <Spinner size="lg" label="加载中…" />
              </div>
            ) : error ? (
              <div className="flex h-32 items-center justify-center text-sm text-text-tertiary">
                {error}
              </div>
            ) : displayItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
                <Activity className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">暂无风险数据</p>
                <p className="mt-1 text-xs opacity-60">点击&ldquo;重新分析&rdquo;按钮开始评估知识点退化风险</p>
              </div>
            ) : (
              <div className="space-y-1">
                {displayItems.map((item) => {
                  const riskColor = RISK_COLORS[item.riskLevel]
                  const isSelected = selectedItem?.id === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`w-full rounded-lg border p-3 text-left transition-all ${
                        isSelected
                          ? 'border-accent bg-accent-subtle/30'
                          : 'border-transparent hover:bg-surface-secondary'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Risk indicator bar */}
                        <div
                          className="mt-0.5 h-full w-1 shrink-0 rounded-full"
                          style={{ backgroundColor: riskColor }}
                        />

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary">
                              {item.knowledgePoint}
                            </span>
                            <Badge variant="default" size="sm">{item.subject}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-text-tertiary line-clamp-1">
                            {item.reason}
                          </p>
                        </div>

                        {/* Score & Level */}
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span
                            className="rounded-md px-2 py-0.5 text-xs font-bold"
                            style={{
                              backgroundColor: `${riskColor}18`,
                              color: riskColor,
                            }}
                          >
                            {item.riskLevel === 'Critical' ? '🔴' : item.riskLevel === 'High' ? '🟠' : item.riskLevel === 'Medium' ? '🟡' : '🟢'}{' '}
                            {Math.round(item.riskScore)}
                          </span>
                          <span className="text-[10px] text-text-tertiary">
                            掌握率 {masteryLabel(item.latestMastery)}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Detail panel (2/5) */}
        <motion.div variants={fadeUp} className="xl:col-span-2">
          <GlassCard gradient="none" className="h-full min-h-[400px] p-5">
            {detailLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Spinner size="lg" label="加载详情…" />
              </div>
            ) : selectedItem ? (
              <div className="space-y-5">
                {/* Header */}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-text-primary">
                      {selectedItem.knowledgePoint}
                    </h3>
                    <Badge variant="default" size="sm">{selectedItem.subject}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div
                      className="rounded-full px-3 py-1 text-sm font-bold"
                      style={{
                        backgroundColor: `${RISK_COLORS[selectedItem.riskLevel]}18`,
                        color: RISK_COLORS[selectedItem.riskLevel],
                      }}
                    >
                      {selectedItem.riskLevel === 'Critical' ? '🔴 高危' :
                       selectedItem.riskLevel === 'High' ? '🟠 较高风险' :
                       selectedItem.riskLevel === 'Medium' ? '🟡 中等风险' : '🟢 低风险'}
                      {' · '}{Math.round(selectedItem.riskScore)}分
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-surface-secondary p-3 text-center">
                    <p className="text-xs text-text-tertiary">趋势斜率</p>
                    <p className={`mt-1 text-sm font-bold ${selectedItem.trendSlope < 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {selectedItem.trendSlope.toFixed(4)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-text-tertiary">{slopeLabel(selectedItem.trendSlope)}</p>
                  </div>
                  <div className="rounded-lg bg-surface-secondary p-3 text-center">
                    <p className="text-xs text-text-tertiary">最新掌握率</p>
                    <p className="mt-1 text-sm font-bold text-text-primary">
                      {masteryLabel(selectedItem.latestMastery)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-text-tertiary">
                      {selectedItem.latestMastery < 0.3 ? '薄弱' :
                       selectedItem.latestMastery < 0.6 ? '一般' : '良好'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface-secondary p-3 text-center">
                    <p className="text-xs text-text-tertiary">样本量</p>
                    <p className="mt-1 text-sm font-bold text-text-primary">
                      {selectedItem.sampleSize}次
                    </p>
                    <p className="mt-0.5 text-[10px] text-text-tertiary">最近考试</p>
                  </div>
                </div>

                {/* Trend Chart */}
                {selectedItem.trendData && selectedItem.trendData.length > 0 && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                      <BarChart3 className="h-3 w-3" />
                      掌握率趋势
                    </h4>
                    <div className="h-48 rounded-lg bg-surface-secondary p-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={selectedItem.trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                          <XAxis
                            dataKey="examDate"
                            tick={{ fontSize: 10, fill: '#9ca3af' }}
                            tickLine={false}
                          />
                          <YAxis
                            domain={[0, 1]}
                            tickFormatter={(v) => `${Math.round(v * 100)}%`}
                            tick={{ fontSize: 10, fill: '#9ca3af' }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              background: '#1f2937',
                              border: '1px solid #374151',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                            labelFormatter={(date) => date as string}
                            formatter={defaultTooltipFormatter}
                          />
                          <Line
                            type="monotone"
                            dataKey="mastery"
                            stroke={RISK_COLORS[selectedItem.riskLevel]}
                            strokeWidth={2}
                            dot={{ r: 4, fill: RISK_COLORS[selectedItem.riskLevel] }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Reason */}
                {selectedItem.reason && (
                  <div className="rounded-lg bg-info/5 p-3">
                    <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-text-tertiary">
                      <Activity className="h-3 w-3" />
                      分析说明
                    </h4>
                    <p className="text-sm leading-relaxed text-text-secondary">
                      {selectedItem.reason}
                    </p>
                  </div>
                )}

                {/* Suggestion */}
                {selectedItem.suggestion && (
                  <div className={`rounded-lg p-3 ${
                    selectedItem.riskLevel === 'Critical' ? 'bg-red-500/5' :
                    selectedItem.riskLevel === 'High' ? 'bg-orange-500/5' :
                    selectedItem.riskLevel === 'Medium' ? 'bg-yellow-500/5' : 'bg-green-500/5'
                  }`}>
                    <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-text-tertiary">
                      <BookOpen className="h-3 w-3" />
                      建议干预措施
                    </h4>
                    <p className={`text-sm leading-relaxed ${
                      selectedItem.riskLevel === 'Critical' ? 'text-red-500/90' :
                      selectedItem.riskLevel === 'High' ? 'text-orange-500/90' : 'text-text-secondary'
                    }`}>
                      {selectedItem.suggestion}
                    </p>
                  </div>
                )}

                {/* Distribution bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-secondary">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${selectedItem.riskScore}%`,
                      backgroundColor: RISK_COLORS[selectedItem.riskLevel],
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-text-tertiary">
                  <span>风险分数: 0</span>
                  <span>{Math.round(selectedItem.riskScore)} / 100</span>
                </div>
              </div>
            ) : (
              /* No item selected */
              <div className="flex h-full flex-col items-center justify-center text-text-tertiary">
                <BarChart3 className="mb-4 h-12 w-12 opacity-20" />
                <p className="text-sm font-medium">选择知识点查看详情</p>
                <p className="mt-1 text-xs opacity-60">点击左侧列表中的知识点查看风险分析和趋势图</p>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </motion.div>
  )
}
