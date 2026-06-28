'use client'

import { type ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import { Sidebar } from './Sidebar'

type AppShellProps = {
  children: ReactNode
  className?: string
}

export function AppShell({ children, className }: AppShellProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        className={twMerge(
          'ml-60 flex-1 min-h-screen p-8 pb-20 transition-all duration-300',
          className,
        )}
      >
        {children}
        {/* ── Global Footer ── */}
        <footer className="mt-16 border-t border-glass-border pt-6 text-center">
          <p className="text-xs text-text-tertiary/50">
            <span className="font-medium text-text-tertiary/70">StarMap v2.0</span>
            <span className="mx-2">·</span>
            Made by HEAOZIE
            <span className="mx-2">·</span>
            © 2026
          </p>
        </footer>
      </main>
    </div>
  )
}
