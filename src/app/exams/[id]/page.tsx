import { AnalysisResultDisplay, StatCard as ReportStatCard } from '@/components/analysis/ResultDisplay'
import AnalysisFeedback from '@/components/analysis/AnalysisFeedback'
import { prisma } from '@/lib/prisma'
import { DifficultyEngineService } from '@/services/difficulty-engine.service'
import Link from 'next/link'
import { ArrowLeft, Upload, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui-system/Badge'
import { ExamTitleEditor } from '@/components/exam/ExamTitleEditor'

// ── Helpers ──

const statusBadge: Record<string, { variant: 'success' | 'warning' | 'danger' | 'default'; label: string }> = {
  COMPLETED: { variant: 'success', label: '已完成' },
  PROCESSING: { variant: 'warning', label: '分析中' },
  PENDING: { variant: 'default', label: '待分析' },
  FAILED: { variant: 'danger', label: '失败' },
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('zh-CN')
}

// ── Data Fetch (direct Prisma) ──

async function getExam(id: string) {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        analysisReports: { orderBy: { createdAt: 'desc' }, take: 1 },
        questions: { orderBy: { sortOrder: 'asc' } },
        questionResults: {
          include: { question: true },
          orderBy: { question: { sortOrder: 'asc' } },
        },
        examSession: { select: { id: true, name: true } },
      },
    })
    return exam
  } catch {
    return null
  }
}

// ═══════════════════ Page ═══════════════════

export default async function ExamDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const exam = await getExam(id)
  const difficulty = exam ? await DifficultyEngineService.getOrCreate(id) : null

  if (!exam) {
    return (
      <div className="space-y-6">
        <Link href="/exams" className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
          <ArrowLeft className="h-4 w-4" /> 返回考试列表
        </Link>
        <div className="glass-card-static p-8 text-center">
          <h1 className="text-xl font-bold text-text-primary">考试记录不存在</h1>
          <p className="mt-1 text-sm text-text-secondary">该考试记录可能已被删除。</p>
        </div>
      </div>
    )
  }

  const report = exam.analysisReports?.[0] ?? null
  const aiStatus = statusBadge[exam.aiStatus] ?? { variant: 'default' as const, label: exam.aiStatus }

  return (
    <div className="space-y-8">
      {/* ── Navigation ── */}
      <div className="flex items-center gap-2 text-sm text-text-tertiary">
        <Link href="/exams" className="text-accent hover:underline">考试记录</Link>
        {exam.examSession && (
          <>
            <span>/</span>
            <Link href={`/exam-sessions/${exam.examSession.id}`} className="text-accent hover:underline">
              {exam.examSession.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-text-secondary">{exam.subject}</span>
      </div>

      {/* ── Header Card ── */}
      <div className="glass-card-static p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <ExamTitleEditor examId={exam.id} initialTitle={exam.title} />
              <Badge variant={aiStatus.variant} size="md">
                {aiStatus.label}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
              <span className="rounded-glass-sm bg-accent-subtle px-2 py-0.5 text-xs font-medium text-accent">
                {exam.subject}
              </span>
              <span>{exam.grade}</span>
              <span>·</span>
              <span>得分 {exam.totalScore}</span>
              <span>·</span>
              <span>{fmtDate(exam.examDate)}</span>
              <span>·</span>
              <span>{new Date(exam.createdAt).toLocaleString('zh-CN')} 创建</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/upload-answer-sheet?examId=${exam.id}`}
              className="inline-flex items-center gap-2 rounded-glass-sm border border-glass-border bg-glass-bg px-4 py-2 text-sm font-medium text-text-primary transition-all hover:shadow-glass-elevated hover:brightness-95"
            >
              <Upload className="h-4 w-4" />
              上传答题卡
            </a>
            <Link
              href={`/upload-exam?examId=${exam.id}`}
              className="inline-flex items-center gap-2 rounded-glass-sm bg-accent px-4 py-2 text-sm font-medium text-white transition-all hover:bg-accent-hover"
            >
              <Sparkles className="h-4 w-4" />
              新建分析
            </Link>
          </div>
        </div>
      </div>

      {/* ── Exam Difficulty ── */}
      {difficulty && (
        <div className="glass-card-static p-6">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">📊 考试难度</h2>
          <div className="flex items-center gap-6">
            {/* 难度系数 */}
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold tracking-tight text-text-primary">
                {difficulty.difficultyScore.toFixed(2)}
              </span>
              <span className="text-xs text-text-tertiary">难度系数</span>
            </div>
            <div className="h-8 w-px bg-surface-tertiary" />
            {/* 等级标签 */}
            <div className="flex items-center gap-2">
              <DifficultyBadge level={difficulty.difficultyLevel} />
              <span className="text-xs text-text-tertiary">难度等级</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Analysis Report ── */}
      {report ? (
        <div className="space-y-6">
          {/* Token / Duration Stats */}
          <div className="flex flex-wrap gap-3">
            {report.durationMs != null && (
              <ReportStatCard label="耗时" value={`${report.durationMs}ms`} color="blue" />
            )}
            {report.promptTokens != null && (
              <ReportStatCard label="Prompt" value={report.promptTokens.toLocaleString()} color="indigo" />
            )}
            {report.completionTokens != null && (
              <ReportStatCard label="Completion" value={report.completionTokens.toLocaleString()} color="violet" />
            )}
            {report.totalTokens != null && (
              <ReportStatCard label="Total" value={report.totalTokens.toLocaleString()} color="purple" />
            )}
          </div>

          <div className="glass-card-static p-6">
            <AnalysisResultDisplay
              data={{
                subject: report.subject,
                summary: report.summary,
                knowledgePoints: report.knowledgePoints as AnalysisTestResultData['knowledgePoints'],
                weaknesses: report.weaknesses as AnalysisTestResultData['weaknesses'],
                strengths: report.strengths as AnalysisTestResultData['strengths'],
                studySuggestions: (report.studySuggestions as Array<{ priority: number; content: string; type: string }>).map((s) => ({
                  ...s,
                  type: s.type as 'PRACTICE' | 'REVIEW' | 'VIDEO' | 'READING',
                })),
              }}
            />
          </div>

          {/* ── Feedback ── */}
          <AnalysisFeedback reportId={report.id} />
        </div>
      ) : (
        <div className="glass-card-static p-8 text-center">
          <p className="text-text-secondary">该考试暂无 AI 分析报告。</p>
        </div>
      )}

      {/* ── Questions List ── */}
      {exam.questions && exam.questions.length > 0 && (
        <div className="glass-card-static p-6">
          <h2 className="mb-5 text-lg font-semibold text-text-primary">📋 题目列表</h2>
          <div className="space-y-3">
            {exam.questions.map((q) => {
              const result = exam.questionResults?.find((r) => r.questionId === q.id)
              return (
                <details
                  key={q.id}
                  className="group rounded-glass-sm surface-card transition-all open:shadow-glass-elevated"
                >
                  <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm font-medium text-text-primary">
                    <span className="flex h-7 w-7 items-center justify-center rounded-glass-sm bg-accent-subtle text-xs font-bold text-accent">
                      {q.questionNo}
                    </span>
                    <Badge size="sm" variant="default">
                      {q.questionType}
                    </Badge>
                    {result && (
                      <>
                        <span className="text-xs text-text-tertiary">
                          得分: {result.score}/{result.fullScore}
                        </span>
                        <Badge size="sm" variant={result.isCorrect ? 'success' : 'danger'}>
                          {result.isCorrect ? '✓' : '✗'}
                        </Badge>
                      </>
                    )}
                    <span className="ml-auto text-xs text-text-tertiary">
                      {q.fullScore} 分
                    </span>
                  </summary>
                  <div className="border-t border-surface-tertiary px-4 py-4">
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
                      {q.questionText}
                    </pre>
                    {q.subQuestions && Array.isArray(q.subQuestions) && q.subQuestions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-text-tertiary">子题：</p>
                        <ol className="list-inside list-decimal space-y-1 text-sm text-text-secondary">
                          {(q.subQuestions as Array<{ label?: string; text: string; score?: number }>).map((sq, i) => (
                            <li key={i}>
                              {sq.label && <span className="font-medium">{sq.label}. </span>}
                              {sq.text}
                              {sq.score != null && (
                                <span className="ml-1 text-xs text-text-tertiary">({sq.score}分)</span>
                              )}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                </details>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Question Results Table ── */}
      {exam.questionResults && exam.questionResults.length > 0 && (
        <div className="glass-card-static p-6">
          <h2 className="mb-5 text-lg font-semibold text-text-primary">📊 题目成绩表</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-tertiary text-xs font-medium text-text-tertiary uppercase">
                  <th className="px-4 py-3">题号</th>
                  <th className="px-4 py-3">题型</th>
                  <th className="px-4 py-3">分值</th>
                  <th className="px-4 py-3">得分</th>
                  <th className="px-4 py-3">得分率</th>
                  <th className="px-4 py-3">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-tertiary">
                {exam.questionResults.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-accent-subtle/30">
                    <td className="px-4 py-3 font-medium text-text-primary">{r.question.questionNo}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.question.questionType}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.fullScore}</td>
                    <td className="px-4 py-3 font-medium text-text-primary">{r.score}</td>
                    <td className="px-4 py-3">
                      <Badge
                        size="sm"
                        variant={r.scoreRate >= 0.6 ? 'success' : r.scoreRate >= 0.3 ? 'warning' : 'danger'}
                      >
                        {(r.scoreRate * 100).toFixed(0)}%
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge size="sm" variant={r.isCorrect ? 'success' : 'danger'}>
                        {r.isCorrect ? '正确' : '错误'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-surface-tertiary bg-surface-secondary font-medium">
                  <td colSpan={3} className="px-4 py-3 text-right text-text-secondary">
                    合计
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {exam.questionResults.reduce((s, r) => s + r.score, 0)}
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {(() => {
                      const total = exam.questionResults.reduce((s, r) => s + r.fullScore, 0)
                      const scored = exam.questionResults.reduce((s, r) => s + r.score, 0)
                      return total > 0 ? `${((scored / total) * 100).toFixed(0)}%` : '—'
                    })()}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Difficulty Helpers ──

const DIFFICULTY_STYLES: Record<string, { variant: 'success' | 'info' | 'warning' | 'danger'; label: string }> = {
  Easy: { variant: 'success', label: 'Easy 简单' },
  Normal: { variant: 'info', label: 'Normal 中等' },
  Hard: { variant: 'warning', label: 'Hard 困难' },
  'Very Hard': { variant: 'danger', label: 'Very Hard 极难' },
}

function DifficultyBadge({ level }: { level: string }) {
  const style = DIFFICULTY_STYLES[level] ?? { variant: 'info' as const, label: level }
  return <Badge variant={style.variant} size="md">{style.label}</Badge>
}

// ── Lightweight type for JSON deserialized data ──
type AnalysisTestResultData = {
  knowledgePoints: Array<{ name: string; score: string; total: string; mastery: string }>
  weaknesses: Array<{ name: string; scoreRate: number; diagnosis: string }>
  strengths: Array<{ name: string; scoreRate: number; comment: string }>
  studySuggestions: Array<{ priority: number; content: string; type: string }>
}
