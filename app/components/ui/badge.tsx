import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-2 text-muted',
        accent: 'bg-accent-subtle text-accent-fg',
        success: 'bg-[var(--status-served-bg)] text-[var(--status-served)]',
        warn: 'bg-[var(--status-cooking-bg)] text-[var(--status-cooking)]',
        danger: 'bg-danger/12 text-danger',
      },
      size: {
        sm: 'px-2 py-0.5 text-2xs',
        md: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'sm' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />
}

type OrderStatus = 'new' | 'cooking' | 'served' | 'cancelled'

const STATUS_MAP: Record<OrderStatus, { label: string; dot: string; className: string }> = {
  new: { label: 'Neu', dot: 'var(--status-new)', className: 'bg-[var(--status-new-bg)] text-[var(--status-new)]' },
  cooking: { label: 'In Zubereitung', dot: 'var(--status-cooking)', className: 'bg-[var(--status-cooking-bg)] text-[var(--status-cooking)]' },
  served: { label: 'Serviert', dot: 'var(--status-served)', className: 'bg-[var(--status-served-bg)] text-[var(--status-served)]' },
  cancelled: { label: 'Storniert', dot: 'var(--danger)', className: 'bg-danger/12 text-danger' },
}

interface StatusPillProps {
  status: OrderStatus
  /** Überschreibt das Standard-Label (z. B. übersetzt). */
  label?: string
  className?: string
}

/** Status-Pille mit farbigem Punkt für Bestell-Zustände. */
export function StatusPill({ status, label, className }: StatusPillProps) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.new
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', s.className, className)}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} aria-hidden="true" />
      {label ?? s.label}
    </span>
  )
}
