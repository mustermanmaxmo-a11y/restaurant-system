'use client'

import { useState, useTransition } from 'react'
import { Save, Eye, Code } from 'lucide-react'

type Props = {
  legalKey: string
  initialContent: string
}

export function LegalEditor({ legalKey, initialContent }: Props) {
  const [content, setContent] = useState(initialContent)
  const [mode, setMode] = useState<'split' | 'edit' | 'preview'>('split')
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const isDirty = content !== initialContent

  function save() {
    setMessage(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/platform/legal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: legalKey, content }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `HTTP ${res.status}`)
        }
        setMessage({ kind: 'ok', text: 'Gespeichert. Öffentliche Seite wurde revalidiert.' })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
        setMessage({ kind: 'err', text: msg })
      }
    })
  }

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '12px', flexWrap: 'wrap', gap: '12px',
      }}>
        <div style={{ display: 'flex', gap: '4px', background: '#1f1f30', padding: '4px', borderRadius: '10px', border: '1px solid #2a2a3e' }}>
          <ModeBtn active={mode === 'edit'} onClick={() => setMode('edit')} icon={Code} label="Editor" />
          <ModeBtn active={mode === 'split'} onClick={() => setMode('split')} icon={Eye} label="Split" />
          <ModeBtn active={mode === 'preview'} onClick={() => setMode('preview')} icon={Eye} label="Vorschau" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {message && (
            <span style={{
              fontSize: '0.8rem', fontWeight: 600,
              color: message.kind === 'ok' ? '#10b981' : '#ef4444',
            }}>
              {message.text}
            </span>
          )}
          <button
            onClick={save}
            disabled={!isDirty || isPending}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '9px 16px', borderRadius: '8px', border: 'none',
              background: isDirty && !isPending ? '#ef4444' : '#2a2a3e',
              color: isDirty && !isPending ? '#fff' : '#666',
              fontWeight: 700, fontSize: '0.85rem',
              cursor: isDirty && !isPending ? 'pointer' : 'not-allowed',
            }}
          >
            <Save size={14} />
            {isPending ? 'Speichert…' : 'Speichern'}
          </button>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: mode === 'split' ? '1fr 1fr' : '1fr',
        gap: '16px',
        minHeight: '600px',
      }}>
        {(mode === 'edit' || mode === 'split') && (
          <div style={{
            background: '#1f1f30', border: '1px solid #2a2a3e', borderRadius: '14px',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '10px 16px', borderBottom: '1px solid #2a2a3e',
              color: '#888', fontSize: '0.7rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              HTML-Quellcode
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1, minHeight: '560px',
                background: '#1a1a2e', color: '#e5e7eb',
                border: 'none', outline: 'none', resize: 'vertical',
                padding: '16px',
                fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem',
                lineHeight: 1.6,
              }}
            />
          </div>
        )}

        {(mode === 'preview' || mode === 'split') && (
          <div style={{
            background: '#fff', borderRadius: '14px', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '10px 16px', borderBottom: '1px solid #e5e7eb',
              color: '#666', fontSize: '0.7rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              background: '#fafafa',
            }}>
              Vorschau
            </div>
            <div
              style={{
                flex: 1, padding: '24px', color: '#1a1a2e',
                fontSize: '0.9rem', lineHeight: 1.7, overflowY: 'auto',
              }}
              dangerouslySetInnerHTML={{ __html: content || '<p style="color:#999">Leer</p>' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function ModeBtn({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void;
  icon: React.ComponentType<{ size?: number }>; label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '6px 12px', borderRadius: '7px', border: 'none',
        background: active ? '#ef4444' : 'transparent',
        color: active ? '#fff' : '#888',
        fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
      }}
    >
      <Icon size={12} /> {label}
    </button>
  )
}
