'use client'

import { type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/components/layout/ThemeContext'
import { AppShell } from '@/components/layout/AppShell'
import { ToastProvider } from '@/components/ui-system/Toast'

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = pathname === '/login'

  const content = isAuthPage ? (
    children
  ) : (
    <AppShell>{children}</AppShell>
  )

  return (
    <SessionProvider>
      <ThemeProvider>
        {content}
        <ToastProvider />
      </ThemeProvider>
    </SessionProvider>
  )
}
