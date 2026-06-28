import type { AiCallMeta } from './ai'

// ── 单条质量日志 ──

export type QualityLogEntry = {
  id: string
  timestamp: string
  inputContent: string
  outputData: unknown
  meta: AiCallMeta
  schemaValid: boolean
  schemaErrors?: string[]
  error?: string
}

// ── 内存日志存储（开发期用，重启即失） ──

const logs: QualityLogEntry[] = []

let idCounter = 0

export function pushQualityLog(entry: Omit<QualityLogEntry, 'id' | 'timestamp'>): QualityLogEntry {
  const log: QualityLogEntry = {
    id: `log_${Date.now()}_${++idCounter}`,
    timestamp: new Date().toISOString(),
    ...entry,
  }
  logs.unshift(log) // 最新在前面
  return log
}

export function getQualityLogs(limit = 50): QualityLogEntry[] {
  return logs.slice(0, limit)
}

export function getQualityStats() {
  if (logs.length === 0) {
    return { total: 0, passed: 0, failed: 0, avgDuration: 0, avgTokens: 0, passRate: 0 }
  }

  const total = logs.length
  const passed = logs.filter((l) => l.schemaValid).length
  const failed = total - passed
  const avgDuration = Math.round(logs.reduce((s, l) => s + l.meta.durationMs, 0) / total)
  const tokensList = logs
    .map((l) => l.meta.usage?.totalTokens ?? 0)
    .filter((t) => t > 0)
  const avgTokens = tokensList.length > 0 ? Math.round(tokensList.reduce((s, t) => s + t, 0) / tokensList.length) : 0

  return { total, passed, failed, avgDuration, avgTokens, passRate: total > 0 ? passed / total : 0 }
}
