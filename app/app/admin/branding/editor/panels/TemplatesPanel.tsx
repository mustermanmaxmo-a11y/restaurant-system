'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Check } from 'lucide-react'
import { TemplatePreviewCard } from '@/components/landing/TemplatePreviewCard'
import type { Restaurant } from '@/types/database'
import { useEditorDraft } from '../useEditorDraft'

type TemplateRow = {
  id: string; name: string; slug: string; category: string; style_tags: string[]
  plan_tier: 'basic' | 'pro' | 'premium'; preview_url: string | null
  config: Record<string, string>; sort_order: number; accessible: boolean; granted: boolean
}

const CATEGORIES = [
  { id: 'all', label: 'Alle' }, { id: 'italian', label: 'Italienisch' },
  { id: 'fastcasual', label: 'Burger & Street Food' }, { id: 'japanese', label: 'Japanisch' },
  { id: 'vegan', label: 'Vegan' }, { id: 'asian', label: 'Asiatisch' },
]

export function TemplatesPanel({ restaurant }: { restaurant: Restaurant }) {
  const { updateBrand } = useEditorDraft()
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState('all')
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [appliedId, setAppliedId] = useState<string | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function doFetch() {
      const ctrl = new AbortController()
      ;(async () => {
        setLoading(true)
        try {
          const params = new URLSearchParams({ restaurant_id: restaurant.id })
          if (category !== 'all') params.set('category', category)
          const res = await fetch(`/api/design-templates?${params.toString()}`, { signal: ctrl.signal })
          if (!res.ok) { setTemplates([]); return }
          const json = await res.json()
          setTemplates(json.templates ?? [])
        } catch { /* aborted */ } finally { setLoading(false) }
      })()
      return ctrl
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    let ctrl: AbortController | undefined
    searchTimeout.current = setTimeout(() => { ctrl = doFetch() }, 200)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); ctrl?.abort() }
  }, [restaurant.id, category])

  async function applyTemplate(tpl: TemplateRow) {
    if (!tpl.accessible) return
    setApplyingId(tpl.id)
    try {
      const res = await fetch(`/api/design-templates/${tpl.id}/apply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: restaurant.id }),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error ?? 'Template konnte nicht angewendet werden.'); return }
      // Frisch geladenes Restaurant in den Entwurf spiegeln, damit die Vorschau das Template zeigt
      const { data: resto } = await supabase.from('restaurants').select('*').eq('id', restaurant.id).single()
      if (resto) {
        updateBrand({
          design_package: resto.design_package ?? 'modern-classic',
          layout_variant: (resto.layout_variant as string | null) ?? 'cards',
          font_pair: resto.font_pair ?? 'syne-dmsans',
          primary_color: resto.primary_color, bg_color: resto.bg_color, header_color: resto.header_color,
          card_color: resto.card_color, button_color: resto.button_color, text_color: resto.text_color,
          design_config: (resto.design_config ?? null) as Record<string, unknown> | null,
        })
      }
      setAppliedId(tpl.id)
      setTimeout(() => setAppliedId(null), 2500)
    } finally { setApplyingId(null) }
  }

  return (
    <div>
      <h2 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '4px' }}>Template-Bibliothek</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.76rem', marginBottom: '12px' }}>Premium-Designs — wähle eines, das zu deinem Restaurant passt.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
        {CATEGORIES.map(cat => {
          const active = cat.id === category
          return (
            <button key={cat.id} onClick={() => setCategory(cat.id)} style={{
              padding: '5px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
              background: active ? 'var(--text)' : 'var(--surface)', color: active ? 'var(--bg)' : 'var(--text-muted)',
              border: '1.5px solid var(--border)',
            }}>{cat.label}</button>
          )
        })}
      </div>
      {loading && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '20px 0' }}>Lade Templates…</div>}
      {!loading && templates.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '20px 0' }}>Keine Templates gefunden.</div>}
      {!loading && templates.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
          {templates.map(tpl => {
            const isApplying = applyingId === tpl.id
            const justApplied = appliedId === tpl.id
            const cfg = tpl.config ?? {}
            const tierColor = tpl.plan_tier === 'premium' ? '#8B5CF6' : tpl.plan_tier === 'pro' ? '#F59E0B' : '#4B5563'
            return (
              <div key={tpl.id} style={{ background: 'var(--surface)', border: '2px solid var(--border)', borderRadius: '12px', padding: '10px', opacity: tpl.accessible ? 1 : 0.55 }}>
                <div style={{ marginBottom: '8px' }}><TemplatePreviewCard config={cfg} name={tpl.name} /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.8rem' }}>{tpl.name}</div>
                  <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.58rem', fontWeight: 800, background: `${tierColor}22`, color: tierColor }}>{tpl.plan_tier.toUpperCase()}</span>
                </div>
                <button onClick={() => applyTemplate(tpl)} disabled={!tpl.accessible || isApplying} style={{
                  width: '100%', padding: '8px', borderRadius: '7px', fontSize: '0.76rem', fontWeight: 700,
                  background: justApplied ? '#10b981' : tpl.accessible ? (cfg.primary_color ?? 'var(--accent)') : 'var(--surface-2)',
                  color: tpl.accessible ? '#fff' : 'var(--text-muted)', border: 'none',
                  cursor: !tpl.accessible || isApplying ? 'not-allowed' : 'pointer',
                }}>
                  {isApplying ? 'Wird angewendet…' : justApplied ? <><Check size={12} style={{ verticalAlign: 'middle' }} /> Angewendet</> : !tpl.accessible ? `Upgrade auf ${tpl.plan_tier}` : 'Anwenden'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
