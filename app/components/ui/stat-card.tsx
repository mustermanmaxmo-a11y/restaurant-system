import * as React from 'react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: React.ReactNode
  value: React.ReactNode
  /** Kleiner Kontext unter dem Wert (z. B. „letzte 7 Tage"). */
  sub?: React.ReactNode
  /** Optionales Icon oben rechts. */
  icon?: React.ReactNode
  /** Trend in Prozent — positiv = grün, negativ = rot. */
  trend?: number
  className?: string
}

/** Kennzahl-Kachel für Dashboards. Ersetzt die Inline-StatCard-Varianten. */
export function StatCard({ label, value, sub, icon, trend, className }: StatCardProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-surface p-4 shadow-sm', className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
        {icon && <span className="text-muted" aria-hidden="true">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-heading text-2xl font-extrabold tracking-tight text-text tabular-nums">{value}</span>
        {typeof trend === 'number' && (
          <span
            className={cn(
              'text-xs font-semibold tabular-nums',
              trend >= 0 ? 'text-[var(--status-served)]' : 'text-danger',
            )}
          >
            {trend >= 0 ? '+' : ''}
            {trend}%
          </span>
        )}
      </div>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  )
}
