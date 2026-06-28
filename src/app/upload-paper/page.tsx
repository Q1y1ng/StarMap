'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader, Button, GlassCard, Spinner, Progress } from '@/components/ui-system'
import type { QuestionParseResult } from '@/lib/questions/types'

// ── 类型 ──────────────────────────────────────────────────

type Step = 'upload' | 'review' | 'analyzing' | 'done'
type Grade = '高一' | '高二' | '高三'

type AnalysisResult = {
  subject: string
  summary: string
  knowledgePoints: { name: string; score: string; total: string; mastery: string }[]
  weaknesses: { name: string; scoreRate: number; diagnosis: string }[]
  strengths: { name: string; scoreRate: number; comment: string }[]
  studySuggestions: { priority: number; content: string; type: string }[]
}

type OcrMeta = {
  engine: string
  quality: number
  qualityReason: string
  durationMs: number
}

type SaveResponse = {
  success: boolean
  data?: { examId: string }
  error?: string
}

// ── 常量 ──────────────────────────────────────────────────

const GRADES: Grade[] = ['高一', '高二', '高三']

const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: 'upload', label: '上传文件', icon: '📄' },
  { key: 'review', label: '确认文本', icon: '✏️' },
  { key: 'analyzing', label: 'AI 分析', icon: '🤖' },
  { key: 'done', label: '完成', icon: '✅' },
]

const SUBJECT_EMOJI: Record<string, string> = {
  '语文': '📖', '数学': '📐', '英语': '🔤',
  '物理': '⚡', '化学': '🧪', '生物': '🧬',
  '历史': '📜', '地理': '🌍', '政治': '⚖️',
}

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
                  isPast
                    ? 'text-success'
                    : isActive
                      ? 'text-accent'
                      : 'text-text-tertiary'
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

// ── 工具函数 ──────────────────────────────────────────────

function suggestTitle(text: string): string {
  const lines = text.split('\n').filter((l) => l.trim())
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length >= 4 && /[一-鿿]/.test(trimmed)) {
      return trimmed.length > 40 ? trimmed.slice(0, 40) + '…' : trimmed
    }
  }
  return '未命名考试'
}

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_SIZE = 20 * 1024 * 1024

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type) && !/\.(jpg|jpeg|png|pdf)$/i.test(file.name)) {
    return '仅支持 JPG / PNG / PDF 文件'
  }
  if (file.size > MAX_SIZE) return `文件超过 20MB (${fmtFileSize(file.size)})`
  if (file.size === 0) return '文件为空'
  return null
}

// ═══════════════════════ 页面组件 ═══════════════════════

export default function UploadPaperPage() {
  const router = useRouter()

  // ── 步骤状态 ──
  const [step, setStep] = useState<Step>('upload')

  // ── 文件 + OCR ──
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [ocrText, setOcrText] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrPageCount, setOcrPageCount] = useState(0)

  // ── 编辑表单 ──
  const [editedText, setEditedText] = useState('')
  const [title, setTitle] = useState('')
  const [grade, setGrade] = useState<Grade>('高三')
  const [examDate, setExamDate] = useState(() => new Date().toISOString().slice(0, 10))

  // ── 分析 + 保存 ──
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisStep, setAnalysisStep] = useState('')
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [parsedQuestions, setParsedQuestions] = useState<QuestionParseResult | null>(null)
  const [saveExamId, setSaveExamId] = useState<string | null>(null)

  // ── OCR 模式 + 元数据 ──
  const [ocrMode, setOcrMode] = useState<'LOCAL' | 'SMART' | 'HIGH_ACCURACY'>('SMART')
  const [ocrMeta, setOcrMeta] = useState<OcrMeta | null>(null)

  // ── 错误 ──
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const inputRef = useRef<HTMLInputElement>(null)

  // ── Helper: 重置错误 ──
  const clearError = useCallback(() => setError(null), [])

  // ═══════════════════════ Step 1: Upload + OCR ═══════════════════════

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    if (selected.length === 0) return
    for (const f of selected) {
      const err = validateFile(f)
      if (err) { setError(err); return }
    }
    clearError()
    setFiles(selected)
    setOcrText('')
    setEditedText('')
    setTitle('')
    setAnalysisResult(null)
    setSaveExamId(null)
    const urls = selected
      .filter((f) => f.type.startsWith('image/'))
      .map((f) => URL.createObjectURL(f))
    setPreviews(urls)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const selected = Array.from(e.dataTransfer.files ?? [])
    if (selected.length === 0) return
    for (const f of selected) {
      const err = validateFile(f)
      if (err) { setError(err); return }
    }
    clearError()
    setFiles(selected)
    setOcrText('')
    setEditedText('')
    setTitle('')
    setAnalysisResult(null)
    setSaveExamId(null)
    const urls = selected
      .filter((f) => f.type.startsWith('image/'))
      .map((f) => URL.createObjectURL(f))
    setPreviews(urls)
  }

  async function handleOcr() {
    if (files.length === 0) return
    clearError()
    setOcrLoading(true)
    setOcrMeta(null)

    try {
      const fd = new FormData()
      for (const f of files) {
        fd.append('file', f, f.name)
      }
      fd.append('mode', ocrMode)

      const res = await fetch('/api/ocr', {
        method: 'POST',
        body: fd,
        signal: AbortSignal.timeout(300_000),
      })

      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'OCR 识别失败')

      const text = data.text ?? ''
      setOcrText(text)
      setEditedText(text)
      setOcrPageCount(data.page_count ?? 1)
      setTitle(suggestTitle(text))

      // 保存 OCR 元数据
      setOcrMeta({
        engine: data.ocrEngine ?? 'PADDLE',
        quality: data.ocrQuality ?? 0,
        qualityReason: data.ocrQualityReason ?? '',
        durationMs: data.ocrDurationMs ?? 0,
      })

      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCR 请求失败')
    } finally {
      setOcrLoading(false)
    }
  }

  // ═══════════════════════ Step 2: Review ═══════════════════════

  function validateForm(): boolean {
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = '请输入考试名称'
    if (!editedText.trim()) errs.title = '考试内容不能为空'
    if (editedText.trim().length < 10) errs.text = '内容过短，请补充完整'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleAnalyze() {
    if (!validateForm()) return
    clearError()
    setAnalyzing(true)
    setAnalysisStep('正在分析试卷内容…')
    setStep('analyzing')

    try {
      // ── 0. 解析题目结构 ──
      setAnalysisStep('正在解析题目结构…')
      try {
        const qRes = await fetch('/api/questions/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: editedText }),
          signal: AbortSignal.timeout(120_000),
        })
        const qData = await qRes.json()
        if (qData.success) {
          setParsedQuestions(qData.data)
        } else {
          console.warn('题目解析失败，继续后续分析:', qData.error)
        }
      } catch (qErr) {
        console.warn('题目解析请求异常，继续后续分析:', qErr)
      }

      // ── 1. AI 分析 ──
      setAnalysisStep('正在调用 DeepSeek 分析…')
      const analysisRes = await fetch('/api/analysis/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedText }),
        signal: AbortSignal.timeout(120_000),
      })

      const analysisData = await analysisRes.json()
      if (!analysisData.success) throw new Error(analysisData.error ?? 'AI 分析失败')

      const result: AnalysisResult = analysisData.data
      setAnalysisResult(result)
      setAnalysisStep('分析完成，正在保存到数据库…')

      // ── 3b. 自动保存 ──
      const savePayload = {
        title: title.trim(),
        grade,
        examDate,
        content: editedText,
        questions: parsedQuestions?.questions ?? [],
        subject: result.subject,
        analysisData: {
          subject: result.subject,
          summary: result.summary,
          knowledgePoints: result.knowledgePoints,
          weaknesses: result.weaknesses,
          strengths: result.strengths,
          studySuggestions: result.studySuggestions,
        },
        meta: analysisData.meta ?? null,
        // OCR 元数据
        ocrMode: ocrMode,
        ocrEngine: ocrMeta?.engine,
        ocrQuality: ocrMeta?.quality,
        ocrDurationMs: ocrMeta?.durationMs,
      }

      const saveRes = await fetch('/api/analysis/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savePayload),
        signal: AbortSignal.timeout(30_000),
      })

      const saveData: SaveResponse = await saveRes.json()
      if (!saveData.success || !saveData.data) {
        throw new Error(saveData.error ?? '保存失败')
      }

      setSaveExamId(saveData.data.examId)
      setAnalysisStep('保存成功')
      setStep('done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '分析流程出错'
      setError(msg)
      setStep('review')
    } finally {
      setAnalyzing(false)
    }
  }

  // ═══════════════════════ Step 4: Done ═══════════════════════

  function handleViewExam() {
    if (saveExamId) {
      router.push(`/exams/${saveExamId}`)
    }
  }

  function handleNewUpload() {
    setFiles([])
    setPreviews([])
    setOcrText('')
    setEditedText('')
    setTitle('')
    setAnalysisResult(null)
    setParsedQuestions(null)
    setSaveExamId(null)
    setError(null)
    setFieldErrors({})
    setStep('upload')
    if (inputRef.current) inputRef.current.value = ''
  }

  // ═══════════════════════ 步骤指示器 ═══════════════════════

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  // ═══════════════════════ 渲染步骤内容 ═══════════════════════

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

      {/* ── 页面标题 ── */}
      <PageHeader
        title="📤 上传试卷"
        subtitle="上传 → OCR → AI 分析 → 自动保存，一步到位"
        className="mb-6"
      />

      {/* ── 步骤指示器 ── */}
      <StepIndicator stepIndex={stepIndex} />

      {/* ── 全局错误 ── */}
      {error && (
        <div className="glass-card-static mb-6 flex items-start gap-2 p-4 text-sm text-danger">
          <span>❌</span>
          <div className="flex-1">{error}</div>
          <button onClick={clearError} className="text-danger/60 hover:text-danger">✕</button>
        </div>
      )}

      {/* ═══════════════════════ STEP: Upload ═══════════════════════ */}
      {step === 'upload' && (
        <div className="space-y-6">
          {/* 上传区域 */}
          <section
            className="rounded-glass-sm border-2 border-dashed border-surface-tertiary bg-surface p-10 text-center transition hover:border-accent/50"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {files.length === 0 ? (
              <div>
                <div className="mb-4 text-5xl text-text-tertiary">📄</div>
                <p className="mb-2 text-text-secondary">
                  拖拽文件到此处，或
                  <button
                    onClick={() => inputRef.current?.click()}
                    className="mx-1 font-semibold text-accent hover:text-accent-hover"
                  >
                    浏览文件
                  </button>
                </p>
                <p className="text-xs text-text-tertiary">支持 JPG / PNG / PDF，每文件最大 20MB，可选择多张图片一起上传</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            ) : (
              <div className="space-y-3 text-left">
                {/* 文件列表 */}
                <div className="flex flex-wrap gap-3">
                  {files.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-glass-sm bg-surface-secondary p-3">
                      <span className="text-2xl">
                        {f.type === 'application/pdf' ? '📕' : '🖼️'}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text-primary max-w-[180px]">{f.name}</p>
                        <p className="text-xs text-text-tertiary">{fmtFileSize(f.size)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {/* 缩略图预览（仅图片） */}
                {previews.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto py-2">
                    {previews.map((url, i) => (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img key={i} src={url} alt={`预览 ${i + 1}`}
                        className="h-24 w-auto rounded-glass-sm border border-surface-tertiary object-cover"
                      />
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-surface-tertiary pt-3">
                  <p className="text-xs text-text-tertiary">共 {files.length} 个文件</p>
                  <div className="flex gap-2">
                    <Button onClick={handleOcr} disabled={ocrLoading} loading={ocrLoading}>
                      {ocrLoading ? '识别中…' : '开始 OCR'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => { setFiles([]); setPreviews([]); if (inputRef.current) inputRef.current.value = '' }}
                    >
                      重新选择
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 图片预览（文件已选但未 OCR 时） */}
          {previews.length > 0 && !ocrLoading && (
            <GlassCard hover={false} className="overflow-hidden p-0">
              <div className="border-b border-surface-tertiary px-4 py-2 text-xs font-medium text-text-secondary">
                预览（共 {previews.length} 页）
              </div>
              <div className="flex gap-2 overflow-x-auto bg-surface-secondary p-2">
                {previews.map((url, i) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={i} src={url} alt={`预览 ${i + 1}`}
                    className="max-h-60 w-auto rounded-glass-sm border border-surface-tertiary object-contain"
                  />
                ))}
              </div>
            </GlassCard>
          )}

          {/* OCR 模式选择 — 始终可见 */}
          {step === 'upload' && (
            <GlassCard hover={false} className="p-4">
              <div className="mb-3 text-xs font-semibold text-text-primary">🔧 OCR 模式</div>
              <div className="flex flex-wrap gap-3">
                {[
                  { value: 'SMART', label: '智能模式', desc: '自动切换，推荐', icon: '🧠' },
                  { value: 'LOCAL', label: '本地快速', desc: '仅 PaddleOCR，快速', icon: '⚡' },
                  { value: 'HIGH_ACCURACY', label: '高精度模式', desc: '视觉大模型，精准', icon: '🎯' },
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
            </GlassCard>
          )}

          {/* OCR 加载动画 */}
          {ocrLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
              <Spinner size="lg" />
              <p className="mt-4 text-sm">正在识别文字…</p>
              <p className="mt-1 text-xs text-text-tertiary/70">
                {files.length > 1 ? `共 ${files.length} 页，一起发送给大模型识别` : files[0]?.name}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════ STEP: Review ═══════════════════════ */}
      {step === 'review' && (
        <div className="space-y-6">
          {/* 预览缩略图 */}
          {previews.length > 0 && (
            <GlassCard hover={false} className="overflow-hidden p-0">
              <div className="border-b border-surface-tertiary px-4 py-2 text-xs font-medium text-text-secondary">
                原图预览 · {ocrPageCount > 1 ? `${ocrPageCount} 页` : `${previews.length} 页`}
              </div>
              <div className="flex gap-2 overflow-x-auto bg-surface-secondary p-2">
                {previews.slice(0, 5).map((url, i) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={i} src={url} alt={`原图 ${i + 1}`}
                    className="h-24 w-auto rounded-glass-sm border border-surface-tertiary object-cover"
                  />
                ))}
                {previews.length > 5 && (
                  <div className="flex h-24 w-24 items-center justify-center rounded-glass-sm border border-surface-tertiary bg-surface text-xs text-text-tertiary">
                    +{previews.length - 5}
                  </div>
                )}
              </div>
            </GlassCard>
          )}

          {/* OCR 元数据 */}
          {ocrMeta && (
            <GlassCard hover={false} className="p-4">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-accent">
                  🧠 {ocrMode === 'SMART' ? '智能模式' : ocrMode === 'LOCAL' ? '本地快速' : '高精度'}
                </span>
                <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${
                  ocrMeta.engine === 'DOUBAO' ? 'bg-purple-500/10 text-purple-500' : 'bg-emerald-500/10 text-emerald-500'
                }`}>
                  ⚙️ {ocrMeta.engine === 'DOUBAO' ? 'Doubao Vision' : 'PaddleOCR'}
                </span>
                <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${
                  ocrMeta.quality >= 75 ? 'bg-success/10 text-success' : ocrMeta.quality >= 50 ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger'
                }`}>
                  📊 质量 {ocrMeta.quality}/100
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-surface-tertiary px-3 py-1 text-text-secondary">
                  ⏱ {(ocrMeta.durationMs / 1000).toFixed(1)}s
                </span>
                {ocrMeta.quality < 75 && (
                  <span className="text-warning" title={ocrMeta.qualityReason}>
                    ⚠️ 质量偏低
                  </span>
                )}
              </div>
            </GlassCard>
          )}

          {/* 元数据表单 */}
          <GlassCard hover={false} className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-text-primary">📋 考试信息</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">考试名称</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={suggestTitle(editedText)}
                  className={`w-full rounded-glass-sm border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-tertiary focus:border-accent focus:ring-1 focus:ring-accent/30 ${
                    fieldErrors.title ? 'border-danger' : 'border-surface-tertiary'
                  }`}
                />
                {fieldErrors.title && <p className="mt-1 text-xs text-danger">{fieldErrors.title}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">年级</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value as Grade)}
                  className="w-full rounded-glass-sm border border-surface-tertiary bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent/30"
                >
                  {GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">考试日期</label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full rounded-glass-sm border border-surface-tertiary bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent/30"
                />
              </div>
            </div>
          </GlassCard>

          {/* OCR 文本编辑 */}
          <GlassCard hover={false} className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-surface-tertiary px-5 py-3">
              <h2 className="text-sm font-semibold text-text-primary">
                ✏️ OCR 识别结果
                <span className="ml-2 text-xs font-normal text-text-tertiary">
                  — 可编辑修改
                </span>
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditedText(ocrText)}
                >
                  还原原文
                </Button>
                <span className="text-xs text-text-tertiary">
                  {editedText.length} 字
                </span>
              </div>
            </div>
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={12}
              className={`w-full resize-y rounded-b-glass-sm bg-surface px-5 py-4 font-mono text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-tertiary ${
                fieldErrors.text ? 'ring-2 ring-danger/30' : ''
              }`}
              placeholder="OCR 识别结果将显示在这里，您可以修改或补充…"
            />
            {fieldErrors.text && (
              <p className="px-5 pb-2 text-xs text-danger">{fieldErrors.text}</p>
            )}
          </GlassCard>

          {/* 操作按钮 */}
          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={() => setStep('upload')}>
              ← 返回重选
            </Button>
            <div className="flex items-center gap-3">
              <p className="text-xs text-text-tertiary">
                AI 将自动识别科目并分析
              </p>
              <Button
                onClick={handleAnalyze}
                disabled={analyzing}
                loading={analyzing}
              >
                {analyzing ? '分析中…' : '开始分析 →'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ STEP: Analyzing ═══════════════════════ */}
      {step === 'analyzing' && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="relative mb-8">
            <Spinner size="lg" />
            <div className="absolute inset-0 flex items-center justify-center text-xl">
              🤖
            </div>
          </div>

          <h3 className="text-lg font-semibold text-text-primary">正在处理</h3>
          <p className="mt-2 text-sm text-text-secondary">{analysisStep}</p>

          <div className="mt-6 w-64">
            <Progress value={60} size="sm" color="accent" animated />
          </div>

          <p className="mt-6 text-xs text-text-tertiary">
            请耐心等待，这通常需要 10-30 秒
          </p>
        </div>
      )}

      {/* ═══════════════════════ STEP: Done ═══════════════════════ */}
      {step === 'done' && analysisResult && (
        <div className="space-y-6">
          {/* 成功横幅 */}
          <div className="rounded-glass-sm border border-success/30 bg-success/5 p-6 text-center">
            <div className="mb-2 text-4xl">🎉</div>
            <h2 className="text-xl font-bold text-success">分析完成！</h2>
            <p className="mt-1 text-sm text-success/80">
              试卷已自动分析并保存到你的学习记录中
            </p>
          </div>

          {/* 分析摘要 */}
          <GlassCard hover={false} className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-text-primary">📊 分析摘要</h2>

            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-glass-sm bg-surface-secondary text-lg">
                {SUBJECT_EMOJI[analysisResult.subject] ?? '📝'}
              </span>
              <div>
                <p className="font-medium text-text-primary">{title}</p>
                <p className="text-xs text-text-tertiary">
                  {analysisResult.subject} · {grade} · {ocrPageCount > 1 ? `${ocrPageCount} 页` : '单页'}
                </p>
                {/* OCR 元数据 */}
                {ocrMeta && (
                  <p className="mt-1 flex flex-wrap gap-2 text-xs text-text-tertiary">
                    <span>{ocrMode === 'SMART' ? '智能模式' : ocrMode === 'LOCAL' ? '本地快速' : '高精度'}</span>
                    <span>·</span>
                    <span>{ocrMeta.engine === 'DOUBAO' ? 'Doubao Vision' : 'PaddleOCR'}</span>
                    <span>·</span>
                    <span>质量 {ocrMeta.quality}/100</span>
                    <span>·</span>
                    <span>{(ocrMeta.durationMs / 1000).toFixed(1)}s</span>
                  </p>
                )}
              </div>
            </div>

            <p className="mb-4 text-sm leading-relaxed text-text-secondary">
              {analysisResult.summary}
            </p>

            {/* 知识点评分摘要 */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {analysisResult.knowledgePoints.slice(0, 6).map((kp, i) => (
                <div key={i} className="rounded-glass-sm bg-surface-secondary p-3 text-center">
                  <p className="truncate text-xs text-text-tertiary">{kp.name}</p>
                  <p className="mt-1 text-lg font-bold text-text-primary">
                    {kp.score}/{kp.total}
                  </p>
                  <p className={`text-xs ${
                    parseFloat(kp.mastery) >= 60 ? 'text-success' : 'text-warning'
                  }`}>
                    {kp.mastery}
                  </p>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* 题目结构 */}
          {parsedQuestions && parsedQuestions.questions.length > 0 && (
            <GlassCard hover={false} className="p-5">
              <h2 className="mb-4 text-sm font-semibold text-text-primary">
                📋 题目结构
                <span className="ml-2 text-xs font-normal text-text-tertiary">
                  {parsedQuestions.questionCount} 题 · 满分 {parsedQuestions.totalScore}
                </span>
              </h2>
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {parsedQuestions.questions.map((q, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-glass-sm border border-surface-tertiary bg-surface-secondary p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-glass-sm bg-accent-subtle text-xs font-bold text-accent">
                      {q.questionNo}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-surface-tertiary px-1.5 py-0.5 text-xs text-text-secondary">
                          {q.questionType}
                        </span>
                        <span className="text-xs text-text-tertiary">{q.fullScore} 分</span>
                        {q.hasSubQuestions && (
                          <span className="text-xs text-warning">包含子题</span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm text-text-primary">
                        {q.questionText}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center justify-center gap-4">
            <Button variant="secondary" onClick={handleNewUpload}>
              继续上传
            </Button>
            <Button onClick={handleViewExam}>
              查看详情 →
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
