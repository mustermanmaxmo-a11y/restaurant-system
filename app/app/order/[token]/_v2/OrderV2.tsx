'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { buildColorsFromRestaurant, readCfgString } from '@/lib/color-utils'
import { getDesignPackage } from '@/lib/design-packages'
import { FONT_PAIRS } from '@/lib/font-pairs'
import type { MenuItem, MenuCategory, Order, Restaurant } from '@/types/database'
import {
  ShoppingCart, Plus, Minus, X, ArrowLeft,
  ChefHat, CheckCircle2, Clock, Bell, Receipt, Sparkles,
} from 'lucide-react'
import { OrderRating } from '@/components/order/OrderRating'
import { ReferralShare } from '@/components/order/ReferralShare'
import ChatWidget from '@/components/ChatWidget'
import { LoyaltyButton, useLoyalty } from '@/components/bestellen/LoyaltyWidget'
import { LoyaltyRedeemBlock } from '@/components/bestellen/LoyaltyRedeemBlock'
import { redeemLoyaltyReward } from '@/lib/loyalty/api'

type CartItem = { item: MenuItem; qty: number }
type View = 'menu' | 'cart' | 'status'

async function calculateAndStoreEta(
  orderId: string,
  restaurantId: string,
  items: { item_id: string; qty: number }[],
  orderType: string
) {
  try {
    const res = await fetch('/api/orders/calculate-eta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, orderItems: items, orderType }),
    })
    if (!res.ok) return
    const { etaMinutes } = await res.json()
    if (typeof etaMinutes === 'number') {
      const { supabase } = await import('@/lib/supabase')
      await supabase.from('orders').update({ estimated_time: etaMinutes }).eq('id', orderId)
    }
  } catch { /* non-critical */ }
}

export default function OrderV2() {
  const params = useParams()
  const token = params.token as string

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [tableId, setTableId] = useState<string | null>(null)
  const [tableName, setTableName] = useState<string>('')
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [view, setView] = useState<View>('menu')
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [note, setNote] = useState('')
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [marketingEmail, setMarketingEmail] = useState('')
  const [myReferralCode, setMyReferralCode] = useState<string | null>(null)
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const loyaltyRestaurantId = restaurant?.id ?? ''
  const {
    program: loyaltyProgram,
    member: loyaltyMember,
    subscriberId: loyaltySubscriberId,
    refreshFromEmail,
    showToast,
  } = useLoyalty(loyaltyRestaurantId)
  const [applyReward, setApplyReward] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: tableData } = await supabase
        .from('tables')
        .select(`*, restaurants(
          id, name, slug, logo_url, description,
          contact_email, contact_phone, contact_address,
          primary_color, surface_color, bg_color, header_color, button_color, card_color, text_color,
          font_pair, design_package, layout_variant, design_config,
          guest_design_version, online_payments_enabled,
          opening_hours, google_review_url, brand_preset
        )`)
        .eq('qr_token', token)
        .eq('active', true)
        .single()

      if (!tableData) {
        setError('Ungültiger QR-Code. Bitte scanne den QR-Code erneut.')
        setLoading(false)
        return
      }

      setTableId(tableData.id)
      setTableName(tableData.label ?? String(tableData.table_num ?? ''))
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

  // Live menu updates
  const restaurantId = restaurant?.id ?? null
  useEffect(() => {
    if (!restaurantId) return
    async function reloadMenu() {
      const [{ data: cats }, { data: menuItems }] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).eq('active', true).order('sort_order'),
        supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).eq('available', true).order('sort_order'),
      ])
      if (cats) setCategories(cats)
      if (menuItems) setItems(menuItems)
    }
    const ch = supabase.channel(`menu-v2-order-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items', filter: `restaurant_id=eq.${restaurantId}` }, reloadMenu)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_categories', filter: `restaurant_id=eq.${restaurantId}` }, reloadMenu)
      .subscribe()

    // Live branding updates
    const brandCh = supabase.channel(`brand-v2-order-${restaurantId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restaurants', filter: `id=eq.${restaurantId}` },
        (payload) => { setRestaurant(prev => prev ? { ...prev, ...(payload.new as Partial<Restaurant>) } : null) })
      .subscribe()

    return () => { supabase.removeChannel(ch); supabase.removeChannel(brandCh) }
  }, [restaurantId])

  // Live order status
  useEffect(() => {
    if (!order) return
    const channel = supabase
      .channel(`order-v2-dine-${order.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` },
        (payload) => { setOrder(prev => prev ? { ...prev, ...(payload.new as Partial<Order>) } : null) })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [order])

  // Lock scroll when item detail open
  useEffect(() => {
    document.body.style.overflow = selectedItem ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selectedItem])

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

  function scrollToCategory(id: string) {
    setActiveCategory(id)
    categoryRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function callWaiter(type: 'waiter' | 'bill') {
    if (!tableId || !restaurant) return
    await supabase.from('service_calls').insert({ restaurant_id: restaurant.id, table_id: tableId, type })
  }

  const total = cart.reduce((s, c) => s + c.item.price * c.qty, 0)
  const cartCount = cart.reduce((s, c) => s + c.qty, 0)

  async function submitOrder() {
    if (!restaurant || !tableId || cart.length === 0) return
    setSubmitting(true)
    setError('')
    const trimmedEmail = marketingEmail.trim()
    // Trigger needs a non-empty email when opt-in is true, otherwise it would create an invalid subscriber.
    if (marketingOptIn && !trimmedEmail) {
      setError('Bitte E-Mail eingeben, um Angebote zu erhalten.')
      setSubmitting(false)
      return
    }
    const { data, error: err } = await supabase.from('orders').insert({
      restaurant_id: restaurant.id,
      order_type: 'dine_in',
      table_id: tableId,
      status: 'new',
      items: cart.map(c => ({ item_id: c.item.id, name: c.item.name, price: c.item.price, qty: c.qty })),
      note: note || null,
      total: parseFloat(total.toFixed(2)),
      customer_email: trimmedEmail || null,
      marketing_opt_in: marketingOptIn,
    }).select().single()
    if (err || !data) { setError('Fehler beim Bestellen.'); setSubmitting(false); return }
    setOrder(data as Order)
    setView('status')
    setCart([])
    setNote('')
    setSubmitting(false)
    if (data?.id) {
      const cartItems = cart.map(c => ({ item_id: c.item.id, qty: c.qty }))
      calculateAndStoreEta(data.id, restaurant.id, cartItems, 'dine_in')
    }
    // Punkte werden jetzt server-seitig bei status=served gutgeschrieben (Trigger).
    // Hier nur noch: Email-Persistenz + Reward-Einlösung (falls aktiviert).
    if (trimmedEmail && loyaltyProgram?.enabled) {
      await refreshFromEmail(trimmedEmail)
    }

    if (applyReward && loyaltySubscriberId && data?.id) {
      const result = await redeemLoyaltyReward({
        subscriberId: loyaltySubscriberId,
        restaurantId: loyaltyRestaurantId,
        orderId: data.id,
      })
      if (result.success) {
        showToast(`✓ Belohnung „${result.reward_text}" eingelöst`)
      } else if (result.reason === 'insufficient_balance') {
        showToast('Belohnung nicht mehr verfügbar — Bestellung wird normal verarbeitet')
      } else {
        showToast('Belohnung konnte nicht eingelöst werden')
      }
      setApplyReward(false)
    }
    // Marketing subscriber capture
    if (restaurant.email_marketing_enabled) {
      const { data: { user: guestUser } } = await supabase.auth.getUser()
      const emailToSave = guestUser?.email || (marketingOptIn ? marketingEmail.trim() : null)
      if (emailToSave) {
        const upsertData: Record<string, unknown> = {
          restaurant_id: restaurant.id,
          email: emailToSave,
          name: null,
          source: 'order_table',
          last_order_at: new Date().toISOString(),
        }
        if (marketingOptIn) upsertData.subscribed = true
        await supabase.from('marketing_subscribers').upsert(upsertData, { onConflict: 'restaurant_id,email' })
        await supabase.rpc('bump_subscriber_stats', { p_restaurant_id: restaurant.id, p_email: emailToSave, p_spent: total })
      }
    }

    // Referral: load own share code for table guests who opted in
    if (restaurant.referral_enabled) {
      const guestEmail = trimmedEmail || null
      if (guestEmail) {
        const { data: sub } = await supabase
          .from('marketing_subscribers')
          .select('referral_code')
          .eq('restaurant_id', restaurant.id)
          .eq('email', guestEmail.toLowerCase())
          .maybeSingle()
        if (sub?.referral_code) setMyReferralCode(sub.referral_code)
      }
    }
  }

  // Resolve colors from restaurant branding
  const C = restaurant ? buildColorsFromRestaurant(restaurant) : buildColorsFromRestaurant({})
  const accentGradient = `linear-gradient(135deg, ${C.accent} 0%, ${C.buttonBg !== C.accent ? C.buttonBg : C.accent}ee 100%)`

  // Font pair
  const cfg = restaurant?.design_config ?? {}
  const fontPairKey = readCfgString(cfg, 'font_pair') ?? restaurant?.font_pair ?? getDesignPackage(restaurant?.design_package).fontPair
  const fontPair = (FONT_PAIRS[fontPairKey ?? ''] ?? FONT_PAIRS['syne-dmsans'])

  const iconBtnStyle: React.CSSProperties = {
    width: '32px', height: '32px', borderRadius: '10px',
    background: C.surface, border: `1px solid ${C.border}`,
    color: C.text, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: `${fontPair.body}, system-ui, sans-serif` }}>
        <div style={{ color: C.muted, fontSize: '14px' }}>Lade Menü…</div>
      </div>
    )
  }

  if (error && !restaurant) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: `${fontPair.body}, system-ui, sans-serif` }}>
        <div style={{ color: C.muted }}>{error}</div>
      </div>
    )
  }

  const closedInfo = restaurant ? getClosedInfo(restaurant.opening_hours) : null
  if (closedInfo && view !== 'status') {
    const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
    return (
      <div style={{ minHeight: '100vh', background: accentGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: `${fontPair.body}, system-ui, sans-serif` }}>
        <div style={{ textAlign: 'center', maxWidth: '360px', width: '100%' }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
            <Clock size={48} color="rgba(255,255,255,0.6)" />
          </div>
          <h2 style={{ color: '#fff', fontWeight: 800, fontSize: '1.4rem', marginBottom: '8px', letterSpacing: '-0.02em' }}>
            {restaurant?.name}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '28px' }}>{closedInfo}</p>
          {restaurant?.opening_hours && (
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px', textAlign: 'left', border: '1px solid rgba(255,255,255,0.12)' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                Öffnungszeiten
              </p>
              {Object.entries(restaurant.opening_hours).map(([key, dh]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>{dayNames[parseInt(key)]}</span>
                  <span style={{ color: dh.closed ? 'rgba(255,255,255,0.3)' : '#fff', fontSize: '0.85rem', fontWeight: 700 }}>
                    {dh.closed ? 'Geschlossen' : `${dh.open} – ${dh.close}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.bg,
        color: C.text,
        fontFamily: `${fontPair.body}, system-ui, sans-serif`,
        paddingBottom: cartCount > 0 && view === 'menu' ? '100px' : '0',
      }}
    >
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
        * { box-sizing: border-box; }
        html, body { overflow-x: hidden; max-width: 100vw; }
      `}</style>

      {/* ── STATUS VIEW ── */}
      {view === 'status' && order && (
        <div style={{ padding: '20px', maxWidth: '560px', margin: '0 auto' }}>
          {/* Status hero */}
          <div style={{
            background: accentGradient,
            borderRadius: '20px',
            padding: '32px 24px',
            marginTop: '20px',
            marginBottom: '24px',
            textAlign: 'center',
            boxShadow: `0 20px 60px ${C.accentGlow}`,
          }}>
            <div style={{ display: 'inline-flex', padding: '10px', background: 'rgba(255,255,255,0.15)', borderRadius: '14px', marginBottom: '12px' }}>
              <Sparkles size={22} />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', fontFamily: `${fontPair.heading}, system-ui, sans-serif` }}>
              Bestellung eingegangen!
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', marginTop: '6px', marginBottom: 0 }}>
              Tisch {tableName} · #{order.id.slice(0, 8).toUpperCase()}
            </p>
            {order.estimated_time != null && order.status !== 'served' && order.status !== 'cancelled' && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: 'rgba(245,158,11,0.2)', color: '#fbbf24',
                borderRadius: '10px', padding: '6px 14px',
                fontSize: '0.85rem', fontWeight: 600, marginTop: '10px',
              }}>
                ⏱ Geschätzte Wartezeit: ~{order.estimated_time} Minuten
              </div>
            )}
          </div>

          {/* Status steps */}
          {(() => {
            const steps: { key: Order['status']; label: string; icon: typeof ChefHat }[] = [
              { key: 'new', label: 'Empfangen', icon: Clock },
              { key: 'cooking', label: 'In Zubereitung', icon: ChefHat },
              { key: 'served', label: 'Fertig', icon: CheckCircle2 },
            ]
            const activeIdx = steps.findIndex(s => s.key === order.status)
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {steps.map((s, idx) => {
                  const done = idx <= activeIdx
                  const current = idx === activeIdx
                  const Icon = s.icon
                  return (
                    <div
                      key={s.key}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '14px',
                        padding: '16px',
                        background: current ? C.surface : C.surface,
                        border: `1px solid ${current ? C.accent : C.border}`,
                        borderRadius: '14px',
                        opacity: done ? 1 : 0.45,
                        transition: 'all 200ms',
                      }}
                    >
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '12px',
                        background: done ? accentGradient : C.surface,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: done ? '#fff' : C.muted,
                        flexShrink: 0,
                      }}>
                        <Icon size={18} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 700 }}>{s.label}</div>
                        {current && <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>Live-Update</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* Order summary */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
              Bestellte Artikel
            </div>
            {order.items.map((it) => (
              <div key={it.item_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
                <span>{it.qty}× {it.name}</span>
                <span style={{ color: C.muted }}>{(it.price * it.qty).toFixed(2)} €</span>
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '16px' }}>
              <span>Gesamt</span>
              <span style={{ color: C.accent }}>{order.total.toFixed(2)} €</span>
            </div>
          </div>

          {/* Service buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            {([
              { icon: Bell, label: 'Kellner rufen', type: 'waiter' as const },
              { icon: Receipt, label: 'Rechnung', type: 'bill' as const },
            ] as { icon: typeof Bell; label: string; type: 'waiter' | 'bill' }[]).map(s => (
              <button
                key={s.type}
                onClick={() => callWaiter(s.type)}
                style={{
                  background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px',
                  padding: '18px 12px', color: C.text, cursor: 'pointer', textAlign: 'center',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ marginBottom: '5px', display: 'flex', justifyContent: 'center' }}>
                  <s.icon size={26} color={C.accent} />
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: C.muted }}>{s.label}</div>
              </button>
            ))}
          </div>

          {/* Rating when served */}
          {order.status === 'served' && (
            <OrderRating
              orderId={order.id}
              restaurantId={order.restaurant_id}
              googleReviewUrl={restaurant?.google_review_url ?? null}
              C={C}
            />
          )}

          {restaurant?.referral_enabled && myReferralCode && restaurant.slug && (
            <ReferralShare
              restaurantSlug={restaurant.slug}
              referralCode={myReferralCode}
              rewardLabel={
                restaurant.referral_reward_type === 'points'
                  ? `${restaurant.referral_reward_points} Punkte`
                  : restaurant.referral_reward_type === 'discount'
                  ? `${restaurant.referral_reward_discount_percent}% Rabatt`
                  : `${restaurant.referral_reward_points} Punkte + ${restaurant.referral_reward_discount_percent}% Rabatt`
              }
              C={C}
            />
          )}

          <button
            onClick={() => { setView('menu'); setOrder(null) }}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.muted, fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Neue Bestellung
          </button>
        </div>
      )}

      {/* ── CART VIEW ── */}
      {view === 'cart' && (
        <div style={{ minHeight: '100vh', background: C.bg }}>
          {/* Header */}
          <div style={{ background: C.surface, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: `1px solid ${C.border}` }}>
            <button
              onClick={() => setView('menu')}
              style={{ width: '38px', height: '38px', borderRadius: '50%', background: C.surface, border: `1px solid ${C.border}`, color: C.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' }}
            >
              <ArrowLeft size={16} />
            </button>
            <h2 style={{ color: C.text, fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.01em', fontFamily: `${fontPair.heading}, system-ui, sans-serif` }}>
              Warenkorb
            </h2>
          </div>

          <div style={{ padding: '20px', maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <div style={{ marginBottom: '14px', opacity: 0.4, display: 'flex', justifyContent: 'center' }}>
                  <ShoppingCart size={56} color={C.muted} />
                </div>
                <p style={{ color: C.muted, fontWeight: 600 }}>Dein Warenkorb ist leer.</p>
              </div>
            ) : (
              <>
                {/* Cart items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                  {cart.map(c => (
                    <div
                      key={c.item.id}
                      style={{ background: C.surface, borderRadius: '14px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${C.border}` }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: C.text, fontWeight: 600, marginBottom: '2px', fontSize: '0.9rem' }}>{c.item.name}</p>
                        <p style={{ color: C.muted, fontSize: '0.82rem' }}>{c.item.price.toFixed(2)} €</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        <button onClick={() => removeFromCart(c.item.id)} style={iconBtnStyle}><Minus size={14} /></button>
                        <span style={{ color: C.text, fontWeight: 800, minWidth: '20px', textAlign: 'center' }}>{c.qty}</span>
                        <button onClick={() => addToCart(c.item)} style={{ ...iconBtnStyle, background: C.accent, border: 'none', color: '#fff' }}><Plus size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Note */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ color: C.muted, fontSize: '0.7rem', fontWeight: 700, display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Anmerkung (optional)
                  </label>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="z.B. Kein Zwiebeln, extra scharf..."
                    rows={3}
                    style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '12px', color: C.text, fontSize: '0.875rem', resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                </div>

                {/* Total */}
                <div style={{ background: C.surface, borderRadius: '16px', padding: '16px 18px', marginBottom: '20px', border: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.1rem' }}>
                    <span style={{ color: C.text }}>Gesamt</span>
                    <span style={{ color: C.accent }}>{total.toFixed(2)} €</span>
                  </div>
                </div>

                {/* Email Marketing Opt-in */}
                {restaurant?.email_marketing_enabled && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={marketingOptIn} onChange={e => setMarketingOptIn(e.target.checked)} style={{ marginTop: '2px', flexShrink: 0 }} />
                      <span style={{ color: C.muted, fontSize: '0.8rem', lineHeight: 1.5 }}>
                        Angebote &amp; News von {restaurant.name} per Email erhalten (jederzeit abbestellbar).
                      </span>
                    </label>
                    {marketingOptIn && (
                      <input
                        type="email"
                        value={marketingEmail}
                        onChange={e => setMarketingEmail(e.target.value)}
                        placeholder="Ihre Email-Adresse"
                        style={{ marginTop: '8px', width: '100%', padding: '9px 12px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
                      />
                    )}
                  </div>
                )}

                {error && (
                  <p style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '12px', textAlign: 'center' }}>{error}</p>
                )}

                <LoyaltyRedeemBlock
                  program={loyaltyProgram}
                  member={loyaltyMember}
                  applyReward={applyReward}
                  onToggle={setApplyReward}
                  accentColor={C.accent}
                />

                <button
                  onClick={submitOrder}
                  disabled={submitting}
                  style={{
                    width: '100%', padding: '17px', borderRadius: '14px', border: 'none',
                    background: submitting ? C.surface : accentGradient,
                    color: submitting ? C.muted : '#fff',
                    fontSize: '1rem', fontWeight: 800,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: submitting ? 'none' : `0 6px 28px ${C.accentGlow}`,
                    letterSpacing: '-0.01em', fontFamily: 'inherit',
                  }}
                >
                  {submitting ? 'Sende…' : `Bestellen · ${total.toFixed(2)} €`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MENU VIEW ── */}
      {view === 'menu' && (
        <div>
          {/* Hero header */}
          <div style={{ padding: '20px 20px 0' }}>
            <div style={{
              background: accentGradient,
              borderRadius: '20px',
              padding: '28px 24px',
              marginTop: '8px',
              boxShadow: `0 20px 60px ${C.accentGlow}`,
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                {/* Table badge */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(255,255,255,0.15)', borderRadius: '999px', fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#fff' }}>
                  Tisch {tableName}
                </div>
                {restaurant && <LoyaltyButton restaurantId={restaurant.id} accentColor="#fff" />}
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#fff', fontFamily: `${fontPair.heading}, system-ui, sans-serif` }}>
                {restaurant?.name}
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', marginTop: '6px', marginBottom: 0 }}>
                Dine-in · Live-Status
              </p>
            </div>
          </div>

          {/* Sticky category tabs */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 20,
            background: C.bg + 'F0',
            backdropFilter: 'blur(10px)',
            borderBottom: `1px solid ${C.border}`,
            marginTop: '16px',
            padding: '12px 20px',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
          }}>
            {categories.map(cat => {
              const active = activeCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  style={{
                    display: 'inline-block',
                    padding: '8px 14px',
                    marginRight: '8px',
                    borderRadius: '999px',
                    background: active ? C.accent : C.surface,
                    border: `1px solid ${active ? C.accent : C.border}`,
                    color: active ? '#fff' : C.text,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 150ms',
                    flexShrink: 0,
                  }}
                >
                  {cat.name}
                </button>
              )
            })}
          </div>

          {/* Menu grid by category */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {categories.map(cat => {
              const catItems = items.filter(i => i.category_id === cat.id)
              if (catItems.length === 0) return null
              return (
                <div key={cat.id} ref={el => { categoryRefs.current[cat.id] = el }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', letterSpacing: '-0.01em', fontFamily: `${fontPair.heading}, system-ui, sans-serif`, color: C.text }}>
                    {cat.name}
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                    {catItems.map(item => {
                      const qty = getQty(item.id)
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          style={{
                            background: C.surface,
                            border: `1px solid ${qty > 0 ? C.accent : C.border}`,
                            borderRadius: '16px',
                            padding: '14px',
                            cursor: 'pointer',
                            transition: 'all 150ms',
                            display: 'flex',
                            gap: '12px',
                          }}
                        >
                          {item.image_url && (
                            <div style={{ width: '80px', height: '80px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, background: C.surface }}>
                              <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px', color: C.text }}>{item.name}</div>
                            {item.description && (
                              <div style={{ color: C.muted, fontSize: '12px', lineHeight: 1.4, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {item.description}
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: C.accent }}>{item.price.toFixed(2)} €</div>
                              {qty > 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                                  <button onClick={() => removeFromCart(item.id)} style={iconBtnStyle}><Minus size={14} /></button>
                                  <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '16px', textAlign: 'center', color: C.text }}>{qty}</span>
                                  <button onClick={() => addToCart(item)} style={iconBtnStyle}><Plus size={14} /></button>
                                </div>
                              ) : (
                                <button
                                  onClick={e => { e.stopPropagation(); addToCart(item) }}
                                  style={{ width: '32px', height: '32px', borderRadius: '10px', background: C.accent, border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Plus size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {items.length === 0 && (
              <div style={{ textAlign: 'center', padding: '64px 0' }}>
                <p style={{ color: C.muted }}>Noch keine Menüpunkte vorhanden.</p>
              </div>
            )}
          </div>

          {/* Floating cart button */}
          {cartCount > 0 && (
            <button
              onClick={() => setView('cart')}
              style={{
                position: 'fixed',
                bottom: '20px',
                left: '20px',
                right: '20px',
                maxWidth: '500px',
                margin: '0 auto',
                padding: '16px 20px',
                borderRadius: '14px',
                background: accentGradient,
                border: 'none',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: `0 12px 40px ${C.accentGlow}`,
                zIndex: 50,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShoppingCart size={18} />
                <span>{cartCount} {cartCount === 1 ? 'Artikel' : 'Artikel'}</span>
              </div>
              <span>{total.toFixed(2)} €</span>
            </button>
          )}

          {/* Item Detail Modal */}
          {selectedItem && (
            <div
              onClick={() => setSelectedItem(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '20px' }}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '20px', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto' }}
              >
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                  <button onClick={() => setSelectedItem(null)} style={iconBtnStyle}><X size={16} /></button>
                </div>
                {selectedItem.image_url && (
                  <div style={{ width: '100%', height: '200px', borderRadius: '14px', overflow: 'hidden', marginBottom: '16px', background: C.bg }}>
                    <img src={selectedItem.image_url} alt={selectedItem.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.01em', color: C.text, fontFamily: `${fontPair.heading}, system-ui, sans-serif` }}>
                  {selectedItem.name}
                </h2>
                {selectedItem.description && (
                  <p style={{ color: C.muted, fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>{selectedItem.description}</p>
                )}
                {selectedItem.allergens && selectedItem.allergens.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                    {selectedItem.allergens.map(a => (
                      <span key={a} style={{ padding: '3px 8px', borderRadius: '999px', background: C.bg, border: `1px solid ${C.border}`, fontSize: '11px', color: C.muted }}>{a}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: C.accent }}>{selectedItem.price.toFixed(2)} €</div>
                  {getQty(selectedItem.id) > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button onClick={() => removeFromCart(selectedItem.id)} style={iconBtnStyle}><Minus size={14} /></button>
                      <span style={{ fontSize: '16px', fontWeight: 700, minWidth: '20px', textAlign: 'center', color: C.text }}>{getQty(selectedItem.id)}</span>
                      <button onClick={() => addToCart(selectedItem)} style={iconBtnStyle}><Plus size={14} /></button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { addToCart(selectedItem); setSelectedItem(null) }}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', background: accentGradient, border: 'none', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Hinzufügen
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KI Menu-Assistant */}
      {view === 'menu' && restaurant && (
        <ChatWidget
          restaurantSlug={restaurant.slug}
          restaurantName={restaurant.name}
          items={items}
          cart={cart.map(c => ({ name: c.item.name, qty: c.qty }))}
          accentColor={restaurant.primary_color ?? undefined}
          tableId={tableId ?? undefined}
          restaurantId={restaurant.id}
          onAddToCart={(itemId, _name, qty) => {
            const found = items.find(i => i.id === itemId)
            if (!found) return
            setCart(prev => {
              const existing = prev.find(c => c.item.id === itemId)
              if (existing) return prev.map(c => c.item.id === itemId ? { ...c, qty: c.qty + qty } : c)
              return [...prev, { item: found, qty }]
            })
          }}
          onSuggestionClick={(itemId) => {
            const found = items.find(i => i.id === itemId)
            if (found) setSelectedItem(found)
          }}
        />
      )}
    </div>
  )
}

function getClosedInfo(
  opening_hours: Record<string, { open: string; close: string; closed: boolean }> | null
): string | null {
  if (!opening_hours) return null
  const now = new Date()
  const jsDay = now.getDay()
  const key = String(jsDay === 0 ? 6 : jsDay - 1)
  const dh = opening_hours[key]
  if (!dh) return null
  if (dh.closed) {
    for (let i = 1; i <= 7; i++) {
      const nextKey = String((parseInt(key) + i) % 7)
      const next = opening_hours[nextKey]
      if (next && !next.closed) {
        const dayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
        return `Heute geschlossen. Nächste Öffnung: ${dayNames[parseInt(nextKey)]} ab ${next.open} Uhr`
      }
    }
    return 'Heute geschlossen.'
  }
  const [oh, om] = dh.open.split(':').map(Number)
  const [ch, cm] = dh.close.split(':').map(Number)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const openMin = oh * 60 + om
  const closeMin = ch * 60 + cm
  if (nowMin < openMin) return `Öffnet heute um ${dh.open} Uhr`
  if (nowMin >= closeMin) return `Heute geschlossen. Öffnungszeit war bis ${dh.close} Uhr`
  return null
}
