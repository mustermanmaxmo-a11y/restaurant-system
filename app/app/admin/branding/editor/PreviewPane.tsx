'use client'

import { useState } from 'react'

interface PreviewPaneProps {
  slug: string
  /** Bei jeder Änderung wird der iframe neu geladen. */
  reloadToken: number
}

type PreviewPage = 'start' | 'speisekarte' | 'reservieren'
type PreviewDevice = 'mobile' | 'desktop'

const PAGE_TABS: { key: PreviewPage; label: string }[] = [
  { key: 'start', label: 'Start' },
  { key: 'speisekarte', label: 'Speisekarte' },
  { key: 'reservieren', label: 'Reservieren' },
]

function buildSrc(slug: string, page: PreviewPage): string {
  switch (page) {
    case 'speisekarte': return `/bestellen/${slug}?preview=1`
    case 'reservieren': return `/bestellen/${slug}?tab=reserve&preview=1`
    case 'start':
    default: return `/${slug}/info?preview=1`
  }
}

const pillBtn = (active: boolean): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
  fontSize: '0.72rem', fontWeight: 700,
  background: active ? 'var(--accent)' : 'transparent',
  color: active ? '#fff' : 'var(--text-muted)',
})

export function PreviewPane({ slug, reloadToken }: PreviewPaneProps) {
  const [page, setPage] = useState<PreviewPage>('start')
  const [device, setDevice] = useState<PreviewDevice>('mobile')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Steuerleiste */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '2px' }}>
          {PAGE_TABS.map(t => (
            <button key={t.key} style={pillBtn(page === t.key)} onClick={() => setPage(t.key)}>{t.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          <button style={pillBtn(device === 'mobile')} onClick={() => setDevice('mobile')} title="Mobil">📱</button>
          <button style={pillBtn(device === 'desktop')} onClick={() => setDevice('desktop')} title="Desktop">🖥</button>
        </div>
      </div>
      {/* Rahmen */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--surface-2)', display: 'flex', justifyContent: 'center', padding: device === 'mobile' ? '12px' : '0' }}>
        <iframe
          key={`${page}-${reloadToken}`}
          src={buildSrc(slug, page)}
          title="Vorschau"
          style={{
            border: device === 'mobile' ? '1px solid var(--border)' : 'none',
            borderRadius: device === 'mobile' ? '12px' : '0',
            width: device === 'mobile' ? '390px' : '100%',
            maxWidth: '100%',
            height: '100%',
            minHeight: '600px',
            background: '#fff',
          }}
        />
      </div>
    </div>
  )
}
