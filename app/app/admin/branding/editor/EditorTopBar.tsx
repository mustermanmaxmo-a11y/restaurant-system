'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEditorDraft } from './useEditorDraft'
import type { PreviewPage, PreviewDevice } from './PreviewPane'

const PAGES: { key: PreviewPage; label: string }[] = [
  { key: 'start', label: 'Start' },
  { key: 'speisekarte', label: 'Speisekarte' },
  { key: 'reservieren', label: 'Reservieren' },
]

function pill(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer',
    fontSize: '0.78rem', fontWeight: active ? 700 : 500,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted)',
  }
}

export function EditorTopBar({
  slug, restaurantId, page, device, onPageChange, onDeviceChange,
}: {
  slug: string
  restaurantId: string
  page: PreviewPage
  device: PreviewDevice
  onPageChange: (p: PreviewPage) => void
  onDeviceChange: (d: PreviewDevice) => void
}) {
  const { saveStatus, hasUnpublishedChanges, publishing, publish, discard } = useEditorDraft()
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const statusText =
    saveStatus === 'saving' ? 'Speichert…'
    : saveStatus === 'error' ? 'Fehler beim Speichern'
    : hasUnpublishedChanges ? '● Nicht veröffentlichte Änderungen'
    : 'Gespeichert ✓'

  async function takeOffline() {
    if (!confirm('Landing-Seite offline nehmen? Sie ist dann nicht mehr öffentlich erreichbar (die Bestell-App bleibt online).')) return
    setBusy(true); setMenuOpen(false)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    await fetch('/api/admin/landing-page', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ restaurant_id: restaurantId, is_published: false }),
    })
    setBusy(false)
    alert('Landing-Seite ist jetzt offline. „Veröffentlichen" schaltet sie wieder online.')
  }

  async function doDiscard() {
    if (!confirm('Alle nicht veröffentlichten Änderungen verwerfen und auf den Live-Stand zurücksetzen?')) return
    setBusy(true); setMenuOpen(false)
    await discard()
    setBusy(false)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-2)', borderRadius: '8px', padding: '3px' }}>
        {PAGES.map(p => (
          <button key={p.key} style={pill(page === p.key)} onClick={() => onPageChange(p.key)}>{p.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '2px' }}>
          <button style={pill(device === 'mobile')} onClick={() => onDeviceChange('mobile')} title="Mobil">📱</button>
          <button style={pill(device === 'desktop')} onClick={() => onDeviceChange('desktop')} title="Desktop">🖥</button>
        </div>

        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: hasUnpublishedChanges ? 'var(--accent)' : 'var(--text-muted)' }}>{statusText}</span>

        <a href={`/${slug}/info`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textDecoration: 'none' }}>Live ansehen ↗</a>

        <button onClick={() => { void publish() }} disabled={publishing || busy || !hasUnpublishedChanges} style={{
          padding: '9px 20px', borderRadius: '8px', border: 'none',
          background: (publishing || !hasUnpublishedChanges) ? 'var(--surface-2)' : 'var(--accent)',
          color: (publishing || !hasUnpublishedChanges) ? 'var(--text-muted)' : '#fff',
          fontWeight: 700, fontSize: '0.82rem', cursor: (publishing || !hasUnpublishedChanges) ? 'default' : 'pointer',
        }}>
          {publishing ? 'Veröffentlicht…' : 'Veröffentlichen'}
        </button>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(o => !o)} disabled={busy} title="Mehr" style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>⋯</button>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 11, minWidth: '230px', overflow: 'hidden' }}>
                <button onClick={doDiscard} disabled={!hasUnpublishedChanges} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'transparent', color: hasUnpublishedChanges ? 'var(--text)' : 'var(--text-muted)', fontSize: '0.8rem', cursor: hasUnpublishedChanges ? 'pointer' : 'default' }}>↺ Änderungen verwerfen</button>
                <button onClick={takeOffline} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderTop: '1px solid var(--border)', background: 'transparent', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer' }}>⏻ Landing-Seite offline nehmen</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
