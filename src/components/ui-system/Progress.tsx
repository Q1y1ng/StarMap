'use client'

import { forwardRef, type HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

type ProgressProps = HTMLAttributes<HTMLDivElement> & {
  value: number      // 0–100
  max?: number       // default 100
  size?: 'sm' | 'md' | 'lg'
  color?: 'accent' | 'success' | 'warning' | 'danger'
  animated?: boolean
  showLabel?: boolean
}

const sizeStyles = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-3.5',
}

const colorStyles: Record<string, string> = {
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, max = 100, size = 'md', color = 'accent', animated = true, showLabel = false, ...props }, ref) => {
    const pct = Math.min(100, Math.max(0, (value / max) * 100))

    return (
      <div className="w-full" ref={ref} {...props}>
        <div
          className={twMerge(
            'w-full overflow-hidden rounded-full bg-surface-tertiary',
            sizeStyles[size],
            className,
          )}
        >
          <div
            className={twMerge(
              'h-full rounded-full transition-all duration-700 ease-out',
              colorStyles[color],
              animated && 'transition-[width]',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        {showLabel && (
          <div className="mt-1 text-right text-xs text-text-tertiary tabular-nums">
            {Math.round(pct)}%
          </div>
        )}
      </div>
    )
  },
)
Progress.displayName = 'Progress'

export { Progress, type ProgressProps }
