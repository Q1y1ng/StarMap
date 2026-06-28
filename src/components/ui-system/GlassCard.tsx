'use client'

import { forwardRef, type HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  hover?: boolean
  gradient?: 'none' | 'blue' | 'green' | 'red' | 'amber' | 'purple'
}

const gradientOverlays: Record<string, string> = {
  blue: 'before:bg-gradient-to-br before:from-blue-500/10 before:to-transparent',
  green: 'before:bg-gradient-to-br before:from-green-500/10 before:to-transparent',
  red: 'before:bg-gradient-to-br before:from-red-500/10 before:to-transparent',
  amber: 'before:bg-gradient-to-br before:from-amber-500/10 before:to-transparent',
  purple: 'before:bg-gradient-to-br before:from-purple-500/10 before:to-transparent',
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hover = true, gradient = 'none', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(
          'relative overflow-hidden',
          hover ? 'glass-card' : 'glass-card-static',
          gradient !== 'none' && 'before:pointer-events-none before:absolute before:inset-0 before:z-0',
          gradient !== 'none' && gradientOverlays[gradient],
          className,
        )}
        {...props}
      >
        <div className="relative z-10">{children}</div>
      </div>
    )
  },
)
GlassCard.displayName = 'GlassCard'

export { GlassCard, type GlassCardProps }
