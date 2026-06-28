'use client'

// ── 统一上传页面（Phase 15-R / Vision-Native） ──────────────
// 上传 → Vision 模型直接分析 → rawText 唯一数据源
// 无 ExamDocumentParser / ExamMarkdownRenderer / DocumentAssembler 旧链路
// rawText 是 Preview / Copy / AI 分析的唯一来源

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileStack,
  Sparkles,
  RefreshCw,
  X,
} from 'lucide-react' // prettier-ignore

type Mode = 'LOCAL' | 'SMART' | 'HIGH_ACCURACY'

type VisionInfo = {
  model: string
  durationMs: number
  cacheHit: boolean
  retried: boolean
  sourceImages: string[]
}

type TimelineInfo = {
  imageBatch: number
  vision: number
  total: number
}

type UploadResult = {
  visionDocument: {
    metadata: {
      title?: string
      subject?: string
      grade?: string
      date?: string
      totalScore?: number
    }
    questions: { questionNo: string; type: string; content: string; fullScore: number | null; sourceImageIndex?: number }[]
    studentAnswers: { questionNo: string; answer: string; confidence: number }[]
    scoreBreakdowns: { questionNo: string; score: number; fullScore: number }[]
    mistakes: { questionNo: string; lostScore: number; rate: string; knowledgePoint?: string }[]
    sourceImages: string[]
    model: string
    durationMs: number
    rawText: string
  }
  markdown: string
  pageCount: number
  sourceFiles: { filename: string; size: number; type: string }[]
  vision: VisionInfo
  timeline: TimelineInfo
  warnings: string[]
  overallQuality: number
}

export default function UploadExamClient({ examId = null }: { examId?: string | null }) {
  const [files, setFiles] = useState<File[]>([])
  const [ocrMode, setOcrMode] = useState<Mode>('HIGH_ACCURACY')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showFullPreview, setShowFullPreview] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 页面切换后恢复上次处理结果
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('upload-exam-result')
      if (stored) {
        const data = JSON.parse(stored) as UploadResult
        setResult(data)
        sessionStorage.removeItem('upload-exam-result')
      }
    } catch {
      // ignore parse errors
    }
  }, [])

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    setError(null)
    setResult(null)
    sessionStorage.removeItem('upload-exam-result')
    setFiles((prev) => [...prev, ...Array.from(newFiles)])
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const clearAll = useCallback(() => {
    setFiles([])
    setResult(null)
    setError(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files)
    },
    [addFiles],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleSubmit = useCallback(async () => {
    if (files.length === 0) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      for (const file of files) {
        formData.append('file', file)
      }
      formData.append('mode', ocrMode)
      if (examId) formData.append('examId', examId)

      const res = await fetch('/api/upload-exam', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json()

      if (!json.success) {
        setError(json.error || '处理失败')
        return
      }

      const data = json.data as UploadResult
      // 保存到 sessionStorage，切换页面后能恢复
      try { sessionStorage.setItem('upload-exam-result', JSON.stringify(data)) } catch { /* ignore */ }
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败')
    } finally {
      setLoading(false)
    }
  }, [files, ocrMode, examId])

  const handleExport = useCallback(async () => {
    if (!result) return
    setExporting(true)
    setExportMsg(null)

    try {
      const filename = result.visionDocument.metadata.title || undefined
      const res = await fetch('/api/export-markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: result.markdown, filename }),
      })
      const json = await res.json()
      if (json.success) {
        setExportMsg(`✅ 已导出至 docx/${filename ? filename.replace(/[<>:"/\\|?*]/g, '_').slice(0, 80) : 'OCR-结果'}.md`)
      } else {
        setExportMsg(`❌ ${json.error || '导出失败'}`)
      }
    } catch (err) {
      setExportMsg(`❌ ${err instanceof Error ? err.message : '网络错误'}`)
    } finally {
      setExporting(false)
    }
  }, [result])

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">📤 统一上传</h1>
        <p className="text-sm text-zinc-400">
          上传考试资料（图片 / PDF），系统自动合并为完整考试档案
        </p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">处理出错</p>
            <p className="mt-1 text-red-400/80">{error}</p>
          </div>
        </div>
      )}

      {/* 拖拽上传区 */}
      {!loading && !result && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:border-zinc-500 ${
            files.length > 0 ? 'border-zinc-700/50 py-6' : 'border-zinc-700 py-12'
          }`}
        >
          <Upload className="mx-auto h-8 w-8 text-zinc-500" />
          <p className="mt-2 text-sm text-zinc-400">
            {files.length > 0 ? '继续添加文件（拖拽或点击）' : '拖拽文件到此处，或点击选择文件'}
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            支持 JPG / PNG / WebP / PDF，每文件最多 50MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) addFiles(e.target.files)
              // 清空 input value 以允许重复选择相同文件
              e.target.value = ''
            }}
          />
        </div>
      )}

      {/* 文件列表 */}
      {files.length > 0 && !loading && !result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-300">
              已选择 {files.length} 个文件
            </h2>
            <button onClick={clearAll} className="text-xs text-zinc-500 hover:text-zinc-300">
              清空
            </button>
          </div>

          <div className="space-y-2">
            {files.map((file, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-zinc-700/50 p-3 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-zinc-500" />
                <span className="flex-1 truncate text-zinc-300">{file.name}</span>
                <span className="text-xs text-zinc-600">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </span>
                <button
                  onClick={() => removeFile(i)}
                  className="rounded p-0.5 text-zinc-600 transition-colors hover:bg-zinc-700 hover:text-zinc-300"
                  title="移除"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* 高级设置 */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
          >
            {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            OCR 模式设置
          </button>

          {showAdvanced && (
            <div className="rounded-lg border border-zinc-700/50 p-4">
              <h3 className="mb-3 text-xs font-medium text-zinc-400">OCR 模式</h3>
              <div className="flex gap-2">
                {([
                  { value: 'HIGH_ACCURACY' as const, label: '大模型精准', desc: 'Doubao Vision（推荐）' },
                  { value: 'LOCAL' as const, label: '本地快速', desc: 'PaddleOCR' },
                  { value: 'SMART' as const, label: '智能模式', desc: '自动切换' },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setOcrMode(opt.value)}
                    className={`flex-1 rounded-lg border p-3 text-left text-xs transition-colors ${
                      ocrMode === opt.value
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                        : 'border-zinc-700 text-zinc-500 hover:border-zinc-600'
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="mt-0.5 text-zinc-600">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-emerald-600 to-sky-600 px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                处理中…
              </span>
            ) : (
              '🚀 开始处理'
            )}
          </button>
        </div>
      )}

      {/* 加载态 */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <p className="mt-4 text-sm text-zinc-400">正在处理中…</p>
          <p className="mt-1 text-xs text-zinc-600">构建图片批次 → Vision 模型分析</p>
        </div>
      )}

      {/* 处理完成 */}
      {result && !loading && (
        <div className="space-y-6">
          {/* 成功提示 */}
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <p className="font-medium text-emerald-300">处理完成</p>
              <p className="mt-1 text-sm text-emerald-400/70">
                共处理 {result.sourceFiles.length} 个文件 · 合计 {result.pageCount} 页
                · 原始输出 {result.markdown.length} 字符
              </p>
            </div>
          </div>

          {/* 完整性警告 */}
          {result.warnings.length > 0 && (
            <div className="space-y-2">
              {result.warnings.map((w, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${
                    w.includes('题目') || w.includes('试卷')
                      ? 'border-red-500/30 bg-red-500/10 text-red-300'
                      : w.includes('缺失') || w.includes('偏低')
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                        : 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300'
                  }`}
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* 质量评分 */}
          <div className="rounded-lg border border-zinc-700/50 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-300">
              文档质量
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                result.overallQuality >= 85
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : result.overallQuality >= 60
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'bg-red-500/15 text-red-400'
              }`}>
                {result.overallQuality}/100
              </span>
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs text-zinc-400 sm:grid-cols-4">
              <div>
                <span className="text-zinc-600">Vision 模型</span>
                <p className="mt-0.5 font-medium text-zinc-300">{result.vision.model}</p>
              </div>
              <div>
                <span className="text-zinc-600">缓存命中</span>
                <p className="mt-0.5 font-medium text-zinc-300">{result.vision.cacheHit ? '是' : '否'}</p>
              </div>
              <div>
                <span className="text-zinc-600">重试</span>
                <p className="mt-0.5 font-medium text-zinc-300">{result.vision.retried ? '是' : '否'}</p>
              </div>
              <div>
                <span className="text-zinc-600">处理用时</span>
                <p className="mt-0.5 font-medium text-zinc-300">{result.timeline.total}ms</p>
              </div>
            </div>
          </div>

          {/* 时线统计 */}
          <div className="rounded-lg border border-zinc-700/50 p-4">
            <h3 className="mb-3 text-sm font-medium text-zinc-300">处理时线</h3>
            <div className="grid grid-cols-3 gap-3 text-xs text-zinc-400">
              <div>
                <span className="text-zinc-600">图片批次</span>
                <p className="mt-0.5 font-medium text-zinc-300">{result.timeline.imageBatch}ms</p>
              </div>
              <div>
                <span className="text-zinc-600">Vision</span>
                <p className="mt-0.5 font-medium text-zinc-300">{result.timeline.vision}ms</p>
              </div>
              <div>
                <span className="text-zinc-600">总计</span>
                <p className="mt-0.5 font-medium text-zinc-300">{result.timeline.total}ms</p>
              </div>
            </div>
          </div>

          {/* 溯源信息 */}
          <div className="rounded-lg border border-zinc-700/50 p-4">
            <h3 className="mb-3 text-sm font-medium text-zinc-300">文件清单</h3>
            <div className="space-y-1">
              {result.sourceFiles.map((sf, i) => (
                <div key={i} className="flex items-center gap-3 text-xs text-zinc-500">
                  <span className="w-48 truncate" title={sf.filename}>{sf.filename}</span>
                  <span className="text-zinc-600">{(sf.size / 1024).toFixed(0)} KB</span>
                  <span className="text-zinc-700">{sf.type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 考试信息 */}
          {result.visionDocument.metadata.title && (
            <div className="rounded-lg border border-zinc-700/50 p-4">
              <h3 className="mb-2 text-sm font-medium text-zinc-300">考试信息</h3>
              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 sm:grid-cols-5">
                <div>
                  <span className="text-zinc-600">名称</span>
                  <p className="mt-0.5 text-zinc-300">{result.visionDocument.metadata.title || '（未识别）'}</p>
                </div>
                <div>
                  <span className="text-zinc-600">科目</span>
                  <p className="mt-0.5 text-zinc-300">{result.visionDocument.metadata.subject || '（未识别）'}</p>
                </div>
                <div>
                  <span className="text-zinc-600">年级</span>
                  <p className="mt-0.5 text-zinc-300">{result.visionDocument.metadata.grade || '（未识别）'}</p>
                </div>
                <div>
                  <span className="text-zinc-600">日期</span>
                  <p className="mt-0.5 text-zinc-300">{result.visionDocument.metadata.date || '（未识别）'}</p>
                </div>
                <div>
                  <span className="text-zinc-600">总分</span>
                  <p className="mt-0.5 text-zinc-300">{result.visionDocument.metadata.totalScore ?? '（未识别）'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Markdown 预览 — 显示 rawText */}
          <div className="rounded-lg border border-zinc-700/50">
            <div className="flex items-center justify-between border-b border-zinc-700/50 p-3">
              <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <FileStack className="h-4 w-4 text-zinc-500" />
                合并文档预览
                <span className="text-xs text-zinc-600">（{result.markdown.length} 字符）</span>
              </h3>
              {result.markdown.length > 5000 && (
                <button
                  onClick={() => setShowFullPreview((v) => !v)}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  {showFullPreview ? '收起' : '展开全部'}
                </button>
              )}
            </div>
            <pre className="max-h-96 overflow-auto p-4 text-xs leading-relaxed text-zinc-400">
              {result.markdown.slice(0, showFullPreview ? undefined : 5000)}
              {!showFullPreview && result.markdown.length > 5000 && '\n\n...（内容过长，点击"展开全部"查看完整内容）'}
            </pre>
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={clearAll}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
            >
              <RefreshCw className="h-4 w-4" />
              继续上传
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(result.markdown)}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
            >
              复制 Markdown
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              导出 Markdown
            </button>
            {exportMsg && (
              <span className="flex items-center text-xs text-zinc-500">{exportMsg}</span>
            )}
          </div>

          {/* AI 分析入口 + 确认考试信息 */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-emerald-300">文档已就绪</h3>
                <p className="mt-1 text-xs text-emerald-400/60">
                  文档已成功处理，共 {result.sourceFiles.length} 个文件 · {result.pageCount} 页
                  · 原始输出 {result.markdown.length} 字符。
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    // 保存结果用于确认页面
                    try { sessionStorage.setItem('upload-exam-result', JSON.stringify(result)) } catch { /* ignore */ }
                    router.push('/upload-confirmation')
                  }}
                  className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-accent/50 hover:text-accent"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  确认考试信息
                </button>
                <button
                  onClick={() => {
                    sessionStorage.setItem('upload-exam-markdown', result.markdown)
                    router.push('/analysis-test')
                  }}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-sky-600 px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  <Sparkles className="h-4 w-4" />
                  开始 AI 分析
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
