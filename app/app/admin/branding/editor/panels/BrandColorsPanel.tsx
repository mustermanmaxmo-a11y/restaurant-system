'use client'

import { useEditorDraft } from '../useEditorDraft'
import { ColorPickerInput } from '../ColorPickerInput'
import { getDesignPackage } from '@/lib/design-packages'
import { FONT_PAIRS } from '@/lib/font-pairs'
import type { LayoutVariant } from '@/lib/design-packages'

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }
const sectionLabel: React.CSSProperties = { display: 'block', fontSize: '0.85rem', color: 'var(--text)', marginBottom: '12px', fontWeight: 700 }

export function BrandColorsPanel() {
  const { draft, updateBrand } = useEditorDraft()
  if (!draft) return null
  const b = draft.brand
  const pkg = getDesignPackage(b.design_package)
  const accent = b.primary_color ?? pkg.preview.primaryColor
  const bg = b.bg_color ?? pkg.preview.bgColor
  const header = b.header_color ?? pkg.preview.headerColor
  const card = b.card_color ?? pkg.preview.cardColor
  const button = b.button_color ?? pkg.preview.buttonColor
  const text = b.text_color ?? pkg.preview.textColor

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <label style={sectionLabel}>Farben</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
          <div><label style={fieldLabel}>Akzentfarbe</label><ColorPickerInput value={accent} onChange={v => updateBrand({ primary_color: v })} onReset={() => updateBrand({ primary_color: null })} /></div>
          <div><label style={fieldLabel}>Hintergrund</label><ColorPickerInput value={bg} onChange={v => updateBrand({ bg_color: v })} onReset={() => updateBrand({ bg_color: null })} /></div>
          <div><label style={fieldLabel}>Header</label><ColorPickerInput value={header} onChange={v => updateBrand({ header_color: v })} onReset={() => updateBrand({ header_color: null })} /></div>
          <div><label style={fieldLabel}>Karten</label><ColorPickerInput value={card} onChange={v => updateBrand({ card_color: v })} onReset={() => updateBrand({ card_color: null })} /></div>
          <div><label style={fieldLabel}>Buttons</label><ColorPickerInput value={button} onChange={v => updateBrand({ button_color: v })} onReset={() => updateBrand({ button_color: null })} /></div>
          <div><label style={fieldLabel}>Text</label><ColorPickerInput value={text} onChange={v => updateBrand({ text_color: v })} onReset={() => updateBrand({ text_color: null })} /></div>
        </div>
      </div>

      <label style={sectionLabel}>Schriftart</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginBottom: '24px' }}>
        {Object.entries(FONT_PAIRS).map(([id, pair]) => {
          const active = id === b.font_pair
          return (
            <button key={id} onClick={() => updateBrand({ font_pair: id })} style={{
              background: active ? `${accent}12` : 'var(--surface)', border: active ? `2px solid ${accent}` : '2px solid var(--border)',
              borderRadius: '10px', padding: '14px 12px', cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{ fontFamily: `${pair.heading}, system-ui`, fontWeight: 700, fontSize: '1rem', color: 'var(--text)', marginBottom: '4px' }}>Aa</div>
              <div style={{ fontFamily: `${pair.body}, system-ui`, fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{pair.label}</div>
            </button>
          )
        })}
      </div>

      <label style={sectionLabel}>Layout (Bestellseite)</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
        {(['cards', 'list', 'large-cards', 'grid'] as LayoutVariant[]).map(v => {
          const active = v === b.layout_variant
          const labels: Record<LayoutVariant, string> = { cards: 'Cards', list: 'Liste', 'large-cards': 'Große Karten', grid: '2-Spalten' }
          return (
            <button key={v} onClick={() => updateBrand({ layout_variant: v })} style={{
              background: active ? `${accent}12` : 'var(--surface)', border: active ? `2px solid ${accent}` : '2px solid var(--border)',
              borderRadius: '10px', padding: '12px 8px', cursor: 'pointer', textAlign: 'center',
              color: active ? 'var(--text)' : 'var(--text-muted)', fontSize: '0.74rem', fontWeight: 600,
            }}>{labels[v]}</button>
          )
        })}
      </div>
    </div>
  )
}
