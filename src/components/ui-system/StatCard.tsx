'use client'

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { GlassCard } from './GlassCard'

type StatCardProps = HTMLAttributes<HTMLDivElement> & {
  label: string
  value: string | number
  trend?: 'up' | 'down' | 'stable'
  trendLabel?: string
  icon?: ReactNode
  gradient?: 'none' | 'blue' | 'green' | 'red' | 'amber' | 'purple'
}

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
}

const trendColors = {
  up: 'text-success',
  down: 'text-danger',
  stable: 'text-text-tertiary',
}

const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, label, value, trend, trendLabel, icon, gradient = 'none', ...props }, ref) => {
    const TrendIcon = trend ? trendIcons[trend] : null

    return (
      <GlassCard
        ref={ref}
        gradient={gradient}
        className={twMerge('p-5', className)}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
              {label}
            </p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums text-text-primary">
              {value}
            </p>
            {trend && TrendIcon && (
              <div className="mt-2 flex items-center gap-1">
                <TrendIcon className={twMerge('h-3.5 w-3.5', trendColors[trend])} />
                {trendLabel && (
                  <span className={twMerge('text-xs font-medium', trendColors[trend])}>
                    {trendLabel}
                  </span>
                )}
              </div>
            )}
          </div>
          {icon && (
            <div className="shrink-0 ml-4 text-text-tertiary">
              {icon}
            </div>
          )}
        </div>
      </GlassCard>
    )
  },
)
StatCard.displayName = 'StatCard'

export { StatCard, type StatCardProps }
