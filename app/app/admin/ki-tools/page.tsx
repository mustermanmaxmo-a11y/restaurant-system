'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Brain, ArrowRight } from 'lucide-react'
import type { Restaurant } from '@/types/database'

type Tab = 'schicht' | 'kosten' | 'vorbereitung'

const TABS: { id: Tab; label: string; desc: string }[] = [
  { id: 'schicht',      label: 'Schichtübergabe',   desc: 'KI-Übergabebericht generieren' },
  { id: 'kosten',       label: 'Kostenanalyse',      desc: 'Lieferanten & Margen vergleichen' },
  { id: 'vorbereitung', label: 'Vorbereitungsliste', desc: 'Mise en Place für heute/morgen' },
]

function KiToolsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const activeTab: Tab = (searchParams.get('tab') as Tab) || 'schicht'

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/owner-login'); return }
      supabase.from('restaurants').select('*').eq('owner_id', session.user.id).limit(1).maybeSingle()
        .then(({ data }) => {
          if (!data) { router.push('/admin/setup'); return }
          setRestaurant(data)
          setLoading(false)
        })
    })
  }, [router])

  function setTab(tab: Tab) {
    router.push(`/admin/ki-tools?tab=${tab}`)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <p style={{ color: 'var(--text-muted)' }}>Lädt...</p>
    </div>
  )

  if (!restaurant) return null

  const isPro = restaurant.plan === 'pro' || restaurant.plan === 'enterprise'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '32px 24px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={18} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>KI-Tools</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '28px', marginLeft: '48px' }}>
          KI-gestützte Analysen und Empfehlungen für deinen Restaurantbetrieb
        </p>

        {/* Plan gate */}
        {!isPro && (
          <div style={{ background: 'rgba(255,150,0,0.1)', border: '1px solid rgba(255,150,0,0.3)', borderRadius: '12px', padding: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: '#FF9500' }}>Pro-Plan erforderlich</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>KI-Features sind im Pro- und Enterprise-Plan verfügbar.</p>
            </div>
            <button onClick={() => router.push('/admin/billing')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FF9500', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
              Upgrade <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--surface)', borderRadius: '12px', padding: '4px', marginBottom: '28px' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              style={{
                flex: 1, padding: '10px 16px', border: 'none', borderRadius: '9px', cursor: 'pointer',
                background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: '0.85rem', transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'schicht' && <SchichtTab restaurant={restaurant} disabled={!isPro} />}
        {activeTab === 'kosten' && <KostenTab restaurant={restaurant} disabled={!isPro} />}
        {activeTab === 'vorbereitung' && <VorbereitungTab restaurant={restaurant} disabled={!isPro} />}
      </div>
    </div>
  )
}

// ── Placeholder tab components (filled in Tasks 5, 7, 9) ─────────────────────

interface ShiftReport {
  highlights: string[]
  issues: string[]
  open_items: string[]
  recommendation: string
}

interface ShiftSummary {
  totalOrders: number
  totalRevenue: number
  topItems: string[]
  waiterCalls: number
  billCalls: number
}

interface ShiftHandover {
  id: string
  shift_date: string
  shift_type: string
  ai_report: ShiftReport
  orders_summary: ShiftSummary
  created_at: string
}

function SchichtTab({ restaurant, disabled }: { restaurant: Restaurant; disabled: boolean }) {
  const today = new Date().toISOString().split('T')[0]
  const [shiftDate, setShiftDate] = useState(today)
  const [shiftType, setShiftType] = useState<'morning' | 'evening' | 'full'>('evening')
  const [rawNotes, setRawNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ report: ShiftReport; summary: ShiftSummary } | null>(null)
  const [history, setHistory] = useState<ShiftHandover[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const lastCall = useRef(0)

  useEffect(() => {
    supabase
      .from('shift_handovers')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => { setHistory((data as ShiftHandover[]) || []); setHistoryLoading(false) })
  }, [restaurant.id, result])

  async function generate() {
    if (disabled) return
    const now = Date.now()
    if (now - lastCall.current < 30000) { setError('Bitte 30 Sekunden warten.'); return }
    setLoading(true); setError(''); setResult(null)
    lastCall.current = now
    const res = await fetch('/api/ai/shift-handover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId: restaurant.id, shiftDate, shiftType, rawNotes }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Fehler beim Generieren'); setLoading(false); return }
    setResult(data)
    setLoading(false)
  }

  const shiftTypeOptions = [
    { value: 'morning', label: 'Frühschicht' },
    { value: 'evening', label: 'Abendschicht' },
    { value: 'full',    label: 'Ganztag' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '24px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 20px' }}>
          Schicht übergeben
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>DATUM</label>
            <input type="date" value={shiftDate} onChange={e => setShiftDate(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>SCHICHT</label>
            <select value={shiftType} onChange={e => setShiftType(e.target.value as 'morning' | 'evening' | 'full')} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }}>
              {shiftTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>NOTIZEN / BESONDERHEITEN</label>
          <textarea value={rawNotes} onChange={e => setRawNotes(e.target.value)} placeholder="z.B. Tisch 4 hatte Beschwerden, Tomatenlieferung fehlt noch, Freitag war sehr voll..." rows={4} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        {error && <p style={{ color: '#FF3B30', fontSize: '0.85rem', margin: '0 0 12px' }}>{error}</p>}
        <button onClick={generate} disabled={loading || disabled} style={{ background: disabled ? 'rgba(255,255,255,0.1)' : 'var(--accent)', color: disabled ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: '9px', padding: '11px 24px', fontWeight: 700, fontSize: '0.875rem', cursor: disabled ? 'not-allowed' : 'pointer' }}>
          {loading ? 'KI analysiert...' : 'Übergabebericht generieren'}
        </button>
      </div>

      {result && (
        <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Übergabebericht</h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {result.summary.totalOrders} Bestellungen · {result.summary.totalRevenue.toFixed(2)}€ Umsatz
            </div>
          </div>
          {result.report.highlights.length > 0 && <ReportSection color="#34C759" label="Highlights" items={result.report.highlights} />}
          {result.report.issues.length > 0 && <ReportSection color="#FF3B30" label="Probleme" items={result.report.issues} />}
          {result.report.open_items.length > 0 && <ReportSection color="#FF9500" label="Offene Punkte" items={result.report.open_items} />}
          {result.report.recommendation && (
            <div style={{ background: 'rgba(var(--accent-rgb),0.08)', border: '1px solid rgba(var(--accent-rgb),0.2)', borderRadius: '8px', padding: '14px 16px' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text)', fontWeight: 600 }}>Empfehlung für nächste Schicht</p>
              <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{result.report.recommendation}</p>
            </div>
          )}
        </div>
      )}

      <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '24px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 16px' }}>Letzte Übergaben</h2>
        {historyLoading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Lädt...</p>
        ) : history.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Noch keine Übergaben gespeichert.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {history.map(h => <HistoryCard key={h.id} handover={h} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function ReportSection({ color, label, items }: { color: string; label: string; items: string[] }) {
  return (
    <div style={{ marginBottom: '14px', background: `${color}0d`, border: `1px solid ${color}33`, borderRadius: '8px', padding: '14px 16px' }}>
      <p style={{ margin: '0 0 8px', fontSize: '0.78rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
        {items.map((item, i) => <li key={i} style={{ fontSize: '0.875rem', color: 'var(--text)', marginBottom: i < items.length - 1 ? '4px' : 0 }}>{item}</li>)}
      </ul>
    </div>
  )
}

function HistoryCard({ handover }: { handover: ShiftHandover }) {
  const [open, setOpen] = useState(false)
  const shiftLabel = { morning: 'Frühschicht', evening: 'Abendschicht', full: 'Ganztag' }[handover.shift_type] || handover.shift_type
  const date = new Date(handover.shift_date)
  const dateStr = date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })

  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{dateStr} — {shiftLabel}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && handover.ai_report && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {handover.ai_report.highlights?.length > 0 && <p style={{ fontSize: '0.8rem', color: '#34C759', margin: '12px 0 4px', fontWeight: 600 }}>Highlights</p>}
          {handover.ai_report.highlights?.map((h, i) => <p key={i} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0' }}>• {h}</p>)}
          {handover.ai_report.issues?.length > 0 && <p style={{ fontSize: '0.8rem', color: '#FF3B30', margin: '10px 0 4px', fontWeight: 600 }}>Probleme</p>}
          {handover.ai_report.issues?.map((h, i) => <p key={i} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0' }}>• {h}</p>)}
          {handover.ai_report.recommendation && <p style={{ fontSize: '0.8rem', color: 'var(--text)', margin: '10px 0 0' }}>💡 {handover.ai_report.recommendation}</p>}
        </div>
      )}
    </div>
  )
}

interface SupplierPrice {
  id: string
  supplier_id: string
  ingredient_id: string
  price_per_unit: number
  source: string
  updated_at: string
}

interface Ingredient { id: string; name: string; unit: string; purchase_price: number | null }
interface Supplier { id: string; name: string }

interface CostResult {
  supplier_recommendations: { ingredient: string; best_supplier: string; saving: string; reason: string }[]
  margin_alerts: { dish: string; margin: string; issue: string }[]
  price_trends: string[]
  savings_potential: string
  dishMargins?: { name: string; price: number; cost: number; margin: number }[]
}

function KostenTab({ restaurant, disabled }: { restaurant: Restaurant; disabled: boolean }) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [prices, setPrices] = useState<SupplierPrice[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<CostResult | null>(null)
  const [error, setError] = useState('')
  const lastCall = useRef(0)

  const [addIngId, setAddIngId] = useState('')
  const [addSuppId, setAddSuppId] = useState('')
  const [addPrice, setAddPrice] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  const [csvText, setCsvText] = useState('')
  const [csvSuppId, setCsvSuppId] = useState('')
  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [csvSaving, setCsvSaving] = useState(false)
  const [csvError, setCsvError] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: ings }, { data: supps }, { data: sps }] = await Promise.all([
        supabase.from('ingredients').select('id, name, unit, purchase_price').eq('restaurant_id', restaurant.id).order('name'),
        supabase.from('suppliers').select('id, name').eq('restaurant_id', restaurant.id).order('name'),
        supabase.from('supplier_prices').select('*').eq('restaurant_id', restaurant.id),
      ])
      setIngredients((ings as Ingredient[]) || [])
      setSuppliers((supps as Supplier[]) || [])
      setPrices((sps as SupplierPrice[]) || [])
      setLoadingData(false)
    }
    load()
  }, [restaurant.id])

  async function savePrice() {
    if (!addIngId || !addSuppId || !addPrice) return
    setAddSaving(true)
    const existing = prices.find(p => p.supplier_id === addSuppId && p.ingredient_id === addIngId)
    if (existing) {
      await supabase.from('supplier_prices').update({ price_per_unit: parseFloat(addPrice), source: 'manual', updated_at: new Date().toISOString() }).eq('id', existing.id)
    } else {
      await supabase.from('supplier_prices').insert({ restaurant_id: restaurant.id, supplier_id: addSuppId, ingredient_id: addIngId, price_per_unit: parseFloat(addPrice), source: 'manual' })
    }
    const { data } = await supabase.from('supplier_prices').select('*').eq('restaurant_id', restaurant.id)
    setPrices((data as SupplierPrice[]) || [])
    setAddIngId(''); setAddSuppId(''); setAddPrice('')
    setAddSaving(false)
  }

  async function importCsv() {
    if (!csvSuppId || !csvText.trim()) { setCsvError('Lieferant und CSV-Inhalt erforderlich'); return }
    setCsvSaving(true); setCsvError('')
    const lines = csvText.trim().split('\n').slice(1)
    const toUpsert: { restaurant_id: string; supplier_id: string; ingredient_id: string; price_per_unit: number; source: string }[] = []

    for (const line of lines) {
      const parts = line.split(/[,;]/).map(p => p.trim().replace(/^"|"$/g, ''))
      if (parts.length < 2) continue
      const ingName = parts[0]
      const price = parseFloat(parts[1])
      if (!ingName || isNaN(price)) continue
      const ing = ingredients.find(i => i.name.toLowerCase() === ingName.toLowerCase())
      if (!ing) continue
      toUpsert.push({ restaurant_id: restaurant.id, supplier_id: csvSuppId, ingredient_id: ing.id, price_per_unit: price, source: 'csv' })
    }

    if (!toUpsert.length) { setCsvError('Keine passenden Zutaten gefunden. Prüfe Zutatenname in Spalte 1.'); setCsvSaving(false); return }

    for (const row of toUpsert) {
      const existing = prices.find(p => p.supplier_id === row.supplier_id && p.ingredient_id === row.ingredient_id)
      if (existing) {
        await supabase.from('supplier_prices').update({ price_per_unit: row.price_per_unit, source: 'csv', updated_at: new Date().toISOString() }).eq('id', existing.id)
      } else {
        await supabase.from('supplier_prices').insert(row)
      }
    }

    const { data } = await supabase.from('supplier_prices').select('*').eq('restaurant_id', restaurant.id)
    setPrices((data as SupplierPrice[]) || [])
    setCsvModalOpen(false); setCsvText(''); setCsvSuppId(''); setCsvSaving(false)
  }

  async function analyze() {
    if (disabled) return
    const now = Date.now()
    if (now - lastCall.current < 30000) { setError('Bitte 30 Sekunden warten.'); return }
    setAnalyzing(true); setError(''); setResult(null)
    lastCall.current = now
    const res = await fetch('/api/ai/cost-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId: restaurant.id }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Fehler'); setAnalyzing(false); return }
    setResult(data)
    setAnalyzing(false)
  }

  if (loadingData) return <p style={{ color: 'var(--text-muted)', padding: '24px' }}>Lädt Daten...</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Lieferantenpreise</h2>
          <button onClick={() => setCsvModalOpen(true)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-muted)', borderRadius: '8px', padding: '7px 14px', fontSize: '0.8rem', cursor: 'pointer' }}>
            CSV importieren
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px auto', gap: '8px', marginBottom: '16px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>ZUTAT</label>
            <select value={addIngId} onChange={e => setAddIngId(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem' }}>
              <option value="">Zutat wählen</option>
              {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>LIEFERANT</label>
            <select value={addSuppId} onChange={e => setAddSuppId(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem' }}>
              <option value="">Lieferant wählen</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>PREIS (€)</label>
            <input type="number" step="0.01" min="0" value={addPrice} onChange={e => setAddPrice(e.target.value)} placeholder="0.00" style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem', boxSizing: 'border-box' }} />
          </div>
          <button onClick={savePrice} disabled={addSaving || !addIngId || !addSuppId || !addPrice} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '7px', padding: '8px 14px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {addSaving ? '...' : '+ Hinzufügen'}
          </button>
        </div>

        {prices.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Noch keine Lieferantenpreise eingetragen.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>ZUTAT</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>LIEFERANT</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>PREIS</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>AKTUALISIERT</th>
                </tr>
              </thead>
              <tbody>
                {prices.map(p => {
                  const ing = ingredients.find(i => i.id === p.ingredient_id)
                  const sup = suppliers.find(s => s.id === p.supplier_id)
                  const ingPrices = prices.filter(x => x.ingredient_id === p.ingredient_id)
                  const isCheapest = ingPrices.length > 1 && p.price_per_unit === Math.min(...ingPrices.map(x => x.price_per_unit))
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '9px 12px', color: 'var(--text)' }}>{ing?.name || '–'}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--text-muted)' }}>{sup?.name || '–'}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: isCheapest ? '#34C759' : 'var(--text)', fontWeight: isCheapest ? 700 : 400 }}>
                        {Number(p.price_per_unit).toFixed(2)}€/{ing?.unit || ''}
                        {isCheapest && <span style={{ marginLeft: '6px', fontSize: '0.7rem' }}>✓ günstigster</span>}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {new Date(p.updated_at).toLocaleDateString('de-DE')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>KI-Kostenanalyse</h2>
          <button onClick={analyze} disabled={analyzing || disabled} style={{ background: disabled ? 'rgba(255,255,255,0.1)' : 'var(--accent)', color: disabled ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: '9px', padding: '9px 20px', fontWeight: 700, fontSize: '0.85rem', cursor: disabled ? 'not-allowed' : 'pointer' }}>
            {analyzing ? 'Analysiert...' : 'Analyse starten'}
          </button>
        </div>

        {error && <p style={{ color: '#FF3B30', fontSize: '0.85rem', margin: '0 0 12px' }}>{error}</p>}

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {result.supplier_recommendations?.length > 0 && (
              <div>
                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34C759', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Lieferantenempfehlungen</p>
                {result.supplier_recommendations.map((r, i) => (
                  <div key={i} style={{ background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.2)', borderRadius: '8px', padding: '12px 14px', marginBottom: '8px' }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>{r.ingredient} → {r.best_supplier} <span style={{ color: '#34C759' }}>({r.saving} sparen)</span></p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.reason}</p>
                  </div>
                ))}
              </div>
            )}
            {result.margin_alerts?.length > 0 && (
              <div>
                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#FF9500', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Margen-Warnungen</p>
                {result.margin_alerts.map((a, i) => (
                  <div key={i} style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.2)', borderRadius: '8px', padding: '12px 14px', marginBottom: '8px' }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>{a.dish} — Marge {a.margin}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{a.issue}</p>
                  </div>
                ))}
              </div>
            )}
            {result.savings_potential && (
              <div style={{ background: 'rgba(var(--accent-rgb),0.08)', border: '1px solid rgba(var(--accent-rgb),0.2)', borderRadius: '8px', padding: '14px 16px' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' }}>Gesamtes Sparpotenzial</p>
                <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{result.savings_potential}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {csvModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '520px' }}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: '1rem', fontWeight: 700 }}>Preisliste importieren (CSV)</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 16px' }}>
              Format: erste Zeile = Header, dann eine Zeile pro Zutat.<br />
              Spalten: <code>Zutat,Preis pro Einheit</code> (Komma oder Semikolon als Trenner)
            </p>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>LIEFERANT</label>
              <select value={csvSuppId} onChange={e => setCsvSuppId(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem' }}>
                <option value="">Lieferant wählen</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>CSV-INHALT</label>
              <textarea value={csvText} onChange={e => setCsvText(e.target.value)} placeholder={"Zutat,Preis\nTomaten,2.10\nPasta,0.95\nOlivenöl,8.50"} rows={8} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            {csvError && <p style={{ color: '#FF3B30', fontSize: '0.85rem', margin: '0 0 12px' }}>{csvError}</p>}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setCsvModalOpen(false); setCsvError('') }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-muted)', borderRadius: '8px', padding: '9px 18px', fontSize: '0.875rem', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={importCsv} disabled={csvSaving} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
                {csvSaving ? 'Importiert...' : 'Importieren'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface PrepItem {
  ingredient: string
  unit: string
  quantity: number
  note: string
}

interface PrepResult {
  estimated_guests: number
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  prep_items: PrepItem[]
  specials_note: string
}

function VorbereitungTab({ restaurant, disabled }: { restaurant: Restaurant; disabled: boolean }) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const [targetDate, setTargetDate] = useState(tomorrowStr)
  const [guestOverride, setGuestOverride] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PrepResult | null>(null)
  const [error, setError] = useState('')
  const lastCall = useRef(0)

  async function generate(override?: number) {
    if (disabled) return
    const now = Date.now()
    if (now - lastCall.current < 20000) { setError('Bitte 20 Sekunden warten.'); return }
    setLoading(true); setError('')
    lastCall.current = now
    const body: { restaurantId: string; targetDate: string; guestCountOverride?: number } = {
      restaurantId: restaurant.id,
      targetDate,
    }
    if (override != null) body.guestCountOverride = override
    const res = await fetch('/api/ai/prep-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Fehler'); setLoading(false); return }
    setResult(data)
    if (!override) setGuestOverride(String(data.estimated_guests))
    setLoading(false)
  }

  const confidenceColor = { high: '#34C759', medium: '#FF9500', low: '#FF3B30' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '24px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 20px' }}>
          Vorbereitungsliste erstellen
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>
              ZIELDATUM
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={e => { setTargetDate(e.target.value); setResult(null) }}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>
              ERWARTETE GÄSTE (optional)
            </label>
            <input
              type="number"
              min="1"
              value={guestOverride}
              onChange={e => setGuestOverride(e.target.value)}
              placeholder="KI schätzt automatisch"
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {error && <p style={{ color: '#FF3B30', fontSize: '0.85rem', margin: '0 0 12px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => generate()}
            disabled={loading || disabled}
            style={{ background: disabled ? 'rgba(255,255,255,0.1)' : 'var(--accent)', color: disabled ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: '9px', padding: '11px 24px', fontWeight: 700, fontSize: '0.875rem', cursor: disabled ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'KI berechnet...' : 'Liste generieren'}
          </button>
          {result && guestOverride && parseInt(guestOverride) !== result.estimated_guests && (
            <button
              onClick={() => generate(parseInt(guestOverride))}
              disabled={loading}
              style={{ background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: '9px', padding: '11px 20px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
            >
              Mit {guestOverride} Gästen neu berechnen
            </button>
          )}
        </div>
      </div>

      {result && (
        <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
                Vorbereitungsliste — {new Date(targetDate).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })}
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {result.estimated_guests} erwartete Gäste ·{' '}
                <span style={{ color: confidenceColor[result.confidence], fontWeight: 600 }}>
                  {result.confidence === 'high' ? 'Hohe Sicherheit' : result.confidence === 'medium' ? 'Mittlere Sicherheit' : 'Wenig Datenbasis'}
                </span>
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{result.reasoning}</p>
            </div>
            <button
              onClick={() => window.print()}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-muted)', borderRadius: '8px', padding: '7px 14px', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Drucken
            </button>
          </div>

          {result.specials_note && (
            <div style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.25)', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#FF9500', fontWeight: 600 }}>Tagesangebote</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{result.specials_note}</p>
            </div>
          )}

          {result.prep_items.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Keine Zutaten berechenbar — bitte Rezeptverknüpfungen im Lagerbestand pflegen.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>ZUTAT</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>MENGE</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>HINWEIS</th>
                </tr>
              </thead>
              <tbody>
                {result.prep_items
                  .sort((a, b) => b.quantity - a.quantity)
                  .map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 600 }}>{item.ingredient}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--accent)', fontWeight: 700, fontFamily: 'monospace' }}>
                        {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(2)} {item.unit}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.note}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

export default function KiToolsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}><p style={{ color: 'var(--text-muted)' }}>Lädt...</p></div>}>
      <KiToolsContent />
    </Suspense>
  )
}
