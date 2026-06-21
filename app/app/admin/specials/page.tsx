'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { MenuItem, Restaurant } from '@/types/database'
import { useLanguage } from '@/components/providers/language-provider'
import { Flame, MessageSquare, X, Tag } from 'lucide-react'

type DailySpecial = {
  id: string
  menu_item_id: string
  label: string
  special_price: number | null
  note: string | null
  active: boolean
}

const LABEL_OPTIONS = [
  'Tagesgericht', "Chef's Empfehlung", 'Wochenangebot',
  'Sonderangebot', 'Bestseller', 'Saisonal',
]

export default function SpecialsPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [items, setItems] = useState<MenuItem[]>([])
  const [specials, setSpecials] = useState<DailySpecial[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [selectedItemId, setSelectedItemId] = useState('')
  const [label, setLabel] = useState('Tagesgericht')
  const [customLabel, setCustomLabel] = useState('')
  const [useCustomLabel, setUseCustomLabel] = useState(false)
  const [specialPrice, setSpecialPrice] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }
      const { data: resto } = await supabase
        .from('restaurants').select('*').eq('owner_id', session.user.id).limit(1).single()
      if (!resto) { router.push('/admin'); return }
      setRestaurant(resto)
      const [{ data: menuItems }, { data: currentSpecials }] = await Promise.all([
        supabase.from('menu_items').select('id, name, price, category_id').eq('restaurant_id', resto.id).eq('available', true).order('name'),
        supabase.from('daily_specials').select('*').eq('restaurant_id', resto.id).order('created_at', { ascending: false }),
      ])
      setItems((menuItems || []) as unknown as MenuItem[])
      setSpecials(currentSpecials || [])
      setLoading(false)
    }
    load()
  }, [router])

  function openAddModal() {
    setEditingId(null); setSelectedItemId(''); setLabel('Tagesgericht')
    setCustomLabel(''); setUseCustomLabel(false); setSpecialPrice(''); setNote('')
    setShowModal(true)
  }

  function openEditModal(s: DailySpecial) {
    setEditingId(s.id); setSelectedItemId(s.menu_item_id)
    const isPreset = LABEL_OPTIONS.includes(s.label)
    setUseCustomLabel(!isPreset)
    setLabel(isPreset ? s.label : 'Tagesgericht')
    setCustomLabel(isPreset ? '' : s.label)
    setSpecialPrice(s.special_price != null ? String(s.special_price) : '')
    setNote(s.note || '')
    setShowModal(true)
  }

  async function save() {
    if (!restaurant || !selectedItemId) return
    setSaving(true)
    const finalLabel = useCustomLabel ? customLabel.trim() || 'Tagesgericht' : label
    const priceVal = specialPrice ? parseFloat(specialPrice) : null
    if (editingId) {
      await supabase.from('daily_specials').update({ menu_item_id: selectedItemId, label: finalLabel, special_price: priceVal, note: note.trim() || null }).eq('id', editingId)
    } else {
      await supabase.from('daily_specials').upsert({ restaurant_id: restaurant.id, menu_item_id: selectedItemId, label: finalLabel, special_price: priceVal, note: note.trim() || null, active: true }, { onConflict: 'restaurant_id,menu_item_id' })
    }
    const { data } = await supabase.from('daily_specials').select('*').eq('restaurant_id', restaurant.id).order('created_at', { ascending: false })
    setSpecials(data || [])
    setShowModal(false)
    setSaving(false)
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('daily_specials').update({ active: !current }).eq('id', id)
    setSpecials(prev => prev.map(s => s.id === id ? { ...s, active: !current } : s))
  }

  async function deleteSpecial(id: string) {
    await supabase.from('daily_specials').delete().eq('id', id)
    setSpecials(prev => prev.filter(s => s.id !== id))
  }

  const itemMap = Object.fromEntries(items.map(i => [i.id, i]))

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t('common.loading')}</div>
    </div>
  )

  const activeSpecials = specials.filter(s => s.active)
  const inactiveSpecials = specials.filter(s => !s.active)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sticky Page Header */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '14px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10,
        flexWrap: 'wrap', gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f59e0b18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Tag size={18} color="#f59e0b" />
          </div>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1 }}>Tagesangebote</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1px' }}>
              {activeSpecials.length > 0 ? `${activeSpecials.length} aktiv` : 'Keine aktiven Angebote'}
            </p>
          </div>
        </div>
        <button
          onClick={openAddModal}
          style={{
            background: 'var(--accent)', color: 'var(--accent-text)', border: 'none',
            borderRadius: '9px', padding: '8px 16px', fontWeight: 700, fontSize: '0.85rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
          }}
        >
          + Angebot hinzufügen
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 20px 40px', maxWidth: '860px', margin: '0 auto' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.5, marginBottom: '20px' }}>
          Markierte Gerichte erscheinen auf der Bestellseite mit einem Badge und werden vom KI-Assistenten priorisiert.
        </p>

        {activeSpecials.length === 0 && inactiveSpecials.length === 0 ? (
          <div style={{
            background: 'var(--surface)', borderRadius: '16px', padding: '48px 24px',
            textAlign: 'center', border: '1px dashed var(--border)',
          }}>
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}><Flame size={36} color="#f59e0b" /></div>
            <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '4px' }}>Noch keine Tagesangebote</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '20px' }}>Erstelle dein erstes Angebot für Gäste und den KI-Assistenten.</p>
            <button onClick={openAddModal} style={{ background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: '9px', padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}>
              + Angebot hinzufügen
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeSpecials.length > 0 && (
              <>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Aktiv ({activeSpecials.length})
                </p>
                {activeSpecials.map(s => (
                  <SpecialCard key={s.id} s={s} itemMap={itemMap} onEdit={() => openEditModal(s)} onToggle={() => toggleActive(s.id, s.active)} onDelete={() => deleteSpecial(s.id)} />
                ))}
              </>
            )}
            {inactiveSpecials.length > 0 && (
              <>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '16px', marginBottom: '4px' }}>
                  Pausiert ({inactiveSpecials.length})
                </p>
                {inactiveSpecials.map(s => (
                  <SpecialCard key={s.id} s={s} itemMap={itemMap} onEdit={() => openEditModal(s)} onToggle={() => toggleActive(s.id, s.active)} onDelete={() => deleteSpecial(s.id)} />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div
          onClick={() => !saving && setShowModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: '18px', padding: '24px',
              width: '100%', maxWidth: 'min(calc(100vw - 32px), 460px)',
              border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
              maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            <h2 style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.05rem', marginBottom: '20px' }}>
              {editingId ? 'Angebot bearbeiten' : 'Neues Tagesangebot'}
            </h2>

            {/* Item picker */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gericht</label>
              <select
                value={selectedItemId}
                onChange={e => setSelectedItemId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
              >
                <option value="">Gericht auswählen…</option>
                {items.map(i => (
                  <option key={i.id} value={i.id}>{i.name} — {Number(i.price).toFixed(2)} €</option>
                ))}
              </select>
            </div>

            {/* Label */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Badge-Label</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {LABEL_OPTIONS.map(l => (
                  <button
                    key={l}
                    onClick={() => { setLabel(l); setUseCustomLabel(false) }}
                    style={{
                      padding: '5px 11px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                      border: !useCustomLabel && label === l ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      background: !useCustomLabel && label === l ? 'var(--accent-subtle)' : 'transparent',
                      color: !useCustomLabel && label === l ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >{l}</button>
                ))}
                <button
                  onClick={() => setUseCustomLabel(true)}
                  style={{
                    padding: '5px 11px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                    border: useCustomLabel ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                    background: useCustomLabel ? 'var(--accent-subtle)' : 'transparent',
                    color: useCustomLabel ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >Eigener Text</button>
              </div>
              {useCustomLabel && (
                <input
                  value={customLabel}
                  onChange={e => setCustomLabel(e.target.value)}
                  placeholder="z.B. Pasta des Tages"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                />
              )}
            </div>

            {/* Special Price */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Sonderpreis <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  value={specialPrice}
                  onChange={e => setSpecialPrice(e.target.value)}
                  placeholder="z.B. 8.90"
                  type="number"
                  step="0.01"
                  min="0"
                  style={{ width: '100%', padding: '9px 36px 9px 12px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                />
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>€</span>
              </div>
              {specialPrice && selectedItemId && itemMap[selectedItemId] && (
                <p style={{ color: 'var(--accent)', fontSize: '0.78rem', marginTop: '5px', fontWeight: 600 }}>
                  Ersparnis: {(Number(itemMap[selectedItemId].price) - parseFloat(specialPrice)).toFixed(2)} € ({Math.round((1 - parseFloat(specialPrice) / Number(itemMap[selectedItemId].price)) * 100)}% Rabatt)
                </p>
              )}
            </div>

            {/* Note */}
            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Hinweis für KI-Assistent <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
              </label>
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="z.B. Heute besonders frisch, mit Trüffelöl"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
              />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '5px' }}>Der KI-Assistent erwähnt dieses Gericht proaktiv in passenden Gesprächen.</p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                style={{ flex: 1, padding: '11px', borderRadius: '9px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' }}
              >{t('common.cancel')}</button>
              <button
                onClick={save}
                disabled={saving || !selectedItemId}
                style={{ flex: 2, padding: '11px', borderRadius: '9px', border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 700, fontSize: '0.88rem', cursor: saving || !selectedItemId ? 'not-allowed' : 'pointer', opacity: saving || !selectedItemId ? 0.6 : 1 }}
              >{saving ? 'Speichert…' : editingId ? 'Änderungen speichern' : 'Angebot erstellen'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SpecialCard({ s, itemMap, onEdit, onToggle, onDelete }: {
  s: DailySpecial
  itemMap: Record<string, MenuItem>
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const item = itemMap[s.menu_item_id]
  if (!item) return null

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: '13px', padding: '14px 16px',
      border: s.active ? '1px solid var(--border)' : '1px dashed var(--border)',
      display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
      opacity: s.active ? 1 : 0.6,
    }}>
      <div style={{ flex: 1, minWidth: '160px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <span style={{
            background: '#f59e0b18', color: '#f59e0b', fontSize: '0.7rem', fontWeight: 700,
            padding: '2px 8px', borderRadius: '6px',
            display: 'inline-flex', alignItems: 'center', gap: '4px',
          }}><Flame size={10} /> {s.label}</span>
          <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.92rem' }}>{item.name}</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {s.special_price != null ? (
            <>
              <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.9rem' }}>{Number(s.special_price).toFixed(2)} €</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textDecoration: 'line-through' }}>{Number(item.price).toFixed(2)} €</span>
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>{Number(item.price).toFixed(2)} €</span>
          )}
          {s.note && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <MessageSquare size={10} /> {s.note}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '7px', alignItems: 'center', flexShrink: 0 }}>
        <button onClick={onToggle} style={{ padding: '6px 11px', borderRadius: '7px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer' }}>
          {s.active ? 'Pausieren' : 'Aktivieren'}
        </button>
        <button onClick={onEdit} style={{ padding: '6px 11px', borderRadius: '7px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer' }}>
          Bearbeiten
        </button>
        <button onClick={onDelete} style={{ padding: '6px 9px', borderRadius: '7px', border: 'none', background: '#ef444418', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
