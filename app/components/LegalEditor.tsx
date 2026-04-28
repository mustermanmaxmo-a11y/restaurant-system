'use client'

import { useState, useTransition } from 'react'
import { Save, Eye, Code, Check, X } from 'lucide-react'

type Props = {
  legalKey: string
  initialContent: string
  role: 'owner' | 'co_founder'
  draftContent?: string | null
}

export function LegalEditor({ legalKey, initialContent, role, draftContent }: Props) {
  const [content, setContent] = useState(
    // Co-Founder sieht seinen eigenen Draft wenn vorhanden, sonst Live-Inhalt
    role === 'co_founder' && draftContent ? draftContent : initialContent
  )
  // Owner sieht in reviewMode den Draft-Inhalt
  const [reviewMode, setReviewMode] = useState(role === 'owner' && !!draftContent)
  const [reviewContent] = useState(draftContent ?? '')
  const [mode, setMode] = useState<'split' | 'edit' | 'preview'>('split')
  const [message, setMessage] = useState<{ kind: 'ok' | 'err' | 'pending'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const isOwner = role === 'owner'
  const isDirty = content !== (role === 'co_founder' && draftContent ? draftContent : initialContent)

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
        const data = await res.json()
        if (data.pending) {
          setMessage({ kind: 'pending', text: 'Zur Freigabe eingereicht. Geht erst live wenn der Owner zustimmt.' })
        } else {
          setMessage({ kind: 'ok', text: 'Gespeichert und live.' })
        }
      } catch (e) {
        setMessage({ kind: 'err', text: e instanceof Error ? e.message : 'Unbekannter Fehler' })
      }
    })
  }

  function approve(reject: boolean) {
    setMessage(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/platform/legal/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: legalKey, reject }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `HTTP ${res.status}`)
        }
        setMessage({
          kind: 'ok',
          text: reject ? 'Draft verworfen.' : 'Genehmigt und live geschaltet.',
        })
        setReviewMode(false)
      } catch (e) {
        setMessage({ kind: 'err', text: e instanceof Error ? e.message : 'Unbekannter Fehler' })
      }
    })
  }

  return (
    <div>
      {/* Review-Banner für Owner wenn Draft vorhanden */}
      {isOwner && reviewMode && (
        <div style={{
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: '12px', padding: '16px 18px', marginBottom: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '12px',
        }}>
          <div>
            <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>
              Draft zur Freigabe
            </div>
            <div style={{ color: '#888', fontSize: '0.78rem' }}>
              Unten siehst du den eingereichten Entwurf. Du kannst ihn genehmigen oder verwerfen.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => approve(true)}
              disabled={isPending}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)',
                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                fontWeight: 700, fontSize: '0.82rem', cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              <X size={13} /> Verwerfen
            </button>
            <button
              onClick={() => approve(false)}
              disabled={isPending}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '8px', border: 'none',
                background: '#10b981', color: '#fff',
                fontWeight: 700, fontSize: '0.82rem', cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              <Check size={13} /> Genehmigen & live schalten
            </button>
          </div>
        </div>
      )}

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
              color: message.kind === 'ok' ? '#10b981' : message.kind === 'pending' ? '#f59e0b' : '#ef4444',
            }}>
              {message.text}
            </span>
          )}
          {/* Owner kann auch selbst direkt speichern wenn er den Draft nicht nutzt */}
          {isOwner && reviewMode && (
            <button
              onClick={() => setReviewMode(false)}
              style={{
                padding: '8px 12px', borderRadius: '8px', border: '1px solid #2a2a3e',
                background: 'transparent', color: '#888',
                fontSize: '0.8rem', cursor: 'pointer',
              }}
            >
              Eigene Änderung schreiben
            </button>
          )}
          {(!isOwner || !reviewMode) && (
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
              {isPending ? 'Speichert…' : isOwner ? 'Direkt live speichern' : 'Zur Freigabe einreichen'}
            </button>
          )}
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
              HTML-Quellcode {!isOwner && <span style={{ color: '#f59e0b', marginLeft: '6px' }}>· Draft (nicht live)</span>}
            </div>
            <textarea
              value={isOwner && reviewMode ? reviewContent : content}
              onChange={e => { if (!(isOwner && reviewMode)) setContent(e.target.value) }}
              readOnly={isOwner && reviewMode}
              spellCheck={false}
              style={{
                flex: 1, minHeight: '560px',
                background: isOwner && reviewMode ? '#1a1a28' : '#1a1a2e',
                color: '#e5e7eb',
                border: 'none', outline: 'none', resize: 'vertical',
                padding: '16px',
                fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem',
                lineHeight: 1.6,
                cursor: isOwner && reviewMode ? 'default' : 'text',
              }}
            />
          </div>
        )}

        {(mode === 'preview' || mode === 'split') && (
          <div style={{
            background: 'var(--surface)', borderRadius: '14px', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '10px 16px', borderBottom: '1px solid var(--border)',
              color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              background: 'var(--surface-2)',
            }}>
              Vorschau
            </div>
            <div
              style={{ flex: 1, padding: '24px', color: 'var(--text)', fontSize: '0.9rem', lineHeight: 1.7, overflowY: 'auto' }}
              dangerouslySetInnerHTML={{ __html: (isOwner && reviewMode ? reviewContent : content) || '<p style="color:var(--text-muted)">Leer</p>' }}
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
