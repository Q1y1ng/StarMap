'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  FileText,
  Map,
  Target,
  BookOpen,
  Calendar,
  TrendingUp,
  GitBranch,
  AlertTriangle,
  MessageSquare,
  Activity,
  Moon,
  Sun,
  GraduationCap,
  Shield,
  Settings,
  Upload,
  FolderArchive,
} from 'lucide-react'
import { useTheme } from './ThemeContext'
import { useSession } from 'next-auth/react'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { href: '/exam-sessions', label: '考试分类', icon: FolderArchive },
  { href: '/exams', label: '考试记录', icon: FileText },
  { href: '/upload-exam', label: '统一上传', icon: Upload },
  { href: '/knowledge-map', label: '知识图谱', icon: Map },
  { href: '/knowledge-graph', label: '知识树', icon: GitBranch },
  { href: '/risk-dashboard', label: '风险预警', icon: AlertTriangle },
  { href: '/learning-profile', label: '学习档案', icon: Target },
  { href: '/wrong-book', label: '错题本', icon: BookOpen },
  { href: '/study-plan', label: '学习计划', icon: Calendar },
  { href: '/trends', label: '成长趋势', icon: TrendingUp },
  { href: '/analytics/feedback', label: '质量反馈', icon: MessageSquare },
  { href: '/analytics/system', label: '系统状态', icon: Activity },
]

export function Sidebar() {
  const pathname = usePathname()
  const { resolved, toggle } = useTheme()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={twMerge(
        'fixed left-0 top-0 z-40 flex h-full flex-col glass border-r border-glass-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className={twMerge(
        'flex items-center border-b border-glass-border px-4',
        collapsed ? 'justify-center py-4' : 'gap-3 px-5 py-4',
      )}>
        <div className="flex h-9 w-9 items-center justify-center rounded-glass-sm bg-accent text-white">
          <GraduationCap className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-text-primary tracking-tight">
              StarMap
            </span>
            <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent leading-none">
              v2.0
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={twMerge(
                'group relative flex items-center gap-3 rounded-glass-sm px-3 py-2.5 text-sm font-medium transition-all duration-200',
                collapsed && 'justify-center px-2',
                isActive
                  ? 'bg-accent-subtle text-accent'
                  : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </Link>
          )
        })}

      </nav>

      {/* Bottom: Admin + Settings + Collapse + Theme + Credit */}
      <div className="border-t border-glass-border p-3 space-y-1">

        {/* 管理后台（仅 ADMIN 可见） */}
        {isAdmin && (
          <Link
            href="/admin"
            className={twMerge(
              'group relative flex w-full items-center gap-3 rounded-glass-sm px-3 py-2.5 text-sm font-medium transition-all duration-200',
              collapsed && 'justify-center px-2',
              pathname.startsWith('/admin')
                ? 'bg-accent-subtle text-accent'
                : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary',
            )}
          >
            <Shield className="h-5 w-5 shrink-0" />
            {!collapsed && <span>管理后台</span>}
            {pathname.startsWith('/admin') && (
              <motion.div
                layoutId="nav-active"
                className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </Link>
        )}

        {/* 设置 */}
        <Link
          href="/settings"
          className={twMerge(
            'group relative flex w-full items-center gap-3 rounded-glass-sm px-3 py-2.5 text-sm font-medium transition-all duration-200',
            collapsed && 'justify-center px-2',
            pathname === '/settings'
              ? 'bg-accent-subtle text-accent'
              : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary',
          )}
        >
          <Settings className="h-5 w-5 shrink-0" />
          {!collapsed && <span>设置</span>}
          {pathname === '/settings' && (
            <motion.div
              layoutId="nav-active"
              className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
        </Link>

        <div className="border-t border-glass-border my-1" />

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-center gap-3 rounded-glass-sm px-3 py-2 text-sm text-text-tertiary transition-colors hover:bg-surface-secondary hover:text-text-secondary"
        >
          <svg
            className={twMerge('h-4 w-4 transition-transform', collapsed && 'rotate-180')}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {!collapsed && <span>收起</span>}
        </button>

        <button
          onClick={toggle}
          className="flex w-full items-center justify-center gap-3 rounded-glass-sm px-3 py-2 text-sm text-text-tertiary transition-colors hover:bg-surface-secondary hover:text-text-secondary"
        >
          {resolved === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          {!collapsed && <span>{resolved === 'dark' ? '浅色' : '深色'}模式</span>}
        </button>

        {!collapsed && (
          <div className="pt-1 text-center text-xs text-text-tertiary/50 select-none">
            Made by HEAOZIE
          </div>
        )}
      </div>
    </aside>
  )
}
