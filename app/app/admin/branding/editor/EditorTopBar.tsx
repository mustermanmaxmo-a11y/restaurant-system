'use client'

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
  slug, page, device, onPageChange, onDeviceChange,
}: {
  slug: string
  page: PreviewPage
  device: PreviewDevice
  onPageChange: (p: PreviewPage) => void
  onDeviceChange: (d: PreviewDevice) => void
}) {
  const { saveStatus, hasUnpublishedChanges, publishing, publish } = useEditorDraft()

  const statusText =
    saveStatus === 'saving' ? 'Speichert…'
    : saveStatus === 'error' ? 'Fehler beim Speichern'
    : hasUnpublishedChanges ? '● Nicht veröffentlichte Änderungen'
    : 'Gespeichert ✓'

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

        <span style={{
          fontSize: '0.74rem', fontWeight: 600,
          color: hasUnpublishedChanges ? 'var(--accent)' : 'var(--text-muted)',
        }}>{statusText}</span>

        <a href={`/${slug}/info`} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
          Live ansehen ↗
        </a>

        <button
          onClick={() => { void publish() }}
          disabled={publishing || !hasUnpublishedChanges}
          style={{
            padding: '9px 20px', borderRadius: '8px', border: 'none',
            background: (publishing || !hasUnpublishedChanges) ? 'var(--surface-2)' : 'var(--accent)',
            color: (publishing || !hasUnpublishedChanges) ? 'var(--text-muted)' : '#fff',
            fontWeight: 700, fontSize: '0.82rem',
            cursor: (publishing || !hasUnpublishedChanges) ? 'default' : 'pointer',
          }}>
          {publishing ? 'Veröffentlicht…' : 'Veröffentlichen'}
        </button>
      </div>
    </div>
  )
}
