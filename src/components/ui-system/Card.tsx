'use client'

import { forwardRef, type HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'elevated' | 'glass'
  hover?: boolean
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hover = false, children, ...props }, ref) => {
    const baseStyles = hover
      ? 'surface-card hover:shadow-glass-elevated'
      : 'surface-card'

    if (variant === 'glass') {
      return (
        <div
          ref={ref}
          className={twMerge(
            hover ? 'glass-card' : 'glass-card-static',
            className,
          )}
          {...props}
        >
          {children}
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={twMerge(
          baseStyles,
          variant === 'elevated' && 'shadow-glass-elevated',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  },
)
Card.displayName = 'Card'

export { Card, type CardProps }
