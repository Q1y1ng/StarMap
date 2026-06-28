'use client'

import { useRef } from 'react'
import { GlassCard } from './GlassCard'
import { Button } from './Button'

// ── 通用文件上传区域组件 ────────────────────────────
// 在 analysis-test、upload-paper 等多区域上传页面中复用
// 支持拖拽、多文件、图片预览、移除

export type UploadFileItem = {
  file: File
  preview: string | null // object URL for images, null for PDFs
}

export type FileUploadZoneProps = {
  /** 区域标签（如 "试卷"、"答题卡"、"小分截图"） */
  label: string
  /** 显示的 Emoji 图标 */
  icon: string
  /** 文件列表 */
  files: UploadFileItem[]
  /** 接受的 MIME 类型 */
  accept?: string
  /** 是否允许多文件 */
  multiple?: boolean
  /** 添加文件 */
  onAdd: (newFiles: File[]) => void
  /** 移除文件 */
  onRemove: (index: number) => void
  /** 格式化文件大小的函数 */
  formatSize?: (bytes: number) => string
  /** 可选：当区域为空时自定义提示信息 */
  hint?: string
}

function defaultFmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function FileUploadZone({
  label,
  icon,
  files,
  accept = '.jpg,.jpeg,.png,.pdf',
  multiple = true,
  onAdd,
  onRemove,
  formatSize = defaultFmtSize,
  hint,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      onAdd(Array.from(e.target.files))
      e.target.value = ''
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    onAdd(Array.from(e.dataTransfer.files))
  }

  const totalSize = files.reduce((s, f) => s + f.file.size, 0)

  return (
    <GlassCard hover={false} className="overflow-hidden p-0">
      <div className="border-b border-surface-tertiary px-4 py-3 text-sm font-semibold text-text-primary">
        {icon} {label}
      </div>

      {files.length === 0 ? (
        <div
          className="flex cursor-pointer flex-col items-center justify-center p-8 text-center transition hover:bg-surface-secondary/50"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
        >
          <div className="mb-3 text-4xl text-text-tertiary">{icon}</div>
          <p className="mb-1 text-sm text-text-secondary">
            拖拽{hint || `${label}文件`}到此处，或
            <span className="mx-1 font-semibold text-accent">浏览</span>
          </p>
          <p className="text-xs text-text-tertiary">
            支持{accept.replace(/\./g, '').toUpperCase().replace(/,/g, ' / ')}
            {multiple ? ' · 支持多文件' : ''}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      ) : (
        <div className="p-4">
          <div className="space-y-2">
            {files.map((item, i) => (
              <div
                key={`${item.file.name}-${i}`}
                className="flex items-center justify-between rounded-glass-sm border border-surface-tertiary bg-surface-secondary p-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {item.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.preview}
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
                      {item.file.name}
                    </p>
                    <p className="text-xs text-text-tertiary">{formatSize(item.file.size)}</p>
                  </div>
                </div>
                <button
                  onClick={() => onRemove(i)}
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
              {files.length} 个文件 · {formatSize(totalSize)}
            </span>
            <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
              继续添加
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              multiple={multiple}
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </div>
      )}
    </GlassCard>
  )
}
