// ── /debug/document — 文档管道调试页面（Phase 15） ──────
// 展示统一 PDF → OCR → 结构化文档的完整管道数据

'use client'

import { useState, useRef, useCallback } from 'react'
import { Loader2, AlertCircle, CheckCircle2, Upload, ChevronDown, ChevronRight } from 'lucide-react'

type OcrMode = 'LOCAL' | 'SMART' | 'HIGH_ACCURACY'

type DebugData = {
  document: {
    metadata: {
      title: string | null
      subject: string | null
      grade: string | null
      date: string | null
      totalScore: number | null
    }
    questions: { questionNo: string; questionType: string; content: string; fullScore: number | null }[]
    answers: { questionNo: string; answer: string; confidence: number; source: string }[]
    scores: { questionNo: string; score: number; fullScore: number; source: string }[]
    mistakes: { questionNo: string; lostScore: number; rate: string; knowledgePoint?: string }[]
    trace: { sourceFiles: { filename: string; pageNumber: number }[]; ocrMode: string; ocrQuality: number; processingTime: number }
    warnings: string[]
    overallQuality: number
  }
  markdown: string
  pdfPath: string
  pageCount: number
  sourceFiles: { filename: string; size: number; type: string }[]
  ocr: { engine: string; mode: string; quality: number; chars: number; durationMs: number }
  timeline: { pdfBuild: number; ocr: number; parse: number; total: number }
  warnings: string[]
  overallQuality: number
}

function CollapsibleSection({
  title,
  defaultOpen,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className="rounded-lg border border-zinc-700/50">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-zinc-300 hover:bg-zinc-800/50"
      >
        {open ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
        {title}
      </button>
      {open && <div className="border-t border-zinc-700/50 p-4">{children}</div>}
    </div>
  )
}

function JsonViewer({ data }: { data: any }) {
  return (
    <pre className="max-h-96 overflow-auto rounded bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-400">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

export default function DebugDocumentPage() {
  const [debugData, setDebugData] = useState<DebugData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ocrMode, setOcrMode] = useState<OcrMode>('SMART')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setLoading(true)
    setError(null)
    setDebugData(null)

    try {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        formData.append('file', files[i])
      }
      formData.append('mode', ocrMode)

      const res = await fetch('/api/upload-exam', { method: 'POST', body: formData })
      const json = await res.json()

      if (!json.success) {
        setError(json.error || '处理失败')
        return
      }

      setDebugData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败')
    } finally {
      setLoading(false)
    }
  }, [ocrMode])

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">🔍 文档管道调试</h1>
        <p className="text-sm text-zinc-400">
          展示 Unified PDF → OCR → ExamDocumentParser 的完整管道数据（Phase 15）
        </p>
      </div>

      {/* 上传区 */}
      <div className="rounded-lg border border-zinc-700/50 p-6">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {(['LOCAL', 'SMART', 'HIGH_ACCURACY'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setOcrMode(mode)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  ocrMode === mode
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                    : 'border-zinc-700 text-zinc-500 hover:border-zinc-600'
                }`}
              >
                {mode === 'LOCAL' ? '本地' : mode === 'SMART' ? '智能' : '高精度'}
              </button>
            ))}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-600 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {loading ? '处理中…' : '上传测试文件'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
      </div>

      {/* 错误 */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 调试数据 */}
      {debugData && (
        <div className="space-y-3">
          {/* 警告 */}
          {debugData.warnings.length > 0 && (
            <div className="space-y-1">
              {debugData.warnings.map((w, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                    w.includes('题目') || w.includes('试卷')
                      ? 'border-red-500/30 bg-red-500/10 text-red-300'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                  }`}
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* 总体质量 */}
          <div className={`rounded-lg border p-4 text-sm ${
            debugData.overallQuality >= 85
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : debugData.overallQuality >= 60
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}>
            <span className="font-medium">总体质量评分：{debugData.overallQuality}/100</span>
          </div>

          {/* 1. 文件信息 + 时线 */}
          <CollapsibleSection title="① 统一 PDF 信息">
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-4 text-zinc-400 md:grid-cols-4">
                <div>
                  <span className="text-zinc-600">总页数</span>
                  <p className="mt-0.5 font-medium text-zinc-300">{debugData.pageCount}</p>
                </div>
                <div>
                  <span className="text-zinc-600">文件数</span>
                  <p className="mt-0.5 font-medium text-zinc-300">{debugData.sourceFiles.length}</p>
                </div>
                <div>
                  <span className="text-zinc-600">PDF 路径</span>
                  <p className="mt-0.5 truncate text-zinc-500" title={debugData.pdfPath}>{debugData.pdfPath}</p>
                </div>
              </div>
              <div>
                <h4 className="mb-1 font-medium text-zinc-500">处理时线</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-zinc-600">PDF 构建</p>
                    <p className="font-medium text-zinc-300">{debugData.timeline.pdfBuild}ms</p>
                  </div>
                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-zinc-600">OCR</p>
                    <p className="font-medium text-zinc-300">{debugData.timeline.ocr}ms</p>
                  </div>
                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-zinc-600">解析</p>
                    <p className="font-medium text-zinc-300">{debugData.timeline.parse}ms</p>
                  </div>
                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-zinc-600">总计</p>
                    <p className="font-medium text-zinc-300">{debugData.timeline.total}ms</p>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="mb-1 font-medium text-zinc-500">源文件清单</h4>
                {debugData.sourceFiles.map((sf, i) => (
                  <div key={i} className="flex gap-3 text-zinc-500">
                    <span className="w-48 truncate" title={sf.filename}>{sf.filename}</span>
                    <span className="text-zinc-600">{(sf.size / 1024).toFixed(0)} KB</span>
                    <span>{sf.type}</span>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleSection>

          {/* 2. OCR 结果 */}
          <CollapsibleSection title="② OCR 结果">
            <div className="grid gap-4 text-xs md:grid-cols-3">
              <div className="rounded border border-zinc-700/50 p-3">
                <h4 className="mb-2 font-medium text-zinc-400">引擎</h4>
                <p className="text-zinc-300">{debugData.ocr.engine}</p>
              </div>
              <div className="rounded border border-zinc-700/50 p-3">
                <h4 className="mb-2 font-medium text-zinc-400">质量</h4>
                <p className={`${debugData.ocr.quality >= 75 ? 'text-emerald-400' : debugData.ocr.quality >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                  {debugData.ocr.quality}/100
                </p>
              </div>
              <div className="rounded border border-zinc-700/50 p-3">
                <h4 className="mb-2 font-medium text-zinc-400">字符数 / 耗时</h4>
                <p className="text-zinc-300">{debugData.ocr.chars} chars / {debugData.ocr.durationMs}ms</p>
              </div>
            </div>
          </CollapsibleSection>

          {/* 3. 结构化文档 */}
          <CollapsibleSection title="③ 结构化文档 (ExamDocument)" defaultOpen>
            <JsonViewer data={debugData.document} />
          </CollapsibleSection>

          {/* 4. 最终 Markdown */}
          <CollapsibleSection title="④ 最终 Markdown" defaultOpen>
            <div className="max-h-96 overflow-auto rounded bg-zinc-900 p-3">
              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">
                {debugData.markdown.slice(0, 10000)}
              </pre>
              {debugData.markdown.length > 10000 && (
                <p className="mt-2 text-xs text-zinc-600">
                  …（内容过长，仅显示前 10000 字符）
                </p>
              )}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {!debugData && !error && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-zinc-600">上传文件以查看管道调试数据</p>
        </div>
      )}
    </div>
  )
}
