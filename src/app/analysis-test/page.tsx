'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader, GlassCard, Button, Progress, Spinner } from '@/components/ui-system'
import { AnalysisResultDisplay, StatCard } from '@/components/analysis/ResultDisplay'
import type { AnalysisTestResult } from '@/types/analysis-test'

// ── 常量 ──────────────────────────────────────────────────

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_SIZE = 50 * 1024 * 1024 // 增大: 20MB → 50MB

type Grade = '高一' | '高二' | '高三'

const GRADES: Grade[] = ['高一', '高二', '高三']

// ── API 响应结构 ──
type SingleResult = {
  success: boolean
  data?: AnalysisTestResult
  meta?: { durationMs: number; usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null }
  error?: string
}

type ScoreItem = {
  questionNo: number
  fullScore: number
  score: number
  lostScore: number
}

type AnalysisStep = 'upload' | 'review' | 'analyzing' | 'done'

const ANALYSIS_STEPS: { key: AnalysisStep; label: string; icon: string }[] = [
  { key: 'upload', label: '上传试卷+答题卡', icon: '📄' },
  { key: 'review', label: '确认文本', icon: '✏️' },
  { key: 'analyzing', label: 'AI 分析', icon: '🤖' },
  { key: 'done', label: '完成', icon: '✅' },
]

// ── 工具函数 ──────────────────────────────────────────────

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type) && !/\.(jpg|jpeg|png|pdf)$/i.test(file.name)) {
    return '仅支持 JPG / PNG / PDF 文件'
  }
  if (file.size > MAX_SIZE) return `文件超过 50MB (${fmtFileSize(file.size)})`
  if (file.size === 0) return '文件为空'
  return null
}

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

// ═══════════════════════ Page ═══════════════════════

export default function AnalysisTestPage() {
  const router = useRouter()

  // ── 双区域上传 ──
  const [paperFiles, setPaperFiles] = useState<File[]>([])
  const [answerFiles, setAnswerFiles] = useState<File[]>([])
  const [paperPreviews, setPaperPreviews] = useState<(string | null)[]>([])
  const [answerPreviews, setAnswerPreviews] = useState<(string | null)[]>([])
  const paperInputRef = useRef<HTMLInputElement>(null)
  const answerInputRef = useRef<HTMLInputElement>(null)

  // ── OCR ──
  const [ocrText, setOcrText] = useState('')
  const [editedText, setEditedText] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrPageCount, setOcrPageCount] = useState(0)
  const [ocrProgress, setOcrProgress] = useState({ current: 0, total: 0 })
  const [ocrCurrentFile, setOcrCurrentFile] = useState('')
  const [ocrMode, setOcrMode] = useState<'LOCAL' | 'SMART' | 'HIGH_ACCURACY'>('SMART')
  const [doubaoApiKey, setDoubaoApiKey] = useState('')
  const [ocrEngine, setOcrEngine] = useState<string | null>(null)
  const [ocrQuality, setOcrQuality] = useState<number | null>(null)
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('upload')

  // ── 小分截图 ──
  const scoreInputRef = useRef<HTMLInputElement>(null)
  const [scoreFiles, setScoreFiles] = useState<File[]>([])
  const [scorePreviews, setScorePreviews] = useState<(string | null)[]>([])
  const [scoreItems, setScoreItems] = useState<ScoreItem[]>([])
  // ── AI 分析 ──
  const [result, setResult] = useState<SingleResult | null>(null)
  const [loading, setLoading] = useState(false)

  // ── 保存 ──
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [grade, setGrade] = useState<Grade>('高三')
  const [examDate, setExamDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [saveResult, setSaveResult] = useState<{ success: boolean; examId?: string; error?: string } | null>(null)
  const [totalScore, setTotalScore] = useState<number | ''>('')

  // ── 错误 ──
  const [error, setError] = useState<string | null>(null)

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

  // ── 从 /upload-exam 接收预合并的 Markdown ──
  useEffect(() => {
    const prefill = sessionStorage.getItem('upload-exam-markdown')
    if (prefill) {
      sessionStorage.removeItem('upload-exam-markdown')
      setOcrText(prefill)
      setEditedText(prefill)
      setTitle(suggestTitle(prefill))
      setAnalysisStep('review')
    }
  }, [])

  // ── 文件管理 ────────────────────────────────────────────

  function addFilesToZone(zone: 'paper' | 'answer' | 'score', newFiles: File[]) {
    const errors: string[] = []
    const valid: File[] = []

    for (const f of newFiles) {
      const err = validateFile(f)
      if (err) errors.push(`${f.name}: ${err}`)
      else valid.push(f)
    }

    if (errors.length > 0) setError(errors.join('; '))
    if (valid.length === 0) return

    const previews = valid.map((f) =>
      f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
    )

    if (zone === 'paper') {
      setPaperFiles((prev) => [...prev, ...valid])
      setPaperPreviews((prev) => [...prev, ...previews])
    } else if (zone === 'answer') {
      setAnswerFiles((prev) => [...prev, ...valid])
      setAnswerPreviews((prev) => [...prev, ...previews])
    } else {
      setScoreFiles((prev) => [...prev, ...valid])
      setScorePreviews((prev) => [...prev, ...previews])
    }
  }

  function removeFile(zone: 'paper' | 'answer' | 'score', index: number) {
    if (zone === 'paper') {
      if (paperPreviews[index]) URL.revokeObjectURL(paperPreviews[index]!)
      setPaperFiles((prev) => prev.filter((_, i) => i !== index))
      setPaperPreviews((prev) => prev.filter((_, i) => i !== index))
    } else if (zone === 'answer') {
      if (answerPreviews[index]) URL.revokeObjectURL(answerPreviews[index]!)
      setAnswerFiles((prev) => prev.filter((_, i) => i !== index))
      setAnswerPreviews((prev) => prev.filter((_, i) => i !== index))
    } else {
      if (scorePreviews[index]) URL.revokeObjectURL(scorePreviews[index]!)
      setScoreFiles((prev) => prev.filter((_, i) => i !== index))
      setScorePreviews((prev) => prev.filter((_, i) => i !== index))
    }
  }

  function handlePaperFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      addFilesToZone('paper', Array.from(e.target.files))
      e.target.value = ''
    }
  }

  function handleAnswerFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      addFilesToZone('answer', Array.from(e.target.files))
      e.target.value = ''
    }
  }

  function handlePaperDrop(e: React.DragEvent) {
    e.preventDefault()
    addFilesToZone('paper', Array.from(e.dataTransfer.files))
  }

  function handleAnswerDrop(e: React.DragEvent) {
    e.preventDefault()
    addFilesToZone('answer', Array.from(e.dataTransfer.files))
  }

  function handleScoreFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      addFilesToZone('score', Array.from(e.target.files))
      e.target.value = ''
    }
  }

  function handleScoreDrop(e: React.DragEvent) {
    e.preventDefault()
    addFilesToZone('score', Array.from(e.dataTransfer.files))
  }

  // ── 多页 OCR ────────────────────────────────────────────

  async function handleMultiOcr() {
    const sources = [
      ...paperFiles.map((f) => ({ file: f, source: '试卷' as const })),
      ...answerFiles.map((f) => ({ file: f, source: '答题卡' as const })),
    ]
    if (sources.length === 0) return

    clearError()
    const totalOcrItems = sources.length + scoreFiles.length
    setOcrLoading(true)
    setOcrProgress({ current: 0, total: totalOcrItems })
    setOcrCurrentFile('准备中…')

    const results: { source: string; fileName: string; text: string; pageCount: number }[] = []

    for (let i = 0; i < sources.length; i++) {
      const { file, source } = sources[i]
      setOcrProgress({ current: i + 1, total: sources.length })
      setOcrCurrentFile(`${source}: ${file.name}`)

      try {
        const fd = new FormData()
        fd.append('file', file, file.name)
        fd.append('mode', ocrMode)
        if (doubaoApiKey) fd.append('doubaoApiKey', doubaoApiKey)

        const res = await fetch('/api/ocr', {
          method: 'POST',
          body: fd,
          signal: AbortSignal.timeout(180_000),
        })

        const data = await res.json()
        if (!data.success) throw new Error(data.error ?? 'OCR 失败')

        // 保存 OCR 元数据（取最后一张的）
        if (data.ocrEngine) setOcrEngine(data.ocrEngine)
        if (data.ocrQuality != null) setOcrQuality(data.ocrQuality)

        results.push({
          source,
          fileName: file.name,
          text: data.text ?? '',
          pageCount: data.page_count ?? 1,
        })
      } catch (err) {
        results.push({
          source,
          fileName: file.name,
          text: `[OCR 错误: ${err instanceof Error ? err.message : '请求失败'}]`,
          pageCount: 0,
        })
      }
    }

    // 合并所有 OCR 文本，标注来源
    const combined = results
      .map((r) => `【${r.source} - ${r.fileName}】\n${r.text}`)
      .join('\n\n')

    setOcrText(combined)
    setEditedText(combined)
    setOcrPageCount(results.reduce((s, r) => s + r.pageCount, 0))
    setTitle(suggestTitle(combined))

    // ── 处理小分截图 ──
    if (scoreFiles.length > 0) {
      for (let i = 0; i < scoreFiles.length; i++) {
        const file = scoreFiles[i]
        setOcrProgress({ current: sources.length + i + 1, total: totalOcrItems })
        setOcrCurrentFile(`小分截图: ${file.name}`)

        try {
          const fd = new FormData()
          fd.append('file', file, file.name)
          if (doubaoApiKey) fd.append('doubaoApiKey', doubaoApiKey)

          const res = await fetch('/api/score-breakdown/ocr', {
            method: 'POST',
            body: fd,
            signal: AbortSignal.timeout(180_000),
          })

          const data = await res.json()
          if (data.success && data.data?.items) {
            setScoreItems(data.data.items)
          }
        } catch {
          // score breakdown OCR failed silently
        }
      }
    }

    setOcrLoading(false)
    setAnalysisStep('review')
  }

  // ── AI 分析 ──────────────────────────────────────────────

  const handleAnalyze = useCallback(async () => {
    if (!editedText.trim()) return
    setLoading(true)
    setResult(null)
    setAnalysisStep('analyzing')

    try {
      const res = await fetch('/api/analysis/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedText }),
        signal: AbortSignal.timeout(120_000),
      })
      const json = await res.json()
      setResult(json)
      if (json.success) {
        setAnalysisStep('done')
      } else {
        setAnalysisStep('review')
        setError(json.error ?? 'AI 分析失败')
      }
    } catch {
      setResult({ success: false, error: '网络错误，请检查连接后重试' })
      setAnalysisStep('review')
      setError('网络错误，请检查连接后重试')
    } finally {
      setLoading(false)
    }
  }, [editedText])

  // 分析成功后自动填充标题（仅在首次获得 result 时设置）
  const hasSetTitleRef = useRef(false)
  useEffect(() => {
    if (result?.data && !hasSetTitleRef.current) {
      hasSetTitleRef.current = true
      setTitle((prev) => prev || (result.data!.subject + ' 考试'))
    }
  }, [result?.data])

  // ── 保存考试 ──────────────────────────────────────────────

  const handleSaveExam = useCallback(async () => {
    if (!result?.data) return
    setSaving(true)
    setSaveResult(null)

    try {
      const res = await fetch('/api/analysis/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          grade,
          examDate,
          content: editedText,
          subject: result.data.subject,
          analysisData: result.data,
          meta: result.meta ?? null,
          totalScore: totalScore === '' ? null : Number(totalScore),
        }),
      })
      const json = await res.json()
      if (json.success) {
        const examId = json.data.examId
        // 如果有小分数据，一并保存
        if (scoreItems.length > 0) {
          try {
            await fetch('/api/score-breakdown/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ examId, items: scoreItems }),
              signal: AbortSignal.timeout(30_000),
            })
          } catch {
            // score save failure is non-fatal
          }
        }
        setSaveResult({ success: true, examId })
      } else {
        setSaveResult({ success: false, error: json.error ?? '保存失败' })
      }
    } catch {
      setSaveResult({ success: false, error: '网络错误' })
    } finally {
      setSaving(false)
    }
  }, [result, title, grade, examDate, editedText, totalScore, scoreItems])

  function handleReset() {
    // 清理预览 URL 避免内存泄漏
    paperPreviews.forEach((p) => { if (p) URL.revokeObjectURL(p) })
    answerPreviews.forEach((p) => { if (p) URL.revokeObjectURL(p) })
    setPaperFiles([])
    setAnswerFiles([])
    setPaperPreviews([])
    setAnswerPreviews([])
    setOcrText('')
    setEditedText('')
    setTitle('')
    setResult(null)
    setAnalysisStep('upload')
    setError(null)
    setShowSaveForm(false)
    setSaveResult(null)
    setTotalScore('')
    setScoreFiles([])
    setScorePreviews([])
    setScoreItems([])
    if (paperInputRef.current) paperInputRef.current.value = ''
    if (answerInputRef.current) answerInputRef.current.value = ''
    if (scoreInputRef.current) scoreInputRef.current.value = ''
  }

  // ── 计算汇总 ──
  const totalFiles = paperFiles.length + answerFiles.length + scoreFiles.length
  const totalFileSize = [...paperFiles, ...answerFiles].reduce((s, f) => s + f.size, 0)

  // ══════════════════ 渲染 ══════════════════

  const stepIndex = ANALYSIS_STEPS.findIndex((s) => s.key === analysisStep)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ── 页面标题 ── */}
      <PageHeader
        title="上传页面"
        subtitle="上传试卷+答题卡 → 多页 OCR 识别 → AI 分析 → 保存"
      />

      {/* ═══════════════════ 上传流程 ═══════════════════ */}
      <div className="space-y-6">
        {/* 步骤指示器 */}
        <div className="mb-6 flex items-center justify-center gap-0">
          {ANALYSIS_STEPS.map((s, i) => {
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
                {i < ANALYSIS_STEPS.length - 1 && (
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

        {/* ── 错误提示 ── */}
        {error && (
          <div className="glass-card-static mb-4 flex items-start gap-2 rounded-glass-sm border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
            <span>❌</span>
            <div className="flex-1">{error}</div>
            <button onClick={clearError} className="text-danger/60 hover:text-danger">
              ✕
            </button>
          </div>
        )}

        {/* ────────────────── 步骤: Upload ────────────────── */}
        {analysisStep === 'upload' && !ocrLoading && (
          <div className="space-y-6">
            {/* 双区域上传 */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* ─── 试卷 ─── */}
              <GlassCard hover={false} className="overflow-hidden p-0">
                <div className="border-b border-surface-tertiary px-4 py-3 text-sm font-semibold text-text-primary">
                  📄 试卷
                </div>
                {paperFiles.length === 0 ? (
                  <div
                    className="flex cursor-pointer flex-col items-center justify-center p-8 text-center transition hover:bg-surface-secondary/50"
                    onDrop={handlePaperDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => paperInputRef.current?.click()}
                  >
                    <div className="mb-3 text-4xl text-text-tertiary">📄</div>
                    <p className="mb-1 text-sm text-text-secondary">
                      拖拽试卷文件到此处，或
                      <span className="mx-1 font-semibold text-accent">浏览</span>
                    </p>
                    <p className="text-xs text-text-tertiary">
                      支持多文件 · JPG/PNG/PDF · 最大 50MB
                    </p>
                    <input
                      ref={paperInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      multiple
                      className="hidden"
                      onChange={handlePaperFileSelect}
                    />
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="space-y-2">
                      {paperFiles.map((f, i) => (
                        <div
                          key={`${f.name}-${i}`}
                          className="flex items-center justify-between rounded-glass-sm border border-surface-tertiary bg-surface-secondary p-3"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            {paperPreviews[i] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={paperPreviews[i]!}
                                alt=""
                                className="h-10 w-8 rounded object-cover bg-surface-tertiary"
                              />
                            ) : (
                              <span className="flex h-10 w-8 items-center justify-center rounded bg-surface-tertiary text-lg">
                                📕
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-text-primary">
                                {f.name}
                              </p>
                              <p className="text-xs text-text-tertiary">{fmtFileSize(f.size)}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFile('paper', i)}
                            className="ml-2 shrink-0 text-text-tertiary hover:text-danger"
                            title="移除"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-surface-tertiary pt-3">
                      <span className="text-xs text-text-tertiary">
                        {paperFiles.length} 个文件 ·{' '}
                        {fmtFileSize(paperFiles.reduce((s, f) => s + f.size, 0))}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => paperInputRef.current?.click()}
                      >
                        继续添加
                      </Button>
                      <input
                        ref={paperInputRef}
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        multiple
                        className="hidden"
                        onChange={handlePaperFileSelect}
                      />
                    </div>
                  </div>
                )}
              </GlassCard>

              {/* ─── 答题卡 ─── */}
              <GlassCard hover={false} className="overflow-hidden p-0">
                <div className="border-b border-surface-tertiary px-4 py-3 text-sm font-semibold text-text-primary">
                  📝 答题卡
                </div>
                {answerFiles.length === 0 ? (
                  <div
                    className="flex cursor-pointer flex-col items-center justify-center p-8 text-center transition hover:bg-surface-secondary/50"
                    onDrop={handleAnswerDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => answerInputRef.current?.click()}
                  >
                    <div className="mb-3 text-4xl text-text-tertiary">📝</div>
                    <p className="mb-1 text-sm text-text-secondary">
                      拖拽答题卡文件到此处，或
                      <span className="mx-1 font-semibold text-accent">浏览</span>
                    </p>
                    <p className="text-xs text-text-tertiary">
                      支持多文件 · JPG/PNG/PDF · 最大 50MB
                    </p>
                    <input
                      ref={answerInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      multiple
                      className="hidden"
                      onChange={handleAnswerFileSelect}
                    />
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="space-y-2">
                      {answerFiles.map((f, i) => (
                        <div
                          key={`${f.name}-${i}`}
                          className="flex items-center justify-between rounded-glass-sm border border-surface-tertiary bg-surface-secondary p-3"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            {answerPreviews[i] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={answerPreviews[i]!}
                                alt=""
                                className="h-10 w-8 rounded object-cover bg-surface-tertiary"
                              />
                            ) : (
                              <span className="flex h-10 w-8 items-center justify-center rounded bg-surface-tertiary text-lg">
                                📕
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-text-primary">
                                {f.name}
                              </p>
                              <p className="text-xs text-text-tertiary">{fmtFileSize(f.size)}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFile('answer', i)}
                            className="ml-2 shrink-0 text-text-tertiary hover:text-danger"
                            title="移除"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-surface-tertiary pt-3">
                      <span className="text-xs text-text-tertiary">
                        {answerFiles.length} 个文件 ·{' '}
                        {fmtFileSize(answerFiles.reduce((s, f) => s + f.size, 0))}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => answerInputRef.current?.click()}
                      >
                        继续添加
                      </Button>
                      <input
                        ref={answerInputRef}
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        multiple
                        className="hidden"
                        onChange={handleAnswerFileSelect}
                      />
                    </div>
                  </div>
                )}
              </GlassCard>

              {/* ─── 小分截图 ─── */}
              <GlassCard hover={false} className="overflow-hidden p-0">
                <div className="border-b border-surface-tertiary px-4 py-3 text-sm font-semibold text-text-primary">
                  📊 小分截图
                </div>
                {scoreFiles.length === 0 ? (
                  <div
                    className="flex cursor-pointer flex-col items-center justify-center p-8 text-center transition hover:bg-surface-secondary/50"
                    onDrop={handleScoreDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => scoreInputRef.current?.click()}
                  >
                    <div className="mb-3 text-4xl text-text-tertiary">📊</div>
                    <p className="mb-1 text-sm text-text-secondary">
                      拖拽成绩截图到此处，或
                      <span className="mx-1 font-semibold text-accent">浏览</span>
                    </p>
                    <p className="text-xs text-text-tertiary">
                      支持 JPG/PNG · 最大 20MB
                    </p>
                    <input
                      ref={scoreInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      className="hidden"
                      onChange={handleScoreFileSelect}
                    />
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="space-y-2">
                      {scoreFiles.map((f, i) => (
                        <div
                          key={`score-${f.name}-${i}`}
                          className="flex items-center justify-between rounded-glass-sm border border-surface-tertiary bg-surface-secondary p-3"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            {scorePreviews[i] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={scorePreviews[i]!}
                                alt=""
                                className="h-10 w-8 rounded object-cover bg-surface-tertiary"
                              />
                            ) : (
                              <span className="flex h-10 w-8 items-center justify-center rounded bg-surface-tertiary text-lg">
                                📊
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-text-primary">
                                {f.name}
                              </p>
                              <p className="text-xs text-text-tertiary">{fmtFileSize(f.size)}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFile('score', i)}
                            className="ml-2 shrink-0 text-text-tertiary hover:text-danger"
                            title="移除"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-surface-tertiary pt-3">
                      <span className="text-xs text-text-tertiary">
                        {scoreFiles.length} 个文件 ·{' '}
                        {fmtFileSize(scoreFiles.reduce((s, f) => s + f.size, 0))}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => scoreInputRef.current?.click()}
                      >
                        继续添加
                      </Button>
                      <input
                        ref={scoreInputRef}
                        type="file"
                        accept=".jpg,.jpeg,.png"
                        className="hidden"
                        onChange={handleScoreFileSelect}
                      />
                    </div>
                  </div>
                )}
              </GlassCard>
            </div>

            {/* 底部操作：汇总 + 开始 OCR */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-tertiary">
                共 {totalFiles} 个文件
                {totalFiles > 0 && ` · ${fmtFileSize(totalFileSize)}`}
                {paperFiles.length > 0 && ` · 试卷 ${paperFiles.length}`}
                {answerFiles.length > 0 && ` · 答题卡 ${answerFiles.length}`}
              </span>
              <Button onClick={handleMultiOcr} disabled={totalFiles === 0}>
                开始多页 OCR ▸
              </Button>
            </div>

            {/* OCR 模式选择 — 始终可见 */}
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
          </div>
        )}

        {/* ────────────────── OCR 加载中 ────────────────── */}
        {analysisStep === 'upload' && ocrLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Spinner size="lg" />
            <p className="mt-4 text-sm font-medium text-text-primary">多页 OCR 识别中</p>
            <p className="mt-1 text-xs text-text-tertiary">正在处理: {ocrCurrentFile}</p>
            <div className="mt-6 w-64">
              <Progress
                value={
                  ocrProgress.total > 0
                    ? (ocrProgress.current / ocrProgress.total) * 100
                    : 0
                }
                size="sm"
                color="accent"
                animated
              />
            </div>
            <p className="mt-2 text-xs text-text-tertiary">
              已完成 {ocrProgress.current} / {ocrProgress.total} 个文件
            </p>
          </div>
        )}

        {/* ────────────────── 步骤: Review ────────────────── */}
        {analysisStep === 'review' && (
          <div className="space-y-6">
            {/* 合并摘要 */}
            <GlassCard hover={false} gradient="blue" className="p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    已合并 OCR 内容{ocrPageCount > 1 ? `（${ocrPageCount} 页）` : ''}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    试卷 {paperFiles.length} 个文件 + 答题卡 {answerFiles.length} 个文件{scoreFiles.length > 0 ? ` + 小分截图 ${scoreFiles.length} 个文件` : ''}
                  </p>
                </div>
              </div>
              {/* OCR 元数据 */}
              {(ocrEngine || ocrQuality !== null) && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${
                    ocrEngine === 'DOUBAO' ? 'bg-purple-500/10 text-purple-500' : 'bg-emerald-500/10 text-emerald-500'
                  }`}>
                    ⚙️ {ocrEngine === 'DOUBAO' ? 'Doubao Vision' : ocrEngine === 'PADDLE' ? 'PaddleOCR' : ocrEngine}
                  </span>
                  <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${
                    ocrMode === 'HIGH_ACCURACY' ? 'bg-purple-500/10 text-purple-500' : ocrMode === 'SMART' ? 'bg-accent/10 text-accent' : 'bg-emerald-500/10 text-emerald-500'
                  }`}>
                    🧠 {ocrMode === 'SMART' ? '智能模式' : ocrMode === 'LOCAL' ? '本地快速' : '高精度模式'}
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
            </GlassCard>

            {/* 考试信息 */}
            <GlassCard hover={false} className="p-5">
              <h2 className="mb-4 text-sm font-semibold text-text-primary">📋 考试信息</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    考试名称
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="自动识别考试名称"
                    className="w-full rounded-glass-sm border border-surface-tertiary bg-surface px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-tertiary focus:border-accent focus:ring-1 focus:ring-accent/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    年级
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value as Grade)}
                    className="w-full rounded-glass-sm border border-surface-tertiary bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent/30"
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    考试日期
                  </label>
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
                  <Button variant="ghost" size="sm" onClick={() => setEditedText(ocrText)}>
                    还原原文
                  </Button>
                  <span className="text-xs text-text-tertiary">{editedText.length} 字</span>
                </div>
              </div>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                rows={10}
                className="w-full resize-y rounded-b-glass-sm bg-surface px-5 py-4 font-mono text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-tertiary"
                placeholder="OCR 识别结果将显示在这里，您可以修改或补充…"
              />
            </GlassCard>

            {/* 小分数据 */}
            {scoreItems.length > 0 && (
              <GlassCard hover={false} className="overflow-hidden p-0">
                <div className="flex items-center justify-between border-b border-surface-tertiary px-5 py-3">
                  <h2 className="text-sm font-semibold text-text-primary">
                    📊 小分数据
                    <span className="ml-2 text-xs font-normal text-text-tertiary">
                      — {scoreItems.length} 道题目
                    </span>
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
                      {scoreItems.map((item) => {
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
                                onChange={(e) => {
                                  const newScore = Math.max(0, parseFloat(e.target.value) || 0)
                                  setScoreItems((prev) =>
                                    prev.map((si) =>
                                      si.questionNo === item.questionNo
                                        ? { ...si, score: newScore, lostScore: Math.max(0, si.fullScore - newScore) }
                                        : si
                                    )
                                  )
                                }}
                                className="w-20 rounded-glass-sm border border-surface-tertiary bg-surface px-2 py-1 text-center text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent/30"
                                min={0}
                                step={0.5}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={item.fullScore}
                                onChange={(e) => {
                                  const newFull = Math.max(0, parseFloat(e.target.value) || 0)
                                  setScoreItems((prev) =>
                                    prev.map((si) =>
                                      si.questionNo === item.questionNo
                                        ? { ...si, fullScore: newFull, lostScore: Math.max(0, newFull - si.score) }
                                        : si
                                    )
                                  )
                                }}
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
                    <tfoot>
                      <tr className="border-t border-surface-tertiary bg-surface-secondary font-medium">
                        <td className="px-5 py-3 text-text-primary">合计</td>
                        <td className="px-4 py-3 text-text-primary">
                          {scoreItems.reduce((s, i) => s + i.score, 0).toFixed(1)}
                        </td>
                        <td className="px-4 py-3 text-text-primary">
                          {scoreItems.reduce((s, i) => s + i.fullScore, 0).toFixed(1)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={
                            scoreItems.reduce((s, i) => s + i.lostScore, 0) > 0
                              ? 'text-danger' : 'text-success'
                          }>
                            {scoreItems.reduce((s, i) => s + i.lostScore, 0).toFixed(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={
                            (() => {
                              const total = scoreItems.reduce((s, i) => s + i.fullScore, 0)
                              const got = scoreItems.reduce((s, i) => s + i.score, 0)
                              return total > 0 && (got / total) >= 0.6 ? 'text-success' : 'text-warning'
                            })()
                          }>
                            {(() => {
                              const total = scoreItems.reduce((s, i) => s + i.fullScore, 0)
                              const got = scoreItems.reduce((s, i) => s + i.score, 0)
                              return total > 0 ? `${((got / total) * 100).toFixed(0)}%` : '—'
                            })()}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </GlassCard>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center justify-between">
              <Button variant="secondary" onClick={handleReset}>
                ← 返回重选
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-tertiary">
                  AI 将自动识别科目并分析
                </span>
                <Button
                  onClick={handleAnalyze}
                  disabled={loading || !editedText.trim()}
                  loading={loading}
                >
                  {loading ? '分析中…' : '开始分析 →'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ────────────────── 步骤: Analyzing ────────────────── */}
        {analysisStep === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative mb-8">
              <Spinner size="lg" />
              <div className="absolute inset-0 flex items-center justify-center text-xl">
                🤖
              </div>
            </div>
            <h3 className="text-lg font-semibold text-text-primary">AI 分析中</h3>
            <p className="mt-2 text-sm text-text-secondary">
              正在调用 DeepSeek 分析试卷内容…
            </p>
            <div className="mt-6 w-64">
              <Progress value={60} size="sm" color="accent" animated />
            </div>
            <p className="mt-6 text-xs text-text-tertiary">
              请耐心等待，这通常需要 10-30 秒
            </p>
          </div>
        )}

        {/* ────────────────── 步骤: Done ────────────────── */}
        {analysisStep === 'done' && result?.data && (
          <div className="space-y-6">
            {/* Token + 耗时统计 */}
            {result?.meta && (
              <div className="flex flex-wrap gap-4">
                <StatCard label="耗时" value={`${result.meta.durationMs}ms`} color="blue" />
                {result.meta.usage && (
                  <>
                    <StatCard
                      label="Prompt Tokens"
                      value={result.meta.usage.promptTokens.toLocaleString()}
                      color="indigo"
                    />
                    <StatCard
                      label="Completion Tokens"
                      value={result.meta.usage.completionTokens.toLocaleString()}
                      color="violet"
                    />
                    <StatCard
                      label="总 Tokens"
                      value={result.meta.usage.totalTokens.toLocaleString()}
                      color="purple"
                    />
                  </>
                )}
              </div>
            )}

            {/* 分析结果 */}
            <AnalysisResultDisplay data={result.data as unknown as AnalysisTestResult} />

            {/* 保存考试 */}
            <div className="border-t border-surface-tertiary pt-4">
              {!showSaveForm ? (
                <div className="flex gap-3">
                  <Button onClick={() => {
                    // 打开保存表单时自动填充总分（优先 AI 返回的总分，其次按知识点累加）
                    const data = result?.data
                    const defaultTotal = data?.totalScore ?? data?.knowledgePoints?.reduce(
                      (sum, kp) => sum + (Number(kp.total) || 0), 0
                    ) ?? ''
                    setTotalScore(defaultTotal)
                    setShowSaveForm(true)
                  }}>💾 保存考试</Button>
                  <Button variant="secondary" onClick={handleReset}>
                    重新上传
                  </Button>
                </div>
              ) : (
                <GlassCard hover={false} gradient="green" className="p-4">
                  <h3 className="mb-3 text-sm font-semibold text-text-primary">
                    保存考试记录
                  </h3>
                  {saveResult?.success ? (
                    <div className="space-y-3">
                      <p className="text-sm text-success">✅ 已成功保存！</p>
                      <div className="flex gap-3">
                        <Button onClick={() => router.push(`/exams/${saveResult.examId}`)}>
                          查看考试详情 →
                        </Button>
                        <Button variant="secondary" onClick={handleReset}>
                          继续上传
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* 总分输入 */}
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-text-secondary whitespace-nowrap">
                          试卷得分
                        </label>
                        <input
                          type="number"
                          value={totalScore}
                          onChange={(e) => setTotalScore(e.target.value === '' ? '' : Number(e.target.value))}
                          min={0}
                          max={999}
                          className="w-24 rounded-glass-sm border border-surface-tertiary bg-surface px-3 py-1.5 text-sm text-text-primary outline-none transition placeholder:text-text-tertiary focus:border-accent focus:ring-1 focus:ring-accent/30"
                          placeholder="自动"
                        />
                        <span className="text-xs text-text-tertiary">
                          留空则由 AI 分析结果自动汇总
                        </span>
                      </div>
                      {saveResult?.error && (
                        <p className="text-sm text-danger">{saveResult.error}</p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          onClick={handleSaveExam}
                          disabled={saving || !title.trim()}
                          loading={saving}
                        >
                          {saving ? '保存中…' : '确认保存'}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setShowSaveForm(false)
                            setSaveResult(null)
                          }}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  )}
                </GlassCard>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
