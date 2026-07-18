import * as React from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  /** Optionales Icon links vom Titel (Lucide-Komponente). */
  icon?: React.ReactNode
  /** Aktionen rechts (Buttons etc.). */
  actions?: React.ReactNode
  className?: string
}

/**
 * Einheitlicher Seitenkopf. Jede Admin-/Platform-Seite beginnt damit —
 * ersetzt die uneinheitlichen Inline-Überschriften mit Emoji.
 */
export function PageHeader({ title, description, icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent-fg">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-text leading-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted max-w-2xl">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
