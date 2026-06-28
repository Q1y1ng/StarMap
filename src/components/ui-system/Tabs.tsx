'use client'

import { type ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import { motion } from 'framer-motion'

type Tab = {
  key: string
  label: string
  icon?: ReactNode
}

type TabsProps = {
  tabs: Tab[]
  activeKey: string
  onChange: (key: string) => void
  variant?: 'pill' | 'underline'
  className?: string
}

export function Tabs({ tabs, activeKey, onChange, variant = 'pill', className }: TabsProps) {
  if (variant === 'underline') {
    return (
      <div className={twMerge('flex gap-1 border-b border-surface-tertiary', className)}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={twMerge(
              'relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors duration-200',
              activeKey === tab.key
                ? 'text-accent'
                : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            {tab.label}
            {activeKey === tab.key && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
    )
  }

  // Pill variant (iOS style)
  return (
    <div className={twMerge('inline-flex gap-1 rounded-glass-sm bg-surface-secondary p-1', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={twMerge(
            'relative flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-sm font-medium transition-all duration-200',
            activeKey === tab.key
              ? 'bg-surface text-text-primary shadow-glass-elevated'
              : 'text-text-tertiary hover:text-text-secondary',
          )}
        >
          {tab.icon && <span className="shrink-0">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export type { Tab }
