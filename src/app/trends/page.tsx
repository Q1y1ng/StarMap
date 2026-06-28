'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'
import { GlassCard } from '@/components/ui-system/GlassCard'
import { Badge } from '@/components/ui-system/Badge'
import { Spinner } from '@/components/ui-system/Spinner'
import { PageHeader } from '@/components/ui-system/PageHeader'
import { Button } from '@/components/ui-system/Button'
import { RefreshCw } from 'lucide-react'

// ── Types ──

type ScoreTrendItem = { examId: string; examDate: string; title: string; subject: string; totalScore: number }
type SubjectTrendItem = { subject: string; data: { examDate: string; avgScore: number; examCount: number }[] }
type WeaknessTrendItem = { name: string; frequency: number; avgScoreRate: number; lastDiagnosis: string; trend: 'improving' | 'stable' | 'declining' }
type TrendStats = { totalExams: number; totalReports: number; subjectCount: number; recentExams: { title: string; subject: string; examDate: string; totalScore: number }[] }
type KpTimeline = { knowledgePoint: string; data: { examId: string; examDate: string; mastery: number; score: number; fullScore: number }[] }
type DifficultyTrendItem = {
  examId: string
  examDate: string
  title: string
  subject: string
  difficultyScore: number
  difficultyLevel: string
}

// ── Colors ──

const SUBJECT_COLORS: Record<string, string> = {
  '语文': '#6366f1', '数学': '#3b82f6', '英语': '#10b981',
  '物理': '#f59e0b', '化学': '#8b5cf6', '生物': '#06b6d4',
  '历史': '#ef4444', '地理': '#84cc16', '政治': '#ec4899',
}
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']
const weakColors = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e']

function getSubjectColor(subject: string): string { return SUBJECT_COLORS[subject] ?? '#6b7280' }
function fmtDate(dateStr: string) { const d = new Date(dateStr); return `${d.getMonth() + 1}/${d.getDate()}` }
function subjectEmoji(s: string): string {
  const map: Record<string, string> = { '语文': '📖', '数学': '📐', '英语': '🔤', '物理': '⚡', '化学': '🧪', '生物': '🧬', '历史': '📜', '地理': '🌍', '政治': '⚖️' }
  return map[s] ?? '📝'
}

// ── Subcomponents ──

function TrendBadge({ trend }: { trend: 'improving' | 'stable' | 'declining' }) {
  const cfg: Record<string, { variant: 'success' | 'info' | 'danger'; label: string }> = {
    improving: { variant: 'success', label: '↑ 好转' },
    stable: { variant: 'info', label: '→ 平稳' },
    declining: { variant: 'danger', label: '↓ 恶化' },
  }
  const c = cfg[trend]
  return <Badge variant={c.variant} size="sm">{c.label}</Badge>
}

function EmptyState() {
  return <div className="flex items-center justify-center py-12 text-sm text-text-tertiary">暂无数据。</div>
}

function ChartTooltip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-glass-sm glass p-3 text-sm shadow-glass-floating">
      {children}
    </div>
  )
}

// ── Animation ──

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 16 } as const,
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
}

// ═══════════════════ Page ═══════════════════

export default function TrendsPage() {
  const [scoreTrend, setScoreTrend] = useState<ScoreTrendItem[]>([])
  const [subjectTrends, setSubjectTrends] = useState<SubjectTrendItem[]>([])
  const [weaknessTrends, setWeaknessTrends] = useState<WeaknessTrendItem[]>([])
  const [stats, setStats] = useState<TrendStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [kpTimelines, setKpTimelines] = useState<KpTimeline[]>([])
  const [difficultyTrend, setDifficultyTrend] = useState<DifficultyTrendItem[]>([])
  const [growthSubject, setGrowthSubject] = useState('数学')
  const [growthLoading, setGrowthLoading] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [overallRes, subjectsRes, weaknessesRes, statsRes, difficultyRes] = await Promise.all([
        fetch('/api/trends/overall'),
        fetch('/api/trends/subjects'),
        fetch('/api/trends/weaknesses'),
        fetch('/api/trends/stats'),
        fetch('/api/trends/difficulty'),
      ])
      const [overall, subjects, weaknesses, statsData, difficultyData] = await Promise.all([
        overallRes.json(), subjectsRes.json(), weaknessesRes.json(), statsRes.json(), difficultyRes.json(),
      ])
      if (overall.success) setScoreTrend(overall.data)
      if (subjects.success) setSubjectTrends(subjects.data)
      if (weaknesses.success) setWeaknessTrends(weaknesses.data)
      if (statsData.success) setStats(statsData.data)
      if (difficultyData.success) setDifficultyTrend(difficultyData.data)
    } catch (err) { console.error('加载趋势数据失败:', err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    let mounted = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    Promise.all([
      fetch('/api/trends/overall'),
      fetch('/api/trends/subjects'),
      fetch('/api/trends/weaknesses'),
      fetch('/api/trends/stats'),
      fetch('/api/trends/difficulty'),
    ])
      .then(([overallRes, subjectsRes, weaknessesRes, statsRes, difficultyRes]) =>
        Promise.all([overallRes.json(), subjectsRes.json(), weaknessesRes.json(), statsRes.json(), difficultyRes.json()])
      )
      .then(([overall, subjects, weaknesses, statsData, difficultyData]) => {
        if (!mounted) return
        if (overall.success) setScoreTrend(overall.data)
        if (subjects.success) setSubjectTrends(subjects.data)
        if (weaknesses.success) setWeaknessTrends(weaknesses.data)
        if (statsData.success) setStats(statsData.data)
        if (difficultyData.success) setDifficultyTrend(difficultyData.data)
      })
      .catch(err => { if (mounted) console.error('加载趋势数据失败:', err) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!stats || stats.subjectCount <= 0) return
    let mounted = true
    const loadKpTimelines = async () => {
      setGrowthLoading(true)
      try {
        const res = await fetch(`/api/growth-analysis/${encodeURIComponent(growthSubject)}?type=timeline&limit=10`)
        const json = await res.json()
        if (mounted && json.success) setKpTimelines(json.data)
      } catch (err) { if (mounted) console.error('加载成长曲线失败:', err) }
      finally { if (mounted) setGrowthLoading(false) }
    }
    loadKpTimelines()
    return () => { mounted = false }
  }, [stats, growthSubject])

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Spinner size="lg" label="加载趋势数据…" />
      </div>
    )
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
      {/* ── Header ── */}
      <motion.div variants={fadeUp} className="flex items-start justify-between">
        <PageHeader
          title="📈 学情趋势"
          subtitle={
            stats
              ? `共 ${stats.totalExams} 场考试 · ${stats.subjectCount} 个科目 · ${stats.totalReports} 份分析报告`
              : '趋势数据'
          }
        />
        <Button variant="secondary" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={fetchAll}>
          刷新数据
        </Button>
      </motion.div>

      {/* ── 1. Stat Cards ── */}
      {stats && (
        <motion.div variants={fadeUp} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <GlassCard gradient="blue" className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">📝 考试总数</p>
            <p className="mt-1 text-2xl font-bold text-text-primary">{stats.totalExams}</p>
          </GlassCard>
          <GlassCard gradient="purple" className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">📚 科目数量</p>
            <p className="mt-1 text-2xl font-bold text-text-primary">{stats.subjectCount}</p>
          </GlassCard>
          <GlassCard gradient="green" className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">📊 分析报告</p>
            <p className="mt-1 text-2xl font-bold text-text-primary">{stats.totalReports}</p>
          </GlassCard>
          <GlassCard gradient="amber" className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">📅 最近考试</p>
            <p className="mt-1 text-base font-bold text-text-primary truncate" title={stats.recentExams[0]?.title}>
              {stats.recentExams[0]?.title ?? '-'}
            </p>
          </GlassCard>
        </motion.div>
      )}

      {/* ── 2. Score Trend ── */}
      <motion.div variants={fadeUp}>
        <GlassCard gradient="none" className="p-6">
          <h2 className="mb-5 text-lg font-semibold text-text-primary">📊 成绩趋势</h2>
          {scoreTrend.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={scoreTrend} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-tertiary)" />
                <XAxis dataKey="examDate" tickFormatter={fmtDate} tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const item = payload[0].payload as ScoreTrendItem
                  return (
                    <ChartTooltip>
                      <div className="font-medium text-text-primary">{item.title}</div>
                      <div className="mt-0.5 text-text-tertiary">{item.subject} · {item.examDate}</div>
                      <div className="mt-1 text-lg font-bold text-accent">{item.totalScore} 分</div>
                    </ChartTooltip>
                  )
                }} />
                <Line type="monotone" dataKey="totalScore" stroke="var(--accent)" strokeWidth={2.5}
                  dot={{ r: 4, fill: 'var(--accent)', strokeWidth: 2, stroke: 'var(--surface)' }}
                  activeDot={{ r: 6, fill: 'var(--accent)', strokeWidth: 2, stroke: 'var(--surface)' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </GlassCard>
      </motion.div>

      {/* ── 3. Subject Averages ── */}
      <motion.div variants={fadeUp}>
        <GlassCard gradient="none" className="p-6">
          <h2 className="mb-5 text-lg font-semibold text-text-primary">📊 各科平均分趋势</h2>
          {subjectTrends.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-tertiary)" />
                <XAxis dataKey="examDate" type="category" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} tickLine={false} allowDuplicatedCategory={false} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <ChartTooltip>
                      <div className="font-medium text-text-primary">{label}</div>
                      {payload.map((entry, i) => (
                        <div key={i} className="mt-1 flex items-center gap-2 text-xs">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                          <span className="text-text-secondary">{entry.name}</span>
                          <span className="font-semibold text-text-primary">{entry.value} 分</span>
                        </div>
                      ))}
                    </ChartTooltip>
                  )
                }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
                {subjectTrends.map((s) => (
                  <Line key={s.subject} data={s.data} dataKey="avgScore" name={s.subject}
                    type="monotone" stroke={getSubjectColor(s.subject)} strokeWidth={2}
                    dot={{ r: 3, fill: getSubjectColor(s.subject), strokeWidth: 0 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </GlassCard>
      </motion.div>

      {/* ── 4. Difficulty Trend ── */}
      <motion.div variants={fadeUp}>
        <GlassCard gradient="none" className="p-6">
          <h2 className="mb-5 text-lg font-semibold text-text-primary">📊 难度趋势</h2>
          {difficultyTrend.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={difficultyTrend} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-tertiary)" />
                <XAxis dataKey="examDate" tickFormatter={fmtDate}
                  tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} tickLine={false} />
                <YAxis domain={[0.5, 2.0]} tickCount={7}
                  tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const item = payload[0].payload as DifficultyTrendItem
                  const levelColors: Record<string, string> = {
                    Easy: '#22c55e', Normal: '#3b82f6', Hard: '#f97316', 'Very Hard': '#ef4444',
                  }
                  return (
                    <ChartTooltip>
                      <div className="font-medium text-text-primary">{item.title}</div>
                      <div className="mt-0.5 text-text-tertiary">{item.subject} · {item.examDate}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-lg font-bold text-text-primary">{item.difficultyScore.toFixed(2)}</span>
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: levelColors[item.difficultyLevel] + '20',
                            color: levelColors[item.difficultyLevel],
                          }}>
                          {item.difficultyLevel}
                        </span>
                      </div>
                    </ChartTooltip>
                  )
                }} />
                <ReferenceLine y={0.8} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.4} />
                <ReferenceLine y={1.2} stroke="#f97316" strokeDasharray="4 4" strokeOpacity={0.4} />
                <ReferenceLine y={1.6} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.4} />
                <Line type="monotone" dataKey="difficultyScore"
                  stroke="#8b5cf6" strokeWidth={2.5}
                  dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: 'var(--surface)' }}
                  activeDot={{ r: 6, fill: '#8b5cf6', strokeWidth: 2, stroke: 'var(--surface)' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-text-tertiary">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#22c55e]" /> 简单</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#3b82f6]" /> 中等</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#f97316]" /> 困难</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#ef4444]" /> 极难</span>
          </div>
        </GlassCard>
      </motion.div>

      {/* ── 5. Weakness Distribution ── */}
      <motion.div variants={fadeUp}>
        <GlassCard gradient="none" className="p-6">
          <h2 className="mb-5 text-lg font-semibold text-text-primary">🔻 薄弱知识点分布</h2>
          {weaknessTrends.length === 0 ? <EmptyState /> : (
            <div className="space-y-6">
              <ResponsiveContainer width="100%" height={Math.max(200, weaknessTrends.length * 40)}>
                <BarChart data={weaknessTrends.slice(0, 10)} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-tertiary)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} width={96} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const item = payload[0].payload as WeaknessTrendItem
                    return (
                      <ChartTooltip>
                        <div className="font-medium text-text-primary">{item.name}</div>
                        <div className="mt-1 text-text-tertiary">出现 {item.frequency} 次 · 平均得分率 {item.avgScoreRate}%</div>
                        <div className="mt-1 text-xs text-text-tertiary line-clamp-2">{item.lastDiagnosis}</div>
                      </ChartTooltip>
                    )
                  }} />
                  <Bar dataKey="frequency" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {weaknessTrends.slice(0, 10).map((_, i) => <Cell key={i} fill={weakColors[i % weakColors.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-tertiary text-left text-xs uppercase text-text-tertiary">
                      <th className="pb-2 pr-4 font-medium">知识点</th>
                      <th className="pb-2 pr-4 font-medium">出现次数</th>
                      <th className="pb-2 pr-4 font-medium">平均得分率</th>
                      <th className="pb-2 pr-4 font-medium">趋势</th>
                      <th className="pb-2 font-medium">最近诊断</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-tertiary">
                    {weaknessTrends.map((w) => (
                      <tr key={w.name} className="transition-colors hover:bg-accent-subtle/30">
                        <td className="py-2.5 pr-4 font-medium text-text-primary">{w.name}</td>
                        <td className="py-2.5 pr-4 text-text-secondary">{w.frequency} 次</td>
                        <td className="py-2.5 pr-4">
                          <Badge size="sm" variant={w.avgScoreRate < 30 ? 'danger' : w.avgScoreRate < 50 ? 'warning' : 'success'}>
                            {w.avgScoreRate}%
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4"><TrendBadge trend={w.trend} /></td>
                        <td className="max-w-xs truncate py-2.5 text-text-tertiary">{w.lastDiagnosis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* ── 6. Knowledge Growth Curves ── */}
      <motion.div variants={fadeUp}>
        <GlassCard gradient="none" className="p-6">
          <h2 className="mb-5 text-lg font-semibold text-text-primary">📈 知识点成长曲线</h2>

          <div className="mb-4 flex flex-wrap gap-2">
            {['数学', '物理', '化学', '语文', '英语', '地理'].map((s) => (
              <button
                key={s}
                onClick={() => setGrowthSubject(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  growthSubject === s
                    ? 'bg-accent text-white'
                    : 'glass text-text-secondary hover:brightness-95'
                }`}
              >
                {subjectEmoji(s)} {s}
              </button>
            ))}
          </div>

          {growthLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="md" label="加载成长曲线…" />
            </div>
          ) : kpTimelines.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-tertiary)" />
                <XAxis dataKey="examDate" type="category" tickFormatter={fmtDate}
                  tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} tickLine={false} allowDuplicatedCategory={false} />
                <YAxis domain={[0, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                  tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <ChartTooltip>
                      <div className="font-medium text-text-primary">{label}</div>
                      {payload.map((entry, i) => (
                        <div key={i} className="mt-1 flex items-center gap-2 text-xs">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                          <span className="text-text-secondary">{entry.name}</span>
                          <span className="font-semibold text-text-primary">{Math.round(Number(entry.value) * 100)}%</span>
                        </div>
                      ))}
                    </ChartTooltip>
                  )
                }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
                {kpTimelines.map((kp, i) => (
                  <Line key={kp.knowledgePoint} data={kp.data} dataKey="mastery" name={kp.knowledgePoint}
                    type="monotone" stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 0 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
          <p className="mt-3 text-xs text-text-tertiary">
            仅显示有足够数据（{'>'} 2 次考试）的知识点。横轴为考试日期，纵轴为掌握率。
          </p>
        </GlassCard>
      </motion.div>

      {/* ── 7. Recent Exams ── */}
      {stats && stats.recentExams.length > 1 && (
        <motion.div variants={fadeUp}>
          <GlassCard gradient="none" className="p-6">
            <h2 className="mb-5 text-lg font-semibold text-text-primary">📋 最近考试</h2>
            <div className="space-y-2">
              {stats.recentExams.map((exam, i) => (
                <div key={i}
                  className="flex items-center gap-4 rounded-glass-sm glass p-3 transition-all hover:shadow-glass-elevated"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-glass-sm text-lg"
                    style={{ backgroundColor: getSubjectColor(exam.subject) + '20' }}>
                    {subjectEmoji(exam.subject)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-text-primary">{exam.title}</div>
                    <div className="text-xs text-text-tertiary">{exam.subject} · {exam.examDate}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-bold text-text-primary">{exam.totalScore}</div>
                    <div className="text-xs text-text-tertiary">分</div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      )}
    </motion.div>
  )
}
