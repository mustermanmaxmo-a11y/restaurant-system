'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Sparkles, Copy, Check, X } from 'lucide-react'
import type { MenuItem } from '@/types/database'

type Tone = 'warm' | 'professional' | 'fun' | 'luxury'
type Lang = 'de' | 'en' | 'it' | 'fr' | 'es'

interface Props {
  restaurantId: string
  items: MenuItem[]
  onClose: () => void
}

const TONES: { key: Tone; label: string }[] = [
  { key: 'warm', label: '❤️ Warm & einladend' },
  { key: 'professional', label: '💼 Professionell' },
  { key: 'fun', label: '🎉 Humorvoll' },
  { key: 'luxury', label: '✨ Luxuriös' },
]

const LANGS: { key: Lang; label: string }[] = [
  { key: 'de', label: 'Deutsch' },
  { key: 'en', label: 'English' },
  { key: 'it', label: 'Italiano' },
  { key: 'fr', label: 'Français' },
  { key: 'es', label: 'Español' },
]

export default function SocialPostGenerator({ restaurantId, items, onClose }: Props) {
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id ?? '')
  const [tone, setTone] = useState<Tone>('warm')
  const [lang, setLang] = useState<Lang>('de')
  const [generating, setGenerating] = useState(false)
  const [post, setPost] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function generate() {
    if (!selectedItemId) return
    setGenerating(true)
    setError('')
    setPost('')
    setCopied(false)

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setError('Nicht angemeldet.'); setGenerating(false); return }

    const res = await fetch('/api/ai/social-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ restaurantId, itemId: selectedItemId, tone, language: lang }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Fehler beim Generieren.')
    } else {
      setPost(data.post)
    }
    setGenerating(false)
  }

  async function copy() {
    await navigator.clipboard.writeText(post)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const s = {
    label: { color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' },
    input: { width: '100%', boxSizing: 'border-box' as const, background: 'var(--surface-2, #1a1a2a)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none' },
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px', padding: '28px', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Sparkles size={20} color="var(--accent)" />
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>Social Post generieren</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Item select */}
          <div>
            <label style={s.label}>Gericht</label>
            <select value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)} style={{ ...s.input }}>
              {items.map(item => (
                <option key={item.id} value={item.id}>{item.name} — {item.price.toFixed(2)} €</option>
              ))}
            </select>
          </div>

          {/* Tone */}
          <div>
            <label style={s.label}>Tonalität</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {TONES.map(t => (
                <button key={t.key} onClick={() => setTone(t.key)} style={{ padding: '8px 10px', borderRadius: '10px', border: `1px solid ${tone === t.key ? 'var(--accent)' : 'var(--border)'}`, background: tone === t.key ? 'rgba(234,88,12,0.12)' : 'transparent', color: tone === t.key ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label style={s.label}>Sprache</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {LANGS.map(l => (
                <button key={l.key} onClick={() => setLang(l.key)} style={{ padding: '6px 12px', borderRadius: '999px', border: `1px solid ${lang === l.key ? 'var(--accent)' : 'var(--border)'}`, background: lang === l.key ? 'rgba(234,88,12,0.12)' : 'transparent', color: lang === l.key ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={generate}
            disabled={generating || !selectedItemId}
            style={{ background: 'var(--accent)', border: 'none', borderRadius: '12px', padding: '12px 20px', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: generating ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: !selectedItemId ? 0.5 : 1 }}
          >
            <Sparkles size={16} />
            {generating ? 'Generiere…' : 'Generieren'}
          </button>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>{error}</p>
          )}

          {/* Result */}
          {post && (
            <div>
              <label style={s.label}>Dein Post</label>
              <textarea
                readOnly
                value={post}
                rows={8}
                style={{ ...s.input, resize: 'vertical', lineHeight: 1.6 }}
              />
              <button
                onClick={copy}
                style={{ marginTop: '8px', background: copied ? '#22c55e' : 'var(--surface-2, #1a1a2a)', border: '1px solid var(--border)', borderRadius: '10px', padding: '9px 16px', color: copied ? '#fff' : 'var(--text)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Kopiert!' : 'In Zwischenablage kopieren'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
