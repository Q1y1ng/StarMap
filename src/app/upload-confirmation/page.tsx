'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ImageIcon,
  X,
  BookOpen,
  FolderArchive,
  Plus,
  FileText,
} from 'lucide-react'
import { GlassCard } from '@/components/ui-system/GlassCard'
import { Button } from '@/components/ui-system/Button'
import { Badge } from '@/components/ui-system/Badge'
import { Spinner } from '@/components/ui-system/Spinner'
import { Input } from '@/components/ui-system/Input'
import { Select } from '@/components/ui-system/Select'

// ═══════════════════ Types ═══════════════════

type UploadResult = {
  visionDocument: {
    metadata: {
      title?: string
      subject?: string
      grade?: string
      date?: string
      totalScore?: number
    }
    questions: unknown[]
    studentAnswers: unknown[]
    scoreBreakdowns: unknown[]
    mistakes: unknown[]
    sourceImages: string[]
    model: string
    durationMs: number
    rawText: string
  }
  markdown: string
  pageCount: number
  sourceFiles: Array<{ filename: string; size: number; type: string }>
  vision: { model: string; durationMs: number; cacheHit: boolean; retried: boolean; sourceImages: string[] }
  timeline: { imageBatch: number; vision: number; total: number }
  warnings: string[]
  overallQuality: number
}

type PreviewData = {
  suggestedName: string
  suggestedGrade: string
  suggestedSemester: string | null
  suggestedExamType: string | null
  suggestedSubject: string
  confidence: number
  existingSessions: Array<{
    id: string
    name: string
    grade: string
    semester: string | null
    examType: string | null
    date: string
    subjectCount: number
    averageScore: number | null
    totalScore: number | null
    subjects: string[]
  }>
  duplicate: {
    isDuplicate: boolean
    existingExamId?: string
    existingExamName?: string
    existingSubject?: string
    message?: string
  }
  suggestion: string | null
}

// ── Constants ──

const GRADE_OPTIONS = [
  { value: '高一', label: '高一' },
  { value: '高二', label: '高二' },
  { value: '高三', label: '高三' },
]

const SEMESTER_OPTIONS = [
  { value: '上', label: '上学期' },
  { value: '下', label: '下学期' },
]

const EXAM_TYPE_OPTIONS = [
  { value: '月考', label: '月考' },
  { value: '期中', label: '期中考试' },
  { value: '期末', label: '期末考试' },
  { value: '模拟', label: '模拟考试' },
  { value: '诊断', label: '诊断考试' },
  { value: '高考', label: '高考' },
]

const SUBJECT_OPTIONS = [
  { value: '语文', label: '📖 语文' },
  { value: '数学', label: '📐 数学' },
  { value: '英语', label: '🔤 英语' },
  { value: '物理', label: '⚡ 物理' },
  { value: '化学', label: '🧪 化学' },
  { value: '生物', label: '🧬 生物' },
  { value: '历史', label: '📜 历史' },
  { value: '地理', label: '🌍 地理' },
  { value: '政治', label: '⚖️ 政治' },
]

function subjectEmoji(s: string): string {
  const map: Record<string, string> = {
    '语文': '📖', '数学': '📐', '英语': '🔤', '物理': '⚡',
    '化学': '🧪', '生物': '🧬', '历史': '📜', '地理': '🌍', '政治': '⚖️',
  }
  return map[s] ?? '📝'
}

// ── Animation ──

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 } as const,
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
}

// ═══════════════════ Page ═══════════════════

export default function UploadConfirmationPage() {
  const router = useRouter()

  // ── Data from OCR ──
  const [data, setData] = useState<UploadResult | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Preview ──
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // ── Editable fields ──
  const [examName, setExamName] = useState('')
  const [examDate, setExamDate] = useState('')
  const [grade, setGrade] = useState('')
  const [semester, setSemester] = useState('')
  const [examType, setExamType] = useState('')
  const [subject, setSubject] = useState('')
  const [totalScore, setTotalScore] = useState('')

  // ── Session ──
  const [sessionMode, setSessionMode] = useState<'existing' | 'new'>('existing')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [newSessionName, setNewSessionName] = useState('')

  // ── Confirm ──
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  // ── Duplicate resolution ──
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false)

  // ── Load OCR data from sessionStorage ──
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('upload-exam-result')
      if (stored) {
        const parsed = JSON.parse(stored) as UploadResult
        setData(parsed)

        // Pre-fill from OCR metadata
        const meta = parsed.visionDocument.metadata
        setExamName(meta.title ?? '')
        setExamDate(meta.date ?? '')
        setGrade(meta.grade ?? '')
        setSubject(meta.subject ?? '')
        setTotalScore(meta.totalScore != null ? String(meta.totalScore) : '')
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Fetch preview data when OCR data is loaded ──
  useEffect(() => {
    if (!data) return

    const fetchPreview = async () => {
      setPreviewLoading(true)
      setPreviewError(null)
      try {
        const meta = data.visionDocument.metadata
        const res = await fetch('/api/upload/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: meta.title || '',
            subject: meta.subject || '',
            grade: meta.grade || '',
            examDate: meta.date || '',
            totalScore: meta.totalScore || 0,
          }),
        })
        const json = await res.json()
        if (json.success) {
          setPreview(json.data)

          // Auto-select best session match
          if (json.data.existingSessions?.length > 0) {
            setSelectedSessionId(json.data.existingSessions[0].id)
          }

          // Pre-fill semester/examType from suggestion
          if (json.data.suggestedSemester) setSemester(json.data.suggestedSemester)
          if (json.data.suggestedExamType) setExamType(json.data.suggestedExamType)
        } else {
          setPreviewError(json.error ?? '预览请求失败')
        }
      } catch {
        setPreviewError('网络错误，无法获取建议')
      } finally {
        setPreviewLoading(false)
      }
    }

    fetchPreview()
  }, [data])

  // ── Best matching session for display ──
  const bestSession = preview?.existingSessions?.[0] ?? null

  // ── Session subjects display ──
  const sessionSubjectsText = bestSession
    ? bestSession.subjects.map((s) => subjectEmoji(s)).join(' ')
    : ''

  // ── Confirm upload ──
  const handleConfirm = useCallback(async () => {
    if (!data) return

    // Validation
    if (!examName.trim()) {
      setConfirmError('考试名称不能为空')
      return
    }
    if (!subject.trim()) {
      setConfirmError('科目不能为空')
      return
    }
    if (!examDate.trim()) {
      setConfirmError('考试日期不能为空')
      return
    }
    const score = parseInt(totalScore)
    if (isNaN(score) || score <= 0) {
      setConfirmError('满分必须大于 0')
      return
    }

    setConfirming(true)
    setConfirmError(null)

    try {
      const body = {
        title: examName.trim(),
        subject: subject.trim(),
        grade: grade || '高三',
        examDate,
        totalScore: score,
        sessionMode,
        existingSessionId: sessionMode === 'existing' ? selectedSessionId : undefined,
        newSession:
          sessionMode === 'new'
            ? {
                name: newSessionName.trim() || examName.trim(),
                grade: grade || '高三',
                semester: semester || undefined,
                examType: examType || undefined,
              }
            : undefined,
        markdown: data.markdown,
      }

      const res = await fetch('/api/upload/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()

      if (json.success) {
        // Clear stored data
        sessionStorage.removeItem('upload-exam-result')
        // Redirect to the session detail page
        router.push(`/exam-sessions/${json.data.sessionId}`)
      } else {
        setConfirmError(json.error ?? '上传确认失败')
      }
    } catch {
      setConfirmError('网络错误，请重试')
    } finally {
      setConfirming(false)
    }
  }, [data, examName, subject, grade, examDate, totalScore, sessionMode, selectedSessionId, newSessionName, semester, examType, router])

  // ── Cancel ──
  const handleCancel = useCallback(() => {
    router.push('/upload-exam')
  }, [router])

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Spinner size="lg" label="加载中…" />
      </div>
    )
  }

  // ── No data state ──
  if (!data) {
    return (
      <motion.div variants={stagger} initial="hidden" animate="show" className="mx-auto max-w-3xl space-y-6 py-8">
        <motion.div variants={fadeUp} className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-glass-sm bg-accent-subtle">
            <ImageIcon className="h-8 w-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">没有检测到识别数据</h1>
          <p className="mt-2 text-sm text-text-secondary">
            请先上传试卷并进行 OCR 识别，然后返回此页面确认。
          </p>
          <div className="mt-6 flex gap-3">
            <Button variant="primary" onClick={() => router.push('/upload-exam')}>
              去上传试卷
            </Button>
            <Button variant="ghost" onClick={() => router.push('/exams')}>
              返回考试记录
            </Button>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  const confidence = preview?.confidence ?? 0
  const hasDuplicate = preview?.duplicate?.isDuplicate && !duplicateAcknowledged

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="mx-auto max-w-3xl space-y-6 py-6">
      {/* ── Back navigation ── */}
      <motion.div variants={fadeUp}>
        <button
          onClick={handleCancel}
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          返回上传
        </button>
      </motion.div>

      {/* ── Page Header ── */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">确认考试信息</h1>
        <p className="mt-1 text-sm text-text-secondary">请确认识别结果，随后开始 AI 分析。</p>
      </motion.div>

      {/* ══════ ① 识别结果 ══════ */}
      <motion.div variants={fadeUp}>
        <GlassCard gradient="blue" className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">📋 识别结果</h2>
            <Badge
              variant={confidence >= 70 ? 'success' : confidence >= 40 ? 'warning' : 'danger'}
              size="sm"
            >
              识别准确率 {confidence}%
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* 考试名称 */}
            <div className="sm:col-span-2">
              <Input
                label="考试名称"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="例如：高二下诊断四"
                helperText={
                  bestSession && !examName.includes(bestSession.name.slice(0, 4))
                    ? `提示：已有相似考试「${bestSession.name}」`
                    : undefined
                }
              />
            </div>

            {/* 考试日期 */}
            <Input
              label="考试日期"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />

            {/* 年级 */}
            <Select
              label="年级"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              options={GRADE_OPTIONS}
              placeholder="选择年级"
            />

            {/* 学期 */}
            <Select
              label="学期"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              options={SEMESTER_OPTIONS}
              placeholder="选择学期"
            />

            {/* 考试类型 */}
            <Select
              label="考试类型"
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
              options={EXAM_TYPE_OPTIONS}
              placeholder="选择考试类型"
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* ══════ AI Suggestion ══════ */}
      {preview?.suggestion && !hasDuplicate && (
        <motion.div variants={fadeUp}>
          <div className="flex items-start gap-3 rounded-glass-sm border border-accent/20 bg-accent/5 p-4 text-sm">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <p className="font-medium text-accent">AI 建议</p>
              <p className="mt-0.5 text-text-secondary">{preview.suggestion}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ══════ Preview loading ══════ */}
      {previewLoading && (
        <motion.div variants={fadeUp}>
          <div className="flex items-center justify-center gap-2 rounded-glass-sm bg-surface-secondary py-4 text-sm text-text-tertiary">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在获取建议…
          </div>
        </motion.div>
      )}

      {/* ══════ Preview error ══════ */}
      {previewError && (
        <motion.div variants={fadeUp}>
          <div className="flex items-start gap-3 rounded-glass-sm border border-warning/20 bg-warning/5 p-4 text-sm text-warning">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{previewError}</span>
          </div>
        </motion.div>
      )}

      {/* ══════ ② Exam Session ══════ */}
      <motion.div variants={fadeUp}>
        <GlassCard className="p-6">
          <h2 className="mb-4 text-base font-semibold text-text-primary">📁 Exam Session</h2>

          {/* 加入已有 */}
          <label className="flex cursor-pointer items-start gap-3 rounded-glass-sm border border-surface-tertiary bg-surface-secondary p-4 transition-colors hover:border-accent/50">
            <input
              type="radio"
              name="sessionMode"
              checked={sessionMode === 'existing'}
              onChange={() => setSessionMode('existing')}
              className="mt-0.5 h-4 w-4 accent-accent"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">加入已有考试</p>
              <p className="text-xs text-text-tertiary">选择已有的考试分类，将此科目加入其中</p>
            </div>
          </label>

          {sessionMode === 'existing' && (
            <div className="mt-3 space-y-2">
              {preview?.existingSessions && preview.existingSessions.length > 0 ? (
                preview.existingSessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSessionId(s.id)}
                    className={`flex w-full items-center gap-4 rounded-glass-sm border p-4 text-left transition-all ${
                      selectedSessionId === s.id
                        ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                        : 'border-surface-tertiary bg-surface hover:border-accent/50'
                    }`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-glass-sm bg-accent-subtle text-lg">
                      <FolderArchive className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">{s.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
                        <span>{s.grade}</span>
                        <span>·</span>
                        <span>{s.subjectCount} 科</span>
                        <span>·</span>
                        <span>{s.date}</span>
                        {s.averageScore != null && (
                          <>
                            <span>·</span>
                            <span>平均 {s.averageScore} 分</span>
                          </>
                        )}
                      </div>
                      <div className="mt-1 text-xs">{sessionSubjectsText}</div>
                    </div>
                    {selectedSessionId === s.id && (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" />
                    )}
                  </button>
                ))
              ) : (
                <div className="rounded-glass-sm bg-surface-secondary p-4 text-center text-sm text-text-tertiary">
                  暂无可加入的考试分类
                </div>
              )}
            </div>
          )}

          {/* 创建新考试 */}
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-glass-sm border border-surface-tertiary bg-surface-secondary p-4 transition-colors hover:border-accent/50">
            <input
              type="radio"
              name="sessionMode"
              checked={sessionMode === 'new'}
              onChange={() => setSessionMode('new')}
              className="mt-0.5 h-4 w-4 accent-accent"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">创建新的考试</p>
              <p className="text-xs text-text-tertiary">为此科目创建一个新的考试分类</p>
            </div>
          </label>

          {sessionMode === 'new' && (
            <div className="mt-3">
              <Input
                label="考试名称"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                placeholder={examName || '例如：高二下诊断四'}
                helperText="留空将使用上方的考试名称"
              />
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* ══════ ③ 科目信息 ══════ */}
      <motion.div variants={fadeUp}>
        <GlassCard className="p-6">
          <h2 className="mb-4 text-base font-semibold text-text-primary">📖 科目信息</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Select
              label="科目"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              options={SUBJECT_OPTIONS}
              placeholder="选择科目"
            />

            <Input
              label="满分"
              type="number"
              value={totalScore}
              onChange={(e) => setTotalScore(e.target.value)}
              placeholder="150"
              min={0}
            />

            {preview && (
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-text-secondary">识别准确率</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="h-2.5 overflow-hidden rounded-full bg-surface-tertiary">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          confidence >= 70
                            ? 'bg-success'
                            : confidence >= 40
                              ? 'bg-warning'
                              : 'bg-danger'
                        }`}
                        style={{ width: `${confidence}%` }}
                      />
                    </div>
                  </div>
                  <Badge variant={confidence >= 70 ? 'success' : confidence >= 40 ? 'warning' : 'danger'} size="sm">
                    {confidence}%
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-text-tertiary">基于 API 返回的数据完整度估算</p>
              </div>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* ══════ ⚠️ Duplicate Warning ══════ */}
      {preview?.duplicate?.isDuplicate && !duplicateAcknowledged && (
        <motion.div variants={fadeUp}>
          <div className="rounded-glass-sm border border-danger/20 bg-danger/5 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-danger">检测到可能重复上传</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  「{preview.duplicate.existingExamName}」（{preview.duplicate.existingSubject}）已存在。
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setDuplicateAcknowledged(true)}
                  >
                    继续上传（忽略重复）
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/exams/${preview.duplicate.existingExamId}`)}
                  >
                    查看已有记录
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ══════ ④ Upload Preview ══════ */}
      <motion.div variants={fadeUp}>
        <GlassCard className="p-6">
          <h2 className="mb-4 text-base font-semibold text-text-primary">🖼️ 上传预览</h2>
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* Thumbnail */}
            <div className="flex h-40 w-full shrink-0 items-center justify-center overflow-hidden rounded-glass-sm bg-surface-secondary sm:w-48">
              {data.visionDocument.sourceImages?.[0] ? (
                <img
                  src={data.visionDocument.sourceImages[0]}
                  alt="试卷缩略图"
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <div className="flex flex-col items-center text-text-tertiary">
                  <ImageIcon className="h-8 w-8" />
                  <span className="mt-1 text-xs">无预览</span>
                </div>
              )}
            </div>

            {/* File info */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-text-tertiary" />
                <span className="text-text-primary font-medium">
                  {data.sourceFiles.length} 个文件
                </span>
              </div>
              <div className="space-y-1">
                {data.sourceFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-text-tertiary">
                    <span className="w-48 truncate" title={f.filename}>
                      {f.filename}
                    </span>
                    <span>{(f.size / 1024).toFixed(0)} KB</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-text-tertiary">
                <Badge variant="default" size="sm">
                  {data.pageCount} 页
                </Badge>
                <Badge variant="default" size="sm">
                  {data.vision.model}
                </Badge>
                <Badge variant="default" size="sm">
                  {data.vision.durationMs}ms
                </Badge>
              </div>
              {data.warnings.length > 0 && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-warning">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{data.warnings[0]}</span>
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ══════ Error ══════ */}
      {confirmError && (
        <motion.div variants={fadeUp}>
          <div className="flex items-start gap-3 rounded-glass-sm border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{confirmError}</span>
          </div>
        </motion.div>
      )}

      {/* ══════ Actions ══════ */}
      <motion.div variants={fadeUp} className="flex items-center justify-between gap-4 pb-8">
        <Button variant="ghost" size="lg" onClick={handleCancel}>
          取消
        </Button>
        <Button
          variant="primary"
          size="lg"
          icon={<Sparkles className="h-4 w-4" />}
          onClick={handleConfirm}
          disabled={confirming || hasDuplicate}
          loading={confirming}
        >
          {confirming ? '保存中…' : '确认上传 🚀'}
        </Button>
      </motion.div>
    </motion.div>
  )
}
