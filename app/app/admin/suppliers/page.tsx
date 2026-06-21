'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, ChevronDown, ChevronUp, Mail, Phone, Truck } from 'lucide-react'

interface Supplier {
  id: string; name: string; email: string | null; phone: string | null
  category: string | null; notes: string | null; contact_name: string | null
}

interface SupplierProduct {
  id: string; supplier_id: string; name: string; unit: string | null; price_per_unit: number | null
}

const CATEGORIES = [
  { key: 'meat',       label: '🥩 Fleisch' },
  { key: 'vegetables', label: '🥦 Gemüse' },
  { key: 'drinks',     label: '🍺 Getränke' },
  { key: 'dairy',      label: '🥛 Milchprodukte' },
  { key: 'dry',        label: '🌾 Trockenware' },
  { key: 'other',      label: '📦 Sonstiges' },
]

const inputStyle = {
  width: '100%', boxSizing: 'border-box' as const,
  padding: '10px 12px', borderRadius: '8px',
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text)', fontSize: '0.875rem', outline: 'none',
}

const labelStyle = {
  color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700 as const,
  display: 'block' as const, marginBottom: '5px',
  textTransform: 'uppercase' as const, letterSpacing: '0.06em',
}

export default function SuppliersPage() {
  const router = useRouter()
  const [restaurantId, setRestaurantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Record<string, SupplierProduct[]>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formContact, setFormContact] = useState('')
  const [saving, setSaving] = useState(false)

  const [addingProductFor, setAddingProductFor] = useState<string | null>(null)
  const [prodName, setProdName] = useState('')
  const [prodUnit, setProdUnit] = useState('')
  const [prodPrice, setProdPrice] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }
      const { data: resto } = await supabase.from('restaurants').select('id').eq('owner_id', session.user.id).limit(1).single()
      if (!resto) { router.push('/admin/setup'); return }
      setRestaurantId(resto.id)
      await loadSuppliers(resto.id)
      setLoading(false)
    }
    load()
  }, [router])

  async function loadSuppliers(rid: string) {
    const { data } = await supabase.from('suppliers').select('*').eq('restaurant_id', rid).order('name')
    setSuppliers((data ?? []) as Supplier[])
    if (data?.length) {
      const ids = data.map(s => s.id)
      const { data: prods } = await supabase.from('supplier_products').select('*').in('supplier_id', ids)
      const bySupplier: Record<string, SupplierProduct[]> = {}
      for (const p of prods ?? []) {
        if (!bySupplier[p.supplier_id]) bySupplier[p.supplier_id] = []
        bySupplier[p.supplier_id].push(p as SupplierProduct)
      }
      setProducts(bySupplier)
    }
  }

  function openForm(supplier?: Supplier) {
    if (supplier) {
      setEditingId(supplier.id); setFormName(supplier.name)
      setFormEmail(supplier.email ?? ''); setFormPhone(supplier.phone ?? '')
      setFormCategory(supplier.category ?? ''); setFormNotes(supplier.notes ?? '')
      setFormContact(supplier.contact_name ?? '')
    } else {
      setEditingId(null); setFormName(''); setFormEmail(''); setFormPhone('')
      setFormCategory(''); setFormNotes(''); setFormContact('')
    }
    setShowForm(true)
  }

  async function saveSupplier() {
    if (!formName.trim()) return
    setSaving(true)
    const payload = {
      restaurant_id: restaurantId, name: formName.trim(),
      email: formEmail.trim() || null, phone: formPhone.trim() || null,
      category: formCategory || null, notes: formNotes.trim() || null,
      contact_name: formContact.trim() || null,
    }
    if (editingId) await supabase.from('suppliers').update(payload).eq('id', editingId)
    else await supabase.from('suppliers').insert(payload)
    await loadSuppliers(restaurantId)
    setShowForm(false); setSaving(false)
  }

  async function deleteSupplier(id: string) {
    if (!confirm('Lieferant und alle Produkte löschen?')) return
    await supabase.from('suppliers').delete().eq('id', id)
    setSuppliers(prev => prev.filter(s => s.id !== id))
  }

  async function addProduct(supplierId: string) {
    if (!prodName.trim()) return
    await supabase.from('supplier_products').insert({
      supplier_id: supplierId, name: prodName.trim(),
      unit: prodUnit.trim() || null,
      price_per_unit: prodPrice ? parseFloat(prodPrice) : null,
    })
    await loadSuppliers(restaurantId)
    setProdName(''); setProdUnit(''); setProdPrice('')
    setAddingProductFor(null)
  }

  async function deleteProduct(id: string, supplierId: string) {
    await supabase.from('supplier_products').delete().eq('id', id)
    setProducts(prev => ({ ...prev, [supplierId]: (prev[supplierId] ?? []).filter(p => p.id !== id) }))
  }

  if (loading) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Page header */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '14px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10,
        flexWrap: 'wrap', gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#38bdf818', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Truck size={18} color="#38bdf8" />
          </div>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1 }}>Lieferanten</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1px' }}>{suppliers.length} Lieferanten</p>
          </div>
        </div>
        <button onClick={() => openForm()} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'var(--accent)', border: 'none', borderRadius: '9px',
          padding: '8px 14px', color: 'var(--accent-text)',
          fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
        }}>
          <Plus size={14} /> Neu
        </button>
      </div>

      <div style={{ padding: '16px 20px 40px', maxWidth: '860px', margin: '0 auto' }}>
        {suppliers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#38bdf818', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Truck size={28} color="#38bdf8" />
            </div>
            <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '6px' }}>Noch keine Lieferanten</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Lege Lieferanten an um Bestellungen direkt per E-Mail zu senden.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {suppliers.map(sup => {
              const isExpanded = expandedId === sup.id
              const supProducts = products[sup.id] ?? []
              const catLabel = CATEGORIES.find(c => c.key === sup.category)?.label ?? sup.category ?? ''

              return (
                <div key={sup.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                  {/* Supplier row */}
                  <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.92rem', margin: 0 }}>{sup.name}</p>
                        {catLabel && (
                          <span style={{ background: 'var(--bg)', color: 'var(--text-muted)', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                            {catLabel}
                          </span>
                        )}
                        {supProducts.length > 0 && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{supProducts.length} Produkte</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {sup.contact_name && <span style={{ color: 'var(--text-muted)', fontSize: '0.77rem' }}>{sup.contact_name}</span>}
                        {sup.email && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.77rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Mail size={11} /> {sup.email}
                          </span>
                        )}
                        {sup.phone && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.77rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={11} /> {sup.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                      <button onClick={() => openForm(sup)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '7px', padding: '5px 10px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}>
                        Bearbeiten
                      </button>
                      <button onClick={() => deleteSupplier(sup.id)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '7px', padding: '5px 8px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={13} />
                      </button>
                      <button onClick={() => setExpandedId(isExpanded ? null : sup.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded section */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', background: 'var(--bg)' }}>
                      {sup.notes && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '14px', fontStyle: 'italic' }}>
                          {sup.notes}
                        </p>
                      )}

                      <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.82rem', marginBottom: '8px' }}>
                        Produkte ({supProducts.length})
                      </p>

                      {supProducts.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
                          {supProducts.map(prod => (
                            <div key={prod.id} style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '7px 10px', background: 'var(--surface)',
                              borderRadius: '8px', border: '1px solid var(--border)',
                              flexWrap: 'wrap',
                            }}>
                              <span style={{ color: 'var(--text)', fontSize: '0.84rem', flex: 1, minWidth: '80px' }}>{prod.name}</span>
                              {prod.unit && <span style={{ color: 'var(--text-muted)', fontSize: '0.77rem' }}>/ {prod.unit}</span>}
                              {prod.price_per_unit != null && (
                                <span style={{ color: 'var(--accent)', fontSize: '0.84rem', fontWeight: 700 }}>{prod.price_per_unit.toFixed(2)} €</span>
                              )}
                              <button onClick={() => deleteProduct(prod.id, sup.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {addingProductFor === sup.id ? (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                          <input value={prodName} onChange={e => setProdName(e.target.value)} placeholder="Produktname"
                            style={{ ...inputStyle, flex: 2, minWidth: '120px' }} />
                          <input value={prodUnit} onChange={e => setProdUnit(e.target.value)} placeholder="kg / L / Stk"
                            style={{ ...inputStyle, width: '90px' }} />
                          <input value={prodPrice} onChange={e => setProdPrice(e.target.value)} type="number" step="0.01" placeholder="Preis €"
                            style={{ ...inputStyle, width: '90px' }} />
                          <button onClick={() => addProduct(sup.id)} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '8px 13px', color: 'var(--accent-text)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            + Hinzufügen
                          </button>
                          <button onClick={() => setAddingProductFor(null)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
                            Abbruch
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setAddingProductFor(sup.id)} style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: '8px', padding: '7px 12px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
                          + Produkt hinzufügen
                        </button>
                      )}

                      {sup.email && (
                        <a href={`mailto:${sup.email}?subject=Bestellung`} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px',
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: '8px', padding: '7px 12px',
                          color: 'var(--text)', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
                        }}>
                          <Mail size={13} /> Bestellung per E-Mail
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Supplier form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '24px', maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)' }}>
            <h2 style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1rem', marginBottom: '20px' }}>
              {editingId ? 'Lieferant bearbeiten' : 'Neuer Lieferant'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div><label style={labelStyle}>Name *</label><input value={formName} onChange={e => setFormName(e.target.value)} autoFocus style={inputStyle} placeholder="Fleischerei Maier" /></div>
              <div><label style={labelStyle}>Ansprechpartner</label><input value={formContact} onChange={e => setFormContact(e.target.value)} style={inputStyle} placeholder="Hans Maier" /></div>
              <div><label style={labelStyle}>E-Mail</label><input value={formEmail} onChange={e => setFormEmail(e.target.value)} type="email" style={inputStyle} placeholder="maier@fleisch.de" /></div>
              <div><label style={labelStyle}>Telefon</label><input value={formPhone} onChange={e => setFormPhone(e.target.value)} type="tel" style={inputStyle} placeholder="+49 89 12345678" /></div>
              <div>
                <label style={labelStyle}>Kategorie</label>
                <select value={formCategory} onChange={e => setFormCategory(e.target.value)} style={inputStyle}>
                  <option value="">— Auswählen —</option>
                  {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Notizen</label><textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Lieferzeiten, Mindestbestellmenge…" /></div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowForm(false)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '9px', padding: '9px 16px', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Abbrechen</button>
                <button onClick={saveSupplier} disabled={saving || !formName.trim()} style={{ background: 'var(--accent)', border: 'none', borderRadius: '9px', padding: '9px 20px', color: 'var(--accent-text)', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontSize: '0.85rem', opacity: !formName.trim() ? 0.5 : 1 }}>
                  {saving ? 'Speichert…' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
