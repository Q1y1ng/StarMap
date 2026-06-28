'use client'

import type { AnalysisTestResult } from '@/types/analysis-test'
import { Progress } from '@/components/ui-system/Progress'

// ── 知识点进度条 ──
export function KnowledgePointsList({ knowledgePoints }: { knowledgePoints: AnalysisTestResult['knowledgePoints'] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-text-primary">📋 知识点清单</h2>
      <div className="space-y-2">
        {knowledgePoints.map((kp, i) => (
          <div key={i} className="rounded-glass-sm border-glass-border bg-surface p-3 shadow-glass-elevated transition hover:shadow-glass">
            <div className="flex items-center justify-between">
              <span className="font-medium text-text-primary">{kp.name}</span>
              <span className="text-sm tabular-nums text-text-secondary">
                {kp.score}/{kp.total}
              </span>
            </div>
            <div className="mt-1.5">
              <Progress value={parseFloat(kp.mastery)} size="sm" color="accent" />
            </div>
            <div className="mt-1 text-right text-xs text-text-tertiary">{kp.mastery}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── 薄弱点 ──
export function WeaknessesList({ weaknesses }: { weaknesses: AnalysisTestResult['weaknesses'] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-danger">🔻 薄弱点</h2>
      {weaknesses.length === 0 ? (
        <p className="rounded-glass-sm border border-success/30 bg-success/10 p-4 text-sm text-success">暂无薄弱点，继续保持！</p>
      ) : (
        <div className="space-y-2">
          {weaknesses.map((w, i) => (
            <div key={i} className="rounded-glass-sm border border-danger/20 bg-danger/10 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-danger">{w.name}</span>
                <span className="text-sm font-semibold text-danger">{w.scoreRate}%</span>
              </div>
              <p className="mt-1 text-sm text-danger">{w.diagnosis}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ── 优势点 ──
export function StrengthsList({ strengths }: { strengths: AnalysisTestResult['strengths'] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-success">✅ 优势点</h2>
      {strengths.length === 0 ? (
        <p className="text-sm text-text-tertiary">暂无优势点数据。</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {strengths.map((s, i) => (
            <div key={i} className="rounded-glass-sm border border-success/20 bg-success/10 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-success">{s.name}</span>
                <span className="text-sm font-semibold text-success">{s.scoreRate}%</span>
              </div>
              <p className="mt-1 text-sm text-success">{s.comment}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function typeLabel(type: string) {
  const map: Record<string, string> = { PRACTICE: '练习', REVIEW: '复习', VIDEO: '视频', READING: '阅读' }
  return map[type] ?? type
}

// ── 学习建议 ──
export function StudySuggestionsList({ studySuggestions }: { studySuggestions: AnalysisTestResult['studySuggestions'] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-accent">🎯 学习建议</h2>
      <div className="space-y-3">
        {studySuggestions.map((s, i) => (
          <div key={i} className="flex gap-3 rounded-glass-sm border-glass-border bg-surface p-4 shadow-glass-elevated">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
              {s.priority}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-text-primary">{s.content}</p>
                <span className="shrink-0 rounded bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                  {typeLabel(s.type)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Token/耗时统计卡片 ──
export function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'border-accent/20 bg-accent/10 text-accent',
    indigo: 'border-info/20 bg-info/10 text-info',
    violet: 'border-info/20 bg-info/10 text-info',
    purple: 'border-info/20 bg-info/10 text-info',
  }
  return (
    <div className={`flex items-center gap-3 rounded-glass-sm border px-4 py-2.5 ${colorMap[color] ?? colorMap.blue}`}>
      <span className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</span>
      <span className="text-lg font-bold tabular-nums">{value}</span>
    </div>
  )
}

// ── 汇总框 ──
export function SummaryBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    green: 'text-success',
    red: 'text-danger',
    blue: 'text-accent',
    purple: 'text-info',
    zinc: 'text-text-secondary',
  }
  return (
    <div className="rounded-glass-sm border-glass-border bg-surface p-3">
      <div className="text-xs text-text-tertiary">{label}</div>
      <div className={`mt-0.5 text-xl font-bold tabular-nums ${colors[color] ?? colors.zinc}`}>{value}</div>
    </div>
  )
}

// ── 完整分析结果展示 ──
export function AnalysisResultDisplay({ data }: { data: AnalysisTestResult }) {
  return (
    <div className="space-y-6">
      {/* 总体摘要 */}
      <div className="rounded-glass-sm border border-accent/20 bg-accent/10 p-4">
        <div className="text-xs font-medium uppercase tracking-wider text-accent">总体评价</div>
        <div className="mt-1 text-lg font-semibold text-accent">{data.subject}</div>
        <p className="mt-1 text-sm text-accent">{data.summary}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <KnowledgePointsList knowledgePoints={data.knowledgePoints} />
        <WeaknessesList weaknesses={data.weaknesses} />
      </div>

      <StrengthsList strengths={data.strengths} />

      <StudySuggestionsList studySuggestions={data.studySuggestions} />

      {/* JSON 原始数据 */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-text-tertiary hover:text-text-secondary">
          查看原始 JSON 数据
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-xs text-zinc-300">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  )
}
