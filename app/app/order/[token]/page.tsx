'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { buildColors } from '@/lib/color-utils'
import type { MenuItem, MenuCategory, Order, Table, Restaurant, GroupItem, OrderGroup } from '@/types/database'
import GroupPayView from './GroupPayView'
import ChatWidget from '@/components/ChatWidget'
import { useLanguage } from '@/components/providers/language-provider'
import { LanguageSelector } from '@/components/ui/language-selector'

type CartItem = { item: MenuItem; qty: number; note: string }
type View = 'menu' | 'cart' | 'status'
type GroupMode = 'none' | 'create' | 'join' | 'active' | 'group-pay'


const ALLERGEN_FILTERS = [
  'Gluten', 'Nüsse', 'Milch', 'Eier', 'Fisch',
  'Meeresfrüchte', 'Soja', 'Sellerie', 'Senf', 'Sesam',
]

// C is derived per-render from restaurant branding (see buildColors call inside component)

const spring = { type: 'spring' as const, stiffness: 420, damping: 26 }
const springBouncy = { type: 'spring' as const, stiffness: 500, damping: 18 }

function SkeletonBlock({ w = '100%', h = '18px', r = '8px' }: { w?: string; h?: string; r?: string }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, #131313 25%, #1c1c1c 50%, #131313 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease-in-out infinite',
    }} />
  )
}

function ItemCard({
  item, qty, isFav, index, C, special, lang,
  onOpen, onAdd, onRemove, onFav,
}: {
  item: MenuItem; qty: number; isFav: boolean; index: number; C: Record<string, string>
  special?: { label: string; special_price: number | null }
  lang?: string
  onOpen: () => void; onAdd: () => void; onRemove: () => void; onFav: () => void
}) {
  const translations = item.translations as Record<string, { name: string; description: string }> | null | undefined
  const displayName = (lang && translations?.[lang]?.name) ? translations[lang].name : item.name
  const displayDesc = (lang && translations?.[lang]?.description) ? translations[lang].description : item.description
  const inCart = qty > 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: index * 0.04 }}
      whileHover={{ y: -2, transition: { duration: 0.18 } }}
      onClick={onOpen}
      style={{
        background: C.surface,
        borderRadius: '16px',
        padding: '14px 14px 14px 14px',
        display: 'flex',
        gap: '13px',
        alignItems: 'center',
        border: `1px solid ${inCart ? C.accentGlow : C.border}`,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        boxShadow: inCart ? `0 0 0 1px ${C.accent}22, 0 4px 20px rgba(255,107,53,0.08)` : 'none',
      }}
    >
      {/* In-cart warm glow */}
      {inCart && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(ellipse at 80% 50%, rgba(255,107,53,0.04) 0%, transparent 70%)', pointerEvents: 'none' }}
        />
      )}

      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.name}
          style={{ width: '68px', height: '68px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div style={{ width: '68px', height: '68px', borderRadius: '10px', background: C.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '1.8rem', opacity: 0.3 }}>🍽</span>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {special && (
          <span style={{ display: 'inline-block', background: '#f59e0b18', color: '#f59e0b', fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', marginBottom: '4px', letterSpacing: '0.02em' }}>
            🔥 {special.label}
          </span>
        )}
        <p style={{ color: C.text, fontWeight: 600, fontSize: '0.92rem', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
        {displayDesc && (
          <p style={{ color: C.muted, fontSize: '0.78rem', marginBottom: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>{displayDesc}</p>
        )}
        {item.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '5px' }}>
            {item.tags.slice(0, 3).map(tag => (
              <span key={tag} style={{ background: C.surface2, color: C.muted, fontSize: '0.62rem', padding: '2px 7px', borderRadius: '5px', fontWeight: 600, letterSpacing: '0.02em' }}>{tag}</span>
            ))}
          </div>
        )}
        {special?.special_price != null ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <p style={{ color: C.accent, fontWeight: 700, fontSize: '0.95rem' }}>{Number(special.special_price).toFixed(2)} €</p>
            <p style={{ color: C.muted, fontWeight: 500, fontSize: '0.8rem', textDecoration: 'line-through' }}>{item.price.toFixed(2)} €</p>
          </div>
        ) : (
          <p style={{ color: C.accent, fontWeight: 700, fontSize: '0.95rem' }}>{item.price.toFixed(2)} €</p>
        )}
      </div>

      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
        {/* Fav */}
        <motion.button
          onClick={onFav}
          whileTap={{ scale: 0.78 }}
          transition={springBouncy}
          style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isFav ? C.accent : C.muted2 }}
        >{isFav ? '♥' : '♡'}</motion.button>

        <AnimatePresence mode="popLayout">
          {qty > 0 && (
            <motion.button
              key="minus"
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
              transition={springBouncy}
              onClick={onRemove}
              style={{ width: '30px', height: '30px', borderRadius: '50%', background: C.surface2, border: `1px solid ${C.border}`, color: C.text, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
            >−</motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence mode="popLayout">
          {qty > 0 && (
            <motion.span
              key={qty}
              initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}
              transition={springBouncy}
              style={{ color: C.text, fontWeight: 800, minWidth: '18px', textAlign: 'center', fontSize: '0.9rem' }}
            >{qty}</motion.span>
          )}
        </AnimatePresence>

        <motion.button
          onClick={onAdd}
          whileTap={{ scale: 0.78 }}
          transition={springBouncy}
          style={{ width: '32px', height: '32px', borderRadius: '50%', background: C.accent, border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, boxShadow: qty > 0 ? `0 2px 12px ${C.accentGlow}` : 'none' }}
        >+</motion.button>
      </div>
    </motion.div>
  )
}

export default function OrderPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const token = params.token as string

  const { lang, t } = useLanguage()

  const STATUS_ICONS: Record<string, string> = {
    new: '📋', cooking: '👨‍🍳', served: '✅', cancelled: '❌',
  }

  const DIETARY_FILTERS = [
    { key: 'vegetarisch', label: t('order.dietary.vegetarisch') },
    { key: 'vegan',       label: t('order.dietary.vegan') },
    { key: 'glutenfrei',  label: t('order.dietary.glutenfrei') },
    { key: 'laktosefrei', label: t('order.dietary.laktosefrei') },
    { key: 'scharf',      label: t('order.dietary.scharf') },
  ]

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
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [showFavorites, setShowFavorites] = useState(false)
  const [detailQty, setDetailQty] = useState(1)
  const [detailNote, setDetailNote] = useState('')
  const [tipPercent, setTipPercent] = useState<number | null>(null)
  const [customTip, setCustomTip] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'later' | null>(null)
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const [specials, setSpecials] = useState<Record<string, { label: string; special_price: number | null }>>({})

  // Filters
  const [activeDietary, setActiveDietary] = useState<string[]>([])
  const [excludedAllergens, setExcludedAllergens] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)

  // Hamburger menu + group ordering
  const [showMenu, setShowMenu] = useState(false)
  const [groupMode, setGroupMode] = useState<GroupMode>('none')
  const [groupCode, setGroupCode] = useState('')
  const [groupId, setGroupId] = useState('')
  const [memberName, setMemberName] = useState('')
  const [groupItems, setGroupItems] = useState<GroupItem[]>([])
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [groupLoading, setGroupLoading] = useState(false)
  const [groupError, setGroupError] = useState('')
  const [isGroupCreator, setIsGroupCreator] = useState(false)
  const [copiedGroup, setCopiedGroup] = useState(false)
  const [showGroupPay, setShowGroupPay] = useState(false)

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

      const [{ data: cats }, { data: menuItems }, { data: specialsData }] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).eq('active', true).order('sort_order'),
        supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).eq('available', true).order('sort_order'),
        supabase.from('daily_specials').select('menu_item_id, label, special_price').eq('restaurant_id', restaurantId).eq('active', true),
      ])

      setCategories(cats || [])
      setItems(menuItems || [])
      setSpecials(Object.fromEntries((specialsData || []).map(s => [s.menu_item_id, { label: s.label, special_price: s.special_price }])))
      if (cats && cats.length > 0) setActiveCategory(cats[0].id)
      setLoading(false)
    }
    load()
  }, [token])

  useEffect(() => {
    if (!restaurant) return
    const rId = restaurant.id
    async function reloadMenu() {
      const [{ data: cats }, { data: menuItems }] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('restaurant_id', rId).eq('active', true).order('sort_order'),
        supabase.from('menu_items').select('*').eq('restaurant_id', rId).eq('available', true).order('sort_order'),
      ])
      if (cats) setCategories(cats)
      if (menuItems) setItems(menuItems)
    }
    const ch = supabase.channel(`menu-${rId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items', filter: `restaurant_id=eq.${rId}` }, reloadMenu)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_categories', filter: `restaurant_id=eq.${rId}` }, reloadMenu)
      .subscribe()

    // Live branding updates
    const brandCh = supabase.channel(`brand-${rId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restaurants', filter: `id=eq.${rId}` },
        (payload) => { setRestaurant(prev => prev ? { ...prev, ...(payload.new as Partial<Restaurant>) } : null) })
      .subscribe()

    return () => { supabase.removeChannel(ch); supabase.removeChannel(brandCh) }
  }, [restaurant])

  useEffect(() => {
    if (selectedItem) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = `${scrollbarWidth}px`
      const cartItem = cart.find(c => c.item.id === selectedItem.id)
      setDetailQty(cartItem ? cartItem.qty : 1)
      setDetailNote(cartItem ? cartItem.note : '')
    } else {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
    return () => { document.body.style.overflow = ''; document.body.style.paddingRight = '' }
  }, [selectedItem])

  useEffect(() => {
    const stored = localStorage.getItem('favorites')
    if (stored) setFavorites(new Set(JSON.parse(stored)))
  }, [])

  function toggleFavorite(itemId: string) {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId)
      localStorage.setItem('favorites', JSON.stringify([...next]))
      return next
    })
  }

  useEffect(() => {
    if (!order) return
    const ch = supabase.channel(`order-${order.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` },
        (payload) => { setOrder(prev => prev ? { ...prev, ...(payload.new as Partial<Order>) } : null) })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [order])

  useEffect(() => {
    const code = searchParams.get('group')
    if (code) {
      setJoinCodeInput(code.toUpperCase())
      setGroupMode('join')
      setShowMenu(true)
    }

    const groupPaid = searchParams.get('group_paid')
    const paidMember = searchParams.get('member')
    if (groupPaid && paidMember) {
      setGroupId(groupPaid)
      setMemberName(decodeURIComponent(paidMember))
      setGroupMode('group-pay')
      supabase.from('group_items').select('*').eq('group_id', groupPaid).then(({ data }) => {
        if (data) setGroupItems(data as GroupItem[])
      })
    }
  }, [searchParams])

  // After Stripe redirect: load order and show status
  useEffect(() => {
    const orderId = searchParams.get('order_id')
    const paymentSuccess = searchParams.get('payment') === 'success'
    if (!orderId || !paymentSuccess) return
    supabase.from('orders').select('*').eq('id', orderId).maybeSingle().then(({ data }) => {
      if (data) { setOrder(data as Order); setView('status') }
    })
  }, [searchParams])

  useEffect(() => {
    if (!groupId) return
    supabase.from('group_items').select('*').eq('group_id', groupId).order('created_at').then(({ data }) => {
      if (data) setGroupItems(data as GroupItem[])
    })
    const ch = supabase.channel(`grp-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_items', filter: `group_id=eq.${groupId}` }, () => {
        supabase.from('group_items').select('*').eq('group_id', groupId).order('created_at').then(({ data }) => {
          if (data) setGroupItems(data as GroupItem[])
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [groupId])

  function generateGroupCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  async function createGroup() {
    if (!restaurant || !memberName.trim()) return
    setGroupLoading(true); setGroupError('')
    const code = generateGroupCode()
    const { data, error: err } = await supabase.from('order_groups').insert({
      restaurant_id: restaurant.id, table_id: table?.id ?? null, group_code: code, status: 'active',
    }).select().single()
    if (err || !data) { setGroupError('Fehler beim Erstellen.'); setGroupLoading(false); return }
    const g = data as OrderGroup
    setGroupCode(g.group_code); setGroupId(g.id); setIsGroupCreator(true)
    setGroupMode('active'); setGroupLoading(false); setShowMenu(false)
  }

  async function joinGroup() {
    if (!joinCodeInput.trim() || !memberName.trim()) return
    setGroupLoading(true); setGroupError('')
    const { data, error: err } = await supabase.from('order_groups')
      .select('*').eq('group_code', joinCodeInput.toUpperCase()).eq('status', 'active').single()
    if (err || !data) { setGroupError('Gruppe nicht gefunden.'); setGroupLoading(false); return }
    const g = data as OrderGroup
    setGroupCode(g.group_code); setGroupId(g.id); setIsGroupCreator(false)
    setGroupMode('active'); setGroupLoading(false); setShowMenu(false)
  }

  async function addToGroupCart(item: MenuItem) {
    if (!groupId || !memberName) return
    const existing = groupItems.find(gi => gi.added_by === memberName && gi.item_id === item.id)
    if (existing) {
      await supabase.from('group_items').update({ qty: existing.qty + 1 }).eq('id', existing.id)
    } else {
      await supabase.from('group_items').insert({ group_id: groupId, added_by: memberName, item_id: item.id, name: item.name, price: item.price, qty: 1 })
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
    if (!groupId || !restaurant) return

    const members = [...new Set(groupItems.map(gi => gi.added_by))]

    const payments = members.map(member => {
      const memberItems = groupItems.filter(gi => gi.added_by === member)
      const amount = memberItems.reduce((s, i) => s + i.price * i.qty, 0)
      return {
        group_id: groupId,
        member_name: member,
        amount: Math.round(amount * 100) / 100,
        status: 'pending' as const,
      }
    })

    const { error: insertError } = await supabase.from('group_payments').insert(payments)
    if (insertError) {
      console.error('Failed to create group payments:', insertError)
      return
    }

    await supabase.from('order_groups').update({ status: 'submitted' }).eq('id', groupId)
    setGroupMode('group-pay')
  }

  function getGroupQty(itemId: string) {
    return groupItems.filter(gi => gi.added_by === memberName && gi.item_id === itemId).reduce((s, gi) => s + gi.qty, 0)
  }

  function addItem(item: MenuItem) {
    if (groupMode === 'active') addToGroupCart(item); else addToCart(item)
  }

  function removeItem(item: MenuItem) {
    if (groupMode === 'active') removeFromGroupCart(item); else removeFromCart(item.id)
  }

  function getItemQty(itemId: string) {
    return groupMode === 'active' ? getGroupQty(itemId) : getQty(itemId)
  }

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id)
      if (existing) return prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { item, qty: 1, note: '' }]
    })
  }

  function addToCartWithDetails(item: MenuItem, qty: number, note: string) {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id)
      if (existing) return prev.map(c => c.item.id === item.id ? { ...c, qty, note } : c)
      return [...prev, { item, qty, note }]
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

  async function callWaiter(type: 'waiter' | 'bill') {
    if (!table || !restaurant) return
    await supabase.from('service_calls').insert({ restaurant_id: restaurant.id, table_id: table.id, type })
  }

  const subtotal = cart.reduce((sum, c) => sum + c.item.price * c.qty, 0)
  const tipAmount = tipPercent === -1 ? parseFloat(customTip.replace(',', '.')) || 0
    : tipPercent !== null ? subtotal * tipPercent / 100 : 0
  const total = subtotal + tipAmount
  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0)

  async function submitOrderLater() {
    if (!table || !restaurant) return
    setSubmitting(true); setError('')
    const { data, error: err } = await supabase.from('orders').insert({
      restaurant_id: restaurant.id, order_type: 'dine_in', table_id: table.id,
      status: 'new', items: cart.map(c => ({ item_id: c.item.id, name: c.item.name, price: c.item.price, qty: c.qty, note: c.note || null })),
      note: note || null, total: parseFloat(subtotal.toFixed(2)),
    }).select().single()
    if (err || !data) { setError('Fehler beim Bestellen. Bitte versuche es erneut.'); setSubmitting(false); return }
    setOrder(data as Order); setView('status'); setSubmitting(false)
  }

  async function submitOrderOnline() {
    if (!table || !restaurant) return
    setSubmitting(true); setError('')
    // Insert with pending_payment — webhook sets it to 'new' after payment
    const { data, error: err } = await supabase.from('orders').insert({
      restaurant_id: restaurant.id, order_type: 'dine_in', table_id: table.id,
      status: 'pending_payment',
      items: cart.map(c => ({ item_id: c.item.id, name: c.item.name, price: c.item.price, qty: c.qty, note: c.note || null })),
      note: note || null, total: parseFloat(total.toFixed(2)),
    }).select('id, guest_token').single()
    if (err || !data) { setError('Fehler beim Erstellen der Bestellung.'); setSubmitting(false); return }

    const res = await fetch('/api/stripe/table-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: data.id, guest_token: data.guest_token, token }),
    })
    const json = await res.json()
    if (!res.ok || !json.url) { setError(json.error ?? 'Stripe-Fehler.'); setSubmitting(false); return }
    window.location.href = json.url
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

  // Derived colors — updates automatically when restaurant branding loads
  const C = buildColors(restaurant?.primary_color, restaurant?.surface_color)

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: '100px' }}>
        <style>{`@keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }`}</style>
        {/* Header skeleton */}
        <div style={{ background: C.surface, padding: '20px 20px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <SkeletonBlock w="160px" h="22px" r="6px" />
            <SkeletonBlock w="80px" h="14px" r="5px" />
          </div>
          <SkeletonBlock w="40px" h="40px" r="10px" />
        </div>
        {/* Category tabs skeleton */}
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '12px 16px', display: 'flex', gap: '8px' }}>
          {[70, 90, 60, 80].map((w, i) => <SkeletonBlock key={i} w={`${w}px`} h="30px" r="20px" />)}
        </div>
        {/* Items skeleton */}
        <div style={{ padding: '20px 16px', maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SkeletonBlock w="100px" h="16px" r="6px" />
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ background: C.surface, borderRadius: '16px', padding: '14px', display: 'flex', gap: '13px', alignItems: 'center', border: `1px solid ${C.border}` }}>
              <SkeletonBlock w="68px" h="68px" r="10px" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <SkeletonBlock w="60%" h="14px" />
                <SkeletonBlock w="80%" h="11px" />
                <SkeletonBlock w="40px" h="14px" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── Error ─────────────────────────────────────────────────────────────────
  if (error && !restaurant) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, padding: '24px' }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>❌</div>
          <p style={{ color: C.text, fontWeight: 700, marginBottom: '8px', fontSize: '1.1rem' }}>QR-Code ungültig</p>
          <p style={{ color: C.muted, fontSize: '0.875rem' }}>{error}</p>
        </motion.div>
      </div>
    )
  }

  // ─── Status View ───────────────────────────────────────────────────────────
  if (view === 'status' && order) {
    const statusIcon = STATUS_ICONS[order.status] ?? STATUS_ICONS.new
    const statusLabel = t(`order.status.${order.status}`) || t('order.status.new')
    const statusIdx = ['new', 'cooking', 'served'].indexOf(order.status)
    const isServed = order.status === 'served'
    const confettiColors = [C.accent, '#f59e0b', '#10b981', '#3b82f6', '#ec4899']

    return (
      <div style={{ minHeight: '100vh', background: C.bg, overflowX: 'hidden' }}>
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
              style={{ fontSize: '4.5rem', marginBottom: '18px', display: 'inline-block' }}
            >{statusIcon}</motion.div>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.h1 key={order.status + 'l'}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
              transition={spring}
              style={{ color: C.text, fontSize: 'clamp(1.3rem, 5vw, 1.6rem)', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.02em' }}
            >{statusLabel}</motion.h1>
          </AnimatePresence>
          <p style={{ color: C.muted, fontSize: '0.85rem' }}>Tisch {table?.table_num} · {restaurant?.name}</p>
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

          {/* Order summary */}
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

          {/* Service buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            {[{ icon: '🔔', label: 'Kellner rufen', type: 'waiter' as const }, { icon: '🧾', label: 'Rechnung', type: 'bill' as const }].map(s => (
              <motion.button key={s.type} onClick={() => callWaiter(s.type)} whileTap={{ scale: 0.95 }} transition={spring}
                style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '18px 12px', color: C.text, cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: '1.6rem', marginBottom: '5px' }}>{s.icon}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: C.muted }}>{s.label}</div>
              </motion.button>
            ))}
          </div>

          <motion.button
            onClick={() => { setCart([]); setNote(''); setView('menu') }}
            whileTap={{ scale: 0.98 }} transition={spring}
            style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '12px', padding: '13px', color: C.muted, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
          >{t('order.backToMenu')}</motion.button>
        </div>
      </div>
    )
  }

  // ─── Cart View ─────────────────────────────────────────────────────────────
  if (view === 'cart') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
        style={{ minHeight: '100vh', background: C.bg }}>
        <style>{`@keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }`}</style>

        {/* Header */}
        <div style={{ background: C.surface, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: `1px solid ${C.border}` }}>
          <motion.button onClick={() => setView('menu')} whileTap={{ scale: 0.9 }} transition={springBouncy}
            style={{ width: '38px', height: '38px', borderRadius: '50%', background: C.surface2, border: `1px solid ${C.border}`, color: C.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
            ←
          </motion.button>
          <h2 style={{ color: C.text, fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.01em' }}>{t('order.cart')}</h2>
        </div>

        <div style={{ padding: '20px', maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
          {cart.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={spring}
              style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '14px', opacity: 0.4 }}>🛒</div>
              <p style={{ color: C.muted, fontWeight: 600 }}>{t('order.emptyCart')}</p>
            </motion.div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {cart.map((c, i) => (
                  <motion.div key={c.item.id} layout initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: i * 0.05 }}
                    style={{ background: C.surface, borderRadius: '14px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${C.border}` }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: C.text, fontWeight: 600, marginBottom: '2px', fontSize: '0.9rem' }}>{c.item.name}</p>
                      <p style={{ color: C.muted, fontSize: '0.82rem' }}>{c.item.price.toFixed(2)} €</p>
                      {c.note && <p style={{ color: C.accent, fontSize: '0.78rem', marginTop: '4px' }}>✎ {c.note}</p>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <motion.button onClick={() => removeFromCart(c.item.id)} whileTap={{ scale: 0.82 }} transition={springBouncy}
                        style={{ width: '30px', height: '30px', borderRadius: '50%', background: C.surface2, border: `1px solid ${C.border}`, color: C.text, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</motion.button>
                      <AnimatePresence mode="popLayout">
                        <motion.span key={c.qty} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={springBouncy}
                          style={{ color: C.text, fontWeight: 800, minWidth: '20px', textAlign: 'center' }}>{c.qty}</motion.span>
                      </AnimatePresence>
                      <motion.button onClick={() => addToCart(c.item)} whileTap={{ scale: 0.82 }} transition={springBouncy}
                        style={{ width: '30px', height: '30px', borderRadius: '50%', background: C.accent, border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Note */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ color: C.muted, fontSize: '0.7rem', fontWeight: 700, display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Anmerkung (optional)</label>
                <textarea value={note} onChange={e => setNote(e.target.value)}
                  placeholder="z.B. Kein Zwiebeln, extra scharf..."
                  rows={3}
                  style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '12px', color: C.text, fontSize: '0.875rem', resize: 'none', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s', fontFamily: 'inherit' }}
                  onFocus={e => { e.target.style.borderColor = C.accent }}
                  onBlur={e => { e.target.style.borderColor = C.border }}
                />
              </div>

              {/* Payment method selection */}
              <div style={{ marginBottom: '16px' }}>
                <p style={{ color: C.muted, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Zahlungsart</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <motion.button
                    onClick={() => { setPaymentMethod('online'); setTipPercent(null); setCustomTip('') }}
                    whileTap={{ scale: 0.96 }} transition={spring}
                    style={{
                      padding: '14px 10px', borderRadius: '14px',
                      border: `2px solid ${paymentMethod === 'online' ? C.accent : C.border}`,
                      background: paymentMethod === 'online' ? C.accentDim : C.surface,
                      cursor: 'pointer', textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>💳</div>
                    <div style={{ color: paymentMethod === 'online' ? C.accent : C.text, fontWeight: 700, fontSize: '0.82rem' }}>Online zahlen</div>
                    <div style={{ color: C.muted, fontSize: '0.68rem', marginTop: '2px' }}>Karte / PayPal</div>
                  </motion.button>
                  <motion.button
                    onClick={() => { setPaymentMethod('later'); setTipPercent(null); setCustomTip('') }}
                    whileTap={{ scale: 0.96 }} transition={spring}
                    style={{
                      padding: '14px 10px', borderRadius: '14px',
                      border: `2px solid ${paymentMethod === 'later' ? C.accent : C.border}`,
                      background: paymentMethod === 'later' ? C.accentDim : C.surface,
                      cursor: 'pointer', textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🧾</div>
                    <div style={{ color: paymentMethod === 'later' ? C.accent : C.text, fontWeight: 700, fontSize: '0.82rem' }}>Später zahlen</div>
                    <div style={{ color: C.muted, fontSize: '0.68rem', marginTop: '2px' }}>Bar / am Tisch</div>
                  </motion.button>
                </div>
              </div>

              {/* Tip — only for online payment */}
              {paymentMethod === 'online' && (
                <div style={{ background: C.surface, borderRadius: '16px', padding: '16px 18px', marginBottom: '14px', border: `1px solid ${C.border}` }}>
                  <p style={{ color: C.muted, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Trinkgeld</p>
                  <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                    {[{ label: 'Kein', value: 0 }, { label: '5%', value: 5 }, { label: '10%', value: 10 }, { label: '15%', value: 15 }, { label: 'Eigen', value: -1 }].map(opt => (
                      <motion.button key={opt.value} onClick={() => { setTipPercent(opt.value === tipPercent ? null : opt.value); setCustomTip('') }}
                        whileTap={{ scale: 0.93 }} transition={springBouncy}
                        style={{
                          padding: '7px 14px', borderRadius: '20px', border: `1.5px solid ${tipPercent === opt.value ? C.accent : C.border}`,
                          background: tipPercent === opt.value ? C.accentDim : 'transparent',
                          color: tipPercent === opt.value ? C.accent : C.muted, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                        }}>{opt.label}</motion.button>
                    ))}
                  </div>
                  {tipPercent === -1 && (
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="number" value={customTip} onChange={e => setCustomTip(e.target.value)}
                        placeholder="z.B. 2.50" min="0" step="0.50" autoFocus
                        style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: '1rem', outline: 'none' }} />
                      <span style={{ color: C.muted }}>€</span>
                    </div>
                  )}
                  {tipAmount > 0 && <p style={{ color: C.accent, fontSize: '0.82rem', marginTop: '10px' }}>+{tipAmount.toFixed(2)} € Trinkgeld — Danke! 🙏</p>}
                </div>
              )}

              {/* Price overview */}
              <div style={{ background: C.surface, borderRadius: '16px', padding: '16px 18px', marginBottom: '20px', border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: tipAmount > 0 ? '8px' : '0' }}>
                  <span style={{ color: C.muted }}>Zwischensumme</span>
                  <span style={{ color: C.text, fontWeight: 600 }}>{subtotal.toFixed(2)} €</span>
                </div>
                {tipAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: C.muted }}>Trinkgeld</span>
                    <span style={{ color: C.accent, fontWeight: 600 }}>+{tipAmount.toFixed(2)} €</span>
                  </div>
                )}
                <div style={{ borderTop: `1px solid ${C.border}`, marginTop: tipAmount > 0 ? '0' : '12px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: C.text, fontWeight: 700 }}>{t('order.total')}</span>
                  <span style={{ color: C.text, fontWeight: 800, fontSize: '1.2rem' }}>{total.toFixed(2)} €</span>
                </div>
              </div>

              {error && <p style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}

              <motion.button
                onClick={paymentMethod === 'online' ? submitOrderOnline : submitOrderLater}
                disabled={submitting || !paymentMethod}
                whileHover={{ scale: paymentMethod ? 1.02 : 1 }}
                whileTap={{ scale: paymentMethod ? 0.97 : 1 }}
                transition={spring}
                style={{
                  width: '100%', padding: '17px', borderRadius: '14px', border: 'none',
                  background: !paymentMethod || submitting ? C.surface2 : C.accent,
                  color: !paymentMethod || submitting ? C.muted : '#fff',
                  fontSize: '1rem', fontWeight: 800,
                  cursor: !paymentMethod || submitting ? 'not-allowed' : 'pointer',
                  boxShadow: !paymentMethod || submitting ? 'none' : `0 6px 28px ${C.accentGlow}`,
                  letterSpacing: '-0.01em', transition: 'background 0.2s',
                }}
              >
                {submitting
                  ? t('common.loading')
                  : !paymentMethod
                    ? 'Zahlungsart wählen'
                    : paymentMethod === 'online'
                      ? `Jetzt bezahlen · ${total.toFixed(2)} €`
                      : `${t('order.placeOrder')} · ${subtotal.toFixed(2)} €`
                }
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
    )
  }

  // ─── Menu View ─────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
        * { box-sizing: border-box; }
        html, body { overflow-x: hidden; max-width: 100vw; }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: '110px', overflowX: 'hidden' }}>

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={spring}
          style={{
            background: `linear-gradient(180deg, #111 0%, ${C.surface} 100%)`,
            padding: '22px 20px 18px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {restaurant?.logo_url && (
              <img src={restaurant.logo_url} alt="" style={{ width: '44px', height: '44px', objectFit: 'contain', borderRadius: '8px', background: '#ffffff10', padding: '3px', flexShrink: 0 }} />
            )}
            <div>
            <p style={{ color: C.muted, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>Willkommen</p>
            <h1 style={{ color: C.text, fontWeight: 800, fontSize: 'clamp(1.15rem, 5vw, 1.5rem)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{restaurant?.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px' }}>
              <span style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', color: C.muted, fontWeight: 700 }}>
                Tisch {table?.table_num}
              </span>
              {groupMode === 'active' && (
                <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springBouncy}
                  style={{ background: C.accentDim, border: `1px solid ${C.accent}44`, borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', color: C.accent, fontWeight: 800, letterSpacing: '0.08em' }}>
                  👥 {groupCode}
                </motion.span>
              )}
            </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <LanguageSelector />
            <motion.button onClick={() => setShowFilters(f => !f)} whileTap={{ scale: 0.88 }} transition={springBouncy}
              style={{ position: 'relative', background: filterCount > 0 ? C.accentDim : C.surface2, border: `1px solid ${filterCount > 0 ? C.accent : C.border}`, borderRadius: '12px', width: '42px', height: '42px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.1rem' }}>
              🔍
              {filterCount > 0 && (
                <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: C.accent, color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '0.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{filterCount}</span>
              )}
            </motion.button>
            <motion.button onClick={() => setShowMenu(true)} whileTap={{ scale: 0.88 }} transition={springBouncy}
              style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '12px', width: '42px', height: '42px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', flexShrink: 0 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: i === 1 ? '12px' : '18px', height: '2px', background: C.text, borderRadius: '2px' }} />
              ))}
            </motion.button>
          </div>
        </motion.div>

        {/* ── Category Pills ── */}
        {categories.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.3 }}
            style={{ overflowX: 'auto', background: C.surface, borderBottom: `1px solid ${C.border}`, scrollbarWidth: 'none' }}>
            <div style={{ display: 'flex', gap: '6px', padding: '10px 16px', minWidth: 'max-content' }}>
              {/* Favorites pill */}
              <button
                onClick={() => { setShowFavorites(true); setActiveCategory(null) }}
                style={{
                  position: 'relative', padding: '7px 16px', borderRadius: '20px', border: 'none',
                  background: showFavorites ? C.accentDim : 'transparent',
                  color: showFavorites ? C.accent : C.muted, fontWeight: showFavorites ? 700 : 500,
                  cursor: 'pointer', fontSize: '0.82rem', whiteSpace: 'nowrap', transition: 'color 0.2s',
                }}
              >
                {showFavorites && (
                  <motion.div layoutId="activeCatPill"
                    style={{ position: 'absolute', inset: 0, borderRadius: '20px', background: C.accentDim, border: `1.5px solid ${C.accent}55` }}
                    transition={spring}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1 }}>♥ Favoriten{favorites.size > 0 ? ` (${favorites.size})` : ''}</span>
              </button>

              {categories.map(cat => {
                const isActive = !showFavorites && activeCategory === cat.id
                return (
                  <button key={cat.id}
                    onClick={() => { setShowFavorites(false); scrollToCategory(cat.id) }}
                    style={{
                      position: 'relative', padding: '7px 16px', borderRadius: '20px', border: 'none',
                      background: 'transparent',
                      color: isActive ? C.accent : C.muted, fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer', fontSize: '0.82rem', whiteSpace: 'nowrap', transition: 'color 0.2s',
                    }}
                  >
                    {isActive && (
                      <motion.div layoutId="activeCatPill"
                        style={{ position: 'absolute', inset: 0, borderRadius: '20px', background: C.accentDim, border: `1.5px solid ${C.accent}55` }}
                        transition={spring}
                      />
                    )}
                    <span style={{ position: 'relative', zIndex: 1 }}>{cat.name}</span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* ── Filter Bar ── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              style={{ overflow: 'hidden', background: C.bg, borderBottom: `1px solid ${C.border}` }}
            >
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <p style={{ color: C.muted, fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Diät & Merkmale</p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {DIETARY_FILTERS.map(({ key, label }) => {
                      const active = activeDietary.includes(key)
                      return (
                        <motion.button key={key} onClick={() => setActiveDietary(prev => active ? prev.filter(d => d !== key) : [...prev, key])}
                          whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                          style={{ padding: '6px 13px', borderRadius: '20px', border: `1.5px solid ${active ? C.accent : C.border}`, background: active ? C.accentDim : 'transparent', color: active ? C.accent : C.muted, fontWeight: active ? 700 : 500, fontSize: '0.8rem', cursor: 'pointer' }}>
                          {label}
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <p style={{ color: C.muted, fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Allergene ausschließen</p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {ALLERGEN_FILTERS.map(a => {
                      const active = excludedAllergens.includes(a)
                      return (
                        <motion.button key={a} onClick={() => setExcludedAllergens(prev => active ? prev.filter(x => x !== a) : [...prev, a])}
                          whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                          style={{ padding: '6px 13px', borderRadius: '20px', border: `1.5px solid ${active ? '#ef4444' : C.border}`, background: active ? 'rgba(239,68,68,0.1)' : 'transparent', color: active ? '#ef4444' : C.muted, fontWeight: active ? 700 : 500, fontSize: '0.8rem', cursor: 'pointer' }}>
                          {a}
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
                {filterCount > 0 && (
                  <button onClick={() => { setActiveDietary([]); setExcludedAllergens([]) }}
                    style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: C.muted, fontSize: '0.78rem', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                    ✕ Filter zurücksetzen
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Menu Items ── */}
        <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>

          {showFavorites && (
            <div style={{ marginBottom: '32px' }}>
              {favorites.size === 0 ? (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring}
                  style={{ textAlign: 'center', padding: '64px 0' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '12px', opacity: 0.25 }}>♡</div>
                  <p style={{ color: C.muted, fontWeight: 600 }}>Noch keine Favoriten gespeichert.</p>
                  <p style={{ color: C.muted2, fontSize: '0.8rem', marginTop: '6px' }}>Tippe auf das Herz bei einem Gericht.</p>
                </motion.div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filterItems(items.filter(i => favorites.has(i.id))).map((item, idx) => {
                    const qty = getItemQty(item.id)
                    return <ItemCard key={item.id} item={item} qty={qty} isFav index={idx} C={C} lang={lang} special={specials[item.id]} onOpen={() => setSelectedItem(item)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} onFav={() => toggleFavorite(item.id)} />
                  })}
                </div>
              )}
            </div>
          )}

          {!showFavorites && categories.map(cat => {
            const catItems = filterItems(items.filter(i => i.category_id === cat.id))
            if (catItems.length === 0) return null
            return (
              <div key={cat.id} ref={el => { categoryRefs.current[cat.id] = el }} style={{ marginBottom: '36px' }}>
                <motion.h2
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={spring}
                  style={{ color: C.text, fontWeight: 800, fontSize: '1rem', marginBottom: '14px', paddingTop: '4px', letterSpacing: '-0.01em' }}
                >
                  {cat.name}
                </motion.h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {catItems.map((item, idx) => {
                    const qty = getItemQty(item.id)
                    return <ItemCard key={item.id} item={item} qty={qty} isFav={favorites.has(item.id)} index={idx} C={C} lang={lang} onOpen={() => setSelectedItem(item)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} onFav={() => toggleFavorite(item.id)} />
                  })}
                </div>
              </div>
            )
          })}

          {!showFavorites && items.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              style={{ textAlign: 'center', padding: '64px 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px', opacity: 0.25 }}>🍽️</div>
              <p style={{ color: C.muted }}>Noch keine Menüpunkte vorhanden.</p>
            </motion.div>
          )}
        </div>

        {/* Chat Widget */}
        {view === 'menu' && restaurant && (
          <ChatWidget
            restaurantSlug={restaurant.slug}
            restaurantName={restaurant.name}
            items={items}
            cart={cart.map(c => ({ name: c.item.name, qty: c.qty }))}
            accentColor={restaurant.primary_color ?? undefined}
            tableId={table.id}
            restaurantId={restaurant.id}
            onAddToCart={(itemId, _name, qty) => {
              const found = items.find(i => i.id === itemId)
              if (!found) return
              setCart(prev => {
                const existing = prev.find(c => c.item.id === itemId)
                if (existing) return prev.map(c => c.item.id === itemId ? { ...c, qty: c.qty + qty, note: c.note } : c)
                return [...prev, { item: found, qty, note: '' }]
              })
            }}
          />
        )}

        {/* ── Floating Cart Button ── */}
        <AnimatePresence>
          {(groupMode === 'active' ? groupItems.length > 0 : cartCount > 0) && (
            <motion.div
              initial={{ y: 90, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 90, opacity: 0, scale: 0.8 }}
              transition={springBouncy}
              style={{ position: 'fixed', bottom: '24px', left: '16px', right: '16px', zIndex: 100 }}
            >
              <motion.button
                onClick={() => groupMode === 'active' ? (isGroupCreator ? submitGroupOrder() : undefined) : setView('cart')}
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} transition={spring}
                style={{
                  background: C.accent, border: 'none', borderRadius: '50px',
                  padding: '16px 24px', color: '#fff', fontWeight: 800,
                  cursor: 'pointer', fontSize: '0.95rem',
                  boxShadow: `0 6px 32px ${C.accentGlow}, 0 2px 8px rgba(0,0,0,0.4)`,
                  display: 'flex', alignItems: 'center', gap: '12px', width: '100%', justifyContent: 'center',
                  letterSpacing: '-0.01em',
                }}
              >
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={groupMode === 'active' ? groupItems.reduce((s, gi) => s + gi.qty, 0) : cartCount}
                    initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }}
                    transition={springBouncy}
                    style={{ background: 'rgba(0,0,0,0.22)', borderRadius: '20px', padding: '3px 11px', fontSize: '0.82rem', fontWeight: 800 }}
                  >
                    {groupMode === 'active' ? groupItems.reduce((s, gi) => s + gi.qty, 0) : cartCount}
                  </motion.span>
                </AnimatePresence>
                <span>
                  {groupMode === 'active'
                    ? (isGroupCreator ? 'Gruppe bestellen' : `Deine Auswahl: ${groupItems.filter(gi => gi.added_by === memberName).reduce((s, gi) => s + gi.qty, 0)} Items ✓`)
                    : '🛒 Warenkorb anzeigen'}
                </span>
                {(groupMode !== 'active' || isGroupCreator) && (
                  <>
                    <span style={{ opacity: 0.5 }}>·</span>
                    <span>
                      {groupMode === 'active'
                        ? `${groupItems.reduce((s, gi) => s + gi.price * gi.qty, 0).toFixed(2)} €`
                        : `${total.toFixed(2)} €`}
                    </span>
                  </>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Item Detail Sheet ── */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: C.bg, zIndex: 200, display: 'flex', flexDirection: 'column' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px 16px', gap: '12px', flexShrink: 0, background: C.bg, borderBottom: `1px solid ${C.border}` }}>
              <motion.button onClick={() => setSelectedItem(null)} whileTap={{ scale: 0.88 }} transition={springBouncy}
                style={{ width: '40px', height: '40px', borderRadius: '50%', background: C.surface, border: `1px solid ${C.border}`, color: C.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                ←
              </motion.button>
              <span style={{ color: C.muted, fontSize: '0.85rem', flex: 1 }}>
                {categories.find(c => c.id === selectedItem.category_id)?.name}
              </span>
              <motion.button onClick={() => toggleFavorite(selectedItem.id)} whileTap={{ scale: 0.75 }} transition={springBouncy}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: favorites.has(selectedItem.id) ? C.accent : C.muted2, padding: '4px' }}>
                {favorites.has(selectedItem.id) ? '♥' : '♡'}
              </motion.button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 300px', minHeight: '280px', maxHeight: '480px' }}>
                {selectedItem.image_url ? (
                  <img src={selectedItem.image_url} alt={selectedItem.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: '280px', maxHeight: '480px' }} />
                ) : (
                  <div style={{ width: '100%', minHeight: '280px', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '4rem', opacity: 0.2 }}>🍽️</span>
                  </div>
                )}
              </div>

              <div style={{ flex: '1 1 280px', padding: '28px 22px', display: 'flex', flexDirection: 'column' }}>
                <h1 style={{ color: C.text, fontWeight: 800, fontSize: 'clamp(1.3rem, 4vw, 1.7rem)', lineHeight: 1.15, marginBottom: '10px', letterSpacing: '-0.02em' }}>
                  {selectedItem.name}
                </h1>
                <span style={{ color: C.accent, fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.01em' }}>{selectedItem.price.toFixed(2)} €</span>

                {selectedItem.description && (
                  <p style={{ color: C.muted, fontSize: '0.92rem', lineHeight: 1.7, marginTop: '16px' }}>{selectedItem.description}</p>
                )}

                {selectedItem.allergens.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <p style={{ color: C.muted2, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{t('order.allergens')}</p>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {selectedItem.allergens.map(a => (
                        <span key={a} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.7rem', padding: '3px 8px', borderRadius: '5px', fontWeight: 600 }}>{a}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedItem.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
                    {selectedItem.tags.map(tag => (
                      <span key={tag} style={{ background: C.surface2, color: C.muted, fontSize: '0.78rem', padding: '4px 12px', borderRadius: '20px' }}>{tag}</span>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: '22px' }}>
                  <label style={{ color: C.muted, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '8px' }}>Sonderwunsch</label>
                  <textarea value={detailNote} onChange={e => setDetailNote(e.target.value)}
                    placeholder="z.B. ohne Zwiebeln, extra scharf..." rows={2}
                    style={{ width: '100%', padding: '10px 13px', borderRadius: '11px', border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: '0.875rem', resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                    onFocus={e => { e.target.style.borderColor = C.accent }}
                    onBlur={e => { e.target.style.borderColor = C.border }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', background: C.surface, borderRadius: '12px', border: `1px solid ${C.border}`, flexShrink: 0 }}>
                    <motion.button onClick={() => setDetailQty(q => Math.max(1, q - 1))} whileTap={{ scale: 0.8 }} transition={springBouncy}
                      style={{ width: '44px', height: '44px', background: 'none', border: 'none', color: C.text, cursor: 'pointer', fontSize: '1.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</motion.button>
                    <AnimatePresence mode="popLayout">
                      <motion.span key={detailQty} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={springBouncy}
                        style={{ color: C.text, fontWeight: 800, fontSize: '1.1rem', minWidth: '28px', textAlign: 'center' }}>{detailQty}</motion.span>
                    </AnimatePresence>
                    <motion.button onClick={() => setDetailQty(q => q + 1)} whileTap={{ scale: 0.8 }} transition={springBouncy}
                      style={{ width: '44px', height: '44px', background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: '1.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</motion.button>
                  </div>
                  <motion.button
                    onClick={() => { addToCartWithDetails(selectedItem, detailQty, detailNote); setSelectedItem(null) }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }} transition={spring}
                    style={{ flex: 1, height: '44px', borderRadius: '12px', background: C.accent, border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 800, boxShadow: `0 4px 18px ${C.accentGlow}`, letterSpacing: '-0.01em' }}
                  >
                    {t('order.addToCart')} · {(selectedItem.price * detailQty).toFixed(2)} €
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hamburger Menu Sheet ── */}
      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowMenu(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', zIndex: 300 }}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.3 }}
              onDragEnd={(_, info) => { if (info.offset.y > 80) setShowMenu(false) }}
              style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301, background: C.surface, borderRadius: '24px 24px 0 0', maxHeight: '92vh', overflowY: 'auto' }}
            >
              <div style={{ padding: '12px 20px 0', textAlign: 'center' }}>
                <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: C.border, margin: '0 auto 18px', cursor: 'grab' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 16px', borderBottom: `1px solid ${C.border}` }}>
                <h2 style={{ color: C.text, fontWeight: 800, fontSize: '1rem', margin: 0, letterSpacing: '-0.01em' }}>Menü & Service</h2>
                <motion.button onClick={() => setShowMenu(false)} whileTap={{ scale: 0.88 }} transition={springBouncy}
                  style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '50%', width: '32px', height: '32px', color: C.muted, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</motion.button>
              </div>

              <div style={{ padding: '20px' }}>

                {/* Service */}
                <p style={{ color: C.muted2, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>Service</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '28px' }}>
                  {[{ icon: '🔔', label: 'Kellner rufen', type: 'waiter' as const }, { icon: '🧾', label: 'Rechnung', type: 'bill' as const }].map(s => (
                    <motion.button key={s.type} onClick={() => { callWaiter(s.type); setShowMenu(false) }}
                      whileTap={{ scale: 0.94 }} transition={spring}
                      style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '18px 12px', color: C.text, cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.7rem', marginBottom: '6px' }}>{s.icon}</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.muted }}>{s.label}</div>
                    </motion.button>
                  ))}
                </div>

                {/* Group ordering */}
                <p style={{ color: C.muted2, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>{t('order.groupOrder')}</p>

                {groupMode === 'none' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                    <motion.button onClick={() => setGroupMode('create')} whileTap={{ scale: 0.97 }} transition={spring}
                      style={{ padding: '14px 16px', borderRadius: '14px', border: `1.5px solid ${C.accent}66`, background: C.accentDim, color: C.accent, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', textAlign: 'left' }}>
                      👥 {t('order.createGroup')} — Code teilen, alle bestellen gemeinsam
                    </motion.button>
                    <motion.button onClick={() => setGroupMode('join')} whileTap={{ scale: 0.97 }} transition={spring}
                      style={{ padding: '14px 16px', borderRadius: '14px', border: `1.5px solid ${C.border}`, background: 'transparent', color: C.muted, fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', textAlign: 'left' }}>
                      🔗 {t('order.joinGroup')} (Code eingeben)
                    </motion.button>
                  </div>
                )}

                {groupMode === 'create' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="Dein Vorname" autoFocus
                      style={{ padding: '13px 14px', borderRadius: '11px', border: `1.5px solid ${C.border}`, background: C.bg, color: C.text, fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' }}
                      onFocus={e => { e.target.style.borderColor = C.accent }} onBlur={e => { e.target.style.borderColor = C.border }} />
                    {groupError && <p style={{ color: '#ef4444', fontSize: '0.82rem' }}>{groupError}</p>}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <motion.button onClick={createGroup} disabled={!memberName.trim() || groupLoading} whileTap={{ scale: 0.96 }} transition={spring}
                        style={{ flex: 1, padding: '14px', borderRadius: '11px', border: 'none', background: memberName.trim() ? C.accent : C.surface2, color: memberName.trim() ? '#fff' : C.muted, fontWeight: 800, cursor: 'pointer', boxShadow: memberName.trim() ? `0 4px 18px ${C.accentGlow}` : 'none' }}>
                        {groupLoading ? 'Erstelle...' : 'Gruppe starten'}
                      </motion.button>
                      <button onClick={() => setGroupMode('none')} style={{ padding: '14px 16px', borderRadius: '11px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', fontWeight: 600 }}>Zurück</button>
                    </div>
                  </div>
                )}

                {groupMode === 'join' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="Dein Vorname"
                      style={{ padding: '13px 14px', borderRadius: '11px', border: `1.5px solid ${C.border}`, background: C.bg, color: C.text, fontSize: '1rem', outline: 'none' }}
                      onFocus={e => { e.target.style.borderColor = C.accent }} onBlur={e => { e.target.style.borderColor = C.border }} />
                    <input value={joinCodeInput} onChange={e => setJoinCodeInput(e.target.value.toUpperCase().slice(0, 4))} placeholder="CODE" maxLength={4}
                      style={{ padding: '14px', borderRadius: '11px', border: `1.5px solid ${C.border}`, background: C.bg, color: C.accent, fontSize: '1.8rem', fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', outline: 'none', textAlign: 'center' }}
                      onFocus={e => { e.target.style.borderColor = C.accent }} onBlur={e => { e.target.style.borderColor = C.border }} />
                    {groupError && <p style={{ color: '#ef4444', fontSize: '0.82rem' }}>{groupError}</p>}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <motion.button onClick={joinGroup} disabled={joinCodeInput.length < 4 || !memberName.trim() || groupLoading} whileTap={{ scale: 0.96 }} transition={spring}
                        style={{ flex: 1, padding: '14px', borderRadius: '11px', border: 'none', background: joinCodeInput.length === 4 && memberName.trim() ? C.accent : C.surface2, color: joinCodeInput.length === 4 && memberName.trim() ? '#fff' : C.muted, fontWeight: 800, cursor: 'pointer' }}>
                        {groupLoading ? 'Suche...' : 'Beitreten'}
                      </motion.button>
                      <button onClick={() => setGroupMode('none')} style={{ padding: '14px 16px', borderRadius: '11px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', fontWeight: 600 }}>Zurück</button>
                    </div>
                  </div>
                )}

                {groupMode === 'active' && (
                  <div>
                    <div style={{ background: C.bg, borderRadius: '14px', padding: '16px', marginBottom: '14px', border: `1px solid ${C.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div>
                          <p style={{ color: C.muted, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>{t('order.groupCode')}</p>
                          <span style={{ color: C.accent, fontWeight: 800, fontSize: '1.4rem', letterSpacing: '0.2em' }}>{groupCode}</span>
                        </div>
                        <motion.button whileTap={{ scale: 0.94 }} transition={spring}
                          onClick={async () => {
                            await navigator.clipboard.writeText(`${window.location.origin}/order/${token}?group=${groupCode}`)
                            setCopiedGroup(true); setTimeout(() => setCopiedGroup(false), 2000)
                          }}
                          style={{ padding: '8px 16px', borderRadius: '10px', border: `1.5px solid ${copiedGroup ? '#10b981' : C.accent}`, background: copiedGroup ? 'rgba(16,185,129,0.1)' : C.accentDim, color: copiedGroup ? '#10b981' : C.accent, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                          {copiedGroup ? `✓ ${t('order.copied')}` : t('order.copyCode')}
                        </motion.button>
                      </div>
                      <p style={{ color: C.muted, fontSize: '0.78rem', lineHeight: 1.5, marginBottom: groupItems.length > 0 ? '14px' : '0' }}>
                        {isGroupCreator ? 'Du bist der Ersteller. Wenn alle fertig sind, bestellst du ab.' : `Du bist beigetreten als ${memberName}.`}
                      </p>

                      {groupItems.length > 0 && (() => {
                        const byPerson: Record<string, GroupItem[]> = {}
                        groupItems.forEach(gi => { if (!byPerson[gi.added_by]) byPerson[gi.added_by] = []; byPerson[gi.added_by].push(gi) })
                        return Object.entries(byPerson).map(([person, pItems]) => (
                          <div key={person} style={{ marginBottom: '10px' }}>
                            <p style={{ color: C.muted2, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px' }}>
                              {person === memberName ? `${person} (du)` : person}
                            </p>
                            {pItems.map(gi => (
                              <div key={gi.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
                                <span style={{ color: C.text, fontSize: '0.85rem' }}>{gi.qty}× {gi.name}</span>
                                <span style={{ color: C.muted, fontSize: '0.85rem' }}>{(gi.price * gi.qty).toFixed(2)} €</span>
                              </div>
                            ))}
                          </div>
                        ))
                      })()}
                    </div>

                    {isGroupCreator && (
                      <motion.button onClick={() => { setShowMenu(false); submitGroupOrder() }} disabled={submitting || groupItems.length === 0}
                        whileTap={{ scale: 0.97 }} transition={spring}
                        style={{
                          width: '100%', padding: '15px', borderRadius: '13px', border: 'none',
                          background: groupItems.length > 0 ? C.accent : C.surface2,
                          color: groupItems.length > 0 ? '#fff' : C.muted,
                          fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
                          boxShadow: groupItems.length > 0 ? `0 4px 20px ${C.accentGlow}` : 'none',
                        }}>
                        {submitting ? 'Wird bestellt...' : '✓ Gruppe bestellen'}
                      </motion.button>
                    )}
                  </div>
                )}

              </div>
              <div style={{ height: '16px' }} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Group Pay Button */}
      <AnimatePresence>
        {groupMode === 'group-pay' && groupId && (
          <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            style={{ position: 'fixed', bottom: '24px', left: '16px', right: '16px', zIndex: 100 }}
          >
            <motion.button
              onClick={() => setShowGroupPay(true)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              style={{
                background: 'var(--accent)', border: 'none', borderRadius: '50px',
                padding: '16px 22px', color: '#fff', fontWeight: 700,
                cursor: 'pointer', fontSize: '0.95rem',
                boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                display: 'flex', alignItems: 'center', gap: '14px', width: '100%',
                justifyContent: 'center',
              }}
            >
              <span>💳 Gruppenkorb & Zahlung</span>
              <span style={{ opacity: 0.6 }}>·</span>
              <span style={{ fontWeight: 800 }}>
                {groupItems.filter(gi => gi.added_by === memberName).reduce((s, gi) => s + gi.price * gi.qty, 0).toFixed(2)} €
              </span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Group Pay Overlay */}
      <AnimatePresence>
        {showGroupPay && groupId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGroupPay(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 32 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.3 }}
              onDragEnd={(_, info) => { if (info.offset.y > 80) setShowGroupPay(false) }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
                background: 'var(--bg)', borderRadius: '20px 20px 0 0',
                maxHeight: '90vh', overflowY: 'auto',
                cursor: 'grab',
              }}
            >
              <div style={{ position: 'sticky', top: 0, background: 'var(--bg)', padding: '14px 20px 0', zIndex: 1 }}>
                <div style={{ width: '40px', height: '4px', background: 'var(--border)', borderRadius: '2px', margin: '0 auto 14px', cursor: 'grab' }} />
              </div>
              <div style={{ cursor: 'default' }} onPointerDown={e => e.stopPropagation()}>
                <GroupPayView
                  groupId={groupId}
                  memberName={memberName}
                  groupItems={groupItems}
                  accent={restaurant?.primary_color ?? '#6c63ff'}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
