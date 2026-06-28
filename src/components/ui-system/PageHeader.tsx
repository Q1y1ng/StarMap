'use client'

import { type ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

type PageHeaderProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={twMerge('flex items-start justify-between', className)}>
      <div className="min-w-0 flex-1">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-sm text-text-secondary">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="ml-6 shrink-0 flex items-center gap-3">
          {actions}
        </div>
      )}
    </div>
  )
}
