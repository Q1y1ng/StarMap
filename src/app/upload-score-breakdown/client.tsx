'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHeader, Button, GlassCard } from '@/components/ui-system'

// ── 类型 ──

type Step = 'select' | 'upload' | 'review' | 'saving' | 'done'

type ExamOption = {
  id: string
  title: string
  subject: string
  grade: string
  examDate: string
  questionCount: number
}

type ScoreItem = {
  questionNo: number
  fullScore: number
  score: number
  lostScore: number
}

type SaveResult = {
  count: number
  matchedCount: number
  unmatchedCount: number
}

// ── 常量 ──

const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: 'select', label: '选择考试', icon: '📋' },
  { key: 'upload', label: '上传小分截图', icon: '📄' },
  { key: 'review', label: '确认小分', icon: '✏️' },
  { key: 'done', label: '完成', icon: '✅' },
]

// ── 步骤指示器 ──

function StepIndicator({ stepIndex }: { stepIndex: number }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-0">
      {STEPS.map((s, i) => {
        const isActive = i === stepIndex
        const isPast = i < stepIndex
        return (
          <div key={s.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all ${
                  isPast
                    ? 'bg-success text-white'
                    : isActive
                      ? 'bg-accent text-white shadow-glass-elevated'
                      : 'bg-surface-tertiary text-text-tertiary'
                }`}
              >
                {isPast ? '✓' : s.icon}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium ${
                  isPast ? 'text-success' : isActive ? 'text-accent' : 'text-text-tertiary'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-2 mt-[-1.25rem] h-0.5 w-12 sm:w-20 ${
                  i < stepIndex ? 'bg-success' : 'bg-surface-tertiary'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════ 页面组件 ═══════════════════════

export default function UploadScoreBreakdownClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedExamId = searchParams.get('examId')

  const [step, setStep] = useState<Step>(preselectedExamId ? 'upload' : 'select')
  const [exams, setExams] = useState<ExamOption[]>([])
  const [selectedExamId, setSelectedExamId] = useState<string>(preselectedExamId ?? '')
  const [examsLoading, setExamsLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [items, setItems] = useState<ScoreItem[]>([])
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doubaoApiKey, setDoubaoApiKey] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const clearError = useCallback(() => setError(null), [])

  // ── 加载 Doubao API Key ──

  useEffect(() => {
    let mounted = true
    fetch('/api/auth/account/settings')
      .then((r) => r.json())
      .then((json) => {
        if (mounted && json.success && json.data.hasDoubaoApiKey) {
          setDoubaoApiKey(json.data.doubaoApiKey)
        }
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  // ── 加载考试列表 ──

  useEffect(() => {
    let mounted = true
    const doLoad = async () => {
      if (!(step === 'select' || preselectedExamId)) return
      setExamsLoading(true)
      try {
        const res = await fetch('/api/exams')
        const json = await res.json()
        if (mounted && json.success) {
          const examOpts: ExamOption[] = (json.data ?? []).map((e: Record<string, unknown>) => ({
            id: e.id as string,
            title: e.title as string,
            subject: e.subject as string,
            grade: e.grade as string,
            examDate: e.examDate as string,
            questionCount: (e._count as { questions?: number })?.questions ?? 0,
          }))
          setExams(examOpts)
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setExamsLoading(false)
      }
    }
    doLoad()
    return () => { mounted = false }
  }, [step, preselectedExamId])

  // ── 文件处理 ──

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setItems([])
    setError(null)
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f))
    } else {
      setPreview(null)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    setFile(f)
    setItems([])
    setError(null)
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f))
    } else {
      setPreview(null)
    }
  }

  // ── OCR 识别 ──

  async function handleOcr() {
    if (!file || !selectedExamId) return
    clearError()
    setOcrLoading(true)

    try {
      const fd = new FormData()
      fd.append('file', file, file.name)
      if (doubaoApiKey) fd.append('doubaoApiKey', doubaoApiKey)

      const res = await fetch('/api/score-breakdown/ocr', {
        method: 'POST',
        body: fd,
        signal: AbortSignal.timeout(180_000),
      })

      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error ?? '识别失败')
      }

      setItems(json.data.items)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : '识别失败')
    } finally {
      setOcrLoading(false)
    }
  }

  // ── 编辑 ──

  function updateItem(questionNo: number, field: 'score' | 'fullScore', value: number) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.questionNo !== questionNo) return item
        const updated = { ...item, [field]: value }
        updated.lostScore = Math.max(0, updated.fullScore - updated.score)
        return updated
      }),
    )
  }

  // ── 保存 ──

  async function handleSave() {
    if (!selectedExamId || items.length === 0) return
    clearError()
    setSaving(true)

    try {
      const res = await fetch('/api/score-breakdown/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId: selectedExamId, items }),
        signal: AbortSignal.timeout(30_000),
      })

      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? '保存失败')

      setSaveResult(json.data)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  // ── 导航 ──

  function viewExam() {
    if (selectedExamId) {
      router.push(`/exams/${selectedExamId}`)
    }
  }

  function resetAll() {
    setStep(preselectedExamId ? 'upload' : 'select')
    setFile(null)
    setPreview(null)
    setItems([])
    setSaveResult(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step)
  const totalScore = items.reduce((s, i) => s + i.score, 0)
  const totalFullScore = items.reduce((s, i) => s + i.fullScore, 0)

  return (
    <div className="mx-auto max-w-4xl">
      {/* ── 已弃用引导（Phase 15） ── */}
      <a
        href="/upload-exam"
        className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 transition-colors hover:bg-amber-500/20"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold">⚠️</span>
        <span className="flex-1">此页面已弃用。请使用新的统一上传页面，支持混合上传图片/PDF →</span>
        <span className="text-xs text-amber-400/60">/upload-exam</span>
      </a>

      <PageHeader
        title="📊 上传小分截图"
        subtitle="上传成绩平台截图 → 自动识别题号/满分/得分/扣分 → 更新考试分析"
        className="mb-6"
      />

      <StepIndicator stepIndex={stepIndex} />

      {error && (
        <div className="glass-card-static mb-6 flex items-start gap-2 p-4 text-sm text-danger">
          <span>❌</span>
          <div className="flex-1">{error}</div>
          <button onClick={clearError} className="text-danger/60 hover:text-danger">✕</button>
        </div>
      )}

      {/* ═══════════ STEP: Select Exam ═══════════ */}
      {step === 'select' && (
        <div className="space-y-6">
          <GlassCard hover={false} className="p-6">
            <h2 className="mb-4 text-sm font-semibold text-text-primary">📋 选择考试</h2>
            {examsLoading ? (
              <p className="py-4 text-center text-sm text-text-tertiary">加载中...</p>
            ) : exams.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm text-text-secondary">暂无已上传题目的考试。</p>
                <Button onClick={() => router.push('/upload-paper')} className="mt-4">
                  去上传试卷
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {exams
                  .filter((e) => e.questionCount > 0)
                  .map((exam) => (
                    <button
                      key={exam.id}
                      onClick={() => { setSelectedExamId(exam.id); setStep('upload') }}
                      className="glass-card-static flex w-full items-center gap-4 p-4 text-left transition hover:shadow-glass-floating hover:brightness-95 dark:hover:brightness-110"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-glass-sm bg-surface-secondary text-lg">
                        📄
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-text-primary">{exam.title}</p>
                        <p className="text-xs text-text-tertiary">
                          {exam.subject} · {exam.grade} · {exam.questionCount} 题
                        </p>
                      </div>
                      <span className="text-sm text-accent">选择 →</span>
                    </button>
                  ))}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* ═══════════ STEP: Upload ═══════════ */}
      {step === 'upload' && (
        <div className="space-y-6">
          {selectedExamId && (
            <GlassCard hover={false} className="p-4">
              <div className="flex items-center gap-3">
                <span className="text-lg">📋</span>
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {exams.find((e) => e.id === selectedExamId)?.title ?? '已选考试'}
                  </p>
                  <button
                    onClick={() => { setSelectedExamId(''); setStep('select') }}
                    className="text-xs text-accent hover:underline"
                  >
                    更换考试
                  </button>
                </div>
              </div>
            </GlassCard>
          )}

          <section
            className="rounded-glass-sm border-2 border-dashed border-surface-tertiary bg-surface p-10 text-center transition hover:border-accent/50"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {!file ? (
              <div>
                <div className="mb-4 text-5xl text-text-tertiary">📊</div>
                <p className="mb-2 text-text-secondary">
                  拖拽成绩平台截图到此处，或
                  <button
                    onClick={() => inputRef.current?.click()}
                    className="mx-1 font-semibold text-accent hover:text-accent-hover"
                  >
                    浏览文件
                  </button>
                </p>
                <p className="text-xs text-text-tertiary">支持 JPG / PNG，最大 20MB</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-glass-sm bg-surface-secondary p-4 text-left">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">🖼️</span>
                  <div>
                    <p className="font-medium text-text-primary">{file.name}</p>
                    <p className="text-xs text-text-tertiary">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleOcr} disabled={ocrLoading} loading={ocrLoading}>
                    {ocrLoading ? '识别中...' : '开始识别'}
                  </Button>
                  <Button variant="secondary" onClick={() => { setFile(null); setPreview(null) }}>
                    重新选择
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* OCR 引擎信息 */}
          {step === 'upload' && (
            <div className="rounded-glass-sm border border-purple-500/20 bg-purple-500/5 p-3 text-xs text-purple-500 flex items-center gap-2">
              <span>🎯</span>
              <span>
                <strong>大模型OCR</strong> — 使用 Doubao Vision 视觉模型识别小分数据，需在
                <button
                  onClick={() => router.push('/settings')}
                  className="mx-1 font-semibold underline hover:text-purple-400"
                >
                  设置页
                </button>
                配置 Doubao API Key
              </span>
            </div>
          )}

          {preview && (
            <div className="overflow-hidden rounded-glass-sm border border-surface-tertiary">
              <img
                src={preview}
                alt="小分截图预览"
                className="max-h-96 w-full object-contain bg-surface-secondary"
              />
            </div>
          )}
        </div>
      )}

      {/* ═══════════ STEP: Review ═══════════ */}
      {step === 'review' && (
        <div className="space-y-6">
          {/* 数据摘要 */}
          {items.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-glass-sm bg-surface-secondary p-3 text-center">
                <p className="text-xs text-text-tertiary">识别题目</p>
                <p className="text-xl font-bold text-text-primary">{items.length}</p>
              </div>
              <div className="rounded-glass-sm bg-surface-secondary p-3 text-center">
                <p className="text-xs text-text-tertiary">总分</p>
                <p className="text-xl font-bold text-text-primary">
                  {totalScore} <span className="text-sm font-normal text-text-tertiary">/ {totalFullScore}</span>
                </p>
              </div>
              <div className="rounded-glass-sm bg-surface-secondary p-3 text-center">
                <p className="text-xs text-text-tertiary">平均得分率</p>
                <p className={`text-xl font-bold ${totalFullScore > 0 && totalScore / totalFullScore >= 0.6 ? 'text-success' : 'text-warning'}`}>
                  {totalFullScore > 0 ? ((totalScore / totalFullScore) * 100).toFixed(0) + '%' : '—'}
                </p>
              </div>
            </div>
          )}

          {/* 小分表格 */}
          <GlassCard hover={false} className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-surface-tertiary px-5 py-3">
              <h2 className="text-sm font-semibold text-text-primary">
                ✏️ 小分数据
                <span className="ml-2 text-xs font-normal text-text-tertiary">— 可编辑修改</span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-tertiary bg-surface-secondary text-left text-xs font-medium text-text-tertiary">
                    <th className="px-5 py-3">题号</th>
                    <th className="px-4 py-3">得分</th>
                    <th className="px-4 py-3">满分</th>
                    <th className="px-4 py-3">扣分</th>
                    <th className="px-4 py-3">得分率</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-tertiary">
                  {items.map((item) => {
                    const rate = item.fullScore > 0
                      ? ((item.score / item.fullScore) * 100).toFixed(0)
                      : '—'
                    return (
                      <tr key={item.questionNo} className="transition-colors hover:bg-accent-subtle/30">
                        <td className="px-5 py-3 font-medium text-text-primary">
                          第 {item.questionNo} 题
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={item.score}
                            onChange={(e) =>
                              updateItem(item.questionNo, 'score', Math.max(0, parseFloat(e.target.value) || 0))
                            }
                            className="w-20 rounded-glass-sm border border-surface-tertiary bg-surface px-2 py-1 text-center text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent/30"
                            min={0}
                            step={0.5}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={item.fullScore}
                            onChange={(e) =>
                              updateItem(item.questionNo, 'fullScore', Math.max(0, parseFloat(e.target.value) || 0))
                            }
                            className="w-20 rounded-glass-sm border border-surface-tertiary bg-surface px-2 py-1 text-center text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent/30"
                            min={0}
                            step={0.5}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className={item.lostScore > 0 ? 'text-danger' : 'text-success'}>
                            {item.lostScore.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={parseInt(rate) >= 60 ? 'text-success' : 'text-warning'}>
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* 操作按钮 */}
          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={() => setStep('upload')}>
              ← 返回重传
            </Button>
            <div className="flex items-center gap-3">
              {items.length > 0 && (
                <span className="text-xs text-text-tertiary">
                  总分：{totalScore} / {totalFullScore}
                </span>
              )}
              <Button onClick={handleSave} disabled={saving || items.length === 0} loading={saving}>
                {saving ? '保存中...' : '保存小分 →'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ STEP: Done ═══════════ */}
      {step === 'done' && saveResult && (
        <div className="space-y-6">
          <div className="rounded-glass-sm border border-success/30 bg-success/5 p-6 text-center">
            <div className="mb-2 text-4xl">🎉</div>
            <h2 className="text-xl font-bold text-success">小分已保存！</h2>
            <p className="mt-1 text-sm text-success/80">
              成功匹配 {saveResult.matchedCount} 道题目
              {saveResult.unmatchedCount > 0 && `（${saveResult.unmatchedCount} 道未匹配）`}
            </p>
          </div>

          <GlassCard hover={false} className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-text-primary">📊 保存结果概览</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-glass-sm bg-surface-secondary p-3 text-center">
                <p className="text-xs text-text-tertiary">识别条目</p>
                <p className="text-xl font-bold text-text-primary">{saveResult.count}</p>
              </div>
              <div className="rounded-glass-sm bg-surface-secondary p-3 text-center">
                <p className="text-xs text-text-tertiary">已匹配</p>
                <p className="text-xl font-bold text-text-primary">{saveResult.matchedCount}</p>
              </div>
              <div className="rounded-glass-sm bg-surface-secondary p-3 text-center">
                <p className="text-xs text-text-tertiary">未匹配</p>
                <p className="text-xl font-bold text-warning">{saveResult.unmatchedCount}</p>
              </div>
              <div className="rounded-glass-sm bg-surface-secondary p-3 text-center">
                <p className="text-xs text-text-tertiary">总分</p>
                <p className="text-xl font-bold text-text-primary">
                  {totalScore} / {totalFullScore}
                </p>
              </div>
            </div>
          </GlassCard>

          <div className="flex items-center justify-center gap-4">
            <Button variant="secondary" onClick={resetAll}>
              继续上传
            </Button>
            <Button onClick={viewExam}>
              查看详情 →
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
