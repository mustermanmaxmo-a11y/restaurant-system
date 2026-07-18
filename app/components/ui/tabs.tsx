'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TabItem {
  key: string
  label: React.ReactNode
  /** Optionale Zahl rechts vom Label (z. B. offene Bestellungen). */
  badge?: number
}

interface TabsProps {
  items: TabItem[]
  value: string
  onValueChange: (key: string) => void
  className?: string
}

/** Unterstrichene Tab-Leiste mit Tastatur-Navigation (Pfeiltasten). */
export function Tabs({ items, value, onValueChange, className }: TabsProps) {
  function onKeyDown(e: React.KeyboardEvent) {
    const i = items.findIndex((t) => t.key === value)
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      onValueChange(items[(i + 1) % items.length].key)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onValueChange(items[(i - 1 + items.length) % items.length].key)
    }
  }

  return (
    <div role="tablist" onKeyDown={onKeyDown} className={cn('flex gap-1 overflow-x-auto border-b border-border', className)}>
      {items.map((t) => {
        const active = t.key === value
        return (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(t.key)}
            className={cn(
              'relative flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-base font-medium transition-colors -mb-px border-b-2',
              active ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text',
            )}
          >
            {t.label}
            {typeof t.badge === 'number' && t.badge > 0 && (
              <span className="rounded-full bg-accent-subtle px-1.5 py-0.5 text-2xs font-bold text-accent-fg tabular-nums">
                {t.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
