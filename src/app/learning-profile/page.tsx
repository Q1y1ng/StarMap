'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { GlassCard } from '@/components/ui-system/GlassCard'
import { Button } from '@/components/ui-system/Button'
import { Progress } from '@/components/ui-system/Progress'
import { Spinner } from '@/components/ui-system/Spinner'
import { Badge } from '@/components/ui-system/Badge'
import { PageHeader } from '@/components/ui-system/PageHeader'
import { Tabs } from '@/components/ui-system/Tabs'

// ── Types ──

type ProfileKnowledgeItem = { name: string; mastery: number }
type ProfileTrendItem = { name: string; delta: number }

type LearningProfileData = {
  subject: string
  strongPoints: ProfileKnowledgeItem[]
  weakPoints: ProfileKnowledgeItem[]
  improvingPoints: ProfileTrendItem[]
  decliningPoints: ProfileTrendItem[]
  generatedAt: string
}

const SUBJECT_TABS = [
  { key: '数学', label: '📐 数学' },
  { key: '物理', label: '⚡ 物理' },
  { key: '化学', label: '🧪 化学' },
  { key: '语文', label: '📖 语文' },
  { key: '英语', label: '🔤 英语' },
  { key: '地理', label: '🌍 地理' },
]

// ── Animation ──

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 } as const,
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
}

const listItem = {
  hidden: { opacity: 0, x: -8 } as const,
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const } },
}

// ── Card With Items ──

function ProfileCard<T>({
  title,
  emoji,
  gradient,
  items,
  renderItem,
  emptyText,
}: {
  title: string
  emoji: string
  gradient: 'blue' | 'green' | 'red' | 'amber' | 'purple'
  items: T[]
  renderItem: (item: T, i: number) => React.ReactNode
  emptyText: string
}) {
  return (
    <motion.div variants={fadeUp}>
      <GlassCard gradient={gradient} className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          <Badge size="sm" variant={gradient === 'green' ? 'success' : gradient === 'red' ? 'danger' : gradient === 'amber' ? 'warning' : 'accent'}>
            {items.length} 项
          </Badge>
        </div>
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-tertiary">{emptyText}</p>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
            {items.map((item, i) => (
              <motion.div key={i} variants={listItem}>
                {renderItem(item, i)}
              </motion.div>
            ))}
          </motion.div>
        )}
      </GlassCard>
    </motion.div>
  )
}

// ═══════════════════ Page ═══════════════════

export default function LearningProfilePage() {
  const [subject, setSubject] = useState('数学')
  const [profile, setProfile] = useState<LearningProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const loadProfile = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/learning-profile?subject=${encodeURIComponent(subject)}`)
        const json = await res.json()
        if (mounted) {
          if (json.success) {
            setProfile(json.data)
          } else {
            if (res.status === 404) setProfile(null)
            else setError(json.error)
          }
        }
      } catch {
        if (mounted) setError('加载失败')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadProfile()
    return () => { mounted = false }
  }, [subject])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/learning-profile/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject }),
      })
      const json = await res.json()
      if (json.success) setProfile(json.data)
      else setError(json.error)
    } catch {
      setError('刷新失败')
    } finally {
      setRefreshing(false)
    }
  }, [subject])

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
      {/* ── Header ── */}
      <motion.div variants={fadeUp}>
        <PageHeader
          title="🎯 学习档案"
          subtitle="基于历史考试数据，自动分析知识点掌握情况与成长趋势"
          actions={
            <Button
              variant="primary"
              size="md"
              loading={refreshing}
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={handleRefresh}
            >
              {refreshing ? '刷新中…' : '刷新分析'}
            </Button>
          }
        />
      </motion.div>

      {/* ── Subject Tabs ── */}
      <motion.div variants={fadeUp}>
        <Tabs tabs={SUBJECT_TABS} activeKey={subject} onChange={setSubject} variant="pill" />
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
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" label="加载学习档案…" />
        </div>
      ) : profile === null ? (
        /* ── Not Generated ── */
        <motion.div variants={fadeUp}>
          <GlassCard gradient="amber" className="p-8 text-center">
            <p className="text-lg font-medium text-text-primary">📊 「{subject}」的学习档案尚未生成</p>
            <p className="mt-2 text-sm text-text-secondary">
              请先上传答题卡并保存成绩，然后点击「刷新分析」按钮生成学习档案。
            </p>
            <Button
              variant="primary"
              size="md"
              className="mt-5"
              loading={refreshing}
              onClick={handleRefresh}
            >
              {refreshing ? '生成中…' : '立即生成'}
            </Button>
          </GlassCard>
        </motion.div>
      ) : (
        <>
          {/* ── Last Updated ── */}
          <motion.div variants={fadeUp} className="text-xs text-text-tertiary">
            最近更新：{new Date(profile.generatedAt).toLocaleString('zh-CN')}
          </motion.div>

          {/* ── 4 Cards Grid ── */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* 🟢 Strong */}
            <ProfileCard
              title="优势知识点"
              emoji="🟢"
              gradient="green"
              items={profile.strongPoints}
              emptyText="暂无数据"
              renderItem={(item: ProfileKnowledgeItem) => (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-text-primary">{item.name}</span>
                    <span className="text-sm font-semibold text-success">
                      {Math.round(item.mastery * 100)}%
                    </span>
                  </div>
                  <Progress value={item.mastery * 100} size="sm" color="success" />
                </div>
              )}
            />

            {/* 🔴 Weak */}
            <ProfileCard
              title="薄弱知识点"
              emoji="🔴"
              gradient="red"
              items={profile.weakPoints}
              emptyText="暂无数据"
              renderItem={(item: ProfileKnowledgeItem) => (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-text-primary">{item.name}</span>
                    <span className="text-sm font-semibold text-danger">
                      {Math.round(item.mastery * 100)}%
                    </span>
                  </div>
                  <Progress value={item.mastery * 100} size="sm" color="danger" />
                </div>
              )}
            />

            {/* 📈 Improving */}
            <ProfileCard
              title="进步最快"
              emoji="📈"
              gradient="blue"
              items={profile.improvingPoints}
              emptyText="没有检测到明显进步的知识点"
              renderItem={(item: ProfileTrendItem) => (
                <div className="flex items-center justify-between rounded-glass-sm bg-accent-subtle px-4 py-3">
                  <span className="text-sm font-medium text-text-primary">{item.name}</span>
                  <Badge variant="success" size="sm">
                    +{Math.round(item.delta * 100)}%
                  </Badge>
                </div>
              )}
            />

            {/* 📉 Declining */}
            <ProfileCard
              title="需关注"
              emoji="📉"
              gradient="amber"
              items={profile.decliningPoints}
              emptyText="没有检测到明显退步的知识点"
              renderItem={(item: ProfileTrendItem) => (
                <div className="flex items-center justify-between rounded-glass-sm bg-warning/10 px-4 py-3">
                  <span className="text-sm font-medium text-text-primary">{item.name}</span>
                  <Badge variant="warning" size="sm">
                    {Math.round(item.delta * 100)}%
                  </Badge>
                </div>
              )}
            />
          </div>
        </>
      )}
    </motion.div>
  )
}
