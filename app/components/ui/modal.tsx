'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconButton } from './button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  /** max-width des Panels. */
  size?: 'sm' | 'md' | 'lg'
  /** Klick auf den Backdrop schließt (Default true). */
  dismissible?: boolean
  className?: string
}

const SIZE: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

/**
 * Barrierefreier Dialog: Portal, Escape-to-close, Scroll-Lock, Fokus aufs Panel.
 * Ersetzt die verstreuten Inline-Modal-Definitionen.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
  className,
}: ModalProps) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  const reactId = React.useId()
  const titleId = `${reactId}-title`
  const descId = `${reactId}-desc`

  React.useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && dismissible) onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, dismissible, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose()
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-[fadeUp_0.15s_ease]" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative w-full rounded-t-xl sm:rounded-xl border border-border bg-surface shadow-lg outline-none',
          'max-h-[92vh] overflow-y-auto slide-up sm:animate-[fadeUp_0.2s_ease]',
          SIZE[size],
          className,
        )}
      >
        {(title || dismissible) && (
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              {title && <h2 id={titleId} className="text-lg font-bold tracking-tight text-text">{title}</h2>}
              {description && <p id={descId} className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            {dismissible && (
              <IconButton variant="ghost" size="sm" aria-label="Schließen" onClick={onClose} className="-mr-1 shrink-0">
                <X size={18} />
              </IconButton>
            )}
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
