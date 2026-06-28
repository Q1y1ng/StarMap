'use client'

import { useState, useRef } from 'react'
import { PageHeader, Button, GlassCard, StatCard } from '@/components/ui-system'
import { OcrService } from '@/services/ocr.service'
import type { OcrResult, UploadProgress } from '@/lib/ocr/types'

// ═══════════════════════ 页面组件 ═══════════════════════

export default function OcrTestPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<OcrResult | null>(null)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [serviceHealth, setServiceHealth] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── 选择文件 ──

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return

    const validationError = OcrService.validate(f)
    if (validationError) {
      setError(validationError)
      return
    }

    setFile(f)
    setResult(null)
    setError(null)
    setProgress(null)

    // 生成图片预览
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f)
      setPreview(url)
    } else {
      setPreview(null) // PDF 不预览
    }
  }

  // ── 执行 OCR ──

  async function handleOcr() {
    if (!file) return
    setError(null)
    setResult(null)
    setProgress({ status: 'uploading', percent: 10, message: '上传中...' })

    try {
      const res = await OcrService.recognize(file, file.name, setProgress)
      setResult(res)
      if (!res.success) {
        setError(res.error ?? '识别失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败')
      setProgress({ status: 'error', percent: 0, message: '错误' })
    }
  }

  // ── 清空 ──

  function handleReset() {
    setFile(null)
    setPreview(null)
    setResult(null)
    setProgress(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  // ── 检查服务健康 ──

  async function checkHealth() {
    setServiceHealth('检查中...')
    try {
      const health = await OcrService.health()
      setServiceHealth(
        health.status === 'ok'
          ? `✅ 服务正常 | GPU: ${health.gpu} | 模型: ${health.model}`
          : `❌ 服务异常: ${health.detail}`,
      )
    } catch {
      setServiceHealth('❌ 无法连接 OCR 服务')
    }
  }

  // ── 拖拽上传 ──

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    const syntheticEvent = { target: { files: [f] } } as unknown as React.ChangeEvent<HTMLInputElement>
    handleSelect(syntheticEvent)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ── 页面标题 ── */}
      <PageHeader
        title="🔍 OCR 测试台"
        subtitle="上传试卷 / 答题卡 / PDF，验证 OCR 识别效果"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={checkHealth}>
              检查服务状态
            </Button>
            {serviceHealth && (
              <span className="text-xs text-text-tertiary">{serviceHealth}</span>
            )}
          </div>
        }
      />

      {/* ── 上传区域 ── */}
      <GlassCard
        hover={false}
        className="border-2 border-dashed border-surface-tertiary p-8 text-center transition hover:border-accent/50"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {!file ? (
          <div>
            <div className="mb-3 text-4xl text-text-tertiary">📄</div>
            <p className="mb-2 text-sm text-text-secondary">
              拖拽文件到此处，或
              <button
                onClick={() => inputRef.current?.click()}
                className="mx-1 font-medium text-accent hover:text-accent-hover"
              >
                浏览文件
              </button>
            </p>
            <p className="text-xs text-text-tertiary">支持 JPG / PNG / PDF，最大 20MB</p>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-glass-sm bg-surface-secondary p-4 text-left">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{file.type === 'application/pdf' ? '📕' : '🖼️'}</span>
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
                disabled={progress?.status === 'uploading' || progress?.status === 'processing'}
                loading={progress?.status === 'processing'}
              >
                {progress?.status === 'processing' ? '识别中...' : '开始 OCR'}
              </Button>
              <Button variant="secondary" onClick={handleReset}>
                更换
              </Button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* ── 进度条 ── */}
      {progress && progress.status !== 'done' && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-tertiary">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progress.status === 'error' ? 'bg-danger' : 'bg-accent'
            }`}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      )}

      {/* ── 错误提示 ── */}
      {error && (
        <div className="rounded-glass-sm border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          ❌ {error}
        </div>
      )}

      {/* ── 结果展示 ── */}
      {result && result.success && (
        <div className="space-y-6">
          {/* 图片预览 */}
          {preview && (
            <GlassCard hover={false} className="overflow-hidden p-0">
              <div className="border-b border-surface-tertiary px-4 py-2 text-xs font-medium text-text-secondary">原图预览</div>
              <div className="flex items-center justify-center bg-surface-secondary p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="原图"
                  className="max-h-96 rounded-glass-sm object-contain shadow-glass-elevated"
                />
              </div>
            </GlassCard>
          )}

          {/* 统计卡片 */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="页数" value={`${result.pages} 页`} icon={<span>📄</span>} />
            <StatCard label="识别字数" value={`${result.chars} 字`} icon={<span>📝</span>} />
            <StatCard label="耗时" value={`${result.elapsed}s`} icon={<span>⏱️</span>} />
          </div>

          {/* OCR 文本 */}
          <GlassCard hover={false} className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-surface-tertiary px-4 py-3">
              <h2 className="text-sm font-semibold text-text-primary">📝 OCR 识别结果</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigator.clipboard.writeText(result.text)}
              >
                复制全文
              </Button>
            </div>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap p-4 font-mono text-sm leading-relaxed text-text-primary">
              {OcrService.formatPreview(result.text)}
            </pre>
          </GlassCard>

          {/* 逐页详情（仅多页时展示） */}
          {result.raw && result.raw.pages.length > 1 && (
            <GlassCard hover={false} className="overflow-hidden p-0">
              <div className="border-b border-surface-tertiary px-4 py-3">
                <h2 className="text-sm font-semibold text-text-primary">📑 逐页详情</h2>
              </div>
              <div className="divide-y divide-surface-tertiary">
                {result.raw.pages.map((page) => (
                  <details key={page.page} className="group">
                    <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm text-text-secondary hover:bg-accent-subtle/30">
                      <span className="rounded-full bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-secondary">
                        第 {page.page} 页
                      </span>
                      <span className="text-text-tertiary">
                        {page.text.slice(0, 60)}
                        {page.text.length > 60 ? '...' : ''}
                      </span>
                    </summary>
                    <pre className="whitespace-pre-wrap bg-surface-secondary p-4 font-mono text-sm text-text-secondary">
                      {page.text || '（无文本）'}
                    </pre>
                  </details>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      )}
    </div>
  )
}
