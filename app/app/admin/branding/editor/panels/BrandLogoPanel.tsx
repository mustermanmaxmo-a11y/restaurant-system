'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEditorDraft } from '../useEditorDraft'

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }
const sectionLabel: React.CSSProperties = { display: 'block', fontSize: '0.85rem', color: 'var(--text)', marginBottom: '12px', fontWeight: 700 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none' }

export function BrandLogoPanel({ restaurantId }: { restaurantId: string }) {
  const { draft, updateBrand } = useEditorDraft()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  if (!draft) return null
  const b = draft.brand

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${restaurantId}/logo.${ext}`
    const { error } = await supabase.storage.from('restaurant-logos').upload(path, file, { upsert: true })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('restaurant-logos').getPublicUrl(path)
      updateBrand({ logo_url: publicUrl })
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div>
      <label style={sectionLabel}>Logo</label>
      <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border)', marginBottom: '24px' }}>
        {b.logo_url ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <img src={b.logo_url} alt="Logo" style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', padding: '4px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => fileRef.current?.click()} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>Ersetzen</button>
              <button onClick={() => updateBrand({ logo_url: null })} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', color: '#ef4444' }}>Entfernen</button>
            </div>
          </div>
        ) : (
          <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: '10px', padding: '24px', textAlign: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}>
            {uploading ? 'Wird hochgeladen…' : 'Logo hochladen (PNG, JPG, SVG)'}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
      </div>

      <label style={sectionLabel}>Kontakt & Beschreibung</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={fieldLabel}>Tagline / Beschreibung</label>
          <textarea value={b.description ?? ''} onChange={e => updateBrand({ description: e.target.value.slice(0, 160) })}
            placeholder="z.B. Authentische Pasta & Pizza seit 1998" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <div><label style={fieldLabel}>E-Mail</label><input type="email" value={b.contact_email ?? ''} onChange={e => updateBrand({ contact_email: e.target.value })} placeholder="info@restaurant.de" style={inputStyle} /></div>
        <div><label style={fieldLabel}>Telefon</label><input type="tel" value={b.contact_phone ?? ''} onChange={e => updateBrand({ contact_phone: e.target.value })} placeholder="+49 89 123456" style={inputStyle} /></div>
        <div><label style={fieldLabel}>Adresse</label><input type="text" value={b.contact_address ?? ''} onChange={e => updateBrand({ contact_address: e.target.value })} placeholder="Musterstr. 1, 80331 München" style={inputStyle} /></div>
      </div>
    </div>
  )
}
