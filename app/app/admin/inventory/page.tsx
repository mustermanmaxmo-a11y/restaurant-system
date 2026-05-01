'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type {
  Restaurant, MenuItem,
  Ingredient, Supplier, StockMovement, WasteLog,
  PurchaseOrder, PurchaseOrderLine,
  WasteReason, PurchaseOrderStatus,
} from '@/types/database'
import { useLanguage } from '@/components/providers/language-provider'
import { Package, AlertTriangle, Truck, Sparkles, Link2, Pencil, X, CheckCircle2, BarChart2, Lightbulb, Siren } from 'lucide-react'

type Tab = 'bestand' | 'lieferanten' | 'bestellungen' | 'verluste'

interface IngredientWithSupplier extends Ingredient {
  supplier_name?: string
}

interface MenuItemIngredientRow {
  menu_item_id: string
  ingredient_id: string
  quantity_per_serving: number
}

interface PurchaseOrderWithLines extends PurchaseOrder {
  supplier_name: string
  lines: (PurchaseOrderLine & { ingredient_name: string; unit: string })[]
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const v = String(r[h] ?? '')
      return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
    }).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── ISO Week helper ──────────────────────────────────────────────────────────
function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `KW ${week} ${d.getUTCFullYear()}`
}

export default function InventoryPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('bestand')

  // ── Bestand state ──────────────────────────────────────────────────────────
  const [ingredients, setIngredients] = useState<IngredientWithSupplier[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])

  // ingredient modal
  const [ingModal, setIngModal] = useState<'add' | 'edit' | null>(null)
  const [editingIng, setEditingIng] = useState<Ingredient | null>(null)
  const [ingName, setIngName] = useState('')
  const [ingUnit, setIngUnit] = useState('kg')
  const [ingStock, setIngStock] = useState('')
  const [ingMin, setIngMin] = useState('')
  const [ingPrice, setIngPrice] = useState('')
  const [ingSupplier, setIngSupplier] = useState('')
  const [ingSaving, setIngSaving] = useState(false)

  // delivery modal
  const [delivModal, setDelivModal] = useState<Ingredient | null>(null)
  const [delivQty, setDelivQty] = useState('')
  const [delivNote, setDelivNote] = useState('')
  const [delivSaving, setDelivSaving] = useState(false)

  // correction modal
  const [corrModal, setCorrModal] = useState<Ingredient | null>(null)
  const [corrDelta, setCorrDelta] = useState('')
  const [corrNote, setCorrNote] = useState('')
  const [corrSaving, setCorrSaving] = useState(false)

  // link modal
  const [linkModal, setLinkModal] = useState<Ingredient | null>(null)
  const [linkSelections, setLinkSelections] = useState<Record<string, { checked: boolean; qty: string }>>({})
  const [linkSaving, setLinkSaving] = useState(false)

  // ── Lieferanten state ──────────────────────────────────────────────────────
  const [supModal, setSupModal] = useState<'add' | 'edit' | null>(null)
  const [editingSup, setEditingSup] = useState<Supplier | null>(null)
  const [supName, setSupName] = useState('')
  const [supContact, setSupContact] = useState('')
  const [supEmail, setSupEmail] = useState('')
  const [supPhone, setSupPhone] = useState('')
  const [supNotes, setSupNotes] = useState('')
  const [supSaving, setSupSaving] = useState(false)

  // ── Bestellvorschläge state ────────────────────────────────────────────────
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderWithLines[]>([])
  const [suggestedQtys, setSuggestedQtys] = useState<Record<string, string>>({})
  const [poSaving, setPoSaving] = useState(false)
  const [aiResult, setAiResult] = useState<{ urgent_orders: { ingredient: string; suggested_qty: string; reason: string }[]; anomalies: string[]; savings_tip: string } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const lastAiCall = useRef<number>(0)

  // ── Verluste state ─────────────────────────────────────────────────────────
  const [wasteLogs, setWasteLogs] = useState<(WasteLog & { ingredient_name: string; unit: string; purchase_price: number | null })[]>([])
  const [wasteIngredient, setWasteIngredient] = useState('')
  const [wasteQty, setWasteQty] = useState('')
  const [wasteReason, setWasteReason] = useState<WasteReason>('spoiled')
  const [wasteNote, setWasteNote] = useState('')
  const [wasteDate, setWasteDate] = useState(new Date().toISOString().slice(0, 10))
  const [wasteSaving, setWasteSaving] = useState(false)

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }
      const { data: resto } = await supabase.from('restaurants').select('*').eq('owner_id', session.user.id).limit(1).single()
      if (!resto) { router.push('/admin/setup'); return }
      setRestaurant(resto)
      await Promise.all([
        loadIngredients(resto.id),
        loadSuppliers(resto.id),
        loadMenuItems(resto.id),
        loadMovements(resto.id),
        loadPurchaseOrders(resto.id),
        loadWasteLogs(resto.id),
      ])
      setLoading(false)
    }
    load()
  }, [router])

  async function loadIngredients(rid: string) {
    const { data: ings } = await supabase.from('ingredients').select('*').eq('restaurant_id', rid).order('name')
    const { data: sups } = await supabase.from('suppliers').select('id, name').eq('restaurant_id', rid)
    const supMap = Object.fromEntries((sups || []).map(s => [s.id, s.name]))
    setIngredients((ings || []).map(i => ({ ...i, supplier_name: i.supplier_id ? supMap[i.supplier_id] : undefined })))
  }

  async function loadSuppliers(rid: string) {
    const { data } = await supabase.from('suppliers').select('*').eq('restaurant_id', rid).order('name')
    setSuppliers(data || [])
  }

  async function loadMenuItems(rid: string) {
    const { data } = await supabase.from('menu_items').select('*').eq('restaurant_id', rid).order('name')
    setMenuItems(data || [])
  }

  async function loadMovements(rid: string) {
    const { data } = await supabase.from('stock_movements').select('*').eq('restaurant_id', rid).order('created_at', { ascending: false }).limit(500)
    setMovements(data || [])
  }

  async function loadPurchaseOrders(rid: string) {
    const { data: orders } = await supabase.from('purchase_orders').select('*').eq('restaurant_id', rid).neq('status', 'received').order('created_at', { ascending: false })
    if (!orders?.length) { setPurchaseOrders([]); return }
    const { data: lines } = await supabase.from('purchase_order_lines').select('*').in('purchase_order_id', orders.map(o => o.id))
    const { data: sups } = await supabase.from('suppliers').select('id, name').eq('restaurant_id', rid)
    const { data: ings } = await supabase.from('ingredients').select('id, name, unit').eq('restaurant_id', rid)
    const supMap = Object.fromEntries((sups || []).map(s => [s.id, s.name]))
    const ingMap = Object.fromEntries((ings || []).map(i => [i.id, { name: i.name, unit: i.unit }]))
    setPurchaseOrders(orders.map(o => ({
      ...o,
      supplier_name: supMap[o.supplier_id] || '–',
      lines: (lines || []).filter(l => l.purchase_order_id === o.id).map(l => ({
        ...l,
        ingredient_name: ingMap[l.ingredient_id]?.name || '–',
        unit: ingMap[l.ingredient_id]?.unit || '',
      })),
    })))
  }

  async function loadWasteLogs(rid: string) {
    const { data: logs } = await supabase.from('waste_log').select('*').eq('restaurant_id', rid).order('logged_at', { ascending: false }).limit(200)
    const { data: ings } = await supabase.from('ingredients').select('id, name, unit, purchase_price').eq('restaurant_id', rid)
    const ingMap = Object.fromEntries((ings || []).map(i => [i.id, i]))
    setWasteLogs((logs || []).map(l => ({
      ...l,
      ingredient_name: ingMap[l.ingredient_id]?.name || '–',
      unit: ingMap[l.ingredient_id]?.unit || '',
      purchase_price: ingMap[l.ingredient_id]?.purchase_price ?? null,
    })))
  }

  // ── Ingredient CRUD ────────────────────────────────────────────────────────
  function openAddIng() {
    setIngName(''); setIngUnit('kg'); setIngStock(''); setIngMin(''); setIngPrice(''); setIngSupplier(''); setEditingIng(null)
    setIngModal('add')
  }
  function openEditIng(ing: Ingredient) {
    setIngName(ing.name); setIngUnit(ing.unit); setIngStock(String(ing.current_stock)); setIngMin(String(ing.min_stock))
    setIngPrice(ing.purchase_price != null ? String(ing.purchase_price) : ''); setIngSupplier(ing.supplier_id || ''); setEditingIng(ing)
    setIngModal('edit')
  }
  async function saveIng() {
    if (!restaurant || !ingName.trim()) return
    setIngSaving(true)
    const payload = {
      name: ingName.trim(), unit: ingUnit,
      current_stock: parseFloat(ingStock) || 0,
      min_stock: parseFloat(ingMin) || 0,
      purchase_price: ingPrice ? parseFloat(ingPrice) : null,
      supplier_id: ingSupplier || null,
    }
    if (editingIng) {
      await supabase.from('ingredients').update(payload).eq('id', editingIng.id)
    } else {
      await supabase.from('ingredients').insert({ ...payload, restaurant_id: restaurant.id })
    }
    await loadIngredients(restaurant.id)
    setIngModal(null); setIngSaving(false)
  }
  async function deleteIng(id: string) {
    if (!confirm('Zutat löschen?')) return
    await supabase.from('ingredients').delete().eq('id', id)
    setIngredients(prev => prev.filter(i => i.id !== id))
  }

  // ── Delivery ───────────────────────────────────────────────────────────────
  async function saveDelivery() {
    if (!restaurant || !delivModal || !delivQty) return
    setDelivSaving(true)
    const qty = parseFloat(delivQty)
    await supabase.from('ingredients').update({ current_stock: delivModal.current_stock + qty }).eq('id', delivModal.id)
    await supabase.from('stock_movements').insert({
      restaurant_id: restaurant.id, ingredient_id: delivModal.id,
      movement_type: 'delivery', quantity_delta: qty,
      note: delivNote || 'Lieferung eingebucht',
    })
    await loadIngredients(restaurant.id)
    await loadMovements(restaurant.id)
    setDelivModal(null); setDelivQty(''); setDelivNote(''); setDelivSaving(false)
  }

  // ── Correction ────────────────────────────────────────────────────────────
  async function saveCorrection() {
    if (!restaurant || !corrModal || !corrDelta) return
    setCorrSaving(true)
    const delta = parseFloat(corrDelta)
    await supabase.from('ingredients').update({ current_stock: corrModal.current_stock + delta }).eq('id', corrModal.id)
    await supabase.from('stock_movements').insert({
      restaurant_id: restaurant.id, ingredient_id: corrModal.id,
      movement_type: 'correction', quantity_delta: delta,
      note: corrNote || 'Manuelle Korrektur',
    })
    await loadIngredients(restaurant.id)
    await loadMovements(restaurant.id)
    setCorrModal(null); setCorrDelta(''); setCorrNote(''); setCorrSaving(false)
  }

  // ── Link Menu Items ────────────────────────────────────────────────────────
  async function openLinkModal(ing: Ingredient) {
    const { data: existing } = await supabase.from('menu_item_ingredients').select('*').eq('ingredient_id', ing.id)
    const init: Record<string, { checked: boolean; qty: string }> = {}
    menuItems.forEach(mi => {
      const found = existing?.find(e => e.menu_item_id === mi.id)
      init[mi.id] = { checked: !!found, qty: found ? String(found.quantity_per_serving) : '1' }
    })
    setLinkSelections(init)
    setLinkModal(ing)
  }
  async function saveLinks() {
    if (!linkModal) return
    setLinkSaving(true)
    await supabase.from('menu_item_ingredients').delete().eq('ingredient_id', linkModal.id)
    const toInsert: MenuItemIngredientRow[] = Object.entries(linkSelections)
      .filter(([, v]) => v.checked && parseFloat(v.qty) > 0)
      .map(([menuItemId, v]) => ({
        menu_item_id: menuItemId,
        ingredient_id: linkModal.id,
        quantity_per_serving: parseFloat(v.qty),
      }))
    if (toInsert.length) await supabase.from('menu_item_ingredients').insert(toInsert)
    setLinkModal(null); setLinkSaving(false)
  }

  // ── Supplier CRUD ──────────────────────────────────────────────────────────
  function openAddSup() {
    setSupName(''); setSupContact(''); setSupEmail(''); setSupPhone(''); setSupNotes(''); setEditingSup(null)
    setSupModal('add')
  }
  function openEditSup(s: Supplier) {
    setSupName(s.name); setSupContact(s.contact_name || ''); setSupEmail(s.email || '')
    setSupPhone(s.phone || ''); setSupNotes(s.notes || ''); setEditingSup(s)
    setSupModal('edit')
  }
  async function saveSup() {
    if (!restaurant || !supName.trim()) return
    setSupSaving(true)
    const payload = { name: supName.trim(), contact_name: supContact || null, email: supEmail || null, phone: supPhone || null, notes: supNotes || null }
    if (editingSup) {
      await supabase.from('suppliers').update(payload).eq('id', editingSup.id)
    } else {
      await supabase.from('suppliers').insert({ ...payload, restaurant_id: restaurant.id })
    }
    await loadSuppliers(restaurant.id)
    await loadIngredients(restaurant.id)
    setSupModal(null); setSupSaving(false)
  }
  async function deleteSup(id: string) {
    if (!confirm('Lieferant löschen?')) return
    await supabase.from('suppliers').delete().eq('id', id)
    setSuppliers(prev => prev.filter(s => s.id !== id))
  }

  // ── Purchase Orders ────────────────────────────────────────────────────────
  const lowStockIngredients = ingredients.filter(i => i.current_stock <= i.min_stock)

  const groupedBySupplier = lowStockIngredients.reduce<Record<string, IngredientWithSupplier[]>>((acc, ing) => {
    const key = ing.supplier_id || '__none__'
    if (!acc[key]) acc[key] = []
    acc[key].push(ing)
    return acc
  }, {})

  function initSuggestedQtys() {
    const init: Record<string, string> = {}
    lowStockIngredients.forEach(i => {
      if (!suggestedQtys[i.id]) init[i.id] = String(Math.max(0, (i.min_stock - i.current_stock) + i.min_stock))
    })
    if (Object.keys(init).length) setSuggestedQtys(prev => ({ ...prev, ...init }))
  }

  useEffect(() => { if (tab === 'bestellungen') initSuggestedQtys() }, [tab, ingredients])

  async function createPurchaseOrder(supplierId: string | null, ings: IngredientWithSupplier[]) {
    if (!restaurant) return
    setPoSaving(true)
    const { data: po } = await supabase.from('purchase_orders').insert({
      restaurant_id: restaurant.id,
      supplier_id: supplierId || suppliers[0]?.id,
      status: 'draft' as PurchaseOrderStatus,
    }).select().single()
    if (po) {
      const lines = ings.map(i => ({
        purchase_order_id: po.id,
        ingredient_id: i.id,
        quantity_ordered: parseFloat(suggestedQtys[i.id] || '0') || 0,
      })).filter(l => l.quantity_ordered > 0)
      if (lines.length) await supabase.from('purchase_order_lines').insert(lines)
    }
    await loadPurchaseOrders(restaurant.id)
    setPoSaving(false)
  }

  async function markPoReceived(po: PurchaseOrderWithLines) {
    if (!restaurant) return
    await supabase.from('purchase_orders').update({ status: 'received' as PurchaseOrderStatus, received_at: new Date().toISOString() }).eq('id', po.id)
    for (const line of po.lines) {
      const qty = line.quantity_received ?? line.quantity_ordered
      const ing = ingredients.find(i => i.id === line.ingredient_id)
      if (ing) {
        await supabase.from('ingredients').update({ current_stock: ing.current_stock + qty }).eq('id', ing.id)
        await supabase.from('stock_movements').insert({
          restaurant_id: restaurant.id, ingredient_id: ing.id,
          movement_type: 'delivery', quantity_delta: qty,
          note: `Bestellung erhalten (PO ${po.id.slice(0, 8)})`,
        })
      }
    }
    await loadIngredients(restaurant.id)
    await loadPurchaseOrders(restaurant.id)
    await loadMovements(restaurant.id)
  }

  // ── KI Analyse ────────────────────────────────────────────────────────────
  async function runAiAnalysis() {
    if (!restaurant) return
    const now = Date.now()
    if (now - lastAiCall.current < 60000) { setAiError('Bitte warte 60 Sekunden zwischen Analysen.'); return }
    setAiLoading(true); setAiError(''); setAiResult(null)
    lastAiCall.current = now
    const res = await fetch('/api/ai/inventory-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId: restaurant.id }),
    })
    if (!res.ok) { setAiError('Analyse momentan nicht verfügbar.'); setAiLoading(false); return }
    const data = await res.json()
    setAiResult(data)
    setAiLoading(false)
  }

  // ── Waste ─────────────────────────────────────────────────────────────────
  async function saveWaste() {
    if (!restaurant || !wasteIngredient || !wasteQty) return
    setWasteSaving(true)
    await supabase.from('waste_log').insert({
      restaurant_id: restaurant.id,
      ingredient_id: wasteIngredient,
      quantity: parseFloat(wasteQty),
      reason: wasteReason,
      note: wasteNote || null,
      logged_at: new Date(wasteDate).toISOString(),
    })
    await loadWasteLogs(restaurant.id)
    await loadIngredients(restaurant.id)
    setWasteQty(''); setWasteNote(''); setWasteSaving(false)
  }

  const wasteByWeek = wasteLogs.reduce<Record<string, typeof wasteLogs>>((acc, log) => {
    const week = getISOWeek(new Date(log.logged_at))
    if (!acc[week]) acc[week] = []
    acc[week].push(log)
    return acc
  }, {})

  const lowStockCount = ingredients.filter(i => i.current_stock <= i.min_stock).length

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
    </div>
  )

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' as const,
  }
  const labelStyle = { display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px', fontWeight: 500 }
  const btnPrimary = {
    background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: '8px',
    padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem',
  }
  const btnSecondary = {
    background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem',
  }
  const btnSmall = {
    background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)',
    borderRadius: '6px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ padding: '24px 24px 0', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h1 style={{ color: 'var(--text)', fontSize: '1.4rem', fontWeight: 700, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}><Package size={22} /> Lagerbestand</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{ingredients.length} Zutaten · {suppliers.length} Lieferanten</p>
            </div>
            {tab === 'bestand' && (
              <button onClick={openAddIng} style={btnPrimary}>+ Zutat</button>
            )}
            {tab === 'lieferanten' && (
              <button onClick={openAddSup} style={btnPrimary}>+ Lieferant</button>
            )}
          </div>

          {/* Low stock banner */}
          {lowStockCount > 0 && (
            <div style={{ background: '#431407', border: '1px solid #fb923c44', borderRadius: '10px', padding: '10px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={16} color="#fb923c" />
              <span style={{ color: '#fdba74', fontSize: '0.875rem', fontWeight: 500 }}>
                {lowStockCount} {lowStockCount === 1 ? 'Zutat hat' : 'Zutaten haben'} niedrigen Bestand
                {' — '}
                <button onClick={() => setTab('bestellungen')} style={{ background: 'none', border: 'none', color: '#fb923c', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', padding: 0 }}>
                  Bestellvorschläge ansehen →
                </button>
              </span>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as never, scrollbarWidth: 'none' as never, msOverflowStyle: 'none' as never }}>
            {([
              { id: 'bestand', label: 'Bestand' },
              { id: 'lieferanten', label: 'Lieferanten' },
              { id: 'bestellungen', label: `Bestellvorschläge${lowStockCount > 0 ? ` (${lowStockCount})` : ''}` },
              { id: 'verluste', label: 'Verluste' },
            ] as { id: Tab; label: string }[]).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', whiteSpace: 'nowrap', flexShrink: 0,
                background: tab === t.id ? 'var(--bg)' : 'transparent',
                color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer', fontSize: '0.875rem',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>

        {/* ── TAB: BESTAND ─────────────────────────────────────────────────── */}
        {tab === 'bestand' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button onClick={() => {
                exportCSV(movements.map(m => ({
                  datum: new Date(m.created_at).toLocaleDateString('de'),
                  typ: m.movement_type, menge: m.quantity_delta, notiz: m.note || '',
                })), 'lagerbewegungen.csv')
              }} style={btnSmall}>⬇ CSV Export</button>
            </div>

            {ingredients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}><Package size={48} color="var(--text-muted)" /></div>
                <p style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>Noch keine Zutaten</p>
                <p style={{ fontSize: '0.875rem' }}>Füge deine erste Zutat hinzu und verknüpfe sie mit Menü-Items.</p>
              </div>
            ) : (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                {/* Table header */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 180px', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                  {['Zutat', 'Bestand', 'Einheit', 'Mindest', 'Preis/E', 'Aktionen'].map(h => (
                    <span key={h} style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{h}</span>
                  ))}
                </div>
                {ingredients.map(ing => {
                  const isLow = ing.current_stock <= ing.min_stock
                  return (
                    <div key={ing.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 180px', padding: '12px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                      <div>
                        <span style={{ color: 'var(--text)', fontWeight: 500, fontSize: '0.875rem' }}>{ing.name}</span>
                        {ing.supplier_name && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>{ing.supplier_name}</span>}
                      </div>
                      <span style={{ color: isLow ? '#f87171' : 'var(--text)', fontWeight: isLow ? 700 : 400, fontSize: '0.875rem' }}>
                        {isLow && <AlertTriangle size={12} style={{ marginRight: '3px', verticalAlign: 'middle' }} />}{Number(ing.current_stock).toFixed(2)}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{ing.unit}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{Number(ing.min_stock).toFixed(2)}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        {ing.purchase_price != null ? `${Number(ing.purchase_price).toFixed(2)} €` : '–'}
                      </span>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <button onClick={() => { setDelivModal(ing); setDelivQty(''); setDelivNote('') }} style={btnSmall}>+ Lieferung</button>
                        <button onClick={() => { setCorrModal(ing); setCorrDelta(''); setCorrNote('') }} style={btnSmall}>± Korrektur</button>
                        <button onClick={() => openLinkModal(ing)} style={btnSmall}><Link2 size={11} style={{ verticalAlign: 'middle', marginRight: '3px' }} />Verknüpfen</button>
                        <button onClick={() => openEditIng(ing)} style={{ ...btnSmall, display: 'flex', alignItems: 'center' }}><Pencil size={11} /></button>
                        <button onClick={() => deleteIng(ing.id)} style={{ ...btnSmall, color: '#f87171', display: 'flex', alignItems: 'center' }}><X size={11} /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: LIEFERANTEN ─────────────────────────────────────────────── */}
        {tab === 'lieferanten' && (
          <div>
            {suppliers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}><Truck size={48} color="var(--text-muted)" /></div>
                <p style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>Noch keine Lieferanten</p>
                <p style={{ fontSize: '0.875rem' }}>Füge Lieferanten hinzu und verknüpfe sie mit deinen Zutaten.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {suppliers.map(s => (
                  <div key={s.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '4px' }}>{s.name}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {[s.contact_name, s.email, s.phone].filter(Boolean).join(' · ') || 'Keine Kontaktdaten'}
                      </p>
                      {s.notes && <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px', fontStyle: 'italic' }}>{s.notes}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => openEditSup(s)} style={{ ...btnSmall, display: 'flex', alignItems: 'center', gap: '4px' }}><Pencil size={11} /> Bearbeiten</button>
                      <button onClick={() => deleteSup(s.id)} style={{ ...btnSmall, color: '#f87171' }}>{t('common.delete')}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: BESTELLVORSCHLÄGE ────────────────────────────────────────── */}
        {tab === 'bestellungen' && (
          <div>
            {/* KI Analyse */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}><Sparkles size={15} /> KI-Analyse</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Unsere KI analysiert deinen Bestand und gibt konkrete Empfehlungen</p>
                </div>
                <button onClick={runAiAnalysis} disabled={aiLoading} style={{ ...btnPrimary, opacity: aiLoading ? 0.6 : 1 }}>
                  {aiLoading ? 'Analysiere...' : <><Sparkles size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />Analyse starten</>}
                </button>
              </div>

              {aiError && <p style={{ color: '#f87171', fontSize: '0.875rem' }}>{aiError}</p>}

              {aiResult && (
                <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '16px', borderLeft: '3px solid var(--accent)' }}>
                  {aiResult.urgent_orders.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '8px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '5px' }}><AlertTriangle size={14} color="#f87171" /> Dringende Bestellungen</p>
                      {aiResult.urgent_orders.map((o, i) => (
                        <div key={i} style={{ marginBottom: '6px' }}>
                          <span style={{ color: '#f87171', fontWeight: 600, fontSize: '0.875rem' }}>{o.ingredient} — {o.suggested_qty}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}> · {o.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {aiResult.anomalies.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '6px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '5px' }}><BarChart2 size={14} /> Auffälligkeiten</p>
                      {aiResult.anomalies.map((a, i) => (
                        <p key={i} style={{ color: '#fbbf24', fontSize: '0.875rem', marginBottom: '4px' }}>• {a}</p>
                      ))}
                    </div>
                  )}
                  {aiResult.savings_tip && (
                    <div>
                      <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '4px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '5px' }}><Lightbulb size={14} color="#4ade80" /> Einspartipp</p>
                      <p style={{ color: '#4ade80', fontSize: '0.875rem' }}>{aiResult.savings_tip}</p>
                    </div>
                  )}
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '12px', fontStyle: 'italic' }}>
                    KI-Empfehlungen sind unverbindliche Entscheidungshilfen. Für Bestellentscheidungen ist der Restaurantbetreiber verantwortlich.
                  </p>
                </div>
              )}
            </div>

            {/* Manual suggestions */}
            {lowStockIngredients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: '12px' }}>
                <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'center' }}><CheckCircle2 size={40} color="#4ade80" /></div>
                <p style={{ fontWeight: 600, color: 'var(--text)' }}>Alle Bestände ausreichend</p>
                <p style={{ fontSize: '0.875rem' }}>Kein Artikel ist unter dem Mindestbestand.</p>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '16px' }}>Manuelle Bestellvorschläge</p>
                {Object.entries(groupedBySupplier).map(([supplierId, ings]) => {
                  const supplierName = ings[0].supplier_name || (supplierId === '__none__' ? 'Kein Lieferant' : '–')
                  return (
                    <div key={supplierId} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <p style={{ color: 'var(--text)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><Truck size={14} /> {supplierName}</p>
                        {supplierId !== '__none__' && (
                          <button
                            onClick={() => createPurchaseOrder(supplierId, ings)}
                            disabled={poSaving}
                            style={{ ...btnPrimary, fontSize: '0.8rem', padding: '7px 14px' }}
                          >
                            Bestellung erstellen
                          </button>
                        )}
                      </div>
                      {ings.map(ing => (
                        <div key={ing.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--text)', fontSize: '0.875rem' }}>{ing.name}</span>
                          <span style={{ color: '#f87171', fontSize: '0.875rem' }}>Ist: {Number(ing.current_stock).toFixed(2)} {ing.unit}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Min: {Number(ing.min_stock).toFixed(2)}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="number" step="0.1" min="0"
                              value={suggestedQtys[ing.id] || ''}
                              onChange={e => setSuggestedQtys(prev => ({ ...prev, [ing.id]: e.target.value }))}
                              style={{ ...inputStyle, width: '80px', padding: '4px 8px' }}
                            />
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{ing.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Open POs */}
            {purchaseOrders.length > 0 && (
              <div style={{ marginTop: '32px' }}>
                <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '12px' }}>Offene Bestellungen</p>
                {purchaseOrders.map(po => (
                  <div key={po.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div>
                        <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem' }}>{po.supplier_name}</span>
                        <span style={{ marginLeft: '10px', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600, background: po.status === 'draft' ? '#1e3a5f' : '#14532d', color: po.status === 'draft' ? '#93c5fd' : '#4ade80' }}>
                          {po.status === 'draft' ? 'Entwurf' : 'Bestellt'}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '8px' }}>{new Date(po.created_at).toLocaleDateString('de')}</span>
                      </div>
                      <button onClick={() => markPoReceived(po)} style={{ ...btnSmall, color: '#4ade80', borderColor: '#4ade8044', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={11} /> Als erhalten markieren</button>
                    </div>
                    {po.lines.map(l => (
                      <div key={l.id} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '3px 0' }}>
                        • {l.ingredient_name}: {l.quantity_ordered} {l.unit}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: VERLUSTE ─────────────────────────────────────────────────── */}
        {tab === 'verluste' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
            {/* Form */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '16px' }}>Verlust erfassen</p>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Zutat</label>
                <select value={wasteIngredient} onChange={e => setWasteIngredient(e.target.value)} style={inputStyle}>
                  <option value="">Zutat wählen...</option>
                  {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Menge</label>
                <input type="number" step="0.01" min="0" value={wasteQty} onChange={e => setWasteQty(e.target.value)} style={inputStyle} placeholder="z.B. 0.5" />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Grund</label>
                <select value={wasteReason} onChange={e => setWasteReason(e.target.value as WasteReason)} style={inputStyle}>
                  <option value="spoiled">Verdorben</option>
                  <option value="overcooked">Verkocht</option>
                  <option value="dropped">Heruntergefallen</option>
                  <option value="other">Sonstiges</option>
                </select>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Datum</label>
                <input type="date" value={wasteDate} onChange={e => setWasteDate(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Notiz (optional)</label>
                <input type="text" value={wasteNote} onChange={e => setWasteNote(e.target.value)} style={inputStyle} placeholder="z.B. zu lange gelagert" />
              </div>
              <button onClick={saveWaste} disabled={wasteSaving || !wasteIngredient || !wasteQty} style={{ ...btnPrimary, width: '100%', opacity: wasteSaving || !wasteIngredient || !wasteQty ? 0.5 : 1 }}>
                {wasteSaving ? '...' : 'Verlust buchen'}
              </button>
            </div>

            {/* Weekly report */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <p style={{ color: 'var(--text)', fontWeight: 700 }}>Wochenbericht</p>
                <button onClick={() => {
                  const week = Object.keys(wasteByWeek)[0]
                  if (!week) return
                  exportCSV(wasteByWeek[week].map(l => ({
                    datum: new Date(l.logged_at).toLocaleDateString('de'),
                    zutat: l.ingredient_name, menge: l.quantity, einheit: l.unit,
                    grund: l.reason, kosten: l.purchase_price != null ? (l.quantity * l.purchase_price).toFixed(2) : '–',
                    notiz: l.note || '',
                  })), `verluste-${week.replace(' ', '-')}.csv`)
                }} style={btnSmall}>⬇ CSV Export</button>
              </div>

              {Object.keys(wasteByWeek).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: '12px' }}>
                  <p>Noch keine Verluste erfasst</p>
                </div>
              ) : (
                Object.entries(wasteByWeek).slice(0, 4).map(([week, logs]) => {
                  const totalCost = logs.reduce((s, l) => s + (l.purchase_price != null ? l.quantity * l.purchase_price : 0), 0)
                  return (
                    <div key={week} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem' }}>{week}</span>
                        {totalCost > 0 && <span style={{ color: '#f87171', fontWeight: 600, fontSize: '0.875rem' }}>~{totalCost.toFixed(2)} € Verlust</span>}
                      </div>
                      {logs.map(l => (
                        <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text)' }}>{l.ingredient_name}</span>
                          <span style={{ color: '#f87171' }}>{l.quantity} {l.unit}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{{ spoiled: 'Verdorben', overcooked: 'Verkocht', dropped: 'Gefallen', other: 'Sonstiges' }[l.reason]}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{new Date(l.logged_at).toLocaleDateString('de')}</span>
                        </div>
                      ))}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── MODALS ──────────────────────────────────────────────────────────── */}

      {/* Ingredient Modal */}
      {ingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '420px', border: '1px solid var(--border)' }}>
            <h3 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '20px' }}>{ingModal === 'add' ? 'Zutat hinzufügen' : 'Zutat bearbeiten'}</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input value={ingName} onChange={e => setIngName(e.target.value)} style={inputStyle} placeholder="z.B. Lachs" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Einheit *</label>
                  <select value={ingUnit} onChange={e => setIngUnit(e.target.value)} style={inputStyle}>
                    {['kg', 'g', 'L', 'ml', 'Stück', 'Pkg', 'Flasche', 'Dose'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Aktueller Bestand</label>
                  <input type="number" step="0.01" value={ingStock} onChange={e => setIngStock(e.target.value)} style={inputStyle} placeholder="0" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Mindestmenge</label>
                  <input type="number" step="0.01" value={ingMin} onChange={e => setIngMin(e.target.value)} style={inputStyle} placeholder="0" />
                </div>
                <div>
                  <label style={labelStyle}>Einkaufspreis/Einheit (€)</label>
                  <input type="number" step="0.01" value={ingPrice} onChange={e => setIngPrice(e.target.value)} style={inputStyle} placeholder="optional" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Lieferant</label>
                <select value={ingSupplier} onChange={e => setIngSupplier(e.target.value)} style={inputStyle}>
                  <option value="">Kein Lieferant</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => setIngModal(null)} style={btnSecondary}>{t('common.cancel')}</button>
              <button onClick={saveIng} disabled={ingSaving || !ingName.trim()} style={{ ...btnPrimary, opacity: ingSaving || !ingName.trim() ? 0.5 : 1 }}>
                {ingSaving ? '...' : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Modal */}
      {delivModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '360px', border: '1px solid var(--border)' }}>
            <h3 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '8px' }}>Lieferung einbuchen</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '16px' }}>{delivModal.name} · Aktuell: {Number(delivModal.current_stock).toFixed(2)} {delivModal.unit}</p>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Erhaltene Menge ({delivModal.unit}) *</label>
              <input type="number" step="0.01" min="0" value={delivQty} onChange={e => setDelivQty(e.target.value)} style={inputStyle} placeholder="z.B. 5" autoFocus />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Notiz</label>
              <input value={delivNote} onChange={e => setDelivNote(e.target.value)} style={inputStyle} placeholder="optional" />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDelivModal(null)} style={btnSecondary}>{t('common.cancel')}</button>
              <button onClick={saveDelivery} disabled={delivSaving || !delivQty} style={{ ...btnPrimary, opacity: delivSaving || !delivQty ? 0.5 : 1 }}>
                {delivSaving ? '...' : '+ Einbuchen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Correction Modal */}
      {corrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '360px', border: '1px solid var(--border)' }}>
            <h3 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '8px' }}>Bestand korrigieren</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '16px' }}>{corrModal.name} · Aktuell: {Number(corrModal.current_stock).toFixed(2)} {corrModal.unit}</p>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Differenz ({corrModal.unit}) — negativ = Abzug *</label>
              <input type="number" step="0.01" value={corrDelta} onChange={e => setCorrDelta(e.target.value)} style={inputStyle} placeholder="z.B. -0.5 oder +2" autoFocus />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Notiz (Pflichtfeld für Korrektur)</label>
              <input value={corrNote} onChange={e => setCorrNote(e.target.value)} style={inputStyle} placeholder="Grund der Korrektur" />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setCorrModal(null)} style={btnSecondary}>{t('common.cancel')}</button>
              <button onClick={saveCorrection} disabled={corrSaving || !corrDelta} style={{ ...btnPrimary, opacity: corrSaving || !corrDelta ? 0.5 : 1 }}>
                {corrSaving ? '...' : 'Korrigieren'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Modal */}
      {linkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '500px', border: '1px solid var(--border)', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '4px' }}>Menü-Items verknüpfen</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '16px' }}>
              Lege fest, wie viel von <strong style={{ color: 'var(--text)' }}>{linkModal.name}</strong> pro Portion verbraucht wird.
            </p>
            <div style={{ display: 'grid', gap: '8px', marginBottom: '20px' }}>
              {menuItems.map(mi => (
                <div key={mi.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <input
                    type="checkbox"
                    checked={linkSelections[mi.id]?.checked || false}
                    onChange={e => setLinkSelections(prev => ({ ...prev, [mi.id]: { ...prev[mi.id], checked: e.target.checked, qty: prev[mi.id]?.qty || '1' } }))}
                    style={{ width: '16px', height: '16px', flexShrink: 0 }}
                  />
                  <span style={{ color: 'var(--text)', fontSize: '0.875rem', flex: 1 }}>{mi.name}</span>
                  {linkSelections[mi.id]?.checked && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number" step="0.01" min="0.01"
                        value={linkSelections[mi.id]?.qty || '1'}
                        onChange={e => setLinkSelections(prev => ({ ...prev, [mi.id]: { ...prev[mi.id], qty: e.target.value } }))}
                        style={{ ...inputStyle, width: '70px', padding: '4px 8px' }}
                      />
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{linkModal.unit}/Portion</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setLinkModal(null)} style={btnSecondary}>{t('common.cancel')}</button>
              <button onClick={saveLinks} disabled={linkSaving} style={{ ...btnPrimary, opacity: linkSaving ? 0.5 : 1 }}>
                {linkSaving ? '...' : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Modal */}
      {supModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '420px', border: '1px solid var(--border)' }}>
            <h3 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '20px' }}>{supModal === 'add' ? 'Lieferant hinzufügen' : 'Lieferant bearbeiten'}</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input value={supName} onChange={e => setSupName(e.target.value)} style={inputStyle} placeholder="z.B. Fischhaus Meyer" />
              </div>
              <div>
                <label style={labelStyle}>Ansprechpartner</label>
                <input value={supContact} onChange={e => setSupContact(e.target.value)} style={inputStyle} placeholder="optional" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>E-Mail</label>
                  <input type="email" value={supEmail} onChange={e => setSupEmail(e.target.value)} style={inputStyle} placeholder="optional" />
                </div>
                <div>
                  <label style={labelStyle}>Telefon</label>
                  <input type="tel" value={supPhone} onChange={e => setSupPhone(e.target.value)} style={inputStyle} placeholder="optional" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Notizen</label>
                <input value={supNotes} onChange={e => setSupNotes(e.target.value)} style={inputStyle} placeholder="optional" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => setSupModal(null)} style={btnSecondary}>{t('common.cancel')}</button>
              <button onClick={saveSup} disabled={supSaving || !supName.trim()} style={{ ...btnPrimary, opacity: supSaving || !supName.trim() ? 0.5 : 1 }}>
                {supSaving ? '...' : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
