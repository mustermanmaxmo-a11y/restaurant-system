import { cn } from '@/lib/utils'

/**
 * Lade-Platzhalter mit Shimmer (nutzt die .skeleton-Animation aus globals.css,
 * die prefers-reduced-motion respektiert). Ersetzt lokale SkeletonBlock-Kopien.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton', className)} aria-hidden="true" {...props} />
}

/** Mehrzeiliger Text-Platzhalter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3.5" style={{ width: i === lines - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  )
}
