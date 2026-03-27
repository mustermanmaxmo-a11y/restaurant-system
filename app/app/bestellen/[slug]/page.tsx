'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { MenuItem, MenuCategory, Order, Restaurant } from '@/types/database'

type CartItem = { item: MenuItem; qty: number }
type OrderType = 'delivery' | 'pickup'
type View = 'menu' | 'checkout' | 'status'

const STATUS_LABELS: Record<string, { label: string; icon: string }> = {
  new: { label: 'Bestellung eingegangen', icon: '📋' },
  cooking: { label: 'Wird zubereitet', icon: '👨‍🍳' },
  served: { label: 'Unterwegs zu dir!', icon: '🛵' },
  cancelled: { label: 'Storniert', icon: '❌' },
}

export default function HomeOrderPage() {
  const params = useParams()
  const slug = params.slug as string

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderType, setOrderType] = useState<OrderType>('pickup')
  const [view, setView] = useState<View>('menu')
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Checkout form
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [zip, setZip] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    async function load() {
      const { data: resto } = await supabase
        .from('restaurants')
        .select('*')
        .eq('slug', slug)
        .eq('active', true)
        .single()

      if (!resto) {
        setError('Restaurant nicht gefunden.')
        setLoading(false)
        return
      }

      setRestaurant(resto)

      const [{ data: cats }, { data: menuItems }] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('restaurant_id', resto.id).eq('active', true).order('sort_order'),
        supabase.from('menu_items').select('*').eq('restaurant_id', resto.id).eq('available', true).order('sort_order'),
      ])

      setCategories(cats || [])
      setItems(menuItems || [])
      if (cats && cats.length > 0) setActiveCategory(cats[0].id)
      setLoading(false)
    }
    load()
  }, [slug])

  useEffect(() => {
    if (!order) return
    const channel = supabase
      .channel(`order-home-${order.id}`)
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

  function scrollToCategory(catId: string) {
    setActiveCategory(catId)
    categoryRefs.current[catId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function submitOrder() {
    if (!restaurant) return
    setSubmitting(true)
    setError('')

    const { data, error: err } = await supabase
      .from('orders')
      .insert({
        restaurant_id: restaurant.id,
        order_type: orderType,
        table_id: null,
        status: 'new',
        items: cart.map(c => ({ item_id: c.item.id, name: c.item.name, price: c.item.price, qty: c.qty })),
        note: note || null,
        total,
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_address: orderType === 'delivery' ? { street, city, zip } : null,
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

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🍽️</div>
          <p style={{ color: '#888' }}>Menü wird geladen...</p>
        </div>
      </div>
    )
  }

  if (error && !restaurant) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa', padding: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>❌</div>
          <p style={{ color: '#1a1a2e', fontWeight: 700 }}>Restaurant nicht gefunden</p>
          <p style={{ color: '#888', fontSize: '0.875rem', marginTop: '8px' }}>{error}</p>
        </div>
      </div>
    )
  }

  // Order status view
  if (view === 'status' && order) {
    const status = STATUS_LABELS[order.status] ?? STATUS_LABELS.new
    const isPickup = order.order_type === 'pickup'
    return (
      <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: '32px 20px' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>{status.icon}</div>
            <h1 style={{ color: '#1a1a2e', fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
              {status.label}
            </h1>
            <p style={{ color: '#888', fontSize: '0.875rem' }}>
              {restaurant?.name} · {isPickup ? 'Abholung' : 'Lieferung'}
            </p>
          </div>

          {/* Progress */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
            {['new', 'cooking', 'served'].map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: ['new', 'cooking', 'served'].indexOf(order.status) >= i ? '#6c63ff' : '#e0e0e0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '0.75rem', fontWeight: 700,
                  transition: 'background 0.5s',
                }}>
                  {i + 1}
                </div>
                {i < 2 && (
                  <div style={{
                    width: '40px', height: '2px',
                    background: ['new', 'cooking', 'served'].indexOf(order.status) > i ? '#6c63ff' : '#e0e0e0',
                    transition: 'background 0.5s',
                  }} />
                )}
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div style={{ background: '#fff', borderRadius: '14px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <h3 style={{ color: '#1a1a2e', fontWeight: 700, marginBottom: '12px', fontSize: '0.9rem' }}>Deine Bestellung</h3>
            {order.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#888', fontSize: '0.875rem' }}>{item.qty}× {item.name}</span>
                <span style={{ color: '#888', fontSize: '0.875rem' }}>{(item.price * item.qty).toFixed(2)}€</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #e0e0e0', marginTop: '12px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#1a1a2e', fontWeight: 700 }}>Gesamt</span>
              <span style={{ color: '#6c63ff', fontWeight: 700 }}>{order.total.toFixed(2)}€</span>
            </div>
          </div>

          {order.delivery_address && (
            <div style={{ background: '#fff', borderRadius: '14px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <p style={{ color: '#888', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Lieferadresse</p>
              <p style={{ color: '#1a1a2e', fontSize: '0.875rem' }}>
                {order.delivery_address.street}, {order.delivery_address.zip} {order.delivery_address.city}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Checkout view
  if (view === 'checkout') {
    const isDelivery = orderType === 'delivery'
    return (
      <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>
        <div style={{ background: '#fff', padding: '20px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setView('menu')} style={{ background: 'none', border: 'none', color: '#6c63ff', cursor: 'pointer', fontSize: '1.2rem' }}>←</button>
          <h2 style={{ color: '#1a1a2e', fontWeight: 700 }}>Bestellung abschließen</h2>
        </div>

        <div style={{ padding: '20px', maxWidth: '480px', margin: '0 auto' }}>
          {/* Order type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
            {(['pickup', 'delivery'] as OrderType[]).map(type => (
              <button
                key={type}
                onClick={() => setOrderType(type)}
                style={{
                  padding: '14px', borderRadius: '12px', border: '2px solid',
                  borderColor: orderType === type ? '#6c63ff' : '#e0e0e0',
                  background: orderType === type ? '#f0eeff' : '#fff',
                  color: orderType === type ? '#6c63ff' : '#888',
                  fontWeight: 700, cursor: 'pointer', textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{type === 'pickup' ? '🏃' : '🛵'}</div>
                {type === 'pickup' ? 'Abholung' : 'Lieferung'}
              </button>
            ))}
          </div>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
            <div>
              <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name *</label>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Dein Name" style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e0e0e0', background: '#fff', color: '#1a1a2e', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Telefon *</label>
              <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+49 123 456789" type="tel" style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e0e0e0', background: '#fff', color: '#1a1a2e', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {isDelivery && (
              <>
                <div>
                  <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Straße & Hausnummer *</label>
                  <input value={street} onChange={e => setStreet(e.target.value)} placeholder="Musterstraße 1" style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e0e0e0', background: '#fff', color: '#1a1a2e', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PLZ *</label>
                    <input value={zip} onChange={e => setZip(e.target.value)} placeholder="12345" style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e0e0e0', background: '#fff', color: '#1a1a2e', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stadt *</label>
                    <input value={city} onChange={e => setCity(e.target.value)} placeholder="Berlin" style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e0e0e0', background: '#fff', color: '#1a1a2e', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </>
            )}

            <div>
              <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Anmerkung</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="z.B. Kein Zwiebeln..." rows={2} style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e0e0e0', background: '#fff', color: '#1a1a2e', fontSize: '0.875rem', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Cart summary */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            {cart.map(c => (
              <div key={c.item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#888', fontSize: '0.875rem' }}>{c.qty}× {c.item.name}</span>
                <span style={{ color: '#888', fontSize: '0.875rem' }}>{(c.item.price * c.qty).toFixed(2)}€</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #e0e0e0', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#1a1a2e', fontWeight: 700 }}>Gesamt</span>
              <span style={{ color: '#6c63ff', fontWeight: 700 }}>{total.toFixed(2)}€</span>
            </div>
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}

          <button
            onClick={submitOrder}
            disabled={submitting || !customerName || !customerPhone || (isDelivery && (!street || !city || !zip))}
            style={{
              width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
              background: submitting || !customerName || !customerPhone ? '#e0e0e0' : '#6c63ff',
              color: submitting || !customerName || !customerPhone ? '#888' : '#fff',
              fontSize: '1rem', fontWeight: 700,
              cursor: submitting || !customerName || !customerPhone ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Wird gesendet...' : `Jetzt bestellen · ${total.toFixed(2)}€`}
          </button>
        </div>
      </div>
    )
  }

  // Menu view (light mode for home ordering)
  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ background: '#fff', padding: '20px', borderBottom: '1px solid #e0e0e0' }}>
        <h1 style={{ color: '#1a1a2e', fontWeight: 700, fontSize: '1.25rem' }}>{restaurant?.name}</h1>
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          {(['pickup', 'delivery'] as OrderType[]).map(type => (
            <button
              key={type}
              onClick={() => setOrderType(type)}
              style={{
                padding: '4px 12px', borderRadius: '20px', border: '1px solid',
                borderColor: orderType === type ? '#6c63ff' : '#e0e0e0',
                background: orderType === type ? '#6c63ff' : 'transparent',
                color: orderType === type ? '#fff' : '#888',
                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {type === 'pickup' ? '🏃 Abholung' : '🛵 Lieferung'}
            </button>
          ))}
        </div>
      </div>

      {/* Category tabs */}
      {categories.length > 0 && (
        <div style={{ overflowX: 'auto', background: '#fff', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ display: 'flex', padding: '0 16px', minWidth: 'max-content' }}>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                style={{
                  padding: '12px 16px', background: 'none', border: 'none',
                  color: activeCategory === cat.id ? '#6c63ff' : '#888',
                  fontWeight: activeCategory === cat.id ? 700 : 400,
                  cursor: 'pointer', fontSize: '0.875rem', whiteSpace: 'nowrap',
                  borderBottom: activeCategory === cat.id ? '2px solid #6c63ff' : '2px solid transparent',
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Items */}
      <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
        {categories.map(cat => {
          const catItems = items.filter(i => i.category_id === cat.id)
          if (catItems.length === 0) return null
          return (
            <div key={cat.id} ref={el => { categoryRefs.current[cat.id] = el }} style={{ marginBottom: '32px' }}>
              <h2 style={{ color: '#1a1a2e', fontWeight: 700, fontSize: '1.1rem', marginBottom: '12px', paddingTop: '8px' }}>
                {cat.name}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {catItems.map(item => {
                  const qty = getQty(item.id)
                  return (
                    <div
                      key={item.id}
                      style={{
                        background: '#fff', borderRadius: '12px', padding: '14px 16px',
                        display: 'flex', gap: '12px', alignItems: 'center',
                        border: qty > 0 ? '1px solid #6c63ff44' : '1px solid #e0e0e0',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      {item.image_url && (
                        <img src={item.image_url} alt={item.name} style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: '#1a1a2e', fontWeight: 600, marginBottom: '2px' }}>{item.name}</p>
                        {item.description && <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</p>}
                        {item.tags.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                            {item.tags.map(tag => (
                              <span key={tag} style={{ background: '#f0eeff', color: '#6c63ff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px' }}>{tag}</span>
                            ))}
                          </div>
                        )}
                        <p style={{ color: '#6c63ff', fontWeight: 700, fontSize: '0.95rem' }}>{item.price.toFixed(2)}€</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {qty > 0 && (
                          <>
                            <button onClick={() => removeFromCart(item.id)} style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#f0eeff', border: 'none', color: '#6c63ff', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>−</button>
                            <span style={{ color: '#1a1a2e', fontWeight: 700, minWidth: '16px', textAlign: 'center' }}>{qty}</span>
                          </>
                        )}
                        <button onClick={() => addToCart(item)} style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#6c63ff', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>+</button>
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
            <p style={{ color: '#888' }}>Noch keine Menüpunkte vorhanden.</p>
          </div>
        )}
      </div>

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
          <button
            onClick={() => setView('checkout')}
            style={{
              background: '#6c63ff', border: 'none', borderRadius: '50px',
              padding: '16px 28px', color: '#fff', fontWeight: 700,
              cursor: 'pointer', fontSize: '1rem', boxShadow: '0 4px 20px rgba(108,99,255,0.4)',
              display: 'flex', alignItems: 'center', gap: '12px', whiteSpace: 'nowrap',
            }}
          >
            <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '20px', padding: '2px 8px', fontSize: '0.875rem' }}>{cartCount}</span>
            Zur Bestellung · {total.toFixed(2)}€
          </button>
        </div>
      )}
    </div>
  )
}
