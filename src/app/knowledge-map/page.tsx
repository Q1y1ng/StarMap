'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BookOpen } from 'lucide-react'
import { GlassCard } from '@/components/ui-system/GlassCard'
import { StatCard } from '@/components/ui-system/StatCard'
import { Badge } from '@/components/ui-system/Badge'
import { Progress } from '@/components/ui-system/Progress'
import { Spinner } from '@/components/ui-system/Spinner'
import { PageHeader } from '@/components/ui-system/PageHeader'
import { Tabs } from '@/components/ui-system/Tabs'

// ── Types ──

type KpMasteryItem = {
  knowledgePoint: string
  knowledgePointId: string
  mastery: number
  totalScore: number
  totalFullScore: number
  examCount: number
}

const SUBJECT_TABS = [
  { key: '数学', label: '📐 数学' },
  { key: '物理', label: '⚡ 物理' },
  { key: '化学', label: '🧪 化学' },
  { key: '语文', label: '📖 语文' },
  { key: '英语', label: '🔤 英语' },
  { key: '地理', label: '🌍 地理' },
]

// ── Helpers ──

function masteryInfo(mastery: number): {
  badge: 'success' | 'warning' | 'danger'
  label: string
  bar: 'success' | 'warning' | 'danger'
} {
  if (mastery < 0.3) return { badge: 'danger', label: '薄弱', bar: 'danger' }
  if (mastery < 0.6) return { badge: 'warning', label: '一般', bar: 'warning' }
  return { badge: 'success', label: '良好', bar: 'success' }
}

// ── Animation ──

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 } as const,
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
}

const rowItem = {
  hidden: { opacity: 0, x: -8 } as const,
  show: { opacity: 1, x: 0, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const } },
}

// ═══════════════════ Page ═══════════════════

export default function KnowledgeMapPage() {
  const [subject, setSubject] = useState('数学')
  const [data, setData] = useState<KpMasteryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const loadData = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/knowledge-mastery/subject/${encodeURIComponent(subject)}?limit=50`)
        const json = await res.json()
        if (mounted && json.success) setData(json.data)
      } catch (err) {
        if (mounted) console.error(err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadData()
    return () => { mounted = false }
  }, [subject])

  const avgMastery = data.length > 0
    ? Math.round((data.reduce((s, d) => s + d.mastery, 0) / data.length) * 100)
    : 0
  const weakCount = data.filter((d) => d.mastery < 0.3).length

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
      {/* ── Header ── */}
      <motion.div variants={fadeUp}>
        <PageHeader
          title="🗺️ 知识点掌握热力图"
          subtitle="各知识点掌握率概览，按掌握率升序排列（薄弱在前）"
        />
      </motion.div>

      {/* ── Subject Tabs ── */}
      <motion.div variants={fadeUp}>
        <Tabs tabs={SUBJECT_TABS} activeKey={subject} onChange={setSubject} variant="pill" />
      </motion.div>

      {/* ── Stat Cards ── */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard
          label="知识点总数"
          value={data.length}
          icon={<BookOpen className="h-5 w-5" />}
          gradient="blue"
        />
        <StatCard
          label="平均掌握率"
          value={`${avgMastery}%`}
          trend={avgMastery >= 60 ? 'up' : avgMastery >= 30 ? 'stable' : 'down'}
          gradient="purple"
        />
        <StatCard
          label="薄弱知识点"
          value={weakCount}
          trend={weakCount > 0 ? 'down' : 'stable'}
          trendLabel={weakCount > 0 ? '需加强' : '暂无'}
          gradient="red"
        />
      </motion.div>

      {/* ── Table ── */}
      <motion.div variants={fadeUp}>
        <GlassCard gradient="none" className="p-6">
          <h2 className="mb-5 text-lg font-semibold text-text-primary">📊 知识点掌握率</h2>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Spinner size="lg" label="加载中…" />
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-text-tertiary">
              暂无数据。请先上传答题卡并生成成绩。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-tertiary text-left text-xs uppercase text-text-tertiary">
                    <th className="pb-3 pr-4 font-medium">知识点</th>
                    <th className="pb-3 pr-4 font-medium">掌握率</th>
                    <th className="pb-3 pr-4 font-medium">得分 / 满分</th>
                    <th className="pb-3 pr-4 font-medium w-[200px]">进度</th>
                    <th className="pb-3 pr-4 font-medium">考试次数</th>
                    <th className="pb-3 font-medium">状态</th>
                  </tr>
                </thead>
                <motion.tbody
                  variants={stagger}
                  initial="hidden"
                  animate="show"
                  className="divide-y divide-surface-tertiary"
                >
                  {data.map((item) => {
                    const info = masteryInfo(item.mastery)
                    return (
                      <motion.tr
                        key={item.knowledgePointId}
                        variants={rowItem}
                        className="transition-colors hover:bg-accent-subtle/50 group"
                      >
                        <td className="py-3.5 pr-4 font-medium text-text-primary">
                          {item.knowledgePoint}
                        </td>
                        <td className="py-3.5 pr-4">
                          <span className="font-semibold tabular-nums text-text-primary">
                            {Math.round(item.mastery * 100)}%
                          </span>
                        </td>
                        <td className="py-3.5 pr-4 text-text-tertiary">
                          {Math.round(item.totalScore)} / {Math.round(item.totalFullScore)}
                        </td>
                        <td className="py-3.5 pr-4">
                          <Progress value={item.mastery * 100} size="sm" color={info.bar} />
                        </td>
                        <td className="py-3.5 pr-4 text-text-tertiary">
                          {item.examCount} 次
                        </td>
                        <td className="py-3.5">
                          <Badge variant={info.badge} size="sm">
                            {info.label}
                          </Badge>
                        </td>
                      </motion.tr>
                    )
                  })}
                </motion.tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </motion.div>
    </motion.div>
  )
}
