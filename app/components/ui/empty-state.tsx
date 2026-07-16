import * as React from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  /** Lucide-Icon-Komponente. */
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** Optionale Primäraktion (z. B. <Button>). */
  action?: React.ReactNode
  className?: string
}

/** Einheitlicher Leerzustand für Listen, Tabellen und Suchergebnisse. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-12 text-center', className)}>
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-muted" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-text">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
