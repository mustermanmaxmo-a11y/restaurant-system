# KI-Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 3 AI features for RestaurantOS — KI-Schichtübergabe, KI-Kostenanalyse, and KI-Vorbereitungsliste — accessible from a unified `/admin/ki-tools` page with shortcut buttons on relevant existing pages.

**Architecture:** Three new API routes under `/api/ai/` follow the existing `inventory-suggestions` pattern (service role + `resolveAiKey` + Claude Haiku). A new `/admin/ki-tools` page with URL-param-driven tabs serves as the hub. Two new Supabase tables (`shift_handovers`, `supplier_prices`) persist AI-generated data.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (Postgres + service role), Claude Haiku (`claude-haiku-4-5-20251001`), Anthropic SDK, lucide-react icons, inline styles (project convention)

---

## File Map

**Create:**
- `app/app/admin/ki-tools/page.tsx` — unified KI hub, 3 tabs
- `app/app/api/ai/shift-handover/route.ts` — Schichtübergabe API
- `app/app/api/ai/cost-analysis/route.ts` — Kostenanalyse API
- `app/app/api/ai/prep-list/route.ts` — Vorbereitungsliste API

**Modify:**
- `app/app/admin/layout.tsx` — add KI-Tools nav item
- `app/app/admin/orders/page.tsx` — add KI shortcut button
- `app/app/admin/inventory/page.tsx` — add KI shortcut button
- `app/app/admin/menu/page.tsx` — add KI shortcut button

**DB (Supabase SQL editor):**
- New table: `shift_handovers`
- New table: `supplier_prices`

---

## Task 1: DB Migrations

**Files:** Supabase SQL editor (Dashboard → SQL Editor)

- [ ] **Step 1: Run shift_handovers migration**

In Supabase SQL Editor, run:

```sql
CREATE TABLE shift_handovers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  shift_date      date NOT NULL,
  shift_type      text NOT NULL CHECK (shift_type IN ('morning', 'evening', 'full')),
  raw_notes       text,
  orders_summary  jsonb,
  ai_report       jsonb,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE shift_handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shift_handovers_owner" ON shift_handovers
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Run supplier_prices migration**

```sql
CREATE TABLE supplier_prices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id    uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  ingredient_id  uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  price_per_unit numeric(10,4) NOT NULL,
  source         text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv')),
  updated_at     timestamptz DEFAULT now(),
  created_at     timestamptz DEFAULT now(),
  UNIQUE(supplier_id, ingredient_id)
);

ALTER TABLE supplier_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_prices_owner" ON supplier_prices
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );
```

- [ ] **Step 3: Verify tables exist**

In Supabase Table Editor, confirm both `shift_handovers` and `supplier_prices` appear with correct columns.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "feat: add shift_handovers and supplier_prices migrations (applied in Supabase)"
```

---

## Task 2: Add KI-Tools to Admin Navigation

**Files:**
- Modify: `app/app/admin/layout.tsx`

- [ ] **Step 1: Add Brain icon import and nav entry**

In `app/app/admin/layout.tsx`, find the imports line:
```ts
import {
  LayoutDashboard, UtensilsCrossed, QrCode, CalendarDays,
  Users, Clock, BarChart2, CreditCard, Sun, Moon, LogOut, Utensils, Palette, ChefHat, Package, Tag,
} from 'lucide-react'
```

Replace with:
```ts
import {
  LayoutDashboard, UtensilsCrossed, QrCode, CalendarDays,
  Users, Clock, BarChart2, CreditCard, Sun, Moon, LogOut, Utensils, Palette, ChefHat, Package, Tag, Brain,
} from 'lucide-react'
```

Then in the `NAV` array, add after the `Package` entry:
```ts
  { icon: Brain,    label: 'KI-Tools',     href: '/admin/ki-tools' },
```

Full NAV array after change:
```ts
const NAV = [
  { icon: LayoutDashboard, label: 'Übersicht',     href: '/admin' },
  { icon: ChefHat,         label: 'Bestellungen',  href: '/admin/orders' },
  { icon: UtensilsCrossed, label: 'Menü',           href: '/admin/menu' },
  { icon: Tag,             label: 'Tagesangebote', href: '/admin/specials' },
  { icon: QrCode,          label: 'Tische & QR',   href: '/admin/tables' },
  { icon: CalendarDays,    label: 'Reservierungen', href: '/admin/reservations' },
  { icon: Users,           label: 'Staff',          href: '/admin/staff' },
  { icon: Clock,           label: 'Öffnungszeiten', href: '/admin/opening-hours' },
  { icon: Palette,         label: 'Branding',       href: '/admin/branding' },
  { icon: Package,         label: 'Lagerbestand',   href: '/admin/inventory' },
  { icon: Brain,           label: 'KI-Tools',       href: '/admin/ki-tools' },
  { icon: BarChart2,       label: 'Statistik',      href: '/admin/stats' },
  { icon: CreditCard,      label: 'Billing',        href: '/admin/billing' },
]
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3000/admin` — sidebar should show "KI-Tools" with brain icon between Lagerbestand and Statistik. Clicking it navigates to `/admin/ki-tools` (will 404 until Task 3).

- [ ] **Step 3: Commit**

```bash
git add app/app/admin/layout.tsx
git commit -m "feat: add KI-Tools nav item to admin sidebar"
```

---

## Task 3: KI-Tools Page Shell

**Files:**
- Create: `app/app/admin/ki-tools/page.tsx`

- [ ] **Step 1: Create the page with auth + tab shell**

Create `app/app/admin/ki-tools/page.tsx`:

```tsx
'use client'

import { useEffect, useState, Suspense } from 'react'
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

function SchichtTab({ restaurant, disabled }: { restaurant: Restaurant; disabled: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Schichtübergabe wird in Task 5 implementiert.</p>
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
```

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000/admin/ki-tools`. You should see:
- Header with brain icon and "KI-Tools" title
- Orange plan-gate banner if on basic plan
- 3 tabs with placeholder content
- Tab switching via URL params (`?tab=schicht`, `?tab=kosten`, `?tab=vorbereitung`)

- [ ] **Step 3: Commit**

```bash
git add app/app/admin/ki-tools/page.tsx
git commit -m "feat: add KI-Tools page shell with tab navigation"
```

---

## Task 4: Schichtübergabe API Route

**Files:**
- Create: `app/app/api/ai/shift-handover/route.ts`

- [ ] **Step 1: Create the API route**

Create `app/app/api/ai/shift-handover/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { resolveAiKey } from '@/lib/ai-key'

// Security: No customer PII sent to Claude API.
// Only aggregated order stats, service call counts, and staff notes.

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { restaurantId, shiftDate, shiftType, rawNotes } = body as {
    restaurantId: string
    shiftDate: string       // ISO date string e.g. "2026-04-05"
    shiftType: 'morning' | 'evening' | 'full'
    rawNotes: string
  }

  if (!restaurantId || !shiftDate || !shiftType) {
    return NextResponse.json({ error: 'restaurantId, shiftDate und shiftType sind erforderlich' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('id', restaurantId)
    .single()

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant nicht gefunden' }, { status: 404 })
  }

  const apiKey = await resolveAiKey(restaurantId)
  if (!apiKey) {
    return NextResponse.json({ error: 'KI nicht verfügbar. Bitte Pro-Plan buchen und API Key eintragen.' }, { status: 503 })
  }

  // Fetch shift data in parallel
  const dayStart = `${shiftDate}T00:00:00.000Z`
  const dayEnd   = `${shiftDate}T23:59:59.999Z`

  const [
    { data: orders },
    { data: serviceCalls },
    { data: lastHandovers },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id, total, items, status, created_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd)
      .neq('status', 'cancelled'),
    supabase
      .from('service_calls')
      .select('type')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd),
    supabase
      .from('shift_handovers')
      .select('shift_date, shift_type, ai_report')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  // Build order stats — no PII
  const totalOrders = (orders || []).length
  const totalRevenue = (orders || []).reduce((s, o) => s + (o.total || 0), 0)

  const itemCounts: Record<string, number> = {}
  ;(orders || []).forEach(o => {
    ;(o.items as { name: string; qty: number }[] || []).forEach(i => {
      itemCounts[i.name] = (itemCounts[i.name] || 0) + i.qty
    })
  })
  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => `${name} (${qty}x)`)

  const waiterCalls = (serviceCalls || []).filter(c => c.type === 'waiter').length
  const billCalls   = (serviceCalls || []).filter(c => c.type === 'bill').length

  const shiftTypeLabel = { morning: 'Frühschicht', evening: 'Abendschicht', full: 'Ganztag' }[shiftType]
  const date = new Date(shiftDate)
  const days = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag']

  const historyText = (lastHandovers || []).map(h => {
    const report = h.ai_report as { highlights?: string[]; issues?: string[] } | null
    if (!report) return `[${h.shift_date} ${h.shift_type}] Keine Daten`
    const hl = report.highlights?.[0] || ''
    const iss = report.issues?.[0] || ''
    return `[${h.shift_date} ${h.shift_type}] Highlight: ${hl} | Problem: ${iss}`
  }).join('\n')

  const prompt = `Restaurant: "${restaurant.name}" | ${shiftTypeLabel} | ${days[date.getDay()]}, ${date.toLocaleDateString('de-DE')}

SCHICHT-STATISTIKEN:
- Bestellungen gesamt: ${totalOrders}
- Umsatz: ${totalRevenue.toFixed(2)}€
- Meistbestellte Gerichte: ${topItems.length ? topItems.join(', ') : 'keine Daten'}
- Service Calls: ${waiterCalls}x Kellner, ${billCalls}x Rechnung

PERSONAL-NOTIZEN:
${rawNotes?.trim() || '(keine Notizen eingetragen)'}

LETZTE ÜBERGABEN (Kontext für Muster):
${historyText || '(keine früheren Übergaben)'}

Erstelle einen strukturierten Schichtübergabe-Bericht als JSON (kein anderer Text):
{
  "highlights": ["positives Ereignis oder Ergebnis"],
  "issues": ["Problem oder Beschwerde die aufgetreten ist"],
  "open_items": ["offener Punkt für nächste Schicht"],
  "recommendation": "Eine konkrete Empfehlung für die nächste Schicht"
}

Regeln:
- highlights: 1-3 Punkte, leer wenn nichts Positives
- issues: 1-3 Punkte, leer wenn keine Probleme
- open_items: 1-3 Punkte, nur echte offene Aufgaben
- recommendation: ein konkreter Satz, kein Allgemeinplatz
- Alles auf Deutsch`

  const anthropic = new Anthropic({ apiKey })

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: 'Du bist ein Restaurant-Manager-Assistent. Antworte ausschließlich mit validem JSON. Kein Text davor oder danach.',
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'KI-Analyse momentan nicht verfügbar' }, { status: 500 })

    const aiReport = JSON.parse(jsonMatch[0])

    // Save to DB
    const ordersSummary = { totalOrders, totalRevenue: parseFloat(totalRevenue.toFixed(2)), topItems, waiterCalls, billCalls }
    await supabase.from('shift_handovers').insert({
      restaurant_id: restaurantId,
      shift_date: shiftDate,
      shift_type: shiftType,
      raw_notes: rawNotes || null,
      orders_summary: ordersSummary,
      ai_report: aiReport,
    })

    return NextResponse.json({ report: aiReport, summary: ordersSummary })
  } catch {
    return NextResponse.json({ error: 'KI-Analyse momentan nicht verfügbar' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Test the API manually**

Run the dev server (`npm run dev` in `app/`), then in browser console or Postman:

```js
fetch('/api/ai/shift-handover', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    restaurantId: '<your-restaurant-id>',
    shiftDate: new Date().toISOString().split('T')[0],
    shiftType: 'evening',
    rawNotes: 'Testschicht, alles normal'
  })
}).then(r => r.json()).then(console.log)
```

Expected: `{ report: { highlights: [...], issues: [...], open_items: [...], recommendation: "..." }, summary: {...} }`

If you get `503`: Pro-Plan not set or API key missing.

- [ ] **Step 3: Commit**

```bash
git add app/app/api/ai/shift-handover/route.ts
git commit -m "feat: add KI shift-handover API route"
```

---

## Task 5: Schichtübergabe UI Tab

**Files:**
- Modify: `app/app/admin/ki-tools/page.tsx`

- [ ] **Step 1: Replace the SchichtTab placeholder with full implementation**

In `app/app/admin/ki-tools/page.tsx`, replace the entire `SchichtTab` function:

```tsx
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

      {/* Input Card */}
      <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '24px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 20px' }}>
          Schicht übergeben
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>
              DATUM
            </label>
            <input
              type="date"
              value={shiftDate}
              onChange={e => setShiftDate(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>
              SCHICHT
            </label>
            <select
              value={shiftType}
              onChange={e => setShiftType(e.target.value as 'morning' | 'evening' | 'full')}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }}
            >
              {shiftTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>
            NOTIZEN / BESONDERHEITEN
          </label>
          <textarea
            value={rawNotes}
            onChange={e => setRawNotes(e.target.value)}
            placeholder="z.B. Tisch 4 hatte Beschwerden, Tomatenlieferung fehlt noch, Freitag war sehr voll..."
            rows={4}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>

        {error && <p style={{ color: '#FF3B30', fontSize: '0.85rem', margin: '0 0 12px' }}>{error}</p>}

        <button
          onClick={generate}
          disabled={loading || disabled}
          style={{ background: disabled ? 'rgba(255,255,255,0.1)' : 'var(--accent)', color: disabled ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: '9px', padding: '11px 24px', fontWeight: 700, fontSize: '0.875rem', cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'KI analysiert...' : 'Übergabebericht generieren'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Übergabebericht</h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {result.summary.totalOrders} Bestellungen · {result.summary.totalRevenue.toFixed(2)}€ Umsatz
            </div>
          </div>

          {result.report.highlights.length > 0 && (
            <ReportSection color="#34C759" label="Highlights" items={result.report.highlights} />
          )}
          {result.report.issues.length > 0 && (
            <ReportSection color="#FF3B30" label="Probleme" items={result.report.issues} />
          )}
          {result.report.open_items.length > 0 && (
            <ReportSection color="#FF9500" label="Offene Punkte" items={result.report.open_items} />
          )}
          {result.report.recommendation && (
            <div style={{ background: 'rgba(var(--accent-rgb),0.08)', border: '1px solid rgba(var(--accent-rgb),0.2)', borderRadius: '8px', padding: '14px 16px' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text)', fontWeight: 600 }}>
                Empfehlung für nächste Schicht
              </p>
              <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {result.report.recommendation}
              </p>
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '24px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 16px' }}>
          Letzte Übergaben
        </h2>
        {historyLoading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Lädt...</p>
        ) : history.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Noch keine Übergaben gespeichert.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {history.map(h => (
              <HistoryCard key={h.id} handover={h} />
            ))}
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
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)' }}
      >
        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{dateStr} — {shiftLabel}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && handover.ai_report && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {handover.ai_report.highlights?.length > 0 && (
            <p style={{ fontSize: '0.8rem', color: '#34C759', margin: '12px 0 4px', fontWeight: 600 }}>Highlights</p>
          )}
          {handover.ai_report.highlights?.map((h, i) => <p key={i} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0' }}>• {h}</p>)}
          {handover.ai_report.issues?.length > 0 && (
            <p style={{ fontSize: '0.8rem', color: '#FF3B30', margin: '10px 0 4px', fontWeight: 600 }}>Probleme</p>
          )}
          {handover.ai_report.issues?.map((h, i) => <p key={i} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0' }}>• {h}</p>)}
          {handover.ai_report.recommendation && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text)', margin: '10px 0 0' }}>💡 {handover.ai_report.recommendation}</p>
          )}
        </div>
      )}
    </div>
  )
}
```

Also add these imports at the top of the file (after the existing imports):
```tsx
import { useState, useEffect, useRef } from 'react'
```

Replace the existing `import { useEffect, useState, Suspense } from 'react'` with:
```tsx
import { useEffect, useState, useRef, Suspense } from 'react'
```

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000/admin/ki-tools?tab=schicht`:
- Form shows date picker, shift type selector, textarea
- Clicking "Übergabebericht generieren" calls the API and shows a structured report
- History section shows past handovers (collapsible)

- [ ] **Step 3: Commit**

```bash
git add app/app/admin/ki-tools/page.tsx
git commit -m "feat: implement Schichtübergabe tab UI"
```

---

## Task 6: Kostenanalyse API Route

**Files:**
- Create: `app/app/api/ai/cost-analysis/route.ts`

- [ ] **Step 1: Create the API route**

Create `app/app/api/ai/cost-analysis/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { resolveAiKey } from '@/lib/ai-key'

// Security: No customer PII. Only ingredient names, prices, supplier names, dish names/prices.

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { restaurantId } = body

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId erforderlich' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: restaurant } = await supabase
    .from('restaurants').select('id, name').eq('id', restaurantId).single()
  if (!restaurant) return NextResponse.json({ error: 'Restaurant nicht gefunden' }, { status: 404 })

  const apiKey = await resolveAiKey(restaurantId)
  if (!apiKey) return NextResponse.json({ error: 'KI nicht verfügbar. Bitte Pro-Plan buchen.' }, { status: 503 })

  // Fetch all data in parallel
  const [
    { data: ingredients },
    { data: suppliers },
    { data: supplierPrices },
    { data: menuItems },
    { data: menuItemIngredients },
  ] = await Promise.all([
    supabase.from('ingredients').select('id, name, unit, purchase_price').eq('restaurant_id', restaurantId),
    supabase.from('suppliers').select('id, name').eq('restaurant_id', restaurantId),
    supabase.from('supplier_prices').select('supplier_id, ingredient_id, price_per_unit, updated_at').eq('restaurant_id', restaurantId),
    supabase.from('menu_items').select('id, name, price').eq('restaurant_id', restaurantId).eq('available', true),
    supabase.from('menu_item_ingredients').select('menu_item_id, ingredient_id, quantity_per_serving'),
  ])

  if (!ingredients?.length) {
    return NextResponse.json({ error: 'Keine Zutaten vorhanden' }, { status: 400 })
  }

  // Build lookup maps
  const supplierMap = Object.fromEntries((suppliers || []).map(s => [s.id, s.name]))
  const ingMap = Object.fromEntries((ingredients || []).map(i => [i.id, i]))

  // Build supplier price matrix per ingredient
  const priceMatrix: Record<string, { supplierId: string; supplierName: string; price: number; updatedAt: string }[]> = {}
  ;(supplierPrices || []).forEach(sp => {
    if (!priceMatrix[sp.ingredient_id]) priceMatrix[sp.ingredient_id] = []
    priceMatrix[sp.ingredient_id].push({
      supplierId: sp.supplier_id,
      supplierName: supplierMap[sp.supplier_id] || 'Unbekannt',
      price: sp.price_per_unit,
      updatedAt: sp.updated_at,
    })
  })

  // Calculate margin per menu item
  const dishMargins: { name: string; price: number; cost: number; margin: number }[] = []
  ;(menuItems || []).forEach(item => {
    const itemIngs = (menuItemIngredients || []).filter(mi => mi.menu_item_id === item.id)
    if (!itemIngs.length) return
    const cost = itemIngs.reduce((sum, mi) => {
      const ing = ingMap[mi.ingredient_id]
      if (!ing) return sum
      const price = ing.purchase_price ?? 0
      return sum + price * mi.quantity_per_serving
    }, 0)
    if (cost > 0) {
      const margin = ((item.price - cost) / item.price) * 100
      dishMargins.push({ name: item.name, price: item.price, cost: parseFloat(cost.toFixed(3)), margin: parseFloat(margin.toFixed(1)) })
    }
  })

  // Build prompt — no PII
  const ingredientsText = (ingredients || []).map(ing => {
    const prices = priceMatrix[ing.id] || []
    const pricesStr = prices.length
      ? prices.map(p => `${p.supplierName}: ${p.price}€/${ing.unit}`).join(', ')
      : `Aktueller Preis: ${ing.purchase_price != null ? `${ing.purchase_price}€/${ing.unit}` : 'unbekannt'}`
    return `- ${ing.name} (${ing.unit}): ${pricesStr}`
  }).join('\n')

  const marginsText = dishMargins
    .sort((a, b) => a.margin - b.margin)
    .map(d => `- ${d.name}: VK ${d.price}€, EK ~${d.cost}€, Marge ${d.margin}%`)
    .join('\n')

  const prompt = `Restaurant: "${restaurant.name}"

ZUTATEN MIT LIEFERANTENPREISEN:
${ingredientsText}

GERICHTE MIT KALKULIERTEN MARGEN:
${marginsText || '(Keine Rezeptverknüpfungen vorhanden — Margen nicht berechenbar)'}

Analysiere und antworte EXAKT als JSON (kein anderer Text):
{
  "supplier_recommendations": [
    {"ingredient": "Name", "best_supplier": "Lieferant", "saving": "X€/Einheit", "reason": "kurze Begründung"}
  ],
  "margin_alerts": [
    {"dish": "Gerichtname", "margin": "XX%", "issue": "kurze Beschreibung des Problems"}
  ],
  "price_trends": ["Beobachtung zu Preistrend"],
  "savings_potential": "Konkrete Gesamteinschätzung des Sparpotenzials"
}

Regeln:
- supplier_recommendations: Nur wenn mehrere Lieferanten für dieselbe Zutat vorhanden und Preisunterschied > 5%
- margin_alerts: Nur Gerichte mit Marge unter 40% oder offensichtlich problematisch
- price_trends: 1-2 Punkte, nur wenn auffällig
- savings_potential: ein konkreter Satz
- Alles auf Deutsch`

  const anthropic = new Anthropic({ apiKey })

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: 'Du bist ein Restaurant-Betriebsberater. Antworte ausschließlich mit validem JSON.',
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Analyse momentan nicht verfügbar' }, { status: 500 })

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json({ ...result, dishMargins })
  } catch {
    return NextResponse.json({ error: 'Analyse momentan nicht verfügbar' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify the route compiles**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors for the new route.

- [ ] **Step 3: Commit**

```bash
git add app/app/api/ai/cost-analysis/route.ts
git commit -m "feat: add KI cost-analysis API route"
```

---

## Task 7: Kostenanalyse Tab UI

**Files:**
- Modify: `app/app/admin/ki-tools/page.tsx`

- [ ] **Step 1: Replace KostenTab placeholder with full implementation**

In `app/app/admin/ki-tools/page.tsx`, replace the entire `KostenTab` function:

```tsx
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

  // Add price form
  const [addIngId, setAddIngId] = useState('')
  const [addSuppId, setAddSuppId] = useState('')
  const [addPrice, setAddPrice] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  // CSV
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
    const lines = csvText.trim().split('\n').slice(1) // skip header
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

      {/* Supplier Prices Table */}
      <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Lieferantenpreise</h2>
          <button onClick={() => setCsvModalOpen(true)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-muted)', borderRadius: '8px', padding: '7px 14px', fontSize: '0.8rem', cursor: 'pointer' }}>
            CSV importieren
          </button>
        </div>

        {/* Add price form */}
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

        {/* Price matrix */}
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

      {/* AI Analysis */}
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

      {/* CSV Import Modal */}
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
```

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000/admin/ki-tools?tab=kosten`:
- Lieferantenpreise table shows with "add" form
- Adding a price (select ingredient + supplier + price, click "+ Hinzufügen") saves to DB and refreshes
- "CSV importieren" button opens modal
- "Analyse starten" calls the API and shows recommendations

- [ ] **Step 3: Commit**

```bash
git add app/app/admin/ki-tools/page.tsx
git commit -m "feat: implement Kostenanalyse tab UI with supplier price matrix and CSV import"
```

---

## Task 8: Vorbereitungsliste API Route

**Files:**
- Create: `app/app/api/ai/prep-list/route.ts`

- [ ] **Step 1: Create the API route**

Create `app/app/api/ai/prep-list/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { resolveAiKey } from '@/lib/ai-key'

// Security: No customer PII. Only reservation counts, aggregate order history, menu item names/quantities.

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { restaurantId, targetDate, guestCountOverride } = body as {
    restaurantId: string
    targetDate: string          // ISO date e.g. "2026-04-06"
    guestCountOverride?: number // manual override
  }

  if (!restaurantId || !targetDate) {
    return NextResponse.json({ error: 'restaurantId und targetDate erforderlich' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: restaurant } = await supabase
    .from('restaurants').select('id, name').eq('id', restaurantId).single()
  if (!restaurant) return NextResponse.json({ error: 'Restaurant nicht gefunden' }, { status: 404 })

  const apiKey = await resolveAiKey(restaurantId)
  if (!apiKey) return NextResponse.json({ error: 'KI nicht verfügbar. Bitte Pro-Plan buchen.' }, { status: 503 })

  const target = new Date(targetDate)
  const targetWeekday = target.getDay() // 0=Sun

  // Get last 4 same weekdays for historical average
  const historicalDates: string[] = []
  for (let i = 1; i <= 4; i++) {
    const d = new Date(target)
    d.setDate(d.getDate() - i * 7)
    historicalDates.push(d.toISOString().split('T')[0])
  }

  const [
    { data: reservations },
    { data: menuItems },
    { data: menuItemIngredients },
    { data: ingredients },
    { data: specials },
  ] = await Promise.all([
    supabase
      .from('reservations')
      .select('guests')
      .eq('restaurant_id', restaurantId)
      .eq('date', targetDate)
      .neq('status', 'cancelled'),
    supabase
      .from('menu_items')
      .select('id, name, price')
      .eq('restaurant_id', restaurantId)
      .eq('available', true),
    supabase
      .from('menu_item_ingredients')
      .select('menu_item_id, ingredient_id, quantity_per_serving'),
    supabase
      .from('ingredients')
      .select('id, name, unit')
      .eq('restaurant_id', restaurantId),
    supabase
      .from('daily_specials')
      .select('menu_item_id, label')
      .eq('restaurant_id', restaurantId)
      .eq('active', true),
  ])

  // Historical orders by weekday — fetch in parallel
  const historicalOrdersResults = await Promise.all(
    historicalDates.map(date =>
      supabase
        .from('orders')
        .select('items')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', `${date}T00:00:00.000Z`)
        .lte('created_at', `${date}T23:59:59.999Z`)
        .neq('status', 'cancelled')
    )
  )

  // Calculate historical averages
  const historicalCounts = historicalOrdersResults
    .map(r => r.data?.length || 0)
    .filter(n => n > 0)

  const avgHistoricalOrders = historicalCounts.length
    ? Math.round(historicalCounts.reduce((a, b) => a + b, 0) / historicalCounts.length)
    : 0

  // Count item frequency from historical orders
  const itemFrequency: Record<string, number> = {}
  const totalHistoricalOrders = historicalCounts.reduce((a, b) => a + b, 0)
  historicalOrdersResults.forEach(r => {
    ;(r.data || []).forEach(order => {
      ;(order.items as { name: string; qty: number }[] || []).forEach(item => {
        itemFrequency[item.name] = (itemFrequency[item.name] || 0) + item.qty
      })
    })
  })

  const reservedGuests = (reservations || []).reduce((sum, r) => sum + (r.guests || 0), 0)
  const estimatedGuests = guestCountOverride ?? (reservedGuests + avgHistoricalOrders)
  const confidence = historicalCounts.length >= 3 ? 'high' : historicalCounts.length >= 1 ? 'medium' : 'low'

  // Build ingredient map
  const ingMap = Object.fromEntries((ingredients || []).map(i => [i.id, i]))

  // Build menu text with ingredients
  const menuText = (menuItems || []).map(item => {
    const ings = (menuItemIngredients || []).filter(mi => mi.menu_item_id === item.id)
    if (!ings.length) return `- ${item.name}: keine Zutatenverknüpfung`
    const ingStr = ings.map(mi => {
      const ing = ingMap[mi.ingredient_id]
      return ing ? `${ing.name}: ${mi.quantity_per_serving}${ing.unit}` : ''
    }).filter(Boolean).join(', ')
    const histFreq = itemFrequency[item.name]
    const freqStr = histFreq && totalHistoricalOrders
      ? ` [historisch: ${(histFreq / (totalHistoricalOrders / historicalDates.length)).toFixed(1)}x pro Schicht]`
      : ''
    return `- ${item.name}${freqStr}: ${ingStr}`
  }).join('\n')

  const specialsText = (specials || [])
    .map(s => (menuItems || []).find(m => m.id === s.menu_item_id))
    .filter(Boolean)
    .map(m => m!.name)
    .join(', ')

  const days = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag']
  const historicalStr = historicalCounts.length
    ? `Letzte ${historicalCounts.length} ${days[targetWeekday]}e: ${historicalCounts.join(', ')} Bestellungen (Ø ${avgHistoricalOrders})`
    : 'Keine historischen Daten'

  const prompt = `Restaurant: "${restaurant.name}" | Zieldatum: ${days[targetWeekday]}, ${target.toLocaleDateString('de-DE')}

RESERVIERUNGEN: ${reservedGuests} Personen reserviert
HISTORISCHE DATEN: ${historicalStr}
ERWARTETE GÄSTE: ${estimatedGuests}${guestCountOverride ? ' (manuell korrigiert)' : ' (KI-Schätzung)'}

MENÜ MIT ZUTATEN PRO PORTION:
${menuText || '(Keine Rezeptverknüpfungen vorhanden)'}

AKTIVE TAGESANGEBOTE: ${specialsText || 'keine'}

Erstelle die Vorbereitungsliste als JSON (kein anderer Text):
{
  "estimated_guests": ${estimatedGuests},
  "confidence": "${confidence}",
  "reasoning": "kurze Begründung der Schätzung",
  "prep_items": [
    {"ingredient": "Zutatname", "unit": "Einheit", "quantity": 0.0, "note": "optionale Notiz"}
  ],
  "specials_note": "Empfehlung zu Tagesangeboten oder leer"
}

Regeln:
- quantity: Menge für geschätzte ${estimatedGuests} Gäste + 10% Puffer
- Berechne basierend auf historischer Bestellhäufigkeit der Gerichte
- Nur Zutaten mit Rezeptverknüpfungen in prep_items
- Alles auf Deutsch`

  const anthropic = new Anthropic({ apiKey })

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: 'Du bist ein Küchen-Planungsassistent. Antworte ausschließlich mit validem JSON.',
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Analyse momentan nicht verfügbar' }, { status: 500 })

    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch {
    return NextResponse.json({ error: 'Analyse momentan nicht verfügbar' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd app && npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/app/api/ai/prep-list/route.ts
git commit -m "feat: add KI prep-list API route"
```

---

## Task 9: Vorbereitungsliste Tab UI

**Files:**
- Modify: `app/app/admin/ki-tools/page.tsx`

- [ ] **Step 1: Replace VorbereitungTab placeholder with full implementation**

In `app/app/admin/ki-tools/page.tsx`, replace the entire `VorbereitungTab` function:

```tsx
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
```

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000/admin/ki-tools?tab=vorbereitung`:
- Date defaults to tomorrow, guest count field is empty (shows placeholder)
- "Liste generieren" calls API, shows estimated guests with confidence level
- If guest count is changed and differs from estimate, "neu berechnen" button appears
- Prep list renders sorted by quantity descending
- "Drucken" button triggers browser print

- [ ] **Step 3: Commit**

```bash
git add app/app/admin/ki-tools/page.tsx
git commit -m "feat: implement Vorbereitungsliste tab UI"
```

---

## Task 10: KI Shortcut Buttons on Existing Pages

**Files:**
- Modify: `app/app/admin/orders/page.tsx`
- Modify: `app/app/admin/inventory/page.tsx`
- Modify: `app/app/admin/menu/page.tsx`

- [ ] **Step 1: Add shortcut button to Orders page**

In `app/app/admin/orders/page.tsx`, find the import for lucide-react icons. Add `Brain` to the imports:

```ts
import { ChefHat, Bell, Receipt, Clock, Users, Truck, ShoppingBag, Check, X, Brain } from 'lucide-react'
```

Then add `useRouter` to the imports at the top:
```ts
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
```

Find the main return JSX. At the top-level container, locate where the page title/header is. Add the button at the end of the header area. Find the section that renders the header of the orders page and add this button. Look for the `<h1>` or title area and add after it:

```tsx
const router = useRouter()
```
(Add this line inside the component function, near other state declarations.)

Then find where the header/title of the orders page is rendered (look for text like "Bestellungen" or a `<h1>`) and add this button nearby:

```tsx
<button
  onClick={() => router.push('/admin/ki-tools?tab=schicht')}
  style={{
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
    color: 'var(--text-muted)', borderRadius: '8px', padding: '7px 14px',
    fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500,
  }}
>
  <Brain size={14} />
  Schicht übergeben
</button>
```

- [ ] **Step 2: Add shortcut button to Inventory page**

In `app/app/admin/inventory/page.tsx`, `useRouter` is already imported. Only add `Brain` to the lucide-react import. The inventory page already has multiple lucide imports — find the line starting with `import {` that contains lucide icon names and add `Brain` to it.

Add `const router = useRouter()` inside the `InventoryPage` component function (alongside the other state declarations near the top).

Find the top-level page header in the inventory page (the section with tabs or title) and add:

```tsx
<button
  onClick={() => router.push('/admin/ki-tools?tab=kosten')}
  style={{
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
    color: 'var(--text-muted)', borderRadius: '8px', padding: '7px 14px',
    fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500,
  }}
>
  <Brain size={14} />
  Kostenanalyse
</button>
```

- [ ] **Step 3: Add shortcut button to Menu page**

In `app/app/admin/menu/page.tsx`, apply the same pattern as above:
- Add `Brain` to lucide-react imports
- Add `useRouter` + `const router = useRouter()`
- Add button near the page header:

```tsx
<button
  onClick={() => router.push('/admin/ki-tools?tab=vorbereitung')}
  style={{
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
    color: 'var(--text-muted)', borderRadius: '8px', padding: '7px 14px',
    fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500,
  }}
>
  <Brain size={14} />
  Vorbereitungsliste
</button>
```

- [ ] **Step 4: Verify in browser**

- `/admin/orders` → "Schicht übergeben" button navigates to `?tab=schicht`
- `/admin/inventory` → "Kostenanalyse" button navigates to `?tab=kosten`
- `/admin/menu` → "Vorbereitungsliste" button navigates to `?tab=vorbereitung`

- [ ] **Step 5: Commit**

```bash
git add app/app/admin/orders/page.tsx app/app/admin/inventory/page.tsx app/app/admin/menu/page.tsx
git commit -m "feat: add KI shortcut buttons to orders, inventory, and menu pages"
```

---

## Summary

After all tasks are complete:
- 2 new DB tables: `shift_handovers`, `supplier_prices`
- 3 new API routes: `/api/ai/shift-handover`, `/api/ai/cost-analysis`, `/api/ai/prep-list`
- 1 new admin page: `/admin/ki-tools` with 3 fully functional tabs
- 3 existing pages updated with KI shortcut buttons
- All KI features gated behind Pro/Enterprise plan via `resolveAiKey`
- Schichtübergabe history persisted in DB, enriches future AI analyses
