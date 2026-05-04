'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { supabase } from '@/lib/supabase'
import { darken, buildColors, buildColorsFromRestaurant } from '@/lib/color-utils'
import { getDesignPackage } from '@/lib/design-packages'
import { FONT_PAIRS } from '@/lib/font-pairs'
import { MenuItemCard } from '@/components/menu/MenuItemCard'
import { MenuItemGrid } from '@/components/menu/MenuItemGrid'
import { useTheme } from '@/components/providers/theme-provider'
import type { MenuItem, MenuCategory, Order, Restaurant, Reservation, Table, GroupItem, OrderGroup } from '@/types/database'
import ChatWidget from '@/components/ChatWidget'
import { useLanguage } from '@/components/providers/language-provider'
import { LanguageSelector } from '@/components/ui/language-selector'
import SmartFilter from '../_components/SmartFilter'
import type { LucideIcon } from 'lucide-react'
import {
  ClipboardList, ChefHat, CheckCircle2, XCircle, Clock, User, Users,
  Link, Bike, PersonStanding, Sun, Moon, Search, PartyPopper, ShoppingCart,
  Dices, Map, Shuffle, Bell, X, UtensilsCrossed,
} from 'lucide-react'

type CartItem = { item: MenuItem; qty: number }
type OrderType = 'delivery' | 'pickup'
type View = 'menu' | 'checkout' | 'status'
type PageTab = 'order' | 'reserve'
type OrderMode = 'solo' | 'group-create' | 'group-join' | 'group-active' | 'confirmed-solo'
type TableStatus = 'available' | 'tight' | 'taken' | 'no-position'

type ResInfo = { id: string; table_id: string | null; date: string; time_from: string; guests: number; status: string }

const TABLE_STATUS_COLORS: Record<TableStatus, string | null> = {
  available: '#10b981',
  tight: '#10b981',
  taken: '#ef4444',
  'no-position': null,
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

export default function BestellenV1() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const { theme, toggleTheme } = useTheme()
  const { lang, t } = useLanguage()

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
  const [pageTab, setPageTab] = useState<PageTab>(
    searchParams.get('tab') === 'reserve' ? 'reserve' : 'order'
  )
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [detailQty, setDetailQty] = useState(1)

  const [specials, setSpecials] = useState<Record<string, { label: string; special_price: number | null }>>({})

  // Floor plan + availability
  const [tables, setTables] = useState<Table[]>([])
  const [allReservations, setAllReservations] = useState<ResInfo[]>([])
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [resMode, setResMode] = useState<'any' | 'pick'>('any')

  // Reservation form
  const [resName, setResName] = useState('')
  const [resPhone, setResPhone] = useState('')
  const [resEmail, setResEmail] = useState('')
  const [resDate, setResDate] = useState('')
  const [resTime, setResTime] = useState('12:00')
  const [resGuests, setResGuests] = useState(2)
  const [resNote, setResNote] = useState('')
  const [resDone, setResDone] = useState<Reservation | null>(null)
  const [resSubmitting, setResSubmitting] = useState(false)
  const [resError, setResError] = useState('')
  const [resConsent, setResConsent] = useState(false)

  // Checkout form
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [zip, setZip] = useState('')
  const [note, setNote] = useState('')

  // Group ordering
  const [orderMode, setOrderMode] = useState<OrderMode>('confirmed-solo')
  const [groupCode, setGroupCode] = useState('')
  const [groupId, setGroupId] = useState('')
  const [memberName, setMemberName] = useState('')
  const [groupItems, setGroupItems] = useState<GroupItem[]>([])
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [groupLoading, setGroupLoading] = useState(false)
  const [groupError, setGroupError] = useState('')
  const [isGroupCreator, setIsGroupCreator] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showCart, setShowCart] = useState(false)

  // Filters
  const [activeDietary, setActiveDietary] = useState<string[]>([])
  const [excludedAllergens, setExcludedAllergens] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [filterResult, setFilterResult] = useState<{
    suitable: string[]
    unsuitable: { id: string; reason: string }[]
  } | null>(null)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/restaurant/${slug}`)
      const resto = res.ok ? await res.json() : null

      if (!resto) {
        setError('Restaurant nicht gefunden.')
        setLoading(false)
        return
      }

      setRestaurant(resto)

      const [{ data: cats }, { data: menuItems }, { data: tablesData }, { data: resData }, { data: specialsData }] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('restaurant_id', resto.id).eq('active', true).order('sort_order'),
        supabase.from('menu_items').select('*').eq('restaurant_id', resto.id).eq('available', true).order('sort_order'),
        supabase.from('tables').select('*').eq('restaurant_id', resto.id).eq('active', true).order('table_num'),
        supabase.from('reservations').select('id,table_id,date,time_from,guests,status').eq('restaurant_id', resto.id).neq('status', 'cancelled'),
        supabase.from('daily_specials').select('menu_item_id, label, special_price').eq('restaurant_id', resto.id).eq('active', true),
      ])

      setCategories(cats || [])
      setItems(menuItems || [])
      setTables((tablesData as Table[]) || [])
      setAllReservations((resData as ResInfo[]) || [])
      setSpecials(Object.fromEntries((specialsData || []).map(s => [s.menu_item_id, { label: s.label, special_price: s.special_price }])))
      if (cats && cats.length > 0) setActiveCategory(cats[0].id)
      setLoading(false)
    }
    load()
  }, [slug])

  useEffect(() => {
    // no-op: payment redirects removed
  }, [searchParams])

  // Auto-join group from URL param ?group=XXXX
  useEffect(() => {
    const code = searchParams.get('group')
    if (!code || orderMode !== 'solo') return
    setJoinCodeInput(code.toUpperCase())
    setOrderMode('group-join')
  }, [searchParams])

  // Realtime: subscribe to group_items when in group
  useEffect(() => {
    if (!groupId) return
    // Initial load
    supabase.from('group_items').select('*').eq('group_id', groupId).order('created_at').then(({ data }) => {
      if (data) setGroupItems(data as GroupItem[])
    })
    const channel = supabase
      .channel(`group-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_items', filter: `group_id=eq.${groupId}` }, () => {
        supabase.from('group_items').select('*').eq('group_id', groupId).order('created_at').then(({ data }) => {
          if (data) setGroupItems(data as GroupItem[])
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [groupId])

  useEffect(() => {
    if (selectedItem) {
      const existing = cart.find(c => c.item.id === selectedItem.id)
      setDetailQty(existing ? existing.qty : 1)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }, [selectedItem])

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

  // Live branding updates
  useEffect(() => {
    if (!restaurant) return
    const ch = supabase.channel(`brand-${restaurant.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restaurants', filter: `id=eq.${restaurant.id}` },
        (payload) => { setRestaurant(prev => prev ? { ...prev, ...(payload.new as Partial<Restaurant>) } : null) })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [restaurant?.id])

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
    if (orderMode === 'group-active') {
      return groupItems.filter(gi => gi.added_by === memberName && gi.item_id === itemId).reduce((s, gi) => s + gi.qty, 0)
    }

    return cart.find(c => c.item.id === itemId)?.qty ?? 0
  }

  const total = orderMode === 'group-active'
    ? groupItems.reduce((sum, gi) => sum + gi.price * gi.qty, 0)
    : cart.reduce((sum, c) => sum + c.item.price * c.qty, 0)
  const cartCount = orderMode === 'group-active'
    ? groupItems.reduce((sum, gi) => sum + gi.qty, 0)
    : cart.reduce((sum, c) => sum + c.qty, 0)
  const myItemCount = orderMode === 'group-active'
    ? groupItems.filter(gi => gi.added_by === memberName).reduce((sum, gi) => sum + gi.qty, 0)
    : cartCount

  // Group helpers
  function generateGroupCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  async function createGroup() {
    if (!restaurant || !memberName.trim()) return
    setGroupLoading(true)
    setGroupError('')
    const code = generateGroupCode()
    const { data, error: err } = await supabase.from('order_groups').insert({
      restaurant_id: restaurant.id,
      group_code: code,
      status: 'active',
    }).select().single()
    if (err || !data) { setGroupError('Fehler beim Erstellen der Gruppe.'); setGroupLoading(false); return }
    const group = data as OrderGroup
    setGroupCode(group.group_code)
    setGroupId(group.id)
    setIsGroupCreator(true)
    setOrderMode('group-active')
    setGroupLoading(false)
  }

  async function joinGroup() {
    if (!joinCodeInput.trim() || !memberName.trim()) return
    setGroupLoading(true)
    setGroupError('')
    const { data, error: err } = await supabase.from('order_groups')
      .select('*').eq('group_code', joinCodeInput.toUpperCase()).eq('status', 'active').single()
    if (err || !data) { setGroupError('Gruppe nicht gefunden oder bereits abgeschlossen.'); setGroupLoading(false); return }
    const group = data as OrderGroup
    setGroupCode(group.group_code)
    setGroupId(group.id)
    setIsGroupCreator(false)
    setOrderMode('group-active')
    setGroupLoading(false)
  }

  async function addToGroupCart(item: MenuItem) {
    if (!groupId || !memberName) return
    // Check if this person already has this item → increment qty
    const existing = groupItems.find(gi => gi.added_by === memberName && gi.item_id === item.id)
    if (existing) {
      await supabase.from('group_items').update({ qty: existing.qty + 1 }).eq('id', existing.id)
    } else {
      await supabase.from('group_items').insert({
        group_id: groupId, added_by: memberName,
        item_id: item.id, name: item.name, price: item.price, qty: 1,
      })
    }
  }

  async function removeFromGroupCart(item: MenuItem) {
    if (!groupId || !memberName) return
    const existing = groupItems.find(gi => gi.added_by === memberName && gi.item_id === item.id)
    if (!existing) return
    if (existing.qty > 1) {
      await supabase.from('group_items').update({ qty: existing.qty - 1 }).eq('id', existing.id)
    } else {
      await supabase.from('group_items').delete().eq('id', existing.id)
    }
  }

  async function submitGroupOrder() {
    if (!groupId || !restaurant || groupItems.length === 0) return

    const aggregated: Record<string, { item_id: string; name: string; price: number; qty: number }> = {}
    const byPerson: Record<string, string[]> = {}

    groupItems.forEach(gi => {
      if (aggregated[gi.item_id]) {
        aggregated[gi.item_id].qty += gi.qty
      } else {
        aggregated[gi.item_id] = { item_id: gi.item_id, name: gi.name, price: gi.price, qty: gi.qty }
      }
      if (!byPerson[gi.added_by]) byPerson[gi.added_by] = []
      byPerson[gi.added_by].push(`${gi.qty}× ${gi.name}`)
    })

    const groupNote = Object.entries(byPerson)
      .map(([name, items]) => `${name}: ${items.join(', ')}`)
      .join(' | ')

    const totalAmount = groupItems.reduce((s, i) => s + i.price * i.qty, 0)

    const { data, error: orderError } = await supabase.from('orders').insert({
      restaurant_id: restaurant.id,
      order_type: 'dine_in',
      table_id: null,
      status: 'new',
      items: Object.values(aggregated),
      note: `[Gruppenbestellung] ${groupNote}`,
      total: Math.round(totalAmount * 100) / 100,
      customer_name: memberName,
    }).select().single()

    if (orderError || !data) {
      console.error('Failed to create group order:', orderError)
      return
    }

    await supabase.from('order_groups').update({ status: 'ordering' }).eq('id', groupId)
    setOrder(data as Order)
    setView('status')
  }

  function scrollToCategory(catId: string) {
    setActiveCategory(catId)
    categoryRefs.current[catId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function filterItems(source: MenuItem[]) {
    return source.filter(item => {
      if (activeDietary.length > 0 && !activeDietary.every(d => item.tags.includes(d))) return false
      if (excludedAllergens.length > 0 && item.allergens.some(a => excludedAllergens.includes(a))) return false
      return true
    })
  }

  const filterCount = activeDietary.length + excludedAllergens.length

  function getItemSuitability(itemId: string): 'suitable' | 'unsuitable' | 'neutral' {
    if (!filterResult) return 'neutral'
    if (filterResult.unsuitable.some(u => u.id === itemId)) return 'unsuitable'
    return 'suitable'
  }

  function getUnsuitableReason(itemId: string): string | undefined {
    return filterResult?.unsuitable.find(u => u.id === itemId)?.reason
  }

  const DIETARY_FILTERS = [
    { key: 'vegetarisch', label: t('order.dietary.vegetarisch') },
    { key: 'vegan',       label: t('order.dietary.vegan') },
    { key: 'glutenfrei',  label: t('order.dietary.glutenfrei') },
    { key: 'laktosefrei', label: t('order.dietary.laktosefrei') },
    { key: 'scharf',      label: t('order.dietary.scharf') },
  ]

  const STATUS_ICONS: Record<string, LucideIcon> = {
    new: ClipboardList, cooking: ChefHat, served: Bike, cancelled: XCircle,
  }

  const C = restaurant ? buildColorsFromRestaurant(restaurant) : buildColors()
  const spring = { type: 'spring' as const, stiffness: 420, damping: 26 }
  const springBouncy = { type: 'spring' as const, stiffness: 500, damping: 18 }

  const ALLERGEN_FILTERS = [
    'Gluten', 'Nüsse', 'Milch', 'Eier', 'Fisch',
    'Meeresfrüchte', 'Soja', 'Sellerie', 'Senf', 'Sesam',
  ]

  function validatePhone(phone: string): string | null {
    const raw = phone.trim()
    if (!raw) return 'Telefonnummer ist erforderlich.'
    if (!/^[+\d\s\-().]+$/.test(raw)) return 'Ungültige Zeichen in der Telefonnummer.'
    const parsed = parsePhoneNumberFromString(raw, 'DE')
    if (!parsed || !parsed.isValid()) return 'Bitte eine gültige Telefonnummer eingeben (z.B. 0151 12345678).'
    return null
  }

  async function submitOrder() {
    if (!restaurant) return
    const phoneErr = validatePhone(customerPhone)
    if (phoneErr) { setError(phoneErr); return }
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

    const newOrder = data as Order
    setOrder(newOrder)
    setView('status')
    setSubmitting(false)

    // After successful insert, calculate ETA (non-blocking)
    if (data?.id) {
      const cartItems = cart.map(c => ({ item_id: c.item.id, qty: c.qty }))
      calculateAndStoreEta(data.id, restaurant.id, cartItems, orderType)
    }

    // Fire-and-forget order confirmation email (delivery + pickup only, requires email)
    // Orders currently don't collect email — skipping for now
  }

  async function submitReservation() {
    if (!restaurant || !resName.trim() || !resDate || !resTime) return
    const phoneErr = validatePhone(resPhone)
    if (phoneErr) { setResError(phoneErr); return }
    setResSubmitting(true)
    setResError('')
    const { data, error: err } = await supabase
      .from('reservations')
      .insert({
        restaurant_id: restaurant.id,
        customer_name: resName.trim(),
        customer_phone: resPhone.trim(),
        customer_email: resEmail.trim() || null,
        guests: resGuests,
        date: resDate,
        time_from: resTime,
        note: resNote.trim() || null,
        table_id: selectedTableId || null,
      })
      .select()
      .single()
    if (err || !data) {
      setResError('Fehler beim Absenden. Bitte versuche es erneut.')
      setResSubmitting(false)
      return
    }
    const newRes = data as Reservation
    setResDone(newRes)
    setSelectedTableId(null)
    setResSubmitting(false)

    // Email is sent server-side via Supabase Edge Function (Database Webhook)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', width: '100%', overflowX: 'hidden' }}>
        <div style={{ background: 'var(--header-bg)', padding: '28px 20px 20px' }}>
          <div className="skeleton" style={{ width: '120px', height: '14px', marginBottom: '10px' }} />
          <div className="skeleton" style={{ width: '200px', height: '28px', marginBottom: '16px' }} />
          <div className="skeleton" style={{ width: '160px', height: '36px', borderRadius: '12px' }} />
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', gap: '8px' }}>
          {[80, 100, 70, 90].map((w, i) => (
            <div key={i} className="skeleton" style={{ width: `${w}px`, height: '34px', borderRadius: '20px' }} />
          ))}
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'center', background: 'var(--surface)', borderRadius: '16px', padding: '14px' }}>
              <div className="skeleton" style={{ width: '72px', height: '72px', borderRadius: '10px', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="skeleton" style={{ width: '60%', height: '16px' }} />
                <div className="skeleton" style={{ width: '80%', height: '12px' }} />
                <div className="skeleton" style={{ width: '40%', height: '16px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error && !restaurant) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa', padding: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><XCircle size={48} color="#ef4444" /></div>
          <p style={{ color: 'var(--text)', fontWeight: 700 }}>Restaurant nicht gefunden</p>
          <p style={{ color: '#888', fontSize: '0.875rem', marginTop: '8px' }}>{error}</p>
        </div>
      </div>
    )
  }

  // ── Mode selection splash (shown before menu) ──
  if (orderMode === 'solo' || orderMode === 'group-create' || orderMode === 'group-join') {
    // Show splash — only when not yet confirmed
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ background: 'var(--header-bg)', padding: '32px 24px 28px' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>Willkommen bei</p>
          <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 'clamp(1.4rem, 6vw, 2rem)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{restaurant?.name}</h1>
        </div>

        <div style={{ flex: 1, padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '480px', width: '100%', margin: '0 auto' }}>

          {/* Solo mode — initial choice */}
          {orderMode === 'solo' && (<>
            <h2 style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '4px' }}>Wie möchtest du bestellen?</h2>

            <motion.button
              whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              onClick={() => setOrderMode('confirmed-solo')}
              style={{ padding: '20px', borderRadius: '16px', border: '2px solid var(--accent)', background: 'var(--accent-subtle)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '16px' }}
            >
              <User size={28} color="var(--accent)" />
              <div>
                <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1rem' }}>{t('order.continueAlone')}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '2px' }}>Nur für mich</div>
              </div>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              onClick={() => setOrderMode('group-create')}
              style={{ padding: '20px', borderRadius: '16px', border: '2px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '16px' }}
            >
              <Users size={28} color="var(--text)" />
              <div>
                <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem' }}>{t('order.createGroup')}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '2px' }}>Alle bestellen gemeinsam — ein einziger Auftrag</div>
              </div>
            </motion.button>

            <button
              onClick={() => setOrderMode('group-join')}
              style={{ padding: '14px 20px', borderRadius: '14px', border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Link size={16} /> {t('order.joinGroup')}</span>
            </button>
          </>)}

          {/* Group create */}
          {orderMode === 'group-create' && (<>
            <button onClick={() => setOrderMode('solo')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', textAlign: 'left', padding: 0, marginBottom: '4px' }}>← {t('common.back')}</button>
            <h2 style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={18} /> Gruppe erstellen</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '-8px' }}>Gib deinen Namen ein, dann bekommst du einen Code den du teilen kannst.</p>
            <input
              value={memberName}
              onChange={e => setMemberName(e.target.value)}
              placeholder={t('order.guestName')}
              autoFocus
              style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '1rem', outline: 'none' }}
            />
            {groupError && <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>{groupError}</p>}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={createGroup}
              disabled={!memberName.trim() || groupLoading}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              style={{ padding: '16px', borderRadius: '14px', border: 'none', background: memberName.trim() ? 'var(--accent)' : 'var(--border)', color: memberName.trim() ? 'var(--accent-text)' : 'var(--text-muted)', fontWeight: 800, fontSize: '1rem', cursor: memberName.trim() ? 'pointer' : 'not-allowed' }}
            >
              {groupLoading ? 'Erstelle Gruppe...' : 'Gruppe starten →'}
            </motion.button>
          </>)}

          {/* Group join */}
          {orderMode === 'group-join' && (<>
            <button onClick={() => setOrderMode('solo')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', textAlign: 'left', padding: 0, marginBottom: '4px' }}>← {t('common.back')}</button>
            <h2 style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Link size={18} /> Gruppe beitreten</h2>
            <input
              value={memberName}
              onChange={e => setMemberName(e.target.value)}
              placeholder={t('order.guestName')}
              autoFocus
              style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '1rem', outline: 'none' }}
            />
            <input
              value={joinCodeInput}
              onChange={e => setJoinCodeInput(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="CODE"
              maxLength={4}
              style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '0.3em', outline: 'none', textAlign: 'center', textTransform: 'uppercase' }}
            />
            {groupError && <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>{groupError}</p>}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={joinGroup}
              disabled={joinCodeInput.length < 4 || !memberName.trim() || groupLoading}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              style={{ padding: '16px', borderRadius: '14px', border: 'none', background: joinCodeInput.length === 4 && memberName.trim() ? 'var(--accent)' : 'var(--border)', color: joinCodeInput.length === 4 && memberName.trim() ? 'var(--accent-text)' : 'var(--text-muted)', fontWeight: 800, fontSize: '1rem', cursor: joinCodeInput.length === 4 && memberName.trim() ? 'pointer' : 'not-allowed' }}
            >
              {groupLoading ? 'Suche Gruppe...' : 'Beitreten →'}
            </motion.button>
          </>)}

        </div>
      </div>
    )
  }

  // Closed check
  const closedInfo = restaurant ? getClosedInfo(restaurant.opening_hours) : null

  if (closedInfo && view !== 'status') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--btn-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center', maxWidth: '360px' }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><Clock size={48} color="rgba(255,255,255,0.6)" /></div>
          <h2 style={{ color: 'var(--surface)', fontWeight: 800, fontSize: '1.4rem', marginBottom: '8px', letterSpacing: '-0.02em' }}>
            {restaurant?.name}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem', marginBottom: '28px' }}>{closedInfo}</p>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px', textAlign: 'left', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Öffnungszeiten</p>
            {restaurant?.opening_hours && Object.entries(restaurant.opening_hours).map(([key, dh]) => {
              const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>{dayNames[parseInt(key)]}</span>
                  <span style={{ color: dh.closed ? 'var(--accent)' : 'var(--surface)', fontSize: '0.85rem', fontWeight: 700 }}>
                    {dh.closed ? 'Geschlossen' : `${dh.open} – ${dh.close}`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Order status view
  if (view === 'status' && order) {
    const statusLabel = order.status === 'served' && order.order_type === 'delivery'
      ? t('order.status.servedDelivery')
      : t(`order.status.${order.status}`)
    const StatusIcon = STATUS_ICONS[order.status] ?? STATUS_ICONS.new
    const isPickup = order.order_type === 'pickup'
    const statusIdx = ['new', 'cooking', 'served'].indexOf(order.status)
    const isServed = order.status === 'served'
    const confettiColors = [C.accent, '#f59e0b', '#10b981', '#3b82f6', '#ec4899']

    return (
      <div style={{ minHeight: '100vh', background: C.bg, width: '100%', overflowX: 'hidden' }}>
        <style>{`@keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }`}</style>

        {/* Confetti */}
        <AnimatePresence>
          {isServed && Array.from({ length: 18 }).map((_, i) => (
            <motion.div key={`c-${i}`}
              initial={{ y: 0, x: 0, opacity: 1, scale: 1, rotate: 0 }}
              animate={{ y: -240 - Math.random() * 180, x: (Math.random() - 0.5) * 320, opacity: 0, scale: 0.2, rotate: 900 }}
              transition={{ duration: 1.1 + Math.random() * 0.6, delay: i * 0.045, ease: 'easeOut' }}
              style={{ position: 'fixed', top: '45%', left: '50%', width: '9px', height: '9px', borderRadius: '2px', background: confettiColors[i % confettiColors.length], pointerEvents: 'none', zIndex: 999 }}
            />
          ))}
        </AnimatePresence>

        {/* Status hero */}
        <div style={{ background: `linear-gradient(180deg, #0f0f0f 0%, ${C.bg} 100%)`, padding: '48px 24px 40px', textAlign: 'center', borderBottom: `1px solid ${C.border}` }}>
          <AnimatePresence mode="wait">
            <motion.div key={order.status}
              initial={{ scale: 0.4, opacity: 0, rotate: -15 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.4, opacity: 0 }}
              transition={springBouncy}
              style={{ marginBottom: '18px', display: 'flex', justifyContent: 'center' }}
            ><StatusIcon size={72} color={C.accent} /></motion.div>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.h1 key={order.status + 'l'}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
              transition={spring}
              style={{ color: C.text, fontSize: 'clamp(1.3rem, 5vw, 1.6rem)', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.02em' }}
            >{statusLabel}</motion.h1>
          </AnimatePresence>
          <p style={{ color: C.muted, fontSize: '0.85rem' }}>
            {restaurant?.name} · {isPickup ? t('order.pickup') : t('order.delivery')}
          </p>
          {order.estimated_time != null && order.status !== 'served' && order.status !== 'cancelled' && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: '#f59e0b20', color: '#f59e0b',
              borderRadius: '10px', padding: '6px 14px',
              fontSize: '0.85rem', fontWeight: 600, marginTop: '12px',
            }}>
              ⏱ Geschätzte Wartezeit: ~{order.estimated_time} Minuten
            </div>
          )}
        </div>

        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '28px 20px' }}>
          {/* Progress */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '32px' }}>
            {['new', 'cooking', 'served'].map((s, i) => {
              const isActive = statusIdx === i
              const isDone = statusIdx > i
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <motion.div
                      animate={{ background: statusIdx >= i ? C.accent : C.surface2, scale: isActive ? 1.18 : 1 }}
                      transition={spring}
                      style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: '0.75rem', fontWeight: 800,
                        boxShadow: isActive ? `0 0 0 5px ${C.accentGlow}` : 'none',
                      }}
                    >
                      <AnimatePresence mode="wait">
                        {isDone ? (
                          <motion.svg key="chk" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <motion.path d="M5 13l4 4L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />
                          </motion.svg>
                        ) : (
                          <motion.span key="n" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{i + 1}</motion.span>
                        )}
                      </AnimatePresence>
                    </motion.div>
                    <span style={{ fontSize: '0.64rem', color: statusIdx >= i ? C.text : C.muted, fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                      {['Eingegangen', 'Zubereitung', 'Fertig'][i]}
                    </span>
                  </div>
                  {i < 2 && (
                    <motion.div animate={{ background: statusIdx > i ? C.accent : C.border }} transition={{ duration: 0.5 }}
                      style={{ width: '48px', height: '2px', margin: '0 4px 20px' }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Order Summary */}
          <div style={{ background: C.surface, borderRadius: '18px', padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
            <h3 style={{ color: C.muted, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>Deine Bestellung</h3>
            {order.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: C.text, fontSize: '0.875rem' }}>{item.qty}× {item.name}</span>
                <span style={{ color: C.muted, fontSize: '0.875rem' }}>{(item.price * item.qty).toFixed(2)} €</span>
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: '12px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.text, fontWeight: 700 }}>{t('order.total')}</span>
              <span style={{ color: C.accent, fontWeight: 800, fontSize: '1.05rem' }}>{order.total.toFixed(2)} €</span>
            </div>
          </div>

          {order.delivery_address && (
            <div style={{ background: C.surface, borderRadius: '16px', padding: '16px 20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
              <p style={{ color: C.muted, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Lieferadresse</p>
              <p style={{ color: C.text, fontSize: '0.875rem', fontWeight: 600 }}>
                {order.delivery_address.street}, {order.delivery_address.zip} {order.delivery_address.city}
              </p>
            </div>
          )}

          <motion.button
            onClick={() => { setCart([]); setView('menu') }}
            whileTap={{ scale: 0.98 }} transition={spring}
            style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '12px', padding: '13px', color: C.muted, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
          >Neue Bestellung</motion.button>
        </div>
      </div>
    )
  }

  // Checkout view
  if (view === 'checkout') {
    const isDelivery = orderType === 'delivery'
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', width: '100%', overflowX: 'hidden' }}>
        <div style={{ background: 'var(--btn-bg)', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button onClick={() => setView('menu')} style={{ background: 'rgba(128,128,128,0.15)', border: 'none', color: 'var(--btn-text)', cursor: 'pointer', fontSize: '1rem', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
          <h2 style={{ color: 'var(--btn-text)', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.01em' }}>Bestellung abschließen</h2>
        </div>

        <div style={{ padding: '20px', maxWidth: '480px', margin: '0 auto' }}>
          {/* Order type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
            {(['pickup', 'delivery'] as OrderType[]).map(type => (
              <button
                key={type}
                onClick={() => setOrderType(type)}
                style={{
                  padding: '14px', borderRadius: '14px', border: '2px solid',
                  borderColor: orderType === type ? 'var(--btn-bg)' : 'var(--border)',
                  background: orderType === type ? 'var(--btn-bg)' : 'var(--surface)',
                  color: orderType === type ? 'var(--btn-text)' : 'var(--text-muted)',
                  fontWeight: 700, cursor: 'pointer', textAlign: 'center',
                }}
              >
                <div style={{ marginBottom: '4px', display: 'flex', justifyContent: 'center' }}>{type === 'pickup' ? <PersonStanding size={24} /> : <Bike size={24} />}</div>
                {type === 'pickup' ? t('order.pickup') : t('order.delivery')}
              </button>
            ))}
          </div>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
            <div>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name *</label>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder={t('order.guestName')} style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Telefon *</label>
              <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+49 123 456789" type="tel" style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {isDelivery && (
              <>
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Straße & Hausnummer *</label>
                  <input value={street} onChange={e => setStreet(e.target.value)} placeholder="Musterstraße 1" style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PLZ *</label>
                    <input value={zip} onChange={e => setZip(e.target.value)} placeholder="12345" style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stadt *</label>
                    <input value={city} onChange={e => setCity(e.target.value)} placeholder="Berlin" style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </>
            )}

            <div>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Anmerkung</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="z.B. Kein Zwiebeln..." rows={2} style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Cart summary */}
          <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '16px', marginBottom: '16px', border: '1px solid var(--border)' }}>
            {cart.map(c => (
              <div key={c.item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{c.qty}× {c.item.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{(c.item.price * c.qty).toFixed(2)}€</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #e0e0e0', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text)', fontWeight: 800 }}>{t('order.total')}</span>
              <span style={{ color: 'var(--accent)', fontWeight: 800 }}>{total.toFixed(2)} €</span>
            </div>
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}

          <button
            onClick={submitOrder}
            disabled={submitting || !customerName || !customerPhone || (isDelivery && (!street || !city || !zip))}
            style={{
              width: '100%', padding: '17px', borderRadius: '14px', border: 'none',
              background: submitting || !customerName || !customerPhone ? 'var(--border)' : 'var(--btn-bg)',
              color: submitting || !customerName || !customerPhone ? 'var(--text-muted)' : 'var(--btn-text)',
              fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.01em',
              cursor: submitting || !customerName || !customerPhone ? 'not-allowed' : 'pointer',
              boxShadow: submitting || !customerName || !customerPhone ? 'none' : '0 4px 16px rgba(0,0,0,0.2)',
            }}
          >
            {submitting ? 'Bitte warten...' : `Jetzt bestellen · ${total.toFixed(2)} €`}
          </button>
        </div>
      </div>
    )
  }

  function getTableStatus(table: Table, date: string, timeFrom: string, guests: number): TableStatus {
    if (table.position_x === null || table.position_y === null) return 'no-position'
    if (table.capacity < guests) return 'taken'
    const [rh, rm] = timeFrom.split(':').map(Number)
    const requestMin = rh * 60 + rm
    const hasConflict = allReservations.some(r => {
      if (r.table_id !== table.id || r.date !== date) return false
      const [eh, em] = r.time_from.split(':').map(Number)
      return Math.abs(eh * 60 + em - requestMin) < 120
    })
    if (hasConflict) return 'taken'
    return table.capacity === guests ? 'tight' : 'available'
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const freeTablesNow = tables.filter(t => {
    if (!t.active || t.position_x === null) return false
    return !allReservations.some(r => {
      if (r.table_id !== t.id || r.date !== todayStr) return false
      const [h, m] = r.time_from.split(':').map(Number)
      return Math.abs(h * 60 + m - nowMin) < 120
    })
  }).length

  const placedTables = tables.filter(t => t.position_x !== null && t.position_y !== null)
  const showFloorPlan = !!(restaurant?.floor_plan_url && placedTables.length > 0 && resDate && resTime && resGuests)

  // Menu view (light mode for home ordering)
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: pageTab === 'order' ? '100px' : '0', width: '100%', overflowX: 'hidden' }}>
      {/* Per-restaurant brand colors + fonts */}
      {restaurant && (() => {
        const pkg = getDesignPackage(restaurant.design_package)
        const accent = restaurant.primary_color ?? pkg.preview.primaryColor
        const header = restaurant.header_color ?? pkg.preview.headerColor
        const btn = restaurant.button_color ?? pkg.preview.buttonColor
        const fp = FONT_PAIRS[restaurant.font_pair ?? pkg.fontPair] ?? FONT_PAIRS['syne-dmsans']
        return (
          <style>{`
            :root, .dark {
              --accent: ${accent};
              --accent-hover: ${darken(accent, 15)};
              --accent-subtle: ${accent}18;
              --border-accent: ${accent}33;
              --header-bg: ${header};
              --btn-bg: ${btn};
              --font-heading: ${fp.heading};
              --font-body: ${fp.body};
            }
          `}</style>
        )
      })()}
      {/* Header */}
      <div style={{ background: 'var(--header-bg)', padding: '28px 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0, flex: 1 }}>
            {restaurant?.logo_url && (
              <img src={restaurant.logo_url} alt="" style={{ width: '52px', height: '52px', objectFit: 'contain', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', padding: '4px', flexShrink: 0, marginTop: '2px' }} />
            )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '5px' }}>Willkommen bei</p>
            <h1 style={{ color: 'var(--header-text)', fontWeight: 800, fontSize: 'clamp(1.2rem, 5vw, 1.6rem)', letterSpacing: '-0.02em', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{restaurant?.name}</h1>
            {restaurant?.description && (
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', marginTop: '3px', lineHeight: 1.3 }}>{restaurant.description}</p>
            )}
          </div>
          </div>{/* end logo+text wrapper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginTop: '4px' }}>
            <LanguageSelector direction="down" />
            <button
              onClick={toggleTheme}
              style={{ background: 'var(--accent)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-text)' }}
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
        {/* Page tabs */}
        <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.08)', borderRadius: '12px', padding: '4px', gap: '4px' }}>
          <span style={{ padding: '8px 16px', borderRadius: '9px', background: 'rgba(255,255,255,0.12)', color: '#FFFFFF', fontWeight: 700, fontSize: '0.8rem' }}>
            {t('order.orderTab')}
          </span>
          <a href={`/reservieren/${slug}`} style={{ padding: '8px 16px', borderRadius: '9px', background: 'transparent', color: 'rgba(255,255,255,0.45)', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none', display: 'inline-block' }}>
            {t('order.reserveTab')}
          </a>
        </div>
      </div>

      {/* Reservierungs-Tab */}
      {pageTab === 'reserve' && (
        <div style={{ padding: '24px 20px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>
          {resDone ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><PartyPopper size={56} color="var(--accent)" /></div>
              <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.3rem', marginBottom: '8px' }}>Anfrage eingegangen!</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Wir melden uns unter <strong style={{ color: 'var(--text)' }}>{resDone.customer_phone}</strong> zur Bestätigung.</p>
              <div style={{ background: 'var(--surface)', borderRadius: '14px', padding: '20px', textAlign: 'left', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Datum</span>
                    <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem' }}>{new Date(resDone.date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Uhrzeit</span>
                    <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem' }}>{resDone.time_from.slice(0, 5)} Uhr</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Personen</span>
                    <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem' }}>{resDone.guests}</span>
                  </div>
                  {resDone.table_id && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Tisch</span>
                      <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem' }}>{tables.find(t => t.id === resDone.table_id)?.label ?? 'Ausgewählt'}</span>
                    </div>
                  )}
                </div>
              </div>
              <button onClick={() => { setResDone(null); setResName(''); setResPhone(''); setResEmail(''); setResDate(''); setResTime('12:00'); setResGuests(2); setResNote('') }}
                style={{ background: 'var(--btn-bg)', border: 'none', borderRadius: '12px', padding: '13px 28px', color: 'var(--btn-text)', fontWeight: 800, cursor: 'pointer' }}>
                Weitere Reservierung
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '4px' }}>{t('order.reserveTable')}</h2>

              {/* Mode selector — only show if floor plan exists */}
              {restaurant?.floor_plan_url && placedTables.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
                  {([
                    ['any', Dices, 'Beliebiger Tisch', 'Wir wählen für dich'],
                    ['pick', Map, 'Tisch selbst wählen', 'Grundriss anzeigen'],
                  ] as const).map(([mode, ModeIcon, title, sub]) => (
                    <button
                      key={mode}
                      onClick={() => { setResMode(mode); setSelectedTableId(null) }}
                      style={{
                        padding: '14px 12px', borderRadius: '12px', border: '2px solid',
                        borderColor: resMode === mode ? 'var(--btn-bg)' : 'var(--border)',
                        background: resMode === mode ? 'var(--btn-bg)' : 'var(--surface)',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{ marginBottom: '4px', display: 'flex' }}><ModeIcon size={22} color={resMode === mode ? 'var(--btn-text)' : 'var(--text)'} /></div>
                      <div style={{ color: resMode === mode ? 'var(--btn-text)' : 'var(--text)', fontWeight: 700, fontSize: '0.875rem' }}>{title}</div>
                      <div style={{ color: resMode === mode ? 'var(--btn-text)' : 'var(--text-muted)', fontSize: '0.75rem', opacity: 0.7 }}>{sub}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* Personen */}
              <div>
                <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Personen</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button onClick={() => setResGuests(g => Math.max(1, g - 1))} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-2)', border: '1.5px solid var(--border)', color: 'var(--text)', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 700 }}>−</button>
                  <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.2rem', minWidth: '32px', textAlign: 'center' }}>{resGuests}</span>
                  <button onClick={() => setResGuests(g => Math.min(20, g + 1))} className="btn-add" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent)', border: 'none', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 700, color: 'var(--accent-text)' }}>+</button>
                </div>
              </div>

              {/* Datum + Zeit */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '100%' }}>
                <div>
                  <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Datum *</label>
                  <input type="date" value={resDate} onChange={e => setResDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Uhrzeit *</label>
                  <select value={resTime} onChange={e => setResTime(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}>
                    {Array.from({ length: 23 }, (_, i) => {
                      const h = Math.floor(i / 2) + 11
                      const m = i % 2 === 0 ? '00' : '30'
                      return `${h}:${m}`
                    }).map(t => <option key={t} value={t}>{t} Uhr</option>)}
                  </select>
                </div>
              </div>

              {/* Floor Plan — only in "pick" mode, only when date+time+guests set */}
              {resMode === 'pick' && showFloorPlan && (
                <div>
                  <div style={{ position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={restaurant!.floor_plan_url!} alt="Grundriss"
                      style={{ width: '100%', display: 'block', userSelect: 'none' }} draggable={false} />
                    {placedTables.map(table => {
                      const status = getTableStatus(table, resDate, resTime, resGuests)
                      const color = TABLE_STATUS_COLORS[status]
                      if (!color) return null
                      const isSelected = selectedTableId === table.id
                      return (
                        <div
                          key={table.id}
                          onClick={() => status !== 'taken' && setSelectedTableId(isSelected ? null : table.id)}
                          title={`${table.label} · ${table.capacity} Plätze`}
                          style={{
                            position: 'absolute',
                            left: `${table.position_x}%`, top: `${table.position_y}%`,
                            transform: 'translate(-50%, -50%)',
                            width: '36px', height: '36px', borderRadius: '50%',
                            background: color,
                            border: isSelected ? '3px solid #1a1a2e' : '2.5px solid rgba(255,255,255,0.9)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: '0.7rem', fontWeight: 700,
                            cursor: status === 'taken' ? 'not-allowed' : 'pointer',
                            boxShadow: isSelected ? '0 0 0 3px #6c63ff66' : '0 2px 6px rgba(0,0,0,0.25)',
                            zIndex: 10, transition: 'transform 0.15s',
                          }}
                        >
                          {table.table_num}
                        </div>
                      )
                    })}
                  </div>
                  {/* Legend */}
                  <div style={{ display: 'flex', gap: '14px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {[{ color: '#10b981', label: t('order.free') }, { color: '#ef4444', label: t('order.occupied') }].map(({ color, label }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
                        <span style={{ color: '#888', fontSize: '0.75rem' }}>{label}</span>
                      </div>
                    ))}
                  </div>
                  {selectedTableId ? (
                    <div style={{ background: 'var(--accent-subtle)', borderRadius: '8px', padding: '10px 14px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text)', fontSize: '0.875rem', fontWeight: 600 }}>
                        <CheckCircle2 size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />{tables.find(t => t.id === selectedTableId)?.label} ausgewählt
                      </span>
                      <button onClick={() => setSelectedTableId(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.8rem' }}>Abwählen</button>
                    </div>
                  ) : (
                    <p style={{ color: '#888', fontSize: '0.78rem', marginTop: '6px' }}>Tippe auf einen freien Tisch um ihn auszuwählen.</p>
                  )}
                </div>
              )}

              {/* Hint when pick mode but date/time not yet set */}
              {resMode === 'pick' && !showFloorPlan && restaurant?.floor_plan_url && (
                <div style={{ background: 'var(--surface)', borderRadius: '10px', padding: '14px 16px', textAlign: 'center' }}>
                  <p style={{ color: '#888', fontSize: '0.875rem' }}>Wähle Datum, Uhrzeit und Personenzahl um den Grundriss zu sehen.</p>
                </div>
              )}

              {/* Name + Tel */}
              <div>
                <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Name *</label>
                <input value={resName} onChange={e => setResName(e.target.value)} placeholder="Vor- und Nachname"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Telefon *</label>
                <input value={resPhone} onChange={e => setResPhone(e.target.value)} placeholder="+49 170 1234567" type="tel"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>E-Mail (optional)</label>
                <input value={resEmail} onChange={e => setResEmail(e.target.value)} placeholder="email@beispiel.de" type="email"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Anmerkung (optional)</label>
                <textarea value={resNote} onChange={e => setResNote(e.target.value)} placeholder="z.B. Fensterplatz, Geburtstagstorte..." rows={2}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={resConsent}
                  onChange={e => setResConsent(e.target.checked)}
                  style={{ marginTop: '3px', accentColor: 'var(--accent)', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer' }}
                />
                <span style={{ color: '#888', fontSize: '0.78rem', lineHeight: 1.5 }}>
                  Ich habe die{' '}
                  <a href="/datenschutz" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>Datenschutzerklärung</a>
                  {' '}gelesen und stimme der Verarbeitung meiner Daten zur Bearbeitung der Reservierungsanfrage zu.
                </span>
              </label>

              {resError && <p style={{ color: '#ef4444', fontSize: '0.875rem', textAlign: 'center' }}>{resError}</p>}

              <button
                onClick={submitReservation}
                disabled={resSubmitting || !resName.trim() || !resPhone.trim() || !resDate || !resConsent}
                style={{ width: '100%', padding: '16px', borderRadius: '14px', border: 'none', background: (!resName.trim() || !resPhone.trim() || !resDate || !resConsent) ? 'var(--border)' : 'var(--btn-bg)', color: (!resName.trim() || !resPhone.trim() || !resDate || !resConsent) ? 'var(--text-muted)' : 'var(--btn-text)', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', boxShadow: (!resName.trim() || !resPhone.trim() || !resDate || !resConsent) ? 'none' : '0 4px 16px rgba(0,0,0,0.2)' }}
              >
                {resSubmitting ? 'Wird gesendet...' : 'Reservierung anfragen'}
              </button>

              {/* Walk-in section */}
              <div style={{ marginTop: '8px', padding: '20px', background: 'var(--surface)', borderRadius: '14px', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{ marginBottom: '6px', display: 'flex', justifyContent: 'center' }}><PersonStanding size={28} color="var(--text-muted)" /></div>
                <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.95rem', marginBottom: '6px' }}>Ohne Reservierung</h3>
                <p style={{ color: '#888', fontSize: '0.8rem', lineHeight: 1.5 }}>
                  Einfach vorbeikommen!{freeTablesNow > 0
                    ? <> Aktuell <strong style={{ color: '#10b981' }}>{freeTablesNow} {freeTablesNow === 1 ? 'Tisch' : 'Tische'}</strong> heute noch verfügbar.</>
                    : ' Schau gerne vorbei, wir helfen dir gerne weiter.'}
                </p>
                {resGuests > 6 && (
                  <p style={{ color: '#aaa', fontSize: '0.75rem', marginTop: '6px' }}>Für Gruppen ab 6 Personen empfehlen wir eine Reservierung.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bestell-Tab */}
      {pageTab === 'order' && <>

      {/* Group active — header banner */}
      {orderMode === 'group-active' && (
        <div style={{ padding: '12px 20px', background: 'var(--accent-subtle)', borderBottom: '2px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}><Users size={14} /> Gruppe aktiv</span>
              <span style={{ background: 'var(--accent)', color: 'var(--accent-text)', borderRadius: '8px', padding: '2px 10px', fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.1em' }}>{groupCode}</span>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={async () => {
                const url = `${window.location.origin}/bestellen/${slug}?group=${groupCode}`
                await navigator.clipboard.writeText(url)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              style={{ padding: '6px 12px', borderRadius: '8px', border: '1.5px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
            >
              {copied ? <><CheckCircle2 size={13} /> {t('order.copied')}</> : <><Link size={13} /> Link teilen</>}
            </motion.button>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Hallo <strong style={{ color: 'var(--text)' }}>{memberName}</strong> · {groupItems.length > 0 ? `${groupItems.reduce((s,gi)=>s+gi.qty,0)} Artikel im Gruppenkorb` : 'Noch keine Artikel'}
          </p>
          {/* Live group items preview */}
          {groupItems.length > 0 && (() => {
            const byPerson: Record<string, GroupItem[]> = {}
            groupItems.forEach(gi => { if (!byPerson[gi.added_by]) byPerson[gi.added_by] = []; byPerson[gi.added_by].push(gi) })
            return (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {Object.entries(byPerson).map(([name, items]) => (
                  <div key={name} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>{name}:</span> {items.map(gi => `${gi.qty}× ${gi.name}`).join(', ')}
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* Group pay view — als Overlay, geöffnet via floating button */}

      {/* Order type toggle */}
      <div style={{ background: 'var(--surface)', padding: '14px 20px 12px', borderBottom: '1px solid #EEECE8', display: 'flex', gap: '8px' }}>
        {(['pickup', 'delivery'] as OrderType[]).map(type => (
          <button key={type} onClick={() => setOrderType(type)} style={{
            padding: '7px 16px', borderRadius: '20px', border: 'none',
            background: orderType === type ? 'var(--btn-bg)' : 'var(--surface-2)',
            color: orderType === type ? 'var(--btn-text)' : 'var(--text-muted)',
            fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
          }}>
            {type === 'pickup' ? `↗ ${t('order.pickup')}` : `→ ${t('order.delivery')}`}
          </button>
        ))}
      </div>

      {/* Category tabs + filter toggle */}
      {categories.length > 0 && (
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
              <div style={{ display: 'flex', padding: '10px 16px', gap: '8px', minWidth: 'max-content' }}>
                {categories.map(cat => (
                  <motion.button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    whileTap={{ scale: 0.93 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    style={{
                      padding: '7px 16px', borderRadius: '20px', border: 'none',
                      background: 'transparent',
                      color: activeCategory === cat.id ? '#fff' : 'var(--text-muted)',
                      fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap',
                      position: 'relative',
                    }}
                  >
                    {activeCategory === cat.id && (
                      <motion.span
                        layoutId="activeCategoryPill"
                        style={{ position: 'absolute', inset: 0, borderRadius: '20px', background: 'var(--accent)', zIndex: -1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    {cat.name}
                  </motion.button>
                ))}
              </div>
            </div>
            {/* Filter button */}
            <motion.button
              onClick={() => setShowFilters(f => !f)}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              style={{
                position: 'relative', flexShrink: 0, margin: '0 12px',
                background: filterCount > 0 ? 'var(--accent-subtle)' : 'var(--surface-2)',
                border: `1.5px solid ${filterCount > 0 ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '20px', padding: '6px 12px',
                color: filterCount > 0 ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <Search size={14} /> Filter{filterCount > 0 ? ` (${filterCount})` : ''}
            </motion.button>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            style={{ overflow: 'hidden', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}
          >
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '600px', margin: '0 auto' }}>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Diät & Merkmale</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {DIETARY_FILTERS.map(({ key, label }) => {
                    const active = activeDietary.includes(key)
                    return (
                      <motion.button key={key} onClick={() => setActiveDietary(prev => active ? prev.filter(d => d !== key) : [...prev, key])}
                        whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                        style={{ padding: '6px 13px', borderRadius: '20px', border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-subtle)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-muted)', fontWeight: active ? 700 : 500, fontSize: '0.8rem', cursor: 'pointer' }}>
                        {label}
                      </motion.button>
                    )
                  })}
                </div>
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Allergene ausschließen</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {ALLERGEN_FILTERS.map(a => {
                    const active = excludedAllergens.includes(a)
                    return (
                      <motion.button key={a} onClick={() => setExcludedAllergens(prev => active ? prev.filter(x => x !== a) : [...prev, a])}
                        whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                        style={{ padding: '6px 13px', borderRadius: '20px', border: `1.5px solid ${active ? '#ef4444' : 'var(--border)'}`, background: active ? 'rgba(239,68,68,0.08)' : 'transparent', color: active ? '#ef4444' : 'var(--text-muted)', fontWeight: active ? 700 : 500, fontSize: '0.8rem', cursor: 'pointer' }}>
                        {a}
                      </motion.button>
                    )
                  })}
                </div>
              </div>
              {filterCount > 0 && (
                <button onClick={() => { setActiveDietary([]); setExcludedAllergens([]) }}
                  style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.78rem', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                  <X size={12} style={{ verticalAlign: 'middle', marginRight: '3px' }} />Filter zurücksetzen
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SmartFilter */}
      {restaurant && (restaurant.plan === 'pro' || restaurant.plan === 'enterprise') && (
        <div style={{ padding: '0 16px', maxWidth: '600px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <SmartFilter
            restaurantId={restaurant.id}
            items={items.map(i => ({
              id: i.id,
              name: i.name,
              description: i.description ?? null,
              allergens: (i.allergens as string[] | null) ?? null,
              tags: (i.tags as string[] | null) ?? null,
            }))}
            accentColor={restaurant.primary_color ?? '#6c63ff'}
            onFilterChange={setFilterResult}
          />
        </div>
      )}

      {/* Items */}
      <div style={{ padding: '20px 16px', maxWidth: '600px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {categories.map(cat => {
          const catItems = filterItems(items.filter(i => i.category_id === cat.id))
          if (catItems.length === 0) return null
          return (
            <div key={cat.id} ref={el => { categoryRefs.current[cat.id] = el }} style={{ marginBottom: '36px' }}>
              <h2 style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1rem', marginBottom: '14px', paddingTop: '4px', letterSpacing: '-0.01em' }}>
                {cat.name}
              </h2>
              <MenuItemGrid layout={(restaurant?.layout_variant as 'cards' | 'list' | 'grid' | 'large-cards') ?? getDesignPackage(restaurant?.design_package).layoutVariant}>
                {catItems.map((item, idx) => {
                  const qty = getQty(item.id)
                  const displayName = (item.translations as Record<string, {name: string; description: string}> | null | undefined)?.[lang]?.name ?? item.name
                  const displayDesc = (item.translations as Record<string, {name: string; description: string}> | null | undefined)?.[lang]?.description ?? item.description
                  return (
                    <div
                      key={item.id}
                      style={{
                        opacity: getItemSuitability(item.id) === 'unsuitable' ? 0.4 : 1,
                        transition: 'opacity 0.3s',
                        position: 'relative',
                      }}
                    >
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
                      <MenuItemCard
                        item={item}
                        qty={qty}
                        layout={(restaurant?.layout_variant as 'cards' | 'list' | 'grid' | 'large-cards') ?? getDesignPackage(restaurant?.design_package).layoutVariant}
                        displayName={displayName}
                        displayDesc={displayDesc}
                        index={idx}
                        special={specials[item.id]}
                        onOpen={() => setSelectedItem(item)}
                        onAdd={() => orderMode === 'group-active' ? addToGroupCart(item) : addToCart(item)}
                        onRemove={() => orderMode === 'group-active' ? removeFromGroupCart(item) : removeFromCart(item.id)}
                      />
                    </div>
                  )
                })}
              </MenuItemGrid>
            </div>
          )
        })}

        {items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}><Bell size={48} color="var(--text-muted)" /></div>
            <p style={{ color: 'var(--text-muted)' }}>Noch keine Menüpunkte vorhanden.</p>
          </div>
        )}
      </div>

      {/* Chat Widget */}
      {view === 'menu' && pageTab === 'order' && restaurant && (
        <ChatWidget
          restaurantSlug={params.slug as string}
          restaurantName={restaurant.name}
          items={items}
          cart={cart.map(c => ({ name: c.item.name, qty: c.qty }))}
          accentColor={restaurant.primary_color ?? undefined}
          onAddToCart={(itemId, _name, qty) => {
            const found = items.find(i => i.id === itemId)
            if (!found) return
            setCart(prev => {
              const existing = prev.find(c => c.item.id === itemId)
              if (existing) return prev.map(c => c.item.id === itemId ? { ...c, qty: c.qty + qty } : c)
              return [...prev, { item: found, qty }]
            })
          }}
        />
      )}

      {/* Floating Cart Button */}
      <AnimatePresence>
        {(orderMode === 'group-active' ? cartCount > 0 || (isGroupCreator && groupItems.length > 0) : cartCount > 0) && (
          <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            style={{ position: 'fixed', bottom: '24px', left: '16px', right: '16px', zIndex: 100 }}
          >
            <motion.button
              onClick={() => setShowCart(true)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              style={{
                background: 'var(--accent)', border: 'none', borderRadius: '50px',
                padding: '16px 22px 16px 16px', color: 'var(--accent-text)', fontWeight: 700,
                cursor: 'pointer', fontSize: '0.95rem',
                boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                display: 'flex', alignItems: 'center', gap: '14px', width: '100%',
                justifyContent: 'center',
              }}
            >
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={cartCount}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 16 }}
                  style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '20px', padding: '3px 10px', fontSize: '0.82rem', fontWeight: 800, display: 'inline-block' }}
                >{orderMode === 'group-active' ? groupItems.reduce((s,gi)=>s+gi.qty,0) : cartCount}</motion.span>
              </AnimatePresence>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><ShoppingCart size={16} /> {t('order.cart')}</span>
              <span style={{ opacity: 0.6 }}>·</span>
              <span style={{ fontWeight: 800 }}>{total.toFixed(2)} €</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Bottom Sheet */}
      <AnimatePresence>
        {showCart && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }}
            />
            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.3 }}
              onDragEnd={(_, info) => { if (info.offset.y > 80) setShowCart(false) }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
                background: 'var(--surface)', borderRadius: '24px 24px 0 0',
                maxHeight: '82vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
                cursor: 'grab',
              }}
            >
              {/* Handle + header */}
              <div style={{ padding: '12px 20px 0', textAlign: 'center' }}>
                <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'var(--border)', margin: '0 auto 16px', cursor: 'grab' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h2 style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>
                    {orderMode === 'group-active' ? <><Users size={16} style={{ verticalAlign: 'middle', marginRight: '5px' }} />Gruppenkorb · {groupCode}</> : <><ShoppingCart size={16} style={{ verticalAlign: 'middle', marginRight: '5px' }} />Dein Warenkorb</>}
                  </h2>
                  <button
                    onClick={() => setShowCart(false)}
                    style={{ background: 'var(--surface-2)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >×</button>
                </div>
              </div>

              {/* Items list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', cursor: 'default' }} onPointerDown={e => e.stopPropagation()}>
                {orderMode === 'group-active' ? (
                  /* Group cart: items grouped by person */
                  (() => {
                    const byPerson: Record<string, GroupItem[]> = {}
                    groupItems.forEach(gi => {
                      if (!byPerson[gi.added_by]) byPerson[gi.added_by] = []
                      byPerson[gi.added_by].push(gi)
                    })
                    if (groupItems.length === 0) {
                      return <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '32px 0' }}>Noch niemand hat etwas hinzugefügt.</p>
                    }
                    return Object.entries(byPerson).map(([person, pItems]) => (
                      <div key={person} style={{ marginBottom: '20px' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                          {person === memberName ? `${person} (du)` : person}
                        </p>
                        {pItems.map(gi => (
                          <motion.div
                            key={gi.id}
                            layout
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem' }}>{gi.name}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{(gi.price * gi.qty).toFixed(2)} €</div>
                            </div>
                            {/* Only own items are editable */}
                            {person === memberName ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <motion.button
                                  whileTap={{ scale: 0.85 }}
                                  onClick={() => {
                                    const menuItem = items.find(i => i.id === gi.item_id)
                                    if (menuItem) removeFromGroupCart(menuItem)
                                  }}
                                  style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >−</motion.button>
                                <span style={{ color: 'var(--text)', fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{gi.qty}</span>
                                <motion.button
                                  whileTap={{ scale: 0.85 }}
                                  onClick={() => {
                                    const menuItem = items.find(i => i.id === gi.item_id)
                                    if (menuItem) addToGroupCart(menuItem)
                                  }}
                                  style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >+</motion.button>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.9rem' }}>×{gi.qty}</span>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    ))
                  })()
                ) : (
                  /* Solo cart */
                  cart.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '32px 0' }}>Dein Warenkorb ist leer.</p>
                  ) : (
                    cart.map(({ item, qty }) => (
                      <motion.div
                        key={item.id}
                        layout
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--border)' }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{(item.price * qty).toFixed(2)} €</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <motion.button
                            whileTap={{ scale: 0.85 }}
                            onClick={() => removeFromCart(item.id)}
                            style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >−</motion.button>
                          <span style={{ color: 'var(--text)', fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{qty}</span>
                          <motion.button
                            whileTap={{ scale: 0.85 }}
                            onClick={() => addToCart(item)}
                            style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >+</motion.button>
                        </div>
                      </motion.div>
                    ))
                  )
                )}
              </div>

              {/* Footer: total + action */}
              <div style={{ padding: '16px 20px 32px', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('order.total')}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.1rem' }}>{total.toFixed(2)} €</span>
                </div>
                {orderMode === 'group-active' ? (
                  isGroupCreator ? (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setShowCart(false); submitGroupOrder() }}
                      disabled={submitting || groupItems.length === 0}
                      style={{
                        width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
                        background: groupItems.length > 0 ? 'var(--accent)' : 'var(--border)',
                        color: groupItems.length > 0 ? '#fff' : 'var(--text-muted)',
                        fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
                      }}
                    >{submitting ? 'Wird bestellt...' : <><CheckCircle2 size={15} style={{ verticalAlign: 'middle', marginRight: '5px' }} />Gruppe bestellen</>}</motion.button>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '8px 0' }}>
                      Warte auf den Gruppenersteller zum Abschließen.
                    </div>
                  )
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setShowCart(false); setView('checkout') }}
                    disabled={cart.length === 0}
                    style={{
                      width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
                      background: cart.length > 0 ? 'var(--accent)' : 'var(--border)',
                      color: cart.length > 0 ? '#fff' : 'var(--text-muted)',
                      fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
                    }}
                  >Zur Bestellung →</motion.button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Item Detail — Vollbild (like tisch app) */}
      <AnimatePresence>
      {selectedItem && (
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 32 }}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg)', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', gap: '12px', flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => setSelectedItem(null)}
              style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-2)', border: 'none', color: 'var(--text)', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >←</button>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', flex: 1 }}>
              {categories.find(c => c.id === selectedItem.category_id)?.name}
            </span>
          </div>

          {/* Bild links + Info rechts */}
          {(() => {
            const detailName = (selectedItem.translations as Record<string, {name: string; description: string}> | null | undefined)?.[lang]?.name ?? selectedItem.name
            const detailDesc = (selectedItem.translations as Record<string, {name: string; description: string}> | null | undefined)?.[lang]?.description ?? selectedItem.description
            return (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Bild links */}
            <div style={{ flex: '1 1 300px', minHeight: '280px', maxHeight: '480px' }}>
              {selectedItem.image_url ? (
                <img
                  src={selectedItem.image_url}
                  alt={detailName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: '280px', maxHeight: '480px' }}
                />
              ) : (
                <div style={{ width: '100%', minHeight: '280px', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UtensilsCrossed size={64} color="var(--border)" style={{ opacity: 0.5 }} />
                </div>
              )}
            </div>

            {/* Info rechts */}
            <div style={{ flex: '1 1 280px', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '0' }}>
              <h1 style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.6rem', lineHeight: 1.2, marginBottom: '10px', fontFamily: 'var(--font-heading), system-ui, sans-serif', letterSpacing: '-0.03em' }}>
                {detailName}
              </h1>
              <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1.5rem' }}>{selectedItem.price.toFixed(2)} €</span>

              {detailDesc && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.7, margin: '18px 0 0' }}>
                  {detailDesc}
                </p>
              )}

              {selectedItem.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
                  {selectedItem.tags.map(tag => (
                    <span key={tag} style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '5px 12px', borderRadius: '20px', border: '1px solid var(--border)' }}>{tag}</span>
                  ))}
                </div>
              )}

              {/* Menge + Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', flexShrink: 0 }}>
                  <button
                    onClick={() => setDetailQty(q => Math.max(1, q - 1))}
                    style={{ width: '44px', height: '44px', background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '1.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >−</button>
                  <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem', minWidth: '28px', textAlign: 'center' }}>{detailQty}</span>
                  <button
                    onClick={() => setDetailQty(q => q + 1)}
                    style={{ width: '44px', height: '44px', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '1.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >+</button>
                </div>
                <motion.button
                  onClick={() => {
                    const existing = cart.find(c => c.item.id === selectedItem.id)
                    if (existing) {
                      setCart(prev => prev.map(c => c.item.id === selectedItem.id ? { ...c, qty: detailQty } : c))
                    } else {
                      for (let i = 0; i < detailQty; i++) addToCart(selectedItem)
                    }
                    setSelectedItem(null)
                  }}
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  style={{ flex: 1, height: '44px', borderRadius: '12px', background: 'var(--accent)', border: 'none', color: 'var(--accent-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 700 }}
                >
                  {t('order.addToCart')} · {(selectedItem.price * detailQty).toFixed(2)} €
                </motion.button>
              </div>
            </div>
          </div>
            )
          })()}
        </motion.div>
      )}
      </AnimatePresence>
      </>}

      {/* Footer */}
      <div style={{ padding: '32px 24px 24px', textAlign: 'center', borderTop: '1px solid var(--border)', marginTop: '40px' }}>
        <p style={{ color: '#bbb', fontSize: '0.72rem', marginBottom: '8px', letterSpacing: '0.05em' }}>Powered by RestaurantOS</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
          <a href="/impressum" style={{ color: '#aaa', fontSize: '0.75rem', textDecoration: 'none' }}>Impressum</a>
          <a href="/datenschutz" style={{ color: '#aaa', fontSize: '0.75rem', textDecoration: 'none' }}>Datenschutz</a>
        </div>
      </div>
    </div>
  )
}

// Returns a human-readable "closed" message, or null if currently open.
// opening_hours = null means no hours configured → always open
function getClosedInfo(
  opening_hours: Record<string, { open: string; close: string; closed: boolean }> | null
): string | null {
  if (!opening_hours) return null
  const now = new Date()
  // JS getDay(): 0=Sun,1=Mon,...,6=Sat → convert to Mon=0,...,Sun=6
  const jsDay = now.getDay()
  const key = String(jsDay === 0 ? 6 : jsDay - 1)
  const dh = opening_hours[key]
  if (!dh) return null
  if (dh.closed) {
    // Find next open day
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
