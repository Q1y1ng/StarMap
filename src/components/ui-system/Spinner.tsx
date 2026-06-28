'use client'

import { forwardRef, type HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

type SpinnerProps = HTMLAttributes<HTMLDivElement> & {
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

const sizeStyles = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-10 w-10',
}

const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = 'md', label, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge('flex items-center justify-center gap-2', className)}
        {...props}
      >
        <svg
          className={twMerge('animate-spin text-text-tertiary', sizeStyles[size])}
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        {label && <span className="text-sm text-text-tertiary">{label}</span>}
      </div>
    )
  },
)
Spinner.displayName = 'Spinner'

export { Spinner, type SpinnerProps }
