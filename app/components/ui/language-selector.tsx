'use client'

import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/components/providers/language-provider'
import { LANGUAGES } from '@/lib/translations'

export function LanguageSelector({ direction = 'up' }: { direction?: 'up' | 'down' }) {
  const { lang, setLang } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = LANGUAGES.find(l => l.code === lang)!

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs cursor-pointer"
        style={{
          background: 'var(--surface-2)',
          borderColor: 'var(--border)',
          color: 'var(--text-muted)',
          whiteSpace: 'nowrap',
        }}
        aria-label="Select language"
      >
        <span>{current.flag}</span>
        <span style={{ fontWeight: 600 }}>{current.code.toUpperCase()}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          ...(direction === 'down'
            ? { top: 'calc(100% + 6px)' }
            : { bottom: 'calc(100% + 6px)' }),
          left: 0, zIndex: 100,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '6px', minWidth: '160px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}>
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                width: '100%', padding: '7px 10px', borderRadius: '8px',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                background: lang === l.code ? 'var(--accent)' : 'transparent',
                color: lang === l.code ? '#fff' : 'var(--text-muted)',
                fontSize: '0.8rem', fontWeight: lang === l.code ? 700 : 400,
              }}
            >
              <span style={{ fontSize: '1rem' }}>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
