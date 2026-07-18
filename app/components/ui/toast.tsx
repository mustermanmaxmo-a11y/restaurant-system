'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastTone = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  title: string
  description?: string
  tone: ToastTone
}
interface ToastOptions {
  title: string
  description?: string
  tone?: ToastTone
  /** ms bis zum automatischen Ausblenden (Default 4000). */
  duration?: number
}

const ToastContext = React.createContext<((opts: ToastOptions) => void) | null>(null)

/** Zugriff auf `toast({ title, tone })`. Muss innerhalb <ToastProvider> liegen. */
export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

const TONE: Record<ToastTone, { icon: React.ReactNode; className: string }> = {
  success: { icon: <CheckCircle2 size={18} />, className: 'text-[var(--status-served)]' },
  error: { icon: <AlertCircle size={18} />, className: 'text-danger' },
  info: { icon: <Info size={18} />, className: 'text-accent-fg' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([])
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const remove = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = React.useCallback(
    ({ title, description, tone = 'info', duration = 4000 }: ToastOptions) => {
      const id = Date.now() + Math.random()
      setItems((prev) => [...prev, { id, title, description, tone }])
      window.setTimeout(() => remove(id), duration)
    },
    [remove],
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-[200] flex w-full max-w-sm flex-col gap-2" aria-live="polite" aria-atomic="false">
            {items.map((t) => (
              <div
                key={t.id}
                role="status"
                className="slide-up flex items-start gap-3 rounded-lg border border-border bg-surface p-3 shadow-lg"
              >
                <span className={cn('mt-0.5 shrink-0', TONE[t.tone].className)} aria-hidden="true">
                  {TONE[t.tone].icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-text">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-sm text-muted">{t.description}</p>}
                </div>
                <button
                  type="button"
                  aria-label="Schließen"
                  onClick={() => remove(t.id)}
                  className="shrink-0 rounded p-0.5 text-muted hover:text-text"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  )
}
