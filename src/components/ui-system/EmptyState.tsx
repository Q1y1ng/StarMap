'use client'

import { motion } from 'framer-motion'
import { Inbox } from 'lucide-react'
import { GlassCard } from './GlassCard'
import { Button } from './Button'
import Link from 'next/link'

export type EmptyStateProps = {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  secondaryAction?: {
    label: string
    href?: string
    onClick?: () => void
  }
}

export function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <GlassCard gradient="none" className="p-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-subtle">
          {icon ?? <Inbox className="h-8 w-8 text-accent" />}
        </div>
        <p className="text-lg font-medium text-text-primary">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-text-tertiary">{description}</p>
        )}
        {(action || secondaryAction) && (
          <div className="mt-6 flex justify-center gap-3">
            {action &&
              (action.href ? (
                <Link href={action.href}>
                  <Button variant="primary">{action.label}</Button>
                </Link>
              ) : (
                <Button variant="primary" onClick={action.onClick}>
                  {action.label}
                </Button>
              ))}
            {secondaryAction &&
              (secondaryAction.href ? (
                <Link href={secondaryAction.href}>
                  <Button variant="ghost">{secondaryAction.label}</Button>
                </Link>
              ) : (
                <Button variant="ghost" onClick={secondaryAction.onClick}>
                  {secondaryAction.label}
                </Button>
              ))}
          </div>
        )}
      </GlassCard>
    </motion.div>
  )
}
