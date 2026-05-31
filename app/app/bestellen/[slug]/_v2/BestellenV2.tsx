'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { supabaseGuest as supabase } from '@/lib/supabase'
import type { MenuItem, MenuCategory, Order, Restaurant } from '@/types/database'
import {
  Sparkles, ShoppingCart, Plus, Minus, X, ArrowLeft, ArrowRight,
  ChefHat, CheckCircle2, Clock, Bike, PersonStanding, MapPin,
} from 'lucide-react'
import BestellenV1 from '../_v1/BestellenV1'
import SmartFilter from '../_components/SmartFilter'
import { LoyaltyButton, LoyaltyBanner, useLoyalty } from '@/components/bestellen/LoyaltyWidget'
import { LoyaltyRedeemBlock } from '@/components/bestellen/LoyaltyRedeemBlock'
import { redeemLoyaltyReward, type LoyaltyMember, type LoyaltyProgram } from '@/lib/loyalty/api'
import { OrderRating } from '@/components/order/OrderRating'
import { ReferralShare } from '@/components/order/ReferralShare'
import { saveReferralRef, getReferralRef, clearReferralRef } from '@/lib/marketing/referral'
import ChatWidget from '@/components/ChatWidget'
import { useLanguage } from '@/components/providers/language-provider'

type Translations = Record<string, { name: string; description: string }>
type CartItem = { item: MenuItem; qty: number }
type OrderType = 'pickup' | 'delivery'
type View = 'menu' | 'checkout' | 'status'

const V2 = {
  bg: '#0A0A0F',
  surface: '#111118',
  surfaceHi: '#16161F',
  border: '#1F1F28',
  accent: '#EA580C',
  accentHi: '#F97316',
  text: '#F5F5F7',
  textDim: '#8B8B93',
  gradient: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)',
  radius: 16,
}

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

export default function BestellenV2() {
  const params = useParams()
  const slug = params.slug as string
  const { lang } = useLanguage()

  function itemName(item: MenuItem) {
    return (item.translations as Translations | null)?.[lang]?.name ?? item.name
  }
  function itemDesc(item: MenuItem) {
    return (item.translations as Translations | null)?.[lang]?.description ?? item.description
  }

  const [showV1, setShowV1] = useState(false)
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
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [zip, setZip] = useState('')
  const [note, setNote] = useState('')
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [marketingEmail, setMarketingEmail] = useState('')

  const searchParams = useSearchParams()
  const [discountCode, setDiscountCode] = useState('')
  const [discountInfo, setDiscountInfo] = useState<{
    type: 'percent' | 'fixed'
    value: number
    expiresAt: string
  } | null>(null)
  const [discountError, setDiscountError] = useState('')
  const [discountLoading, setDiscountLoading] = useState(false)

  const [filterResult, setFilterResult] = useState<{
    suitable: string[]
    unsuitable: { id: string; reason: string }[]
  } | null>(null)

  const [myReferralCode, setMyReferralCode] = useState<string | null>(null)

  async function validateCode(code: string) {
    if (!restaurant || !code.trim()) return
    setDiscountLoading(true)
    setDiscountError('')
    try {
      const res = await fetch('/api/checkout/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.toUpperCase().trim(), restaurantId: restaurant.id }),
      })
      const data = await res.json()
      if (data.valid) {
        setDiscountInfo({ type: data.discountType, value: data.discountValue, expiresAt: data.expiresAt })
      } else {
        const msg: Record<string, string> = {
          not_found: 'Code nicht gefunden.',
          already_used: 'Code wurde bereits eingelöst.',
          expired: 'Code ist abgelaufen.',
          wrong_restaurant: 'Code gilt nicht für dieses Restaurant.',
        }
        setDiscountError(msg[data.error] ?? 'Ungültiger Code.')
        setDiscountInfo(null)
      }
    } catch {
      setDiscountError('Validierung fehlgeschlagen.')
    }
    setDiscountLoading(false)
  }

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/restaurant/${slug}`)
      const resto = res.ok ? await res.json() : null
      if (!resto) { setError('Restaurant nicht gefunden.'); setLoading(false); return }
      setRestaurant(resto)
      const [{ data: cats }, { data: menuItems }] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('restaurant_id', resto.id).eq('active', true).order('sort_order'),
        supabase.from('menu_items').select('*').eq('restaurant_id', resto.id).eq('available', true).order('sort_order'),
      ])
      setCategories(cats || [])
      setItems(menuItems || [])
      if (cats && cats.length > 0) setActiveCategory(cats[0].id)
      const { data: as_ } = await supabase.from('alert_settings').select('show_sold_out_label,auto_hide_item').eq('restaurant_id', resto.id).single()
      if (as_) setAlertSettings(as_)
      setLoading(false)
    }
    load()
  }, [slug])

  useEffect(() => {
    if (!order) return
    const channel = supabase
      .channel(`order-v2-${order.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` },
        (payload) => { setOrder(prev => prev ? { ...prev, ...(payload.new as Partial<Order>) } : null) })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [order])

  useEffect(() => {
    document.body.style.overflow = selectedItem ? 'hidden' : ''
  }, [selectedItem])

  useEffect(() => {
    const codeFromUrl = searchParams?.get('code')
    if (codeFromUrl) {
      const upper = codeFromUrl.toUpperCase()
      setDiscountCode(upper)
      validateCode(upper)
    }
    const refFromUrl = searchParams?.get('ref')
    if (refFromUrl && slug) {
      saveReferralRef(slug, refFromUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, restaurant])

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

  function getItemSuitability(itemId: string): 'suitable' | 'unsuitable' | 'neutral' {
    if (!filterResult) return 'neutral'
    if (filterResult.unsuitable.some(u => u.id === itemId)) return 'unsuitable'
    return 'suitable'
  }

  function getUnsuitableReason(itemId: string): string | undefined {
    return filterResult?.unsuitable.find(u => u.id === itemId)?.reason
  }

  const total = cart.reduce((s, c) => s + c.item.price * c.qty, 0)
  const cartCount = cart.reduce((s, c) => s + c.qty, 0)

  const loyaltyRestaurantId = restaurant?.id ?? ''
  const {
    program: loyaltyProgram,
    member: loyaltyMember,
    subscriberId: loyaltySubscriberId,
    refreshFromEmail,
    showToast,
  } = useLoyalty(loyaltyRestaurantId)
  const [applyReward, setApplyReward] = useState(false)

  const [alertSettings, setAlertSettings] = useState<{ show_sold_out_label: boolean; auto_hide_item: boolean } | null>(null)

  function scrollToCategory(id: string) {
    setActiveCategory(id)
    categoryRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function validatePhone(phone: string): string | null {
    const raw = phone.trim()
    if (!raw) return 'Telefonnummer ist erforderlich.'
    if (!/^[+\d\s\-().]+$/.test(raw)) return 'Ungültige Zeichen in der Telefonnummer.'
    const parsed = parsePhoneNumberFromString(raw, 'DE')
    if (!parsed || !parsed.isValid()) return 'Bitte eine gültige Telefonnummer eingeben (z.B. 0151 12345678).'
    return null
  }

  async function submitOrder() {
    if (!restaurant || cart.length === 0) return
    if (!customerName.trim()) { setError('Name ist erforderlich.'); return }
    const phoneErr = validatePhone(customerPhone)
    if (phoneErr) { setError(phoneErr); return }
    if (orderType === 'delivery' && (!street.trim() || !city.trim() || !zip.trim())) { setError('Lieferadresse vollständig angeben.'); return }
    const trimmedEmail = marketingEmail.trim()
    // Trigger needs a non-empty email when opt-in is true, otherwise it would create an invalid subscriber.
    if (marketingOptIn && !trimmedEmail) { setError('Bitte E-Mail eingeben, um Angebote zu erhalten.'); return }
    setSubmitting(true)
    setError('')

    function applyDiscount(subtotalCents: number): { finalCents: number; discountAmountCents: number } {
      if (!discountInfo) return { finalCents: subtotalCents, discountAmountCents: 0 }
      if (discountInfo.type === 'percent') {
        const amount = Math.round(subtotalCents * discountInfo.value / 100)
        return { finalCents: subtotalCents - amount, discountAmountCents: amount }
      }
      const amount = Math.round(discountInfo.value * 100)
      return { finalCents: Math.max(0, subtotalCents - amount), discountAmountCents: amount }
    }

    const subtotalCents = Math.round(total * 100)
    const { finalCents, discountAmountCents } = applyDiscount(subtotalCents)
    const { data, error: err } = await supabase.from('orders').insert({
      restaurant_id: restaurant.id,
      order_type: orderType,
      table_id: null,
      status: 'new',
      items: cart.map(c => ({ item_id: c.item.id, name: c.item.name, price: c.item.price, qty: c.qty })),
      note: note || null,
      total: finalCents / 100,
      customer_name: customerName,
      customer_phone: customerPhone,
      delivery_address: orderType === 'delivery' ? { street, city, zip } : null,
      customer_email: trimmedEmail || null,
      marketing_opt_in: marketingOptIn,
      discount_code: discountInfo && discountCode ? discountCode.toUpperCase().trim() : null,
      discount_amount_cents: discountAmountCents > 0 ? discountAmountCents : null,
    }).select().single()
    if (err || !data) { setError('Fehler beim Bestellen.'); setSubmitting(false); return }
    setOrder(data as Order)
    setView('status')
    setCart([])
    setSubmitting(false)
    const insertedOrderId = data.id as string

    if (discountCode && discountInfo && insertedOrderId) {
      await fetch('/api/checkout/use-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: discountCode.toUpperCase().trim(), orderId: insertedOrderId, restaurantId: restaurant.id }),
      })
    }

    // Stop any active drip enrollment when guest orders
    if (data.customer_id) {
      fetch('/api/drip/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriberId: data.customer_id, orderId: insertedOrderId, reason: 'ordered' }),
      }).catch(() => {})
    }

    // Punkte werden jetzt server-seitig bei status=served gutgeschrieben (Trigger).
    // Hier nur noch: Email-Persistenz + Reward-Einlösung (falls aktiviert).
    if (trimmedEmail && loyaltyProgram?.enabled) {
      await refreshFromEmail(trimmedEmail)
    }

    if (applyReward && loyaltySubscriberId && insertedOrderId) {
      const result = await redeemLoyaltyReward({
        subscriberId: loyaltySubscriberId,
        restaurantId: loyaltyRestaurantId,
        orderId: insertedOrderId,
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
    // After successful insert, calculate ETA (non-blocking)
    if (data?.id) {
      const cartItems = cart.map(c => ({ item_id: c.item.id, qty: c.qty }))
      calculateAndStoreEta(data.id, restaurant.id, cartItems, orderType)
    }
    // Marketing subscriber capture
    if (restaurant.email_marketing_enabled) {
      const { data: { user: guestUser } } = await supabase.auth.getUser()
      const emailToSave = guestUser?.email || (marketingOptIn ? marketingEmail.trim() : null)
      if (emailToSave) {
        const upsertData: Record<string, unknown> = {
          restaurant_id: restaurant.id,
          email: emailToSave,
          name: customerName || null,
          source: 'order',
          last_order_at: new Date().toISOString(),
        }
        if (marketingOptIn) upsertData.subscribed = true
        await supabase.from('marketing_subscribers').upsert(upsertData, { onConflict: 'restaurant_id,email' })
        await supabase.rpc('bump_subscriber_stats', { p_restaurant_id: restaurant.id, p_email: emailToSave, p_spent: total })
      }
    }

    // Referral: process incoming referral + load own share code
    if (restaurant.referral_enabled) {
      const refCode = getReferralRef(slug)
      if (refCode && insertedOrderId && trimmedEmail) {
        clearReferralRef(slug)
        fetch('/api/referral/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: insertedOrderId, referrerCode: refCode, restaurantId: restaurant.id, customerEmail: trimmedEmail }),
        }).catch(() => {})
      }
      // Load the guest's own referral code to show the share block
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

  if (showV1) return <BestellenV1 />

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: V2.bg, color: V2.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-geist), system-ui, sans-serif' }}>
        <div style={{ color: V2.textDim, fontSize: '14px' }}>Lade Menü…</div>
      </div>
    )
  }

  if (error && !restaurant) {
    return (
      <div style={{ minHeight: '100vh', background: V2.bg, color: V2.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-geist), system-ui, sans-serif' }}>
        <div style={{ color: V2.textDim }}>{error}</div>
      </div>
    )
  }

  const closedInfo = restaurant ? getClosedInfo(restaurant.opening_hours) : null
  if (closedInfo && view !== 'status') {
    const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
    return (
      <div style={{ minHeight: '100vh', background: V2.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--font-geist), system-ui, sans-serif' }}>
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
    <div style={{ minHeight: '100vh', background: V2.bg, color: V2.text, fontFamily: 'var(--font-geist), system-ui, sans-serif', paddingBottom: cartCount > 0 && view === 'menu' ? '100px' : '0' }}>
      {/* STATUS VIEW */}
      {view === 'status' && order && (
        <StatusView
          order={order}
          googleReviewUrl={restaurant?.google_review_url ?? null}
          onReset={() => { setView('menu'); setOrder(null) }}
          referralCode={myReferralCode}
          restaurantSlug={slug}
          restaurant={restaurant}
        />
      )}

      {/* CHECKOUT VIEW */}
      {view === 'checkout' && (
        <CheckoutView
          cart={cart}
          total={total}
          orderType={orderType}
          setOrderType={setOrderType}
          customerName={customerName} setCustomerName={setCustomerName}
          customerPhone={customerPhone} setCustomerPhone={setCustomerPhone}
          street={street} setStreet={setStreet}
          city={city} setCity={setCity}
          zip={zip} setZip={setZip}
          note={note} setNote={setNote}
          error={error}
          submitting={submitting}
          onBack={() => { setView('menu'); setError('') }}
          onSubmit={submitOrder}
          restaurantEmailMarketing={restaurant?.email_marketing_enabled ?? false}
          restaurantName={restaurant?.name}
          marketingOptIn={marketingOptIn} setMarketingOptIn={setMarketingOptIn}
          marketingEmail={marketingEmail} setMarketingEmail={setMarketingEmail}
          loyaltyProgram={loyaltyProgram}
          loyaltyMember={loyaltyMember}
          applyReward={applyReward}
          setApplyReward={setApplyReward}
          accentColor={restaurant?.primary_color ?? V2.accent}
          discountCode={discountCode}
          setDiscountCode={setDiscountCode}
          discountInfo={discountInfo}
          discountError={discountError}
          discountLoading={discountLoading}
          onValidateCode={validateCode}
        />
      )}

      {/* MENU VIEW */}
      {view === 'menu' && (
        <div>
          {/* Hero */}
          <div style={{ padding: '20px 20px 0' }}>
            <div style={{
              background: V2.gradient,
              borderRadius: '20px',
              padding: '28px 24px',
              marginTop: '8px',
              boxShadow: '0 20px 60px rgba(234,88,12,0.25)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(255,255,255,0.15)', borderRadius: '999px', fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                  <Sparkles size={11} /> Bestellen
                </div>
                {restaurant && (
                  <LoyaltyButton restaurantId={restaurant.id} accentColor={restaurant.primary_color ?? V2.accent} />
                )}
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>{restaurant?.name}</h1>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', marginTop: '6px', marginBottom: 0 }}>Abholung oder Lieferung · Live-Status</p>
            </div>
          </div>

          {/* Loyalty Banner */}
          {restaurant && (
            <LoyaltyBanner restaurantId={restaurant.id} accentColor={restaurant.primary_color ?? V2.accent} />
          )}

          {/* Sticky category tabs */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 20,
            background: V2.bg + 'F0',
            backdropFilter: 'blur(10px)',
            borderBottom: `1px solid ${V2.border}`,
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
                    background: active ? V2.accent : V2.surface,
                    border: `1px solid ${active ? V2.accent : V2.border}`,
                    color: active ? '#fff' : V2.text,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 150ms',
                  }}
                >
                  {cat.name}
                </button>
              )
            })}
          </div>

          {/* SmartFilter */}
          {restaurant && (restaurant.plan === 'pro' || restaurant.plan === 'enterprise') && (
            <div style={{ padding: '0 20px' }}>
              <SmartFilter
                restaurantId={restaurant.id}
                items={items.map(i => ({
                  id: i.id,
                  name: i.name,
                  description: i.description ?? null,
                  allergens: (i.allergens as string[] | null) ?? null,
                  tags: (i.tags as string[] | null) ?? null,
                }))}
                accentColor={V2.accent}
                onFilterChange={setFilterResult}
              />
            </div>
          )}

          {/* Menu grid by category */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {categories.map(cat => {
              const catItems = items.filter(i => {
                if (i.category_id !== cat.id) return false
                if (alertSettings?.auto_hide_item && i.stock_count !== null && i.stock_count <= 0) return false
                return true
              })
              if (catItems.length === 0) return null
              return (
                <div key={cat.id} ref={el => { categoryRefs.current[cat.id] = el }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', letterSpacing: '-0.01em' }}>{cat.name}</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                    {catItems.map(item => {
                      const qty = getQty(item.id)
                      return (
                        <div
                          key={item.id}
                          style={{
                            opacity: getItemSuitability(item.id) === 'unsuitable' ? 0.4 : (alertSettings?.show_sold_out_label && item.stock_count !== null && item.stock_count <= 0 ? 0.5 : 1),
                            transition: 'opacity 0.3s',
                            position: 'relative',
                          }}
                        >
                          {alertSettings?.show_sold_out_label && item.stock_count !== null && item.stock_count <= 0 && (
                            <div style={{
                              position: 'absolute', top: '8px', left: '8px', zIndex: 10,
                              background: '#6b7280', color: '#fff', fontSize: '0.7rem',
                              padding: '2px 8px', borderRadius: '20px', fontWeight: 600,
                              pointerEvents: 'none',
                            }}>
                              Ausverkauft
                            </div>
                          )}
                          {getItemSuitability(item.id) === 'unsuitable' && getUnsuitableReason(item.id) && (
                            <div style={{
                              position: 'absolute', top: '8px', right: '8px', zIndex: 10,
                              background: '#ef4444', color: '#fff', fontSize: '0.7rem',
                              padding: '2px 8px', borderRadius: '20px', fontWeight: 600,
                              pointerEvents: 'none',
                            }}>
                              {getUnsuitableReason(item.id)}
                            </div>
                          )}
                        <div
                          onClick={() => setSelectedItem(item)}
                          style={{
                            background: V2.surface,
                            border: `1px solid ${qty > 0 ? V2.accent : V2.border}`,
                            borderRadius: `${V2.radius}px`,
                            padding: '14px',
                            cursor: 'pointer',
                            transition: 'all 150ms',
                            display: 'flex',
                            gap: '12px',
                          }}
                        >
                          {item.image_url && (
                            <div style={{ width: '80px', height: '80px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, background: V2.surfaceHi }}>
                              <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>{itemName(item)}</div>
                            {item.description && (
                              <div style={{ color: V2.textDim, fontSize: '12px', lineHeight: 1.4, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {itemDesc(item)}
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: V2.accent }}>{item.price.toFixed(2)} €</div>
                              {qty > 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                                  <button onClick={() => removeFromCart(item.id)} style={iconBtnStyle}><Minus size={14} /></button>
                                  <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '16px', textAlign: 'center' }}>{qty}</span>
                                  <button onClick={() => addToCart(item)} style={iconBtnStyle}><Plus size={14} /></button>
                                </div>
                              ) : (
                                <button
                                  onClick={e => { e.stopPropagation(); addToCart(item) }}
                                  style={{ width: '32px', height: '32px', borderRadius: '10px', background: V2.accent, border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Plus size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Link to V1 */}
          <div style={{ padding: '0 20px 20px' }}>
            <button
              onClick={() => setShowV1(true)}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                background: 'transparent',
                border: `1px solid ${V2.border}`,
                color: V2.textDim,
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              Gruppen-Bestellung, Reservierung & mehr → V1 öffnen <ArrowRight size={13} />
            </button>
          </div>

          {/* Floating cart button */}
          {cartCount > 0 && (
            <button
              onClick={() => setView('checkout')}
              style={{
                position: 'fixed',
                bottom: '20px',
                left: '20px',
                right: '20px',
                maxWidth: '500px',
                margin: '0 auto',
                padding: '16px 20px',
                borderRadius: '14px',
                background: V2.gradient,
                border: 'none',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 12px 40px rgba(234,88,12,0.5)',
                zIndex: 50,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShoppingCart size={18} />
                <span>{cartCount} {cartCount === 1 ? 'Artikel' : 'Artikel'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{total.toFixed(2)} €</span>
                <ArrowRight size={16} />
              </div>
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
                style={{ background: V2.surface, border: `1px solid ${V2.border}`, borderRadius: '20px', padding: '20px', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto' }}
              >
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                  <button onClick={() => setSelectedItem(null)} style={iconBtnStyle}><X size={16} /></button>
                </div>
                {selectedItem.image_url && (
                  <div style={{ width: '100%', height: '200px', borderRadius: '14px', overflow: 'hidden', marginBottom: '16px', background: V2.surfaceHi }}>
                    <img src={selectedItem.image_url} alt={selectedItem.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.01em' }}>{selectedItem.name}</h2>
                {selectedItem.description && (
                  <p style={{ color: V2.textDim, fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>{selectedItem.description}</p>
                )}
                {selectedItem.allergens && selectedItem.allergens.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                    {selectedItem.allergens.map(a => (
                      <span key={a} style={{ padding: '3px 8px', borderRadius: '999px', background: V2.surfaceHi, border: `1px solid ${V2.border}`, fontSize: '11px', color: V2.textDim }}>{a}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: V2.accent }}>{selectedItem.price.toFixed(2)} €</div>
                  {getQty(selectedItem.id) > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button onClick={() => removeFromCart(selectedItem.id)} style={iconBtnStyle}><Minus size={14} /></button>
                      <span style={{ fontSize: '16px', fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{getQty(selectedItem.id)}</span>
                      <button onClick={() => addToCart(selectedItem)} style={iconBtnStyle}><Plus size={14} /></button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { addToCart(selectedItem); setSelectedItem(null) }}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', background: V2.gradient, border: 'none', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
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

const iconBtnStyle: React.CSSProperties = {
  width: '28px', height: '28px', borderRadius: '8px',
  background: V2.surfaceHi, border: `1px solid ${V2.border}`,
  color: V2.text, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

function CheckoutView(props: {
  cart: CartItem[]; total: number;
  orderType: OrderType; setOrderType: (t: OrderType) => void;
  customerName: string; setCustomerName: (v: string) => void;
  customerPhone: string; setCustomerPhone: (v: string) => void;
  street: string; setStreet: (v: string) => void;
  city: string; setCity: (v: string) => void;
  zip: string; setZip: (v: string) => void;
  note: string; setNote: (v: string) => void;
  error: string; submitting: boolean;
  onBack: () => void; onSubmit: () => void;
  restaurantEmailMarketing?: boolean; restaurantName?: string;
  marketingOptIn: boolean; setMarketingOptIn: (v: boolean) => void;
  marketingEmail: string; setMarketingEmail: (v: string) => void;
  loyaltyProgram: LoyaltyProgram | null;
  loyaltyMember: LoyaltyMember | null;
  applyReward: boolean;
  setApplyReward: (v: boolean) => void;
  accentColor: string;
  discountCode: string;
  setDiscountCode: (v: string) => void;
  discountInfo: { type: 'percent' | 'fixed'; value: number; expiresAt: string } | null;
  discountError: string;
  discountLoading: boolean;
  onValidateCode: (code: string) => void;
}) {
  const { cart, total, orderType, setOrderType, customerName, setCustomerName, customerPhone, setCustomerPhone, street, setStreet, city, setCity, zip, setZip, note, setNote, error, submitting, onBack, onSubmit, restaurantEmailMarketing, restaurantName, marketingOptIn, setMarketingOptIn, marketingEmail, setMarketingEmail, loyaltyProgram, loyaltyMember, applyReward, setApplyReward, accentColor, discountCode, setDiscountCode, discountInfo, discountError, discountLoading, onValidateCode } = props

  return (
    <div style={{ padding: '20px', maxWidth: '560px', margin: '0 auto' }}>
      <button onClick={onBack} style={{ ...iconBtnStyle, width: 'auto', padding: '8px 14px', fontSize: '13px', gap: '6px', marginBottom: '16px', fontFamily: 'inherit' }}>
        <ArrowLeft size={14} /> Zurück zum Menü
      </button>

      <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '20px' }}>Bestellung abschließen</h1>

      {/* Cart summary */}
      <div style={{ background: V2.surface, border: `1px solid ${V2.border}`, borderRadius: `${V2.radius}px`, padding: '16px', marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Dein Warenkorb</div>
        {cart.map(c => (
          <div key={c.item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px' }}>
            <span>{c.qty}× {c.item.name}</span>
            <span style={{ color: V2.textDim }}>{(c.item.price * c.qty).toFixed(2)} €</span>
          </div>
        ))}
        <div style={{ borderTop: `1px solid ${V2.border}`, marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '16px' }}>
          <span>Gesamt</span>
          <span style={{ color: V2.accent }}>{total.toFixed(2)} €</span>
        </div>
      </div>

      {/* Order type */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        {(['pickup', 'delivery'] as OrderType[]).map(t => {
          const active = orderType === t
          const Icon = t === 'pickup' ? PersonStanding : Bike
          return (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: active ? V2.accent : V2.surface,
                border: `1px solid ${active ? V2.accent : V2.border}`,
                color: active ? '#fff' : V2.text,
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Icon size={16} />
              {t === 'pickup' ? 'Abholung' : 'Lieferung'}
            </button>
          )
        })}
      </div>

      {/* Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Input placeholder="Name *" value={customerName} onChange={setCustomerName} />
        <Input placeholder="Telefon *" value={customerPhone} onChange={setCustomerPhone} type="tel" />
        {orderType === 'delivery' && (
          <>
            <Input placeholder="Straße + Nr. *" value={street} onChange={setStreet} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
              <Input placeholder="PLZ *" value={zip} onChange={setZip} />
              <Input placeholder="Stadt *" value={city} onChange={setCity} />
            </div>
          </>
        )}
        <textarea
          placeholder="Notiz (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>

      {restaurantEmailMarketing && (
        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
            <input type="checkbox" checked={marketingOptIn} onChange={e => setMarketingOptIn(e.target.checked)} style={{ marginTop: '2px', flexShrink: 0 }} />
            <span style={{ color: V2.textDim, fontSize: '13px', lineHeight: 1.5 }}>
              Angebote &amp; News von {restaurantName} per Email erhalten (jederzeit abbestellbar).
            </span>
          </label>
          {marketingOptIn && (
            <input
              type="email"
              value={marketingEmail}
              onChange={e => setMarketingEmail(e.target.value)}
              placeholder="Deine Email-Adresse"
              style={{ ...inputStyle, marginTop: '8px' }}
            />
          )}
        </div>
      )}

      {error && (
        <div style={{ marginTop: '12px', padding: '12px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: '16px' }}>
        <LoyaltyRedeemBlock
          program={loyaltyProgram}
          member={loyaltyMember}
          applyReward={applyReward}
          onToggle={setApplyReward}
          accentColor={accentColor}
        />
      </div>

      {/* Gutschein-Code */}
      <div style={{ marginTop: '12px' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#8B8B93', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Gutschein-Code (optional)
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={discountCode}
            onChange={e => { setDiscountCode(e.target.value.toUpperCase()); }}
            placeholder="z.B. BDAY-A1B2C3"
            style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: '#1a1a2a', color: '#F5F5F7', fontSize: '0.875rem', fontFamily: 'monospace', letterSpacing: '0.05em', outline: 'none' }}
          />
          <button
            type="button"
            onClick={() => onValidateCode(discountCode)}
            disabled={!discountCode.trim() || discountLoading}
            style={{ padding: '10px 14px', borderRadius: '10px', border: 'none', background: accentColor, color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: discountLoading ? 0.6 : 1 }}
          >
            {discountLoading ? '…' : 'Einlösen'}
          </button>
        </div>
        {discountInfo && (
          <div style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '8px', background: '#16a34a15', border: '1px solid #16a34a40', color: '#16a34a', fontSize: '0.85rem', fontWeight: 600 }}>
            🎉 {discountInfo.type === 'percent' ? `${discountInfo.value} % Rabatt` : `${discountInfo.value} € Rabatt`} aktiviert!
          </div>
        )}
        {discountError && (
          <p style={{ marginTop: '6px', fontSize: '0.8rem', color: '#ef4444', margin: '6px 0 0' }}>{discountError}</p>
        )}
      </div>

      <button
        onClick={onSubmit}
        disabled={submitting || cart.length === 0}
        style={{
          width: '100%',
          marginTop: '16px',
          padding: '16px',
          borderRadius: '14px',
          background: V2.gradient,
          border: 'none',
          color: '#fff',
          fontSize: '15px',
          fontWeight: 700,
          cursor: submitting ? 'wait' : 'pointer',
          opacity: submitting ? 0.7 : 1,
          fontFamily: 'inherit',
          boxShadow: '0 12px 40px rgba(234,88,12,0.4)',
        }}
      >
        {submitting ? 'Sende…' : `Bestellen · ${total.toFixed(2)} €`}
      </button>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 14px',
  borderRadius: '12px',
  background: V2.surface,
  border: `1px solid ${V2.border}`,
  color: V2.text,
  fontSize: '14px',
  outline: 'none',
  fontFamily: 'inherit',
}

function Input({ placeholder, value, onChange, type = 'text' }: { placeholder: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={inputStyle}
    />
  )
}

function StatusView({ order, googleReviewUrl, onReset, referralCode, restaurantSlug, restaurant }: {
  order: Order
  googleReviewUrl: string | null
  onReset: () => void
  referralCode: string | null
  restaurantSlug: string
  restaurant: Restaurant | null
}) {
  const isServed = order.status === 'served'
  const steps: { key: Order['status']; label: string; icon: typeof ChefHat }[] = [
    { key: 'new', label: 'Empfangen', icon: Clock },
    { key: 'cooking', label: 'In Zubereitung', icon: ChefHat },
    { key: 'served', label: 'Fertig', icon: CheckCircle2 },
  ]
  const activeIdx = steps.findIndex(s => s.key === order.status)

  return (
    <div style={{ padding: '20px', maxWidth: '560px', margin: '0 auto' }}>
      <div style={{
        background: V2.gradient,
        borderRadius: '20px',
        padding: '32px 24px',
        marginTop: '20px',
        marginBottom: '24px',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(234,88,12,0.25)',
      }}>
        <div style={{ display: 'inline-flex', padding: '10px', background: 'rgba(255,255,255,0.15)', borderRadius: '14px', marginBottom: '12px' }}>
          <Sparkles size={22} />
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Bestellung eingegangen!</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', marginTop: '6px', marginBottom: 0 }}>
          #{order.id.slice(0, 8).toUpperCase()} · {order.total.toFixed(2)} €
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
                background: current ? V2.surfaceHi : V2.surface,
                border: `1px solid ${current ? V2.accent : V2.border}`,
                borderRadius: '14px',
                opacity: done ? 1 : 0.45,
                transition: 'all 200ms',
              }}
            >
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: done ? V2.gradient : V2.surfaceHi,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: done ? '#fff' : V2.textDim,
              }}>
                <Icon size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{s.label}</div>
                {current && <div style={{ fontSize: '12px', color: V2.textDim, marginTop: '2px' }}>Live-Update</div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Items recap */}
      <div style={{ background: V2.surface, border: `1px solid ${V2.border}`, borderRadius: `${V2.radius}px`, padding: '16px', marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Bestellte Artikel</div>
        {order.items.map((it, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
            <span>{it.qty}× {it.name}</span>
            <span style={{ color: V2.textDim }}>{(it.price * it.qty).toFixed(2)} €</span>
          </div>
        ))}
        {order.delivery_address && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${V2.border}`, display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: V2.textDim }}>
            <MapPin size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
            <span>{order.delivery_address.street}, {order.delivery_address.zip} {order.delivery_address.city}</span>
          </div>
        )}
      </div>

      {isServed && (
        <OrderRating
          orderId={order.id}
          restaurantId={order.restaurant_id}
          googleReviewUrl={googleReviewUrl}
          C={null}
        />
      )}

      {restaurant?.referral_enabled && referralCode && (
        <ReferralShare
          restaurantSlug={restaurantSlug}
          referralCode={referralCode}
          rewardLabel={
            restaurant.referral_reward_type === 'points'
              ? `${restaurant.referral_reward_points} Punkte`
              : restaurant.referral_reward_type === 'discount'
              ? `${restaurant.referral_reward_discount_percent}% Rabatt`
              : `${restaurant.referral_reward_points} Punkte + ${restaurant.referral_reward_discount_percent}% Rabatt`
          }
          C={null}
        />
      )}

      <button
        onClick={onReset}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '12px',
          background: 'transparent',
          border: `1px solid ${V2.border}`,
          color: V2.textDim,
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Neue Bestellung
      </button>
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

