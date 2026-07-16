import { cn } from '@/lib/utils'

interface SpinnerProps {
  className?: string
  /** Kantenlänge in px */
  size?: number
  label?: string
}

/** Barrierefreier Lade-Spinner (respektiert prefers-reduced-motion via CSS). */
export function Spinner({ className, size = 16, label = 'Lädt' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn('inline-block animate-spin rounded-full border-2 border-current border-t-transparent align-[-0.125em]', className)}
      style={{ width: size, height: size }}
    />
  )
}
