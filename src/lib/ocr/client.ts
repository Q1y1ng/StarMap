// ── OCR 服务 HTTP 客户端 ─────────────────────────────────
// 封装对本地 OCR Service (FastAPI) 的调用

import type { OcrHealth, OcrResponse } from './types'

const OCR_SERVICE_URL = process.env.NEXT_PUBLIC_OCR_URL ?? 'http://localhost:8000'

/**
 * 构建 FormData 上传文件
 */
function buildForm(file: File | Blob, filename: string): FormData {
  const fd = new FormData()
  fd.append('file', file, filename)
  return fd
}

/**
 * 健康检查 — 检测 OCR 服务是否在线
 */
export async function checkOcrHealth(): Promise<OcrHealth> {
  const res = await fetch(`${OCR_SERVICE_URL}/health`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    return { status: 'error', gpu: false, model: 'unknown', lang: 'unknown', detail: `HTTP ${res.status}` }
  }
  return res.json()
}

/**
 * 单文件 OCR — 上传并识别
 */
export async function ocrFile(
  file: File | Blob,
  filename: string,
  signal?: AbortSignal,
): Promise<OcrResponse> {
  const fd = buildForm(file, filename)

  const res = await fetch(`${OCR_SERVICE_URL}/ocr`, {
    method: 'POST',
    body: fd,
    signal: signal ?? AbortSignal.timeout(120_000),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(body.detail ?? `OCR 请求失败 (${res.status})`)
  }

  return res.json()
}

/**
 * 批量 OCR — 多个文件并行识别
 */
export async function ocrFiles(
  files: { file: File | Blob; name: string }[],
): Promise<OcrResponse[]> {
  return Promise.all(
    files.map(({ file, name }) => ocrFile(file, name)),
  )
}
