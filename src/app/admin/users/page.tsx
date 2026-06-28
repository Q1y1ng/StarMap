'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { Trash2, X, AlertTriangle } from 'lucide-react'
import { GlassCard } from '@/components/ui-system/GlassCard'
import { Badge } from '@/components/ui-system/Badge'
import { Spinner } from '@/components/ui-system/Spinner'
import { PageHeader } from '@/components/ui-system/PageHeader'
import { Button } from '@/components/ui-system/Button'

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
  },
}

type UserItem = {
  id: string
  username: string
  name: string
  role: string
  createdAt: string
  updatedAt: string
  _count: { exams: number }
}

export default function AdminUsersPage() {
  const { data: session } = useSession()
  const currentUserId = session?.user?.id

  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // 注销状态（按用户 ID 管理）
  const [deleteState, setDeleteState] = useState<Record<string, 'idle' | 'counting' | 'confirming'>>({})
  const [deleteCountdown, setDeleteCountdown] = useState<Record<string, number>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // 页面切换时加载用户
  useEffect(() => {
    let mounted = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    fetch(`/api/admin/users?page=${page}&pageSize=20`)
      .then(r => r.json())
      .then(json => {
        if (!mounted) return
        if (json.success) {
          setUsers(json.data.items)
          setTotalPages(json.data.totalPages)
        }
      })
      .catch(err => { if (mounted) console.error(err) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [page])

  // 倒计时逻辑 — 使用 ref 避免 setState in effect
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const countingUserIds = Object.entries(deleteState)
      .filter(([, state]) => state === 'counting')
      .map(([id]) => id)

    if (countingUserIds.length === 0) return

    // 使用单个递归 setTimeout 替代多个 setInterval
    function tick() {
      setDeleteCountdown((prev) => {
        const next: Record<string, number> = { ...prev }
        let hasActive = false
        for (const userId of countingUserIds) {
          const current = next[userId] ?? 3
          if (current <= 0) {
            setDeleteState((p) => ({ ...p, [userId]: 'confirming' }))
            delete next[userId]
          } else {
            next[userId] = current - 1
            hasActive = true
          }
        }
        if (!hasActive) return prev
        return next
      })
    }

    timerRef.current = setTimeout(tick, 1000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [deleteState, deleteCountdown])

  function startDeleteCountdown(userId: string) {
    setDeleteState((prev) => ({ ...prev, [userId]: 'counting' }))
    setDeleteCountdown((prev) => ({ ...prev, [userId]: 3 }))
    setDeleteError(null)
  }

  function cancelDelete(userId: string) {
    setDeleteState((prev) => ({ ...prev, [userId]: 'idle' }))
    setDeleteCountdown((prev) => ({ ...prev, [userId]: 3 }))
    setDeleteError(null)
  }

  async function confirmDeleteUser(userId: string) {
    setDeletingId(userId)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        setUsers((prev) => prev.filter((u) => u.id !== userId))
        setDeleteState((prev) => ({ ...prev, [userId]: 'idle' }))
      } else {
        setDeleteError(json.error || '注销失败')
        setDeleteState((prev) => ({ ...prev, [userId]: 'idle' }))
      }
    } catch {
      setDeleteError('注销失败，请稍后重试')
      setDeleteState((prev) => ({ ...prev, [userId]: 'idle' }))
    } finally {
      setDeletingId(null)
    }
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
      <motion.div variants={fadeUp}>
        <PageHeader
          title="用户管理"
          subtitle="管理系统中的全部用户账户"
        />
      </motion.div>

      {deleteError && (
        <motion.div variants={fadeUp}>
          <div className="rounded-glass-sm bg-danger/10 px-4 py-3 text-sm text-danger">
            {deleteError}
          </div>
        </motion.div>
      )}

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" label="加载用户列表…" />
        </div>
      )}

      {!loading && (
        <motion.div variants={fadeUp}>
          <GlassCard gradient="none" className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-tertiary text-left text-xs uppercase text-text-tertiary">
                    <th className="pb-3 pr-4 font-medium">用户名</th>
                    <th className="pb-3 pr-4 font-medium">姓名</th>
                    <th className="pb-3 pr-4 font-medium">角色</th>
                    <th className="pb-3 pr-4 font-medium">考试数</th>
                    <th className="pb-3 pr-4 font-medium">创建时间</th>
                    <th className="pb-3 font-medium min-w-[140px]">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-tertiary">
                  {users.map((user) => {
                    const state = deleteState[user.id] || 'idle'
                    const count = deleteCountdown[user.id] ?? 3
                    const isSelf = user.id === currentUserId
                    const isDeleting = deletingId === user.id

                    return (
                      <tr
                        key={user.id}
                        className="transition-colors hover:bg-accent-subtle/30"
                      >
                        <td className="py-3 pr-4 font-medium text-text-primary">
                          {user.username}
                        </td>
                        <td className="py-3 pr-4 text-text-secondary">
                          {user.name}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            variant={user.role === 'ADMIN' ? 'accent' : 'default'}
                            size="sm"
                            dot
                          >
                            {user.role === 'ADMIN' ? '管理员' : '用户'}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 tabular-nums text-text-secondary">
                          {user._count.exams}
                        </td>
                        <td className="py-3 pr-4 text-xs text-text-tertiary">
                          {fmtDate(user.createdAt)}
                        </td>
                        <td className="py-3">
                          {state === 'idle' && (
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/admin/users/${user.id}`}
                                className="text-xs font-medium text-accent hover:underline"
                              >
                                查看详情
                              </Link>
                              {!isSelf && (
                                <button
                                  onClick={() => startDeleteCountdown(user.id)}
                                  className="text-xs font-medium text-danger/70 hover:text-danger transition-colors"
                                >
                                  注销账号
                                </button>
                              )}
                            </div>
                          )}

                          {state === 'counting' && (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-xs text-danger font-medium">
                                <AlertTriangle className="h-3 w-3" />
                                确认中 {count}s
                              </span>
                              <button
                                onClick={() => cancelDelete(user.id)}
                                className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}

                          {state === 'confirming' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => confirmDeleteUser(user.id)}
                                disabled={isDeleting}
                                className="inline-flex items-center gap-1 text-xs font-medium text-danger hover:text-danger/70 transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="h-3 w-3" />
                                {isDeleting ? '删除中…' : '确认注销'}
                              </button>
                              <button
                                onClick={() => cancelDelete(user.id)}
                                disabled={isDeleting}
                                className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
                              >
                                取消
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一页
                </Button>
                <span className="text-sm text-text-secondary">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </Button>
              </div>
            )}
          </GlassCard>
        </motion.div>
      )}
    </motion.div>
  )
}
