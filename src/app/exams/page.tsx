'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/ui-system/GlassCard'
import { Button } from '@/components/ui-system/Button'
import { Badge } from '@/components/ui-system/Badge'
import { Spinner } from '@/components/ui-system/Spinner'
import { PageHeader } from '@/components/ui-system/PageHeader'
import { Dialog } from '@/components/ui-system/Dialog'
import { Input } from '@/components/ui-system/Input'

// ── Types ──

type ExamItem = {
  id: string
  title: string
  subject: string
  grade: string
  examDate: string
  totalScore: number
  aiStatus: string
  createdAt: string
  _count: { analysisReports: number }
  examSession?: { id: string; name: string } | null
}

// const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']

function subjectEmoji(s: string): string {
  const map: Record<string, string> = {
    '语文': '📖', '数学': '📐', '英语': '🔤', '物理': '⚡',
    '化学': '🧪', '生物': '🧬', '历史': '📜', '地理': '🌍', '政治': '⚖️',
  }
  return map[s] ?? '📝'
}

function statusConfig(status: string): { variant: 'success' | 'warning' | 'danger' | 'default'; label: string } {
  const map: Record<string, { variant: 'success' | 'warning' | 'danger' | 'default'; label: string }> = {
    COMPLETED: { variant: 'success', label: '已完成' },
    PROCESSING: { variant: 'warning', label: '分析中' },
    PENDING: { variant: 'default', label: '待分析' },
    FAILED: { variant: 'danger', label: '失败' },
  }
  return map[status] ?? { variant: 'default', label: status }
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

export default function ExamsPage() {
  const [exams, setExams] = useState<ExamItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCounter, setRetryCounter] = useState(0)
  const [renameTarget, setRenameTarget] = useState<ExamItem | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    fetch('/api/exams')
      .then(res => res.json())
      .then(json => {
        if (!mounted) return
        if (json.success) setExams(json.data)
        else setError(json.error ?? '加载失败')
      })
      .catch(() => { if (mounted) setError('网络错误，请检查连接') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [retryCounter])

  const handleDelete = useCallback(async (id: string, title: string) => {
    if (!confirm(`确定删除「${title}」吗？此操作不可撤销。`)) return
    try {
      const res = await fetch(`/api/exams/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        setExams((prev) => prev.filter((e) => e.id !== id))
        toast.success('考试已删除')
      } else toast.error(json.error ?? '删除失败')
    } catch {
      toast.error('删除失败，请重试')
    }
  }, [])

  const handleRenameOpen = useCallback((exam: ExamItem) => {
    setRenameTarget(exam)
    setRenameDraft(exam.title)
    setRenameError(null)
    setRenameSaving(false)
  }, [])

  const handleRenameSave = useCallback(async () => {
    if (!renameTarget) return
    const trimmed = renameDraft.trim()
    if (!trimmed) { setRenameError('名称不能为空'); return }
    if (trimmed.length > 128) { setRenameError('名称不能超过128个字符'); return }

    setRenameSaving(true)
    setRenameError(null)
    try {
      const res = await fetch(`/api/exams/${renameTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      })
      const json = await res.json()
      if (json.success) {
        setExams((prev) => prev.map((e) => e.id === renameTarget.id ? { ...e, title: trimmed } : e))
        setRenameTarget(null)
      } else {
        setRenameError(json.error ?? '保存失败')
      }
    } catch {
      setRenameError('网络错误，请重试')
    } finally {
      setRenameSaving(false)
    }
  }, [renameTarget, renameDraft])

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
      {/* ── Header ── */}
      <motion.div variants={fadeUp}>
        <PageHeader
          title="考试记录"
          subtitle="所有单科试卷列表 · 支持搜索、筛选、删除、重新分析"
          actions={
            <Link href="/exam-sessions">
              <Button variant="primary" size="md" icon={<Plus className="h-4 w-4" />}>
                考试分类
              </Button>
            </Link>
          }
        />
      </motion.div>

      {/* ── Error ── */}
      {error && (
        <motion.div variants={fadeUp}>
          <div className="rounded-glass-sm border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setRetryCounter(c => c + 1)} className="underline hover:no-underline">
                重试
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" label="加载中…" />
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && exams.length === 0 && (
        <motion.div variants={fadeUp}>
          <GlassCard gradient="none" className="p-12 text-center">
            <p className="text-lg text-text-secondary">暂无考试记录</p>
            <p className="mt-1 text-sm text-text-tertiary">
              在
              <Link href="/analysis-test" className="mx-1 text-accent hover:underline">
                分析测试页
              </Link>
              完成分析后保存即可显示。
            </p>
          </GlassCard>
        </motion.div>
      )}

      {/* ── List ── */}
      {exams.length > 0 && (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
          {exams.map((exam) => {
            const status = statusConfig(exam.aiStatus)
            return (
              <motion.div key={exam.id} variants={fadeUp}>
                <GlassCard hover className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Emoji */}
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-glass-sm bg-accent-subtle text-xl">
                      {subjectEmoji(exam.subject)}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/exams/${exam.id}`}
                        className="text-base font-semibold text-text-primary transition-colors hover:text-accent"
                      >
                        {exam.title}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
                        <span>{exam.subject}</span>
                        <span>·</span>
                        <span>{exam.grade}</span>
                        <span>·</span>
                        <span>满分 {exam.totalScore}</span>
                        <span>·</span>
                        <span>{new Date(exam.examDate).toLocaleDateString('zh-CN')}</span>
                        <span>·</span>
                        <span>{exam._count.analysisReports} 份报告</span>
                        {exam.examSession && (
                          <>
                            <span>·</span>
                            <Link
                              href={`/exam-sessions/${exam.examSession.id}`}
                              className="text-accent hover:underline"
                            >
                              {exam.examSession.name}
                            </Link>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Status + Actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant={status.variant} size="sm">
                        {status.label}
                      </Badge>
                      <button
                        onClick={() => handleRenameOpen(exam)}
                        className="rounded-full p-1.5 text-text-tertiary transition-colors hover:bg-accent-subtle hover:text-accent"
                        title="重命名"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(exam.id, exam.title)}
                        className="rounded-full p-1.5 text-text-tertiary transition-colors hover:bg-danger/10 hover:text-danger"
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* ── Rename Dialog ── */}
      <Dialog open={!!renameTarget} onClose={() => setRenameTarget(null)} title="修改考试名称">
        <div className="space-y-4">
          <Input
            label="考试名称"
            value={renameDraft}
            onChange={(e) => { setRenameDraft(e.target.value); setRenameError(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSave() }}
            error={renameError ?? undefined}
            autoFocus
            placeholder="输入考试名称"
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" size="md" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button variant="primary" size="md" onClick={handleRenameSave} disabled={renameSaving}>
              {renameSaving ? '保存中…' : '保存'}
            </Button>
          </div>
        </div>
      </Dialog>
    </motion.div>
  )
}
