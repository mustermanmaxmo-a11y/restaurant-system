'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { MenuItem, MenuCategory, Order, Table, Restaurant } from '@/types/database'

type CartItem = { item: MenuItem; qty: number }
type View = 'menu' | 'cart' | 'status'

const STATUS_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  new: { label: 'Bestellung eingegangen', icon: '📋', color: '#f59e0b' },
  cooking: { label: 'Wird zubereitet', icon: '👨‍🍳', color: '#ff6b35' },
  served: { label: 'Serviert — Guten Appetit!', icon: '✅', color: '#10b981' },
  cancelled: { label: 'Storniert', icon: '❌', color: '#ef4444' },
}

export default function OrderPage() {
  const params = useParams()
  const token = params.token as string

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [table, setTable] = useState<Table | null>(null)
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [note, setNote] = useState('')
  const [view, setView] = useState<View>('menu')
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    async function load() {
      const { data: tableData } = await supabase
        .from('tables')
        .select('*, restaurants(*)')
        .eq('qr_token', token)
        .eq('active', true)
        .single()

      if (!tableData) {
        setError('Ungültiger QR-Code. Bitte scanne den QR-Code erneut.')
        setLoading(false)
        return
      }

      setTable(tableData)
      setRestaurant(tableData.restaurants as Restaurant)

      const restaurantId = tableData.restaurant_id

      const [{ data: cats }, { data: menuItems }] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).eq('active', true).order('sort_order'),
        supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).eq('available', true).order('sort_order'),
      ])

      setCategories(cats || [])
      setItems(menuItems || [])
      if (cats && cats.length > 0) setActiveCategory(cats[0].id)
      setLoading(false)
    }
    load()
  }, [token])

  useEffect(() => {
    if (!order) return
    const channel = supabase
      .channel(`order-${order.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${order.id}`,
      }, (payload) => {
        setOrder(prev => prev ? { ...prev, ...(payload.new as Partial<Order>) } : null)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [order])

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
      if (existing.qty > 1) return prev.map(c => c.item.id === itemId ? { ...c, qty: c.qty - 1 } : c)
      return prev.filter(c => c.item.id !== itemId)
    })
  }

  function getQty(itemId: string) {
    return cart.find(c => c.item.id === itemId)?.qty ?? 0
  }

  const total = cart.reduce((sum, c) => sum + c.item.price * c.qty, 0)
  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0)

  async function callWaiter(type: 'waiter' | 'bill') {
    if (!table || !restaurant) return
    await supabase.from('service_calls').insert({
      restaurant_id: restaurant.id,
      table_id: table.id,
      type,
    })
  }

  async function submitOrder() {
    if (!table || !restaurant) return
    setSubmitting(true)
    setError('')

    const { data, error: err } = await supabase
      .from('orders')
      .insert({
        restaurant_id: restaurant.id,
        order_type: 'dine_in',
        table_id: table.id,
        status: 'new',
        items: cart.map(c => ({ item_id: c.item.id, name: c.item.name, price: c.item.price, qty: c.qty })),
        note: note || null,
        total,
      })
      .select()
      .single()

    if (err || !data) {
      setError('Fehler beim Bestellen. Bitte versuche es erneut.')
      setSubmitting(false)
      return
    }

    setOrder(data as Order)
    setView('status')
    setSubmitting(false)
  }

  function scrollToCategory(catId: string) {
    setActiveCategory(catId)
    categoryRefs.current[catId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🍽️</div>
          <p style={{ color: '#aaa' }}>Menü wird geladen...</p>
        </div>
      </div>
    )
  }

  if (error && !restaurant) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', padding: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>❌</div>
          <p style={{ color: '#fff', fontWeight: 700, marginBottom: '8px' }}>QR-Code ungültig</p>
          <p style={{ color: '#aaa', fontSize: '0.875rem' }}>{error}</p>
        </div>
      </div>
    )
  }

  // Order status view
  if (view === 'status' && order) {
    const status = STATUS_LABELS[order.status] ?? STATUS_LABELS.new
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f0f', padding: '32px 20px' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>{status.icon}</div>
            <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
              {status.label}
            </h1>
            <p style={{ color: '#aaa', fontSize: '0.875rem' }}>
              Tisch {table?.table_num} · {restaurant?.name}
            </p>
          </div>

          {/* Progress Steps */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '40px' }}>
            {['new', 'cooking', 'served'].map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: ['new', 'cooking', 'served'].indexOf(order.status) >= i ? '#ff6b35' : '#2a2a2a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '0.75rem', fontWeight: 700,
                  transition: 'background 0.5s',
                }}>
                  {i + 1}
                </div>
                {i < 2 && (
                  <div style={{
                    width: '40px', height: '2px',
                    background: ['new', 'cooking', 'served'].indexOf(order.status) > i ? '#ff6b35' : '#2a2a2a',
                    transition: 'background 0.5s',
                  }} />
                )}
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div style={{ background: '#1a1a1a', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ color: '#fff', fontWeight: 700, marginBottom: '12px', fontSize: '0.9rem' }}>
              Deine Bestellung
            </h3>
            {order.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#aaa', fontSize: '0.875rem' }}>{item.qty}× {item.name}</span>
                <span style={{ color: '#aaa', fontSize: '0.875rem' }}>{(item.price * item.qty).toFixed(2)}€</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #2a2a2a', marginTop: '12px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#fff', fontWeight: 700 }}>Gesamt</span>
              <span style={{ color: '#ff6b35', fontWeight: 700 }}>{order.total.toFixed(2)}€</span>
            </div>
          </div>

          {/* Service Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              onClick={() => callWaiter('waiter')}
              style={{
                background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px',
                padding: '16px', color: '#fff', cursor: 'pointer', textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🔔</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Kellner rufen</div>
            </button>
            <button
              onClick={() => callWaiter('bill')}
              style={{
                background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px',
                padding: '16px', color: '#fff', cursor: 'pointer', textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🧾</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Rechnung</div>
            </button>
          </div>

          <button
            onClick={() => { setCart([]); setNote(''); setView('menu') }}
            style={{
              marginTop: '20px', width: '100%', background: 'transparent',
              border: '1px solid #2a2a2a', borderRadius: '10px', padding: '12px',
              color: '#aaa', cursor: 'pointer', fontSize: '0.875rem',
            }}
          >
            Weitere Bestellung aufgeben
          </button>
        </div>
      </div>
    )
  }

  // Cart view
  if (view === 'cart') {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f0f', padding: '0' }}>
        {/* Header */}
        <div style={{ background: '#1a1a1a', padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #2a2a2a' }}>
          <button onClick={() => setView('menu')} style={{ background: 'none', border: 'none', color: '#ff6b35', cursor: 'pointer', fontSize: '1.2rem' }}>←</button>
          <h2 style={{ color: '#fff', fontWeight: 700 }}>Warenkorb</h2>
        </div>

        <div style={{ padding: '20px', maxWidth: '480px', margin: '0 auto' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛒</div>
              <p style={{ color: '#aaa' }}>Dein Warenkorb ist leer</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {cart.map(c => (
                  <div key={c.item.id} style={{ background: '#1a1a1a', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: '#fff', fontWeight: 600, marginBottom: '2px' }}>{c.item.name}</p>
                      <p style={{ color: '#aaa', fontSize: '0.875rem' }}>{c.item.price.toFixed(2)}€</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button onClick={() => removeFromCart(c.item.id)} style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#2a2a2a', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ color: '#fff', fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{c.qty}</span>
                      <button onClick={() => addToCart(c.item)} style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#ff6b35', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Note */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ color: '#aaa', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Anmerkung (optional)</label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="z.B. Kein Zwiebeln, extra scharf..."
                  rows={3}
                  style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '12px', color: '#fff', fontSize: '0.875rem', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Total */}
              <div style={{ background: '#1a1a1a', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#aaa' }}>Gesamt</span>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: '1.25rem' }}>{total.toFixed(2)}€</span>
              </div>

              {error && <p style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}

              <button
                onClick={submitOrder}
                disabled={submitting}
                style={{
                  width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                  background: submitting ? '#2a2a2a' : '#ff6b35',
                  color: '#fff', fontSize: '1rem', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Wird gesendet...' : `Jetzt bestellen · ${total.toFixed(2)}€`}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // Menu view
  const filteredItems = activeCategory ? items.filter(i => i.category_id === activeCategory) : items

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ background: '#1a1a1a', padding: '20px', borderBottom: '1px solid #2a2a2a' }}>
        <h1 style={{ color: '#fff', fontWeight: 700, fontSize: '1.25rem' }}>{restaurant?.name}</h1>
        <p style={{ color: '#aaa', fontSize: '0.8rem', marginTop: '2px' }}>Tisch {table?.table_num}</p>
      </div>

      {/* Category Tabs */}
      {categories.length > 0 && (
        <div style={{ overflowX: 'auto', background: '#1a1a1a', borderBottom: '1px solid #2a2a2a' }}>
          <div style={{ display: 'flex', gap: '0', padding: '0 16px', minWidth: 'max-content' }}>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                style={{
                  padding: '12px 16px', background: 'none', border: 'none',
                  color: activeCategory === cat.id ? '#ff6b35' : '#aaa',
                  fontWeight: activeCategory === cat.id ? 700 : 400,
                  cursor: 'pointer', fontSize: '0.875rem', whiteSpace: 'nowrap',
                  borderBottom: activeCategory === cat.id ? '2px solid #ff6b35' : '2px solid transparent',
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu Items */}
      <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
        {categories.map(cat => {
          const catItems = items.filter(i => i.category_id === cat.id)
          if (catItems.length === 0) return null
          return (
            <div key={cat.id} ref={el => { categoryRefs.current[cat.id] = el }} style={{ marginBottom: '32px' }}>
              <h2 style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', marginBottom: '12px', paddingTop: '8px' }}>
                {cat.name}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {catItems.map(item => {
                  const qty = getQty(item.id)
                  return (
                    <div
                      key={item.id}
                      style={{
                        background: '#1a1a1a', borderRadius: '12px', padding: '14px 16px',
                        display: 'flex', gap: '12px', alignItems: 'center',
                        border: qty > 0 ? '1px solid #ff6b3544' : '1px solid transparent',
                      }}
                    >
                      {item.image_url && (
                        <img src={item.image_url} alt={item.name} style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: '#fff', fontWeight: 600, marginBottom: '2px' }}>{item.name}</p>
                        {item.description && <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</p>}
                        {item.tags.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                            {item.tags.map(tag => (
                              <span key={tag} style={{ background: '#2a2a2a', color: '#aaa', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px' }}>{tag}</span>
                            ))}
                          </div>
                        )}
                        <p style={{ color: '#ff6b35', fontWeight: 700, fontSize: '0.95rem' }}>{item.price.toFixed(2)}€</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {qty > 0 && (
                          <>
                            <button onClick={() => removeFromCart(item.id)} style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#2a2a2a', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                            <span style={{ color: '#fff', fontWeight: 700, minWidth: '16px', textAlign: 'center' }}>{qty}</span>
                          </>
                        )}
                        <button onClick={() => addToCart(item)} style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#ff6b35', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🍽️</div>
            <p style={{ color: '#aaa' }}>Noch keine Menüpunkte vorhanden.</p>
          </div>
        )}
      </div>

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
          <button
            onClick={() => setView('cart')}
            style={{
              background: '#ff6b35', border: 'none', borderRadius: '50px',
              padding: '16px 28px', color: '#fff', fontWeight: 700,
              cursor: 'pointer', fontSize: '1rem', boxShadow: '0 4px 20px rgba(255,107,53,0.4)',
              display: 'flex', alignItems: 'center', gap: '12px', whiteSpace: 'nowrap',
            }}
          >
            <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '20px', padding: '2px 8px', fontSize: '0.875rem' }}>{cartCount}</span>
            Warenkorb · {total.toFixed(2)}€
          </button>
        </div>
      )}
    </div>
  )
}
