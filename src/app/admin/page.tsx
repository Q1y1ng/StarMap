'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Users, Shield, FileText, BarChart3, ThumbsUp, Activity } from 'lucide-react'
import { StatCard } from '@/components/ui-system/StatCard'
import { GlassCard } from '@/components/ui-system/GlassCard'
import { Spinner } from '@/components/ui-system/Spinner'
import { PageHeader } from '@/components/ui-system/PageHeader'

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
  },
}

type AdminStats = {
  totalUsers: number
  totalAdmins: number
  totalExams: number
  totalReports: number
  totalFeedback: number
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then((json) => {
        if (mounted && json.success) setStats(json.data)
      })
      .catch(console.error)
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Spinner size="lg" label="加载管理后台…" />
      </div>
    )
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
      <motion.div variants={fadeUp}>
        <PageHeader title="管理后台" subtitle="系统数据概览与用户管理" />
      </motion.div>

      <motion.div
        variants={fadeUp}
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5"
      >
        <StatCard
          label="用户总数"
          value={stats?.totalUsers ?? '—'}
          icon={<Users className="h-5 w-5" />}
          gradient="blue"
        />
        <StatCard
          label="管理员数"
          value={stats?.totalAdmins ?? '—'}
          icon={<Shield className="h-5 w-5" />}
          gradient="purple"
        />
        <StatCard
          label="考试总数"
          value={stats?.totalExams ?? '—'}
          icon={<FileText className="h-5 w-5" />}
          gradient="green"
        />
        <StatCard
          label="分析报告"
          value={stats?.totalReports ?? '—'}
          icon={<BarChart3 className="h-5 w-5" />}
          gradient="amber"
        />
        <StatCard
          label="用户反馈"
          value={stats?.totalFeedback ?? '—'}
          icon={<ThumbsUp className="h-5 w-5" />}
          gradient="red"
        />
      </motion.div>

      <motion.div variants={fadeUp}>
        <GlassCard gradient="none" className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">
            📋 快捷操作
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/admin/users"
              className="flex items-center gap-4 rounded-glass-sm bg-surface-secondary p-4 transition-colors hover:bg-accent-subtle"
            >
              <Users className="h-8 w-8 text-accent" />
              <div>
                <p className="font-medium text-text-primary">用户管理</p>
                <p className="text-sm text-text-tertiary">
                  查看和管理系统用户
                </p>
              </div>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-4 rounded-glass-sm bg-surface-secondary p-4 transition-colors hover:bg-accent-subtle"
            >
              <Activity className="h-8 w-8 text-accent" />
              <div>
                <p className="font-medium text-text-primary">系统仪表盘</p>
                <p className="text-sm text-text-tertiary">回到主系统</p>
              </div>
            </Link>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  )
}
