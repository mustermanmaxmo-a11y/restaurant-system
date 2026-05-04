'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Search, ShoppingCart, AlertTriangle, ChevronDown, ChevronUp, Plus, Minus } from 'lucide-react'
import type { Order, Table, MenuItem, MenuCategory } from '@/types/database'
import { timeAgo } from '@/lib/utils'

interface CartItem {
  item: MenuItem
  qty: number
}

interface StaffOrderPanelProps {
  table: Table
  restaurantId: string
  existingOrders: Order[]
  onClose: () => void
  onOrderPlaced: () => void
}

const COMMON_ALLERGENS = ['Gluten', 'Laktose', 'Nüsse', 'Eier', 'Fisch', 'Soja', 'Sesam']

const ACCENT = '#e5b44b'

export default function StaffOrderPanel({
  table,
  restaurantId,
  existingOrders,
  onClose,
  onOrderPlaced,
}: StaffOrderPanelProps) {
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [allergenFilter, setAllergenFilter] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [allergenOpen, setAllergenOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const allergenRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchMenu() {
      setLoading(true)
      const [{ data: cats }, { data: menuItems }] = await Promise.all([
        supabase
          .from('menu_categories')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('active', true)
          .order('sort_order'),
        supabase
          .from('menu_items')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('available', true)
          .order('sort_order'),
      ])
      setCategories((cats as MenuCategory[]) || [])
      setItems((menuItems as MenuItem[]) || [])
      setLoading(false)
    }
    fetchMenu()
  }, [restaurantId])

  // Clear submit error whenever the cart changes
  useEffect(() => {
    if (submitError) setSubmitError(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart])

  // Fix 4 — allergen dropdown outside-click + Escape dismiss
  useEffect(() => {
    if (!allergenOpen) return
    const handler = (e: MouseEvent) => {
      if (allergenRef.current && !allergenRef.current.contains(e.target as Node)) {
        setAllergenOpen(false)
      }
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAllergenOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [allergenOpen])

  // Filtering
  const filteredItems = items.filter(item => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false
    if (selectedCategory && item.category_id !== selectedCategory) return false
    if (allergenFilter.length > 0 && item.allergens?.some(a => allergenFilter.includes(a))) return false
    return true
  })

  // Cart helpers
  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id)
      if (existing) return prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { item, qty: 1 }]
    })
  }

  function removeFromCart(itemId: string) {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === itemId)
      if (!existing) return prev
      if (existing.qty <= 1) return prev.filter(c => c.item.id !== itemId)
      return prev.map(c => c.item.id === itemId ? { ...c, qty: c.qty - 1 } : c)
    })
  }

  function getQty(itemId: string): number {
    return cart.find(c => c.item.id === itemId)?.qty ?? 0
  }

  function toggleAllergen(allergen: string) {
    setAllergenFilter(prev =>
      prev.includes(allergen) ? prev.filter(a => a !== allergen) : [...prev, allergen]
    )
  }

  async function handleSubmit() {
    if (cart.length === 0 || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    const total = cart.reduce((s, c) => s + c.item.price * c.qty, 0)
    const { error } = await supabase.from('orders').insert({
      restaurant_id: restaurantId,
      order_type: 'dine_in',
      table_id: table.id,
      status: 'new',
      source: 'staff',
      items: cart.map(c => ({
        item_id: c.item.id,
        name: c.item.name,
        price: c.item.price,
        qty: c.qty,
      })),
      note: note.trim() || null,
      total,
    })
    setSubmitting(false)
    if (error) {
      console.error('Order insert failed:', error)
      setSubmitError('Bestellung konnte nicht gesendet werden. Bitte erneut versuchen.')
      return
    }
    onOrderPlaced()
    onClose()
  }

  const total = cart.reduce((s, c) => s + c.item.price * c.qty, 0)
  const cartCount = cart.reduce((s, c) => s + c.qty, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#141414', color: '#fff' }}>

      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #2a2a2a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        background: '#1a1a1a',
      }}>
        <div>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
            Bestellen — {table.label}
          </p>
          {existingOrders.length > 0 && (
            <p style={{ color: ACCENT, fontSize: '0.75rem', marginTop: '2px' }}>
              {existingOrders.length} aktive Bestellung{existingOrders.length > 1 ? 'en' : ''}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#666', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

        {/* Existing orders (read-only) */}
        {existingOrders.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <p style={{ color: '#555', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Aktive Bestellungen
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {existingOrders.map(order => (
                <div key={order.id} style={{
                  background: '#1a1a1a',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  border: `1px solid ${order.status === 'new' ? '#f59e0b33' : '#ff6b3533'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: order.status === 'new' ? '#f59e0b' : '#ff6b35' }}>
                      {order.status === 'new' ? '● Neu' : '● Küche'}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#555' }}>{timeAgo(order.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {order.items.map((item, i) => (
                      <span key={i} style={{ color: '#aaa', fontSize: '0.78rem' }}>
                        <span style={{ color: '#fff', fontWeight: 600 }}>{item.qty}×</span> {item.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Gericht suchen..."
            style={{
              width: '100%',
              padding: '10px 12px 10px 32px',
              borderRadius: '8px',
              border: '1px solid #2a2a2a',
              background: '#1a1a1a',
              color: '#fff',
              fontSize: '0.875rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Category chips */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '12px', paddingBottom: '4px' }}>
          <button
            onClick={() => setSelectedCategory(null)}
            style={{
              flexShrink: 0,
              padding: '5px 12px',
              borderRadius: '20px',
              border: `1px solid ${selectedCategory === null ? ACCENT : '#2a2a2a'}`,
              background: selectedCategory === null ? ACCENT + '22' : 'transparent',
              color: selectedCategory === null ? ACCENT : '#666',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Alle
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                flexShrink: 0,
                padding: '5px 12px',
                borderRadius: '20px',
                border: `1px solid ${selectedCategory === cat.id ? ACCENT : '#2a2a2a'}`,
                background: selectedCategory === cat.id ? ACCENT + '22' : 'transparent',
                color: selectedCategory === cat.id ? ACCENT : '#666',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Allergen filter */}
        <div ref={allergenRef} style={{ marginBottom: '16px', position: 'relative' }}>
          <button
            onClick={() => setAllergenOpen(o => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: `1px solid ${allergenFilter.length > 0 ? '#f59e0b' : '#2a2a2a'}`,
              background: allergenFilter.length > 0 ? '#f59e0b11' : 'transparent',
              color: allergenFilter.length > 0 ? '#f59e0b' : '#666',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <AlertTriangle size={12} />
            Allergen-Filter
            {allergenFilter.length > 0 && (
              <span style={{ background: '#f59e0b', color: '#000', borderRadius: '10px', padding: '1px 6px', fontSize: '0.65rem', fontWeight: 700 }}>
                {allergenFilter.length}
              </span>
            )}
            {allergenOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {allergenOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              zIndex: 10,
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: '10px',
              padding: '12px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              minWidth: '240px',
            }}>
              {COMMON_ALLERGENS.map(allergen => (
                <label key={allergen} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={allergenFilter.includes(allergen)}
                    onChange={() => toggleAllergen(allergen)}
                    style={{ accentColor: '#f59e0b' }}
                  />
                  <span style={{ color: '#ccc', fontSize: '0.78rem' }}>{allergen}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Item list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#555' }}>Menü wird geladen...</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#555', fontSize: '0.875rem' }}>Keine Gerichte gefunden</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {filteredItems.map(item => {
              const qty = getQty(item.id)
              const hasAllergens = item.allergens && item.allergens.length > 0
              return (
                <div key={item.id} style={{
                  background: '#1a1a1a',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  border: `1px solid ${qty > 0 ? ACCENT + '44' : '#2a2a2a'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: '#fff', fontWeight: 600, fontSize: '0.875rem', marginBottom: '2px' }}>{item.name}</p>
                    {item.description && (
                      <p style={{ color: '#555', fontSize: '0.75rem', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.description}</p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: ACCENT, fontWeight: 700, fontSize: '0.875rem' }}>{item.price.toFixed(2)} €</span>
                      {hasAllergens && (
                        <span style={{ color: '#f59e0b', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <AlertTriangle size={10} /> {item.allergens.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {qty > 0 ? (
                      <>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid #2a2a2a', background: '#0d0d0d', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Minus size={12} />
                        </button>
                        <span style={{ color: ACCENT, fontWeight: 700, fontSize: '0.875rem', minWidth: '20px', textAlign: 'center' }}>{qty}</span>
                      </>
                    ) : null}
                    <button
                      onClick={() => addToCart(item)}
                      style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: qty > 0 ? ACCENT : '#2a2a2a', color: qty > 0 ? '#000' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Cart summary */}
        {cart.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <p style={{ color: '#555', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Warenkorb ({cartCount})
            </p>
            <div style={{ background: '#1a1a1a', borderRadius: '10px', padding: '12px 14px', border: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cart.map(c => (
                <div key={c.item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: ACCENT, fontWeight: 700, fontSize: '0.8rem' }}>{c.qty}×</span>
                    <span style={{ color: '#ccc', fontSize: '0.8rem' }}>{c.item.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: '#555', fontSize: '0.78rem' }}>{(c.item.price * c.qty).toFixed(2)} €</span>
                    <button
                      onClick={() => setCart(prev => prev.filter(ci => ci.item.id !== c.item.id))}
                      style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Note */}
        <div style={{ marginBottom: '8px' }}>
          <label style={{ color: '#555', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>
            Notiz (optional)
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="z.B. ohne Zwiebeln, Allergie beachten..."
            rows={2}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #2a2a2a',
              background: '#1a1a1a',
              color: '#fff',
              fontSize: '0.875rem',
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Submit footer */}
      <div style={{ padding: '16px', borderTop: '1px solid #2a2a2a', flexShrink: 0, background: '#1a1a1a' }}>
        {submitError && (
          <p style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '10px', textAlign: 'center' }}>
            {submitError}
          </p>
        )}
        <button
          onClick={handleSubmit}
          disabled={cart.length === 0 || submitting}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '10px',
            border: 'none',
            background: cart.length === 0 ? '#2a2a2a' : ACCENT,
            color: cart.length === 0 ? '#444' : '#000',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: cart.length === 0 || submitting ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <ShoppingCart size={16} />
          {submitting
            ? 'Wird gesendet...'
            : cart.length === 0
            ? 'Warenkorb leer'
            : `Bestellen · ${total.toFixed(2)} €`}
        </button>
      </div>
    </div>
  )
}
