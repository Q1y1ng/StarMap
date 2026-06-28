'use client'

import { useState, useEffect } from 'react'
import { Spinner } from '@/components/ui-system/Spinner'

// ── 类型 ──

type FeedbackData = {
  id: string
  reportId: string
  accurate: boolean
  helpful: boolean
  comment: string | null
  createdAt: string
}

type Props = {
  reportId: string
}

// ── 评价按钮 ──

function ThumbButton({
  active,
  direction,
  onClick,
}: {
  active: boolean
  direction: 'up' | 'down'
  onClick: () => void
}) {
  const isUp = direction === 'up'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-glass-sm border px-4 py-2 text-sm font-medium transition ${
        active
          ? isUp
            ? 'border-success/30 bg-success/10 text-success'
            : 'border-danger/30 bg-danger/10 text-danger'
          : 'border-glass-border bg-surface text-text-secondary hover:border-surface-tertiary hover:text-text-primary'
      }`}
    >
      {isUp ? '👍' : '👎'}
      <span>{isUp ? '准确' : '不准确'}</span>
    </button>
  )
}

function HelpfulButton({
  active,
  direction,
  onClick,
}: {
  active: boolean
  direction: 'up' | 'down'
  onClick: () => void
}) {
  const isUp = direction === 'up'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-glass-sm border px-4 py-2 text-sm font-medium transition ${
        active
          ? isUp
            ? 'border-success/30 bg-success/10 text-success'
            : 'border-danger/30 bg-danger/10 text-danger'
          : 'border-glass-border bg-surface text-text-secondary hover:border-surface-tertiary hover:text-text-primary'
      }`}
    >
      {isUp ? '👍' : '👎'}
      <span>{isUp ? '有帮助' : '没有帮助'}</span>
    </button>
  )
}

// ═══════════════════ 主组件 ═══════════════════

export default function AnalysisFeedback({ reportId }: Props) {
  const [feedback, setFeedback] = useState<FeedbackData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // 表单状态
  const [accurate, setAccurate] = useState<boolean | null>(null)
  const [helpful, setHelpful] = useState<boolean | null>(null)
  const [comment, setComment] = useState('')

  // ── 加载已有反馈 ──
  useEffect(() => {
    let mounted = true
    // loading is already initialized to true; setState only in callbacks
    fetch(`/api/analysis-feedback?reportId=${reportId}`)
      .then(res => res.json())
      .then(json => {
        if (!mounted) return
        if (json.success && json.data) {
          setFeedback(json.data)
          setAccurate(json.data.accurate)
          setHelpful(json.data.helpful)
          setComment(json.data.comment ?? '')
          setSubmitted(true)
        }
        setLoading(false)
      })
      .catch(err => { console.error('[feedback] 加载失败:', err); if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [reportId])

  // ── 提交反馈 ──
  const handleSubmit = async () => {
    if (accurate === null || helpful === null) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/analysis-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, accurate, helpful, comment: comment || undefined }),
      })
      const json = await res.json()
      if (json.success) {
        setSubmitted(true)
        setFeedback(json.data)
      }
    } catch (err) {
      console.error('[feedback] 提交失败:', err)
    } finally {
      setSubmitting(false)
    }
  }

  // ── 重新编辑 ──
  const handleEdit = () => {
    setSubmitted(false)
  }

  return (
    <section className="rounded-glass-sm border bg-surface p-6 shadow-glass">
      <h2 className="mb-4 text-lg font-semibold text-text-primary">💬 分析评价</h2>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-text-tertiary">
          <Spinner size="sm" />
          <span className="ml-2">加载评价…</span>
        </div>
      ) : submitted && feedback ? (
        /* ── 已提交：显示结果 ── */
        <div className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-text-secondary">分析准确度：</span>
              <span className={`font-medium ${feedback.accurate ? 'text-success' : 'text-danger'}`}>
                {feedback.accurate ? '👍 准确' : '👎 不准确'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-text-secondary">建议帮助度：</span>
              <span className={`font-medium ${feedback.helpful ? 'text-success' : 'text-danger'}`}>
                {feedback.helpful ? '👍 有帮助' : '👎 没有帮助'}
              </span>
            </div>
            {feedback.comment && (
              <div className="w-full rounded-glass-sm bg-surface-secondary p-3 text-sm text-text-secondary">
                💬 {feedback.comment}
              </div>
            )}
          </div>
          <p className="text-xs text-text-tertiary">
            已收到您的反馈
            {new Date(feedback.createdAt).toLocaleString('zh-CN')} ·
            <button onClick={handleEdit} className="ml-1 text-accent underline hover:no-underline">
              重新评价
            </button>
          </p>
        </div>
      ) : (
        /* ── 评价表单 ── */
        <div className="space-y-5">
          {/* Q1: 分析是否准确 */}
          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">1. 这份分析是否准确？</p>
            <div className="flex gap-3">
              <ThumbButton
                direction="up"
                active={accurate === true}
                onClick={() => setAccurate(true)}
              />
              <ThumbButton
                direction="down"
                active={accurate === false}
                onClick={() => setAccurate(false)}
              />
            </div>
          </div>

          {/* Q2: 学习建议是否有帮助 */}
          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">2. 学习建议是否有帮助？</p>
            <div className="flex gap-3">
              <HelpfulButton
                direction="up"
                active={helpful === true}
                onClick={() => setHelpful(true)}
              />
              <HelpfulButton
                direction="down"
                active={helpful === false}
                onClick={() => setHelpful(false)}
              />
            </div>
          </div>

          {/* Q3: 其他反馈 */}
          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">3. 其他反馈（可选）</p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="请描述您的想法，帮助我们改进分析质量…"
              rows={3}
              className="w-full resize-none rounded-glass-sm border border-glass-border p-3 text-sm text-text-primary placeholder-text-tertiary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* 提交按钮 */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={accurate === null || helpful === null || submitting}
              className="rounded-glass-sm bg-accent px-6 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
            >
              {submitting ? '提交中…' : '提交评价'}
            </button>
            {accurate === null || helpful === null ? (
              <span className="text-xs text-text-tertiary">请先回答第 1、2 题</span>
            ) : null}
          </div>
        </div>
      )}
    </section>
  )
}
