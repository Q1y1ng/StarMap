'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  ChevronDown,
  Search,
  TrendingUp,
  AlertTriangle,
  Network,
  ArrowRight,
  FileQuestion,
  Target,
} from 'lucide-react'
import { PageHeader } from '@/components/ui-system/PageHeader'
import { GlassCard } from '@/components/ui-system/GlassCard'
import { Badge } from '@/components/ui-system/Badge'
import { Tabs } from '@/components/ui-system/Tabs'
import { Spinner } from '@/components/ui-system/Spinner'
import { Progress } from '@/components/ui-system/Progress'

// ── Types ──

type TreeNode = {
  id: string
  subject: string
  name: string
  parentId: string | null
  level: number
  description: string | null
  childrenCount: number
  children?: TreeNode[]
}

type NodeDetail = {
  node: TreeNode
  path: { id: string; name: string; level: number }[]
  prerequisites: { id: string; name: string; subject: string }[]
  relatedNodes: { id: string; name: string; subject: string; relationType: string }[]
  masteryHistory: { examDate: string; mastery: number; score: number; fullScore: number }[]
  wrongQuestions: { id: string; questionNo: number; examTitle: string; wrongCount: number }[]
}

// ── Subject Tabs ──

const SUBJECT_TABS = [
  { key: '数学', label: '📐 数学' },
  { key: '物理', label: '⚡ 物理' },
  { key: '化学', label: '🧪 化学' },
  { key: '语文', label: '📖 语文' },
  { key: '英语', label: '🔤 英语' },
  { key: '地理', label: '🌍 地理' },
]

// ── Helpers ──

function masteryBadge(mastery: number): { variant: 'success' | 'warning' | 'danger'; label: string; color: 'success' | 'warning' | 'danger' } {
  if (mastery < 0.3) return { variant: 'danger', label: '薄弱', color: 'danger' }
  if (mastery < 0.6) return { variant: 'warning', label: '一般', color: 'warning' }
  return { variant: 'success', label: '良好', color: 'success' }
}

// ═══════════════════ Page ═══════════════════

export default function KnowledgeGraphPage() {
  const [subject, setSubject] = useState('数学')
  const [tree, setTree] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [nodeDetail, setNodeDetail] = useState<NodeDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TreeNode[]>([])
  const [searching, setSearching] = useState(false)

  // ── Load tree ──

  const loadTree = useCallback(async (subj: string) => {
    setLoading(true)
    setError(null)
    setSelectedNodeId(null)
    setNodeDetail(null)
    setExpandedIds(new Set())
    try {
      const res = await fetch(`/api/knowledge-graph?subject=${encodeURIComponent(subj)}`)
      const json = await res.json()
      if (json.success) {
        setTree(json.data)
        // Auto-expand root nodes
        setExpandedIds(new Set(json.data.map((n: TreeNode) => n.id)))
      } else {
        setError(json.error)
      }
    } catch {
      setError('加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTree(subject)
  }, [subject, loadTree])

  // ── Load node detail ──

  const loadNodeDetail = useCallback(async (nodeId: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/knowledge-graph/${nodeId}`)
      const json = await res.json()
      if (json.success) setNodeDetail(json.data)
    } catch {
      // silently fail
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId)
    loadNodeDetail(nodeId)
  }, [loadNodeDetail])

  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }, [])

  // ── Search ──

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`/api/knowledge-graph?search=${encodeURIComponent(searchQuery)}&subject=${encodeURIComponent(subject)}`)
      const json = await res.json()
      if (json.success) setSearchResults(json.data)
    } catch {
      // silent
    } finally {
      setSearching(false)
    }
  }, [searchQuery, subject])

  // ── Animation ──

  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
  }
  const fadeUp = {
    hidden: { opacity: 0, y: 16 } as const,
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
  }

  // ── Render Tree Node ──

  function TreeNodeItem({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
    const isExpanded = expandedIds.has(node.id)
    const isSelected = selectedNodeId === node.id
    const hasChildren = node.childrenCount > 0

    return (
      <div>
        <div
          className={`
            group flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-all duration-150
            ${isSelected ? 'bg-accent-subtle text-accent' : 'hover:bg-surface-secondary text-text-secondary hover:text-text-primary'}
          `}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => handleNodeClick(node.id)}
        >
          {/* Expand/Collapse */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleExpand(node.id) }}
            className={`shrink-0 rounded p-0.5 transition-colors hover:bg-surface-tertiary ${!hasChildren ? 'invisible' : ''}`}
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>

          {/* Node icon */}
          <span className="shrink-0 text-xs opacity-60">
            {node.level === 0 ? '📂' : node.childrenCount > 0 ? '📁' : '📄'}
          </span>

          {/* Name */}
          <span className={`truncate ${node.level === 0 ? 'font-semibold' : ''}`}>
            {node.name}
          </span>

          {/* Children count badge */}
          {hasChildren && (
            <span className="ml-auto text-[10px] text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100">
              {node.childrenCount}
            </span>
          )}
        </div>

        {/* Children */}
        {isExpanded && node.children && node.children.length > 0 && (
          <div>
            {node.children.map((child) => (
              <TreeNodeItem key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════ Render ═══════════════════

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp}>
        <PageHeader
          title="🧠 知识图谱"
          subtitle="标准高中知识体系结构可视化，支持展开/折叠查看知识点层级关系"
        />
      </motion.div>

      {/* Subject Tabs */}
      <motion.div variants={fadeUp}>
        <Tabs tabs={SUBJECT_TABS} activeKey={subject} onChange={setSubject} variant="pill" />
      </motion.div>

      {/* Search */}
      <motion.div variants={fadeUp}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="搜索知识点..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full rounded-glass-sm border border-glass-border bg-surface py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="rounded-glass-sm bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            搜索
          </button>
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="mt-3">
            <GlassCard gradient="none" className="p-3">
              <p className="mb-2 text-xs font-medium text-text-tertiary">
                搜索结果 ({searchResults.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { handleNodeClick(r.id); setSearchResults([]); setSearchQuery('') }}
                    className="rounded-lg bg-surface-secondary px-3 py-1.5 text-xs text-text-primary transition-colors hover:bg-accent-subtle hover:text-accent"
                  >
                    {r.subject} / {r.name}
                  </button>
                ))}
              </div>
            </GlassCard>
          </div>
        )}
      </motion.div>

      {/* Main layout: Tree + Detail */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Tree Panel (3/5) */}
        <motion.div variants={fadeUp} className="xl:col-span-3">
          <GlassCard gradient="none" className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
                <Network className="h-4 w-4 text-accent" />
                知识结构
              </h2>
              <span className="text-xs text-text-tertiary">
                {loading ? '...' : `${countLeaves(tree)} 个知识点`}
              </span>
            </div>

            {/* Tree */}
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <Spinner size="lg" label="加载中…" />
              </div>
            ) : error ? (
              <div className="flex h-32 items-center justify-center text-sm text-text-tertiary">
                {error}
              </div>
            ) : tree.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-text-tertiary">
                暂无数据
              </div>
            ) : (
              <div className="space-y-0.5">
                {tree.map((rootNode) => (
                  <TreeNodeItem key={rootNode.id} node={rootNode} depth={0} />
                ))}
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Detail Panel (2/5) */}
        <motion.div variants={fadeUp} className="xl:col-span-2">
          <GlassCard gradient="none" className="p-5 h-full min-h-[300px]">
            {detailLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Spinner size="lg" label="加载详情…" />
              </div>
            ) : nodeDetail ? (
              <div className="space-y-5">
                {/* Breadcrumb */}
                <div>
                  <div className="flex flex-wrap items-center gap-1 text-xs text-text-tertiary">
                    {nodeDetail.path.map((p, i) => (
                      <span key={p.id} className="flex items-center gap-1">
                        {i > 0 && <ArrowRight className="h-3 w-3" />}
                        <button
                          onClick={() => handleNodeClick(p.id)}
                          className={`transition-colors hover:text-accent ${p.id === selectedNodeId ? 'text-accent font-medium' : ''}`}
                        >
                          {p.name}
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Node Header */}
                <div>
                  <h3 className="text-xl font-bold text-text-primary">
                    {nodeDetail.node.name}
                  </h3>
                  {nodeDetail.node.description && (
                    <p className="mt-1.5 text-sm leading-relaxed text-text-tertiary">
                      {nodeDetail.node.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="accent" size="sm">{nodeDetail.node.subject}</Badge>
                    <Badge variant="default" size="sm">Lv.{nodeDetail.node.level}</Badge>
                    {nodeDetail.node.childrenCount > 0 && (
                      <Badge variant="info" size="sm">{nodeDetail.node.childrenCount} 个子节点</Badge>
                    )}
                  </div>
                </div>

                {/* Prerequisites */}
                {nodeDetail.prerequisites.length > 0 && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                      <ArrowRight className="h-3 w-3" />
                      前置知识
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {nodeDetail.prerequisites.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleNodeClick(p.id)}
                          className="rounded-lg bg-warning/10 px-2.5 py-1 text-xs text-warning transition-colors hover:bg-warning/20"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Related Nodes */}
                {nodeDetail.relatedNodes.length > 0 && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                      <Network className="h-3 w-3" />
                      关联知识点
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {nodeDetail.relatedNodes.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => handleNodeClick(r.id)}
                          className="rounded-lg bg-info/10 px-2.5 py-1 text-xs text-info transition-colors hover:bg-info/20"
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mastery History */}
                {nodeDetail.masteryHistory.length > 0 && (
                  <div>
                    <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                      <TrendingUp className="h-3 w-3" />
                      历史掌握率
                    </h4>
                    <div className="space-y-2">
                      {nodeDetail.masteryHistory.map((h, i) => {
                        const info = masteryBadge(h.mastery)
                        return (
                          <div key={i} className="rounded-lg bg-surface-secondary p-2.5">
                            <div className="mb-1.5 flex items-center justify-between text-xs">
                              <span className="text-text-secondary">
                                {new Date(h.examDate).toLocaleDateString('zh-CN')}
                              </span>
                              <Badge variant={info.variant} size="sm">{info.label}</Badge>
                            </div>
                            <Progress value={h.mastery * 100} size="sm" color={info.color} />
                            <div className="mt-1 text-[10px] text-text-tertiary">
                              得分 {Math.round(h.score)} / {Math.round(h.fullScore)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Wrong Questions */}
                {nodeDetail.wrongQuestions.length > 0 && (
                  <div>
                    <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                      <AlertTriangle className="h-3 w-3" />
                      关联错题
                    </h4>
                    <div className="space-y-2">
                      {nodeDetail.wrongQuestions.map((wq) => (
                        <div
                          key={wq.id}
                          className="flex items-center justify-between rounded-lg bg-danger/5 p-2.5"
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <FileQuestion className="h-3.5 w-3.5 text-danger" />
                            <span className="text-text-primary">
                              {wq.examTitle} · 第 {wq.questionNo} 题
                            </span>
                          </div>
                          <Badge variant="danger" size="sm">
                            {wq.wrongCount} 次错
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty detail state */}
                {nodeDetail.masteryHistory.length === 0 && nodeDetail.wrongQuestions.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-text-tertiary">
                    <Target className="mb-3 h-10 w-10 opacity-30" />
                    <p className="text-sm">暂无学习数据</p>
                    <p className="mt-1 text-xs opacity-60">上传答题卡并完成分析后将展示掌握率和错题</p>
                  </div>
                )}
              </div>
            ) : (
              /* No node selected */
              <div className="flex h-full flex-col items-center justify-center text-text-tertiary">
                <Network className="mb-4 h-12 w-12 opacity-20" />
                <p className="text-sm font-medium">选择一个知识点</p>
                <p className="mt-1 text-xs opacity-60">点击左侧树中的节点查看详情</p>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </motion.div>
  )
}

// ── Helper: count leaves ──

function countLeaves(nodes: TreeNode[]): number {
  let count = 0
  for (const n of nodes) {
    count++
    if (n.children) count += countLeaves(n.children)
  }
  return count
}
