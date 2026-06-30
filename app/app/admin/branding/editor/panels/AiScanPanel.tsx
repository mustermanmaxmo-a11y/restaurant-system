'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Restaurant } from '@/types/database'
import { useEditorDraft } from '../useEditorDraft'

const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }

export function AiScanPanel({ restaurant }: { restaurant: Restaurant }) {
  const { applyDesignConfig } = useEditorDraft()
  const [tab, setTab] = useState<'screenshot' | 'url'>('screenshot')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ design_config: Record<string, unknown>; confidence: number } | null>(null)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return }
    const u = URL.createObjectURL(file); setPreviewUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  async function analyze() {
    setLoading(true); setError(''); setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const form = new FormData()
      form.append('restaurant_id', restaurant.id)
      if (tab === 'screenshot' && file) form.append('image', file)
      else if (tab === 'url' && url) form.append('url', url)
      else { setError('Bitte Screenshot oder URL angeben'); return }
      const res = await fetch('/api/ai/design-extract', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Fehler beim Analysieren'); return }
      setResult(data)
    } catch { setError('Verbindungsfehler') } finally { setLoading(false) }
  }

  const swatch = (k: string) => {
    const v = result?.design_config[k]
    return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null
  }

  return (
    <div>
      <h2 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '4px' }}>Design automatisch erkennen</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.76rem', marginBottom: '12px' }}>Screenshot oder URL → die KI erkennt Farben/Schrift. „Übernehmen" schreibt in den Entwurf.</p>
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: 'var(--surface-2)', borderRadius: 8, padding: 4 }}>
        {(['screenshot', 'url'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setResult(null); setError('') }} style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: tab === t ? 700 : 500, background: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? '#fff' : 'var(--text-muted)' }}>
            {t === 'screenshot' ? '📸 Screenshot' : '🌐 URL'}
          </button>
        ))}
      </div>
      {tab === 'screenshot' ? (
        <label style={{ display: 'block', border: '2px dashed var(--border)', borderRadius: 10, padding: '20px', textAlign: 'center', cursor: 'pointer', marginBottom: 12 }}>
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null) }} />
          {file && previewUrl ? <img src={previewUrl} alt="" style={{ maxHeight: 140, maxWidth: '100%', borderRadius: 8 }} /> : <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>🖼️ Screenshot ablegen oder klicken</div>}
        </label>
      ) : (
        <input type="url" placeholder="https://dein-restaurant.de" value={url} onChange={e => { setUrl(e.target.value); setResult(null) }} style={{ ...inputStyle, marginBottom: 12 }} />
      )}
      {!result && (
        <button onClick={analyze} disabled={loading || (tab === 'screenshot' ? !file : !url)} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: (loading || (tab === 'screenshot' ? !file : !url)) ? 0.5 : 1 }}>
          {loading ? '⏳ Analysiert…' : '✨ Design erkennen'}
        </button>
      )}
      {error && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: 8 }}>{error}</div>}
      {result && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {['primary_color', 'bg_color', 'header_color', 'card_color', 'button_color', 'text_color'].map(k => {
              const c = swatch(k)
              return c ? <div key={k} title={k} style={{ width: 28, height: 28, borderRadius: 6, background: c, border: '1px solid var(--border)' }} /> : null
            })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10 }}>
            Schrift: {String(result.design_config.font_pair ?? '–')} · {Math.round((result.confidence ?? 0) * 100)}% Konfidenz
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { applyDesignConfig(result.design_config); setResult(null); setFile(null); setUrl('') }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>✓ Übernehmen</button>
            <button onClick={() => { setResult(null); setError('') }} style={{ padding: '10px 16px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>Nochmal</button>
          </div>
        </div>
      )}
    </div>
  )
}
