'use client'

import { useEditorDraft } from './useEditorDraft'
import type { SectionKey } from '@/lib/landing-content'

export type NavSelection =
  | { kind: 'section'; key: SectionKey }
  | { kind: 'brand'; key: 'colors' | 'logo' }
  | { kind: 'tool'; key: 'templates' | 'ai-chat' | 'ai-scan' | 'requests' }

export type NavMode = 'pages' | 'brand'

const START_SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'about', label: 'Über uns' },
  { key: 'gallery', label: 'Galerie' },
  { key: 'featured_menu', label: 'Menü-Highlights' },
  { key: 'team', label: 'Team' },
  { key: 'story', label: 'Geschichte' },
  { key: 'ambiance', label: 'Atmosphäre' },
  { key: 'awards', label: 'Auszeichnungen' },
  { key: 'opening_hours', label: 'Öffnungszeiten' },
  { key: 'reviews', label: 'Bewertungen' },
  { key: 'reservation_cta', label: 'Reservierungs-Aufruf' },
  { key: 'contact', label: 'Kontakt' },
  { key: 'instagram', label: 'Instagram' },
]

const BRAND_ITEMS: { sel: NavSelection; label: string }[] = [
  { sel: { kind: 'brand', key: 'colors' }, label: 'Farben & Schrift' },
  { sel: { kind: 'brand', key: 'logo' }, label: 'Logo & Infos' },
  { sel: { kind: 'tool', key: 'templates' }, label: 'Templates' },
  { sel: { kind: 'tool', key: 'ai-chat' }, label: 'KI-Assistent' },
  { sel: { kind: 'tool', key: 'ai-scan' }, label: 'Design erkennen' },
  { sel: { kind: 'tool', key: 'requests' }, label: 'Design anfragen' },
]

function rowStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 10px', borderRadius: '7px', cursor: 'pointer',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text)',
    fontSize: '0.82rem', fontWeight: active ? 700 : 500, border: 'none', width: '100%', textAlign: 'left',
  }
}

export function EditorNav({
  mode, onModeChange, selection, onSelect,
}: {
  mode: NavMode
  onModeChange: (m: NavMode) => void
  selection: NavSelection
  onSelect: (s: NavSelection) => void
}) {
  const { draft, updateLandingContent } = useEditorDraft()
  const vis = draft?.landing_content.section_visibility ?? {}
  const isVis = (k: SectionKey) => vis[k] !== false
  const toggle = (k: SectionKey) => updateLandingContent(prev => ({
    ...prev, section_visibility: { ...prev.section_visibility, [k]: !(prev.section_visibility?.[k] !== false) },
  }))

  const isSel = (s: NavSelection) => s.kind === selection.kind && s.key === selection.key

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Modus-Umschalter */}
      <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-2)', borderRadius: '8px', padding: '3px', margin: '10px' }}>
        {(['pages', 'brand'] as NavMode[]).map(m => (
          <button key={m} onClick={() => onModeChange(m)} style={{
            flex: 1, padding: '7px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            fontSize: '0.76rem', fontWeight: mode === m ? 700 : 500,
            background: mode === m ? 'var(--accent)' : 'transparent',
            color: mode === m ? '#fff' : 'var(--text-muted)',
          }}>{m === 'pages' ? 'Seiten' : 'Design & Marke'}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {mode === 'pages' && (
          <>
            <div style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 700, padding: '8px 10px 4px' }}>Start-Sektionen</div>
            {START_SECTIONS.map(s => {
              const active = isSel({ kind: 'section', key: s.key })
              return (
                <div key={s.key} style={rowStyle(active)}>
                  <button onClick={() => onSelect({ kind: 'section', key: s.key })}
                    style={{ flex: 1, background: 'transparent', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
                    {s.label}
                  </button>
                  <button onClick={() => toggle(s.key)} title={isVis(s.key) ? 'Sichtbar' : 'Aus'}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.85rem', opacity: isVis(s.key) ? 1 : 0.4 }}>
                    {isVis(s.key) ? '👁' : '🚫'}
                  </button>
                </div>
              )
            })}
          </>
        )}

        {mode === 'brand' && BRAND_ITEMS.map(item => (
          <button key={`${item.sel.kind}-${item.sel.key}`} onClick={() => onSelect(item.sel)} style={rowStyle(isSel(item.sel))}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
