'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHeader, Button, GlassCard, Progress } from '@/components/ui-system'
import type { AnswerSheetEntry, AnswerSheetResult, AnswerSheetProgress } from '@/lib/answer-sheet/types'

// ── 类型 ──────────────────────────────────────────────────

type Step = 'select' | 'upload' | 'review' | 'saving' | 'done'

type ExamOption = {
  id: string
  title: string
  subject: string
  grade: string
  examDate: string
  questionCount: number
}

// ── 常量 ──────────────────────────────────────────────────

const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: 'select', label: '选择考试', icon: '📋' },
  { key: 'upload', label: '上传答题卡', icon: '📄' },
  { key: 'review', label: '确认成绩', icon: '✏️' },
  { key: 'done', label: '完成', icon: '✅' },
]

// ── 步骤指示器（模块级，避免每次渲染重新创建） ──

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

export default function UploadAnswerSheetClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedExamId = searchParams.get('examId')

  // ── 步骤 ──
  const [step, setStep] = useState<Step>(preselectedExamId ? 'upload' : 'select')

  // ── 考试列表 ──
  const [exams, setExams] = useState<ExamOption[]>([])
  const [selectedExamId, setSelectedExamId] = useState<string>(preselectedExamId ?? '')
  const [examsLoading, setExamsLoading] = useState(false)

  // ── 文件 ──
  const [file, setFile] = useState<File | null>(null)
  const [, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── OCR + 解析 ──
  const [progress, setProgress] = useState<AnswerSheetProgress | null>(null)
  const [, setOcrText] = useState('')
  const [parsed, setParsed] = useState<AnswerSheetResult | null>(null)
  const [entries, setEntries] = useState<AnswerSheetEntry[]>([])
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])

  // ── 保存 ──
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{
    count: number
    matchedCount: number
    unmatchedCount: number
  } | null>(null)

  // ── OCR 模式 ──
  const [ocrMode, setOcrMode] = useState<'LOCAL' | 'SMART' | 'HIGH_ACCURACY'>('LOCAL')
  const [doubaoApiKey, setDoubaoApiKey] = useState('')
  const [ocrEngine, setOcrEngine] = useState<string | null>(null)
  const [ocrQuality, setOcrQuality] = useState<number | null>(null)

  // ── 错误 ──
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

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

  // ── 文件处理 ──

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setProgress(null)
    setParsed(null)
    setEntries([])
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
    setProgress(null)
    setParsed(null)
    setEntries([])
    setError(null)
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f))
    } else {
      setPreview(null)
    }
  }

  // ── OCR ──

  async function handleOcr() {
    if (!file || !selectedExamId) return
    clearError()
    setOcrEngine(null)
    setOcrQuality(null)
    setProgress({ status: 'uploading', percent: 10, message: '上传中...' })
    setStep('upload')

    try {
      const fd = new FormData()
      fd.append('file', file, file.name)
      fd.append('mode', ocrMode)
      if (doubaoApiKey) fd.append('doubaoApiKey', doubaoApiKey)

      setProgress({ status: 'ocr', percent: 40, message: '正在识别...' })
      const res = await fetch('/api/answer-sheet/ocr', {
        method: 'POST',
        body: fd,
        signal: AbortSignal.timeout(180_000),
      })

      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? '识别失败')

      setOcrText(data.ocr?.text ?? '')
      setParsed(data.data)
      setEntries(data.data?.entries ?? [])
      setValidationWarnings(data.validation?.warnings ?? [])
      setOcrEngine(data.ocr?.engine ?? null)
      setOcrQuality(data.ocr?.quality ?? null)

      setProgress({ status: 'done', percent: 100, message: `识别完成，${data.data?.entryCount ?? 0} 题` })
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : '识别失败')
      setProgress({ status: 'error', percent: 0, message: '错误' })
    }
  }

  // ── 编辑条目 ──

  function updateEntry(questionNo: number, field: 'score' | 'fullScore', value: number) {
    setEntries((prev) =>
      prev.map((e) =>
        e.questionNo === questionNo ? { ...e, [field]: value } : e,
      ),
    )
  }

  // ── 保存 ──

  async function handleSave() {
    if (!selectedExamId || entries.length === 0) return
    clearError()
    setSaving(true)

    try {
      const res = await fetch('/api/answer-sheet/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId: selectedExamId, entries }),
        signal: AbortSignal.timeout(30_000),
      })

      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? '保存失败')

      setSaveResult(data.data)
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
    setParsed(null)
    setEntries([])
    setSaveResult(null)
    setError(null)
    setProgress(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  // ── 步骤指示器 ──

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  // ── 渲染 ──

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

      {/* 页面标题 */}
      <PageHeader
        title="📝 上传答题卡"
        subtitle="上传 → OCR 识别得分 → 匹配题目 → 自动分析掌握率"
        className="mb-6"
      />

      {/* 步骤指示器 */}
      <StepIndicator stepIndex={stepIndex} />

      {/* 错误 */}
      {error && (
        <div className="glass-card-static mb-6 flex items-start gap-2 p-4 text-sm text-danger">
          <span>❌</span>
          <div className="flex-1">{error}</div>
          <button onClick={clearError} className="text-danger/60 hover:text-danger">✕</button>
        </div>
      )}

      {/* ═══════════════════ STEP: Select Exam ═══════════════════ */}
      {step === 'select' && (
        <div className="space-y-6">
          <GlassCard hover={false} className="p-6">
            <h2 className="mb-4 text-sm font-semibold text-text-primary">📋 选择考试</h2>
            {examsLoading ? (
              <p className="py-4 text-center text-sm text-text-tertiary">加载中...</p>
            ) : exams.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm text-text-secondary">暂无已上传题目的考试。</p>
                <p className="mt-1 text-xs text-text-tertiary">请先上传试卷并解析题目。</p>
                <Button
                  onClick={() => router.push('/upload-paper')}
                  className="mt-4"
                >
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

      {/* ═══════════════════ STEP: Upload ═══════════════════ */}
      {step === 'upload' && (
        <div className="space-y-6">
          {/* 已选考试 */}
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

          {/* 上传区域 */}
          <section
            className="rounded-glass-sm border-2 border-dashed border-surface-tertiary bg-surface p-10 text-center transition hover:border-accent/50"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {!file ? (
              <div>
                <div className="mb-4 text-5xl text-text-tertiary">📄</div>
                <p className="mb-2 text-text-secondary">
                  拖拽答题卡图片到此处，或
                  <button
                    onClick={() => inputRef.current?.click()}
                    className="mx-1 font-semibold text-accent hover:text-accent-hover"
                  >
                    浏览文件
                  </button>
                </p>
                <p className="text-xs text-text-tertiary">支持 JPG / PNG / PDF，最大 20MB</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-glass-sm bg-surface-secondary p-4 text-left">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">
                    {file.type === 'application/pdf' ? '📕' : '🖼️'}
                  </span>
                  <div>
                    <p className="font-medium text-text-primary">{file.name}</p>
                    <p className="text-xs text-text-tertiary">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleOcr}
                    disabled={progress?.status === 'ocr'}
                    loading={progress?.status === 'ocr'}
                  >
                    {progress?.status === 'ocr' ? '识别中...' : '开始识别'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => { setFile(null); setPreview(null) }}
                  >
                    重新选择
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* OCR 模式选择 — 始终可见 */}
          {step === 'upload' && (
            <div className="rounded-glass-sm border border-surface-tertiary bg-surface p-4">
              <div className="mb-3 text-xs font-semibold text-text-primary">🔧 OCR 模式</div>
              <div className="flex flex-wrap gap-3">
                {[
                  { value: 'LOCAL', label: '本地OCR', desc: 'PaddleOCR 快速识别', icon: '⚡' },
                  { value: 'SMART', label: '智能模式', desc: '自动切换，推荐', icon: '🧠' },
                  { value: 'HIGH_ACCURACY', label: '大模型OCR', desc: 'Doubao 视觉高精度', icon: '🎯' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setOcrMode(opt.value as 'LOCAL' | 'SMART' | 'HIGH_ACCURACY')}
                    className={`flex flex-1 items-center gap-3 rounded-glass-sm border p-3 text-left transition ${
                      ocrMode === opt.value
                        ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                        : 'border-surface-tertiary bg-surface-secondary hover:border-accent/50'
                    }`}
                  >
                    <span className="text-xl">{opt.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{opt.label}</p>
                      <p className="text-xs text-text-tertiary">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 提示 */}
          <div className="rounded-glass-sm border border-accent/20 bg-accent/5 p-3 text-xs text-accent">
            💡 <strong>小提示：</strong>上传答题卡后，还可前往
            <button
              onClick={() => selectedExamId && router.push(`/upload-score-breakdown?examId=${selectedExamId}`)}
              className="mx-1 font-semibold underline hover:text-accent-hover"
            >
              上传小分截图
            </button>
            提高得分准确率（小分页面数据通常更精确）。
          </div>

          {/* 进度 */}
          {progress && (
            <Progress
              value={progress.percent}
              size="sm"
              color={progress.status === 'error' ? 'danger' : 'accent'}
              animated
            />
          )}
        </div>
      )}

      {/* ═══════════════════ STEP: Review ═══════════════════ */}
      {step === 'review' && (
        <div className="space-y-6">
          {/* 警告 */}
          {validationWarnings.length > 0 && (
            <div className="rounded-glass-sm border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
              {validationWarnings.map((w, i) => (
                <p key={i}>⚠️ {w}</p>
              ))}
            </div>
          )}

          {/* OCR 元数据 */}
          {(ocrEngine || ocrQuality !== null) && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${
                ocrEngine === 'DOUBAO' ? 'bg-purple-500/10 text-purple-500' : 'bg-emerald-500/10 text-emerald-500'
              }`}>
                ⚙️ {ocrEngine === 'DOUBAO' ? 'Doubao Vision' : ocrEngine === 'PADDLE' ? 'PaddleOCR' : ocrEngine}
              </span>
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${
                ocrMode === 'HIGH_ACCURACY' ? 'bg-purple-500/10 text-purple-500' : ocrMode === 'SMART' ? 'bg-accent/10 text-accent' : 'bg-emerald-500/10 text-emerald-500'
              }`}>
                🧠 {ocrMode === 'SMART' ? '智能模式' : ocrMode === 'LOCAL' ? '本地OCR' : '大模型OCR'}
              </span>
              {ocrQuality !== null && (
                <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${
                  ocrQuality >= 75 ? 'bg-success/10 text-success' : ocrQuality >= 50 ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger'
                }`}>
                  📊 质量 {ocrQuality}/100
                </span>
              )}
            </div>
          )}

          {/* 成绩编辑表 */}
          <GlassCard hover={false} className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-surface-tertiary px-5 py-3">
              <h2 className="text-sm font-semibold text-text-primary">
                ✏️ 答题卡成绩
                <span className="ml-2 text-xs font-normal text-text-tertiary">
                  — 可编辑修改
                </span>
              </h2>
              {parsed && (
                <span className="text-xs text-text-tertiary">
                  共 {parsed.entryCount} 题 · 总分 {parsed.totalScore}/{parsed.totalFullScore}
                </span>
              )}
            </div>

            {/* 表格 */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-tertiary bg-surface-secondary text-left text-xs font-medium text-text-tertiary">
                    <th className="px-5 py-3">题号</th>
                    <th className="px-4 py-3">得分</th>
                    <th className="px-4 py-3">满分</th>
                    <th className="px-4 py-3">得分率</th>
                    <th className="px-4 py-3">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-tertiary">
                  {entries.map((entry) => {
                    const rate = entry.fullScore > 0
                      ? ((entry.score / entry.fullScore) * 100).toFixed(0)
                      : '—'
                    const isCorrect = entry.fullScore > 0 && entry.score >= entry.fullScore
                    return (
                      <tr key={entry.questionNo} className="transition-colors hover:bg-accent-subtle/30">
                        <td className="px-5 py-3 font-medium text-text-primary">
                          第 {entry.questionNo} 题
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={entry.score}
                            onChange={(e) =>
                              updateEntry(entry.questionNo, 'score', Math.max(0, parseFloat(e.target.value) || 0))
                            }
                            className="w-20 rounded-glass-sm border border-surface-tertiary bg-surface px-2 py-1 text-center text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent/30"
                            min={0}
                            step={0.5}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-text-secondary">{entry.fullScore}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={parseInt(rate) >= 60 ? 'text-success' : 'text-warning'}>
                            {rate}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isCorrect ? (
                            <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">✓ 正确</span>
                          ) : (
                            <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">✗ 错误</span>
                          )}
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
              {entries.length > 0 && (
                <span className="text-xs text-text-tertiary">
                  总分：{entries.reduce((s, e) => s + e.score, 0)} / {entries.reduce((s, e) => s + e.fullScore, 0)}
                </span>
              )}
              <Button
                onClick={handleSave}
                disabled={saving || entries.length === 0}
                loading={saving}
              >
                {saving ? '保存中...' : '保存成绩 →'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ STEP: Done ═══════════════════ */}
      {step === 'done' && saveResult && (
        <div className="space-y-6">
          {/* 成功横幅 */}
          <div className="rounded-glass-sm border border-success/30 bg-success/5 p-6 text-center">
            <div className="mb-2 text-4xl">🎉</div>
            <h2 className="text-xl font-bold text-success">成绩已保存！</h2>
            <p className="mt-1 text-sm text-success/80">
              成功匹配 {saveResult.matchedCount} 道题目
              {saveResult.unmatchedCount > 0 && `（${saveResult.unmatchedCount} 道未匹配）`}
            </p>
          </div>

          {/* 成绩概览 */}
          <GlassCard hover={false} className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-text-primary">📊 成绩概览</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-glass-sm bg-surface-secondary p-3 text-center">
                <p className="text-xs text-text-tertiary">已匹配</p>
                <p className="text-xl font-bold text-text-primary">{saveResult.matchedCount}</p>
              </div>
              <div className="rounded-glass-sm bg-surface-secondary p-3 text-center">
                <p className="text-xs text-text-tertiary">未匹配</p>
                <p className="text-xl font-bold text-warning">{saveResult.unmatchedCount}</p>
              </div>
              <div className="rounded-glass-sm bg-surface-secondary p-3 text-center">
                <p className="text-xs text-text-tertiary">得分率趋势</p>
                <p className="text-xl font-bold text-text-primary">
                  {entries.length > 0
                    ? ((entries.reduce((s, e) => s + e.score, 0) / entries.reduce((s, e) => s + e.fullScore, 0)) * 100).toFixed(0) + '%'
                    : '—'}
                </p>
              </div>
              <div className="rounded-glass-sm bg-surface-secondary p-3 text-center">
                <p className="text-xs text-text-tertiary">题目总数</p>
                <p className="text-xl font-bold text-text-primary">{saveResult.count}</p>
              </div>
            </div>
          </GlassCard>

          {/* 操作按钮 */}
          <div className="flex items-center justify-center gap-4">
            <Button variant="secondary" onClick={resetAll}>
              继续上传
            </Button>
            <Button
              variant="secondary"
              onClick={() => selectedExamId && router.push(`/upload-score-breakdown?examId=${selectedExamId}`)}
            >
              📊 上传小分截图
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
