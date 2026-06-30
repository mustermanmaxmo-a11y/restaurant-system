'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Send } from 'lucide-react'
import { getDesignPackage } from '@/lib/design-packages'
import type { Restaurant } from '@/types/database'
import { useEditorDraft } from '../useEditorDraft'

type ChatMsg = { role: 'user' | 'assistant'; content: string; delta?: Record<string, string> }

export function AiChatPanel({ restaurant }: { restaurant: Restaurant }) {
  const { draft, applyDesignConfig } = useEditorDraft()
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  async function send() {
    if (!draft || !input.trim() || loading) return
    const userMsg: ChatMsg = { role: 'user', content: input.trim() }
    const next = [...messages, userMsg]
    setMessages(next); setInput(''); setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const b = draft.brand
      const pkg = getDesignPackage(b.design_package)
      const currentConfig: Record<string, unknown> = {
        primary_color: b.primary_color ?? pkg.preview.primaryColor,
        bg_color: b.bg_color ?? pkg.preview.bgColor,
        header_color: b.header_color ?? pkg.preview.headerColor,
        card_color: b.card_color ?? pkg.preview.cardColor,
        button_color: b.button_color ?? pkg.preview.buttonColor,
        text_color: b.text_color ?? pkg.preview.textColor,
        font_pair: b.font_pair,
        layout_variant: b.layout_variant,
        ...(b.design_config ?? {}),
      }
      const res = await fetch('/api/ai/design-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ restaurant_id: restaurant.id, messages: next.map(m => ({ role: m.role, content: m.content })), current_design_config: currentConfig }),
      })
      const data = await res.json()
      if (!res.ok) { setMessages(prev => [...prev, { role: 'assistant', content: data.error ?? 'KI nicht verfügbar' }]); return }
      setMessages(prev => [...prev, { role: 'assistant', content: data.message, delta: data.delta }])
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Verbindungsfehler' }])
    } finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <h2 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '4px' }}>KI Design-Assistent</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.76rem', marginBottom: '12px' }}>Beschreib dein Wunsch-Design — „Übernehmen" schreibt es in den Entwurf (erst beim Veröffentlichen live).</p>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px', minHeight: '160px', background: 'var(--surface)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border)' }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', marginTop: '20px', lineHeight: 1.7 }}>
            „Mach es dunkler" · „Blaue Akzentfarbe" · „Elegantes Gold auf Schwarz"
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '90%', padding: '9px 12px', borderRadius: '12px', background: msg.role === 'user' ? 'var(--accent)' : 'var(--surface-2)', color: msg.role === 'user' ? '#fff' : 'var(--text)', fontSize: '0.84rem', lineHeight: 1.5 }}>{msg.content}</div>
            {msg.delta && Object.keys(msg.delta).length > 0 && (
              <div style={{ marginTop: '5px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {Object.values(msg.delta).filter(v => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)).slice(0, 6).map((c, ci) => (
                    <div key={ci} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c, border: '1px solid var(--border)' }} />
                  ))}
                </div>
                <button onClick={() => msg.delta && applyDesignConfig(msg.delta)}
                  style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: '6px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  Übernehmen
                </button>
              </div>
            )}
          </div>
        ))}
        {loading && <div style={{ alignSelf: 'flex-start', padding: '9px 14px', borderRadius: '12px', background: 'var(--surface-2)', color: 'var(--text-muted)', letterSpacing: '0.18em' }}>···</div>}
        <div ref={endRef} />
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Design beschreiben…" style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none' }} />
        <button onClick={send} disabled={!input.trim() || loading} style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'var(--accent)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !input.trim() || loading ? 0.45 : 1, flexShrink: 0 }}>
          <Send size={16} color="#fff" />
        </button>
      </div>
    </div>
  )
}
