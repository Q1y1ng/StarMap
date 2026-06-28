'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { GlassCard } from '@/components/ui-system/GlassCard'
import { Badge } from '@/components/ui-system/Badge'
import { Spinner } from '@/components/ui-system/Spinner'
import { PageHeader } from '@/components/ui-system/PageHeader'
import { Button } from '@/components/ui-system/Button'
import {
  BookOpen,
  RefreshCw,
  Download,
  AlertTriangle,
  Trash2,
} from 'lucide-react'

// ── 中文字体缓存（仅需加载一次） ──
let cachedFontBytes: { regular: ArrayBuffer; bold: ArrayBuffer } | undefined
const CJK_FONT_REGULAR = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf'
const CJK_FONT_BOLD = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Bold.otf'
async function getFontBytes() {
  if (!cachedFontBytes) {
    const [regular, bold] = await Promise.all([
      fetch(CJK_FONT_REGULAR).then(r => r.arrayBuffer()),
      fetch(CJK_FONT_BOLD).then(r => r.arrayBuffer()),
    ])
    cachedFontBytes = { regular, bold }
  }
  return cachedFontBytes
}

// ── Types ──

type WrongQuestionItem = {
  id: string
  questionId: string
  examId: string
  subject: string
  knowledgePoint: string
  wrongCount: number
  latestScoreRate: number
  priorityScore: number
  createdAt: string
  updatedAt: string
  question: {
    questionNo: number
    questionType: string
    fullScore: number
    questionText: string
  }
  exam: {
    title: string
    examDate: string
  }
}

type WrongBookData = {
  items: WrongQuestionItem[]
  subjects: string[]
  total: number
}

// ── Helpers ──

function fmtDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function scoreRateBadge(rate: number) {
  if (rate < 0.3) return { variant: 'danger' as const, label: `${Math.round(rate * 100)}%` }
  if (rate < 0.6) return { variant: 'warning' as const, label: `${Math.round(rate * 100)}%` }
  return { variant: 'success' as const, label: `${Math.round(rate * 100)}%` }
}

function priorityLabel(score: number) {
  if (score >= 2.0) return { label: '🔴 极高', color: 'text-danger' }
  if (score >= 1.2) return { label: '🟠 高', color: 'text-warning' }
  if (score >= 0.6) return { label: '🟡 中', color: 'text-amber-400' }
  return { label: '🟢 低', color: 'text-success' }
}

const SUBJECTS_ALL = '全部'
const subjectEmoji: Record<string, string> = {
  '语文': '📖', '数学': '📐', '英语': '🔤',
  '物理': '⚡', '化学': '🧪', '生物': '🧬',
  '历史': '📜', '地理': '🌍', '政治': '⚖️',
}

// ── Animation ──

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 16 } as const,
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
}

// ═══════════════════ Page ═══════════════════

export default function WrongBookPage() {
  const [data, setData] = useState<WrongBookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSubject, setActiveSubject] = useState(SUBJECTS_ALL)
  const [exporting, setExporting] = useState(false)

  const fetchData = useCallback(async (subject?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '200')
      if (subject && subject !== SUBJECTS_ALL) params.set('subject', subject)
      const res = await fetch(`/api/wrong-book?${params}`)
      const json = await res.json()
      if (json.success) setData(json.data)
    } catch (err) {
      console.error('加载错题本失败:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    const params = new URLSearchParams()
    params.set('limit', '200')
    fetch(`/api/wrong-book?${params}`)
      .then(r => r.json())
      .then(json => { if (mounted && json.success) setData(json.data) })
      .catch(err => { if (mounted) console.error('加载错题本失败:', err) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  // 按科目筛选（前端过滤，更流畅）
  const filteredItems = useMemo(
    () => data?.items.filter(
      (item) => activeSubject === SUBJECTS_ALL || item.subject === activeSubject,
    ) ?? [],
    [data, activeSubject],
  )

  // 导出 PDF
  const handleExportPDF = useCallback(async () => {
    if (!data || filteredItems.length === 0) return
    setExporting(true)

    try {
      const { PDFDocument, rgb } = await import('pdf-lib')

      const pdfDoc = await PDFDocument.create()

      // 嵌入中文字体（变量字体，一个文件包含全部字重）
      let font, fontBold
      try {
        const fontkit = await import('fontkit')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pdfDoc.registerFontkit((fontkit.default ?? fontkit) as any)

        const { regular: fontRegularBytes, bold: fontBoldBytes } = await getFontBytes()
        font = await pdfDoc.embedFont(fontRegularBytes, { subset: false })
        fontBold = await pdfDoc.embedFont(fontBoldBytes, { subset: false })
      } catch {
        // 中文字体加载失败时，使用标准字体作为降级（不支持中文，但不崩溃）
        const { StandardFonts } = await import('pdf-lib')
        font = await pdfDoc.embedFont(StandardFonts.Helvetica)
        fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      }

      const pageWidth = 595.28
      const pageHeight = 841.89
      const margin = 50
      const contentWidth = pageWidth - margin * 2

      let page = pdfDoc.addPage([pageWidth, pageHeight])
      let y = pageHeight - margin

      // ── Title ──
      page.drawText('错题本', {
        x: margin,
        y,
        size: 24,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.15),
      })
      y -= 12

      page.drawText(`生成日期：${fmtDate(new Date().toISOString())}${activeSubject !== SUBJECTS_ALL ? ` ｜ 科目：${activeSubject}` : ''}`, {
        x: margin,
        y,
        size: 10,
        font,
        color: rgb(0.5, 0.5, 0.5),
      })
      y -= 8

      page.drawText(`共 ${filteredItems.length} 道错题`, {
        x: margin,
        y,
        size: 10,
        font,
        color: rgb(0.5, 0.5, 0.5),
      })
      y -= 20

      // ── Table Header ──
      const cols = [
        { key: 'no', label: '题号', width: 30 },
        { key: 'question', label: '原题', width: 175 },
        { key: 'kp', label: '知识点', width: 85 },
        { key: 'wrong', label: '错误次数', width: 45 },
        { key: 'rate', label: '得分率', width: 40 },
        { key: 'priority', label: '优先级', width: 45 },
        { key: 'exam', label: '考试', width: 75 },
      ]

      const drawTableHeader = (yPos: number) => {
        page.drawRectangle({
          x: margin,
          y: yPos - 18,
          width: contentWidth,
          height: 20,
          color: rgb(0.9, 0.92, 0.95),
        })
        let x = margin + 6
        for (const col of cols) {
          page.drawText(col.label, {
            x,
            y: yPos - 14,
            size: 9,
            font: fontBold,
            color: rgb(0.3, 0.3, 0.4),
          })
          x += col.width
        }
        return yPos - 22
      }

      y = drawTableHeader(y)

      // ── Table Rows（使用 forEach 避免 indexOf O(n²)） ──
      filteredItems.forEach((item, idx) => {
        if (y < 80) {
          page = pdfDoc.addPage([pageWidth, pageHeight])
          y = pageHeight - margin
          y = drawTableHeader(y)
        }

        const ratePct = Math.round(item.latestScoreRate * 100)
        const examTitle = item.exam.title.length > 18
          ? item.exam.title.slice(0, 18) + '…'
          : item.exam.title

        // 原题文本（截取前 24 字）
        const questionPreview = item.question.questionText
          ? (item.question.questionText.length > 24 ? item.question.questionText.slice(0, 24) + '…' : item.question.questionText)
          : '-'

        let x = margin + 6
        const row = [
          { text: String(item.question.questionNo), w: cols[0].width },
          { text: questionPreview, w: cols[1].width },
          { text: item.knowledgePoint.length > 10 ? item.knowledgePoint.slice(0, 10) + '…' : item.knowledgePoint, w: cols[2].width },
          { text: `${item.wrongCount} 次`, w: cols[3].width },
          { text: `${ratePct}%`, w: cols[4].width },
          { text: item.priorityScore.toFixed(2), w: cols[5].width },
          { text: examTitle, w: cols[6].width },
        ]

        // Alternate row background（基于 idx 替代 indexOf）
        if (idx % 2 === 0) {
          page.drawRectangle({
            x: margin,
            y: y - 16,
            width: contentWidth,
            height: 18,
            color: rgb(0.97, 0.97, 0.99),
          })
        }

        for (const cell of row) {
          page.drawText(cell.text, {
            x,
            y: y - 12,
            size: 8,
            font,
            color: rgb(0.2, 0.2, 0.25),
          })
          x += cell.w
        }

        y -= 20
      })

      // ── Footer ──
      page.drawText(`StarMap 错题本 ｜ 生成于 ${new Date().toLocaleString('zh-CN')}`, {
        x: margin,
        y: 30,
        size: 8,
        font,
        color: rgb(0.6, 0.6, 0.6),
      })

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `StarMap-错题本-${fmtDate(new Date().toISOString())}${activeSubject !== SUBJECTS_ALL ? `-${activeSubject}` : ''}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF 导出失败:', err)
      toast.error('PDF 导出失败，请查看控制台了解详情')
    } finally {
      setExporting(false)
    }
  }, [data, filteredItems, activeSubject])

  // ── Render ──

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
      {/* ── Header ── */}
      <motion.div variants={fadeUp} className="flex items-start justify-between">
        <PageHeader
          title="📕 错题本"
          subtitle={
            data
              ? `共 ${data.total} 道错题 · ${data.subjects.length} 个科目`
              : '加载中…'
          }
        />
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => fetchData()}
          >
            刷新
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Download className="h-4 w-4" />}
            onClick={handleExportPDF}
            loading={exporting}
            disabled={filteredItems.length === 0}
          >
            导出 PDF
          </Button>
        </div>
      </motion.div>

      {/* ── Summary Stats ── */}
      {data && (
        <motion.div variants={fadeUp} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <GlassCard gradient="red" className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">📕 错题总数</p>
            <p className="mt-1 text-2xl font-bold text-text-primary">{data.total}</p>
          </GlassCard>
          <GlassCard gradient="amber" className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">📚 涉及科目</p>
            <p className="mt-1 text-2xl font-bold text-text-primary">{data.subjects.length}</p>
          </GlassCard>
          <GlassCard gradient="purple" className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">🎯 高优先级</p>
            <p className="mt-1 text-2xl font-bold text-text-primary">
              {data.items.filter((i) => i.priorityScore >= 1.2).length}
            </p>
          </GlassCard>
          <GlassCard gradient="green" className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">🔄 高频错题</p>
            <p className="mt-1 text-2xl font-bold text-text-primary">
              {data.items.filter((i) => i.wrongCount >= 3).length}
            </p>
          </GlassCard>
        </motion.div>
      )}

      {/* ── Subject Filter ── */}
      <motion.div variants={fadeUp}>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSubject(SUBJECTS_ALL)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              activeSubject === SUBJECTS_ALL
                ? 'bg-accent text-white'
                : 'glass text-text-secondary hover:brightness-95'
            }`}
          >
            📋 全部
          </button>
          {data?.subjects.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSubject(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                activeSubject === s
                  ? 'bg-accent text-white'
                  : 'glass text-text-secondary hover:brightness-95'
              }`}
            >
              {subjectEmoji[s] ?? '📝'} {s}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Wrong Questions Table ── */}
      <motion.div variants={fadeUp}>
        <GlassCard gradient="none" className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">
              {activeSubject === SUBJECTS_ALL ? '全部错题' : `${activeSubject} 错题`}
              <span className="ml-2 text-sm font-normal text-text-tertiary">
                {filteredItems.length} 道
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" label="加载错题本…" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
              <BookOpen className="mb-3 h-12 w-12 opacity-30" />
              <p className="text-sm">暂无错题记录</p>
              <p className="mt-1 text-xs">完成考试分析后，得分率低于 60% 的题将自动加入错题本</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-tertiary text-left text-xs uppercase text-text-tertiary">
                    <th className="pb-3 pr-3 font-medium">优先级</th>
                    <th className="pb-3 pr-3 font-medium">题号</th>
                    <th className="pb-3 pr-3 font-medium">题型</th>
                    <th className="pb-3 pr-3 font-medium">原题</th>
                    <th className="pb-3 pr-3 font-medium">知识点</th>
                    <th className="pb-3 pr-3 font-medium">错误次数</th>
                    <th className="pb-3 pr-3 font-medium">最近得分率</th>
                    <th className="pb-3 pr-3 font-medium">考试</th>
                    <th className="pb-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-tertiary">
                  {filteredItems.map((item) => {
                    const pri = priorityLabel(item.priorityScore)
                    const rate = scoreRateBadge(item.latestScoreRate)
                    return (
                      <tr
                        key={item.id}
                        className="transition-colors hover:bg-accent-subtle/30 group"
                      >
                        <td className="py-3 pr-3">
                          <span className={`text-xs font-semibold ${pri.color}`}>
                            {item.priorityScore.toFixed(2)}
                          </span>
                          <span className="ml-1 text-[10px] text-text-tertiary">{pri.label}</span>
                        </td>
                        <td className="py-3 pr-3 font-medium text-text-primary">
                          {item.question.questionNo}
                        </td>
                        <td className="py-3 pr-3">
                          <Badge size="sm" variant="default">
                            {item.question.questionType}
                          </Badge>
                        </td>
                        <td className="max-w-[200px] truncate py-3 pr-3 text-text-primary" title={item.question.questionText}>
                          {item.question.questionText || '-'}
                        </td>
                        <td className="max-w-[120px] truncate py-3 pr-3 text-text-secondary">
                          {item.knowledgePoint}
                        </td>
                        <td className="py-3 pr-3">
                          <Badge
                            size="sm"
                            variant={item.wrongCount >= 3 ? 'danger' : item.wrongCount >= 2 ? 'warning' : 'info'}
                          >
                            {item.wrongCount} 次
                          </Badge>
                        </td>
                        <td className="py-3 pr-3">
                          <Badge size="sm" variant={rate.variant}>
                            {rate.label}
                          </Badge>
                        </td>
                        <td className="max-w-[160px] truncate py-3 pr-3 text-text-tertiary">
                          <span title={item.exam.title}>
                            {item.exam.title}
                          </span>
                          <span className="ml-1 text-[10px]">
                            · {fmtDate(item.exam.examDate)}
                          </span>
                        </td>
                        <td className="py-3">
                          <button
                            onClick={async () => {
                              if (!confirm('确定删除这道错题记录？')) return
                              try {
                                const res = await fetch('/api/wrong-book', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ action: 'delete', id: item.id }),
                                })
                                const json = await res.json()
                                if (json.success) {
                                  fetchData(activeSubject === SUBJECTS_ALL ? undefined : activeSubject)
                                  toast.success('错题记录已删除')
                                }
                              } catch (err) {
                                console.error('删除失败:', err)
                              }
                            }}
                            className="p-1 text-text-tertiary opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                            title="删除记录"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* ── Tips ── */}
      <motion.div variants={fadeUp}>
        <GlassCard gradient="blue" className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <div className="text-xs text-text-secondary leading-relaxed">
              <p className="font-medium text-text-primary">📌 错题本生成规则</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                <li>得分率 &lt; 60% 的题目自动加入错题本</li>
                <li>同一题多次出错会累积错误次数，优先级自动升高</li>
                <li>优先级分 = 错误次数 × 0.4 + (1 - 最新得分率) × 0.4 + 知识点薄弱度 × 0.2</li>
                <li>高频错题（≥ 3 次）和高优先级（≥ 1.2）建议优先复习</li>
              </ul>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  )
}
