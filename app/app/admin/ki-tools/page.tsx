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

function KostenTab({ restaurant, disabled }: { restaurant: Restaurant; disabled: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Kostenanalyse wird in Task 7 implementiert.</p>
    </div>
  )
}

function VorbereitungTab({ restaurant, disabled }: { restaurant: Restaurant; disabled: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Vorbereitungsliste wird in Task 9 implementiert.</p>
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
