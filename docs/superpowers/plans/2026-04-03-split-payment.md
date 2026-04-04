# Split Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jeder Gast einer Gruppenbestellung wählt seine Zahlungsart (Online, Bar, Karte via Kellner) und zahlt seinen eigenen Anteil — mit optionaler flexibler Aufteilung wo eine Person für andere zahlt.

**Architecture:** Neue `group_payments`-Tabelle trackt Zahlungsstatus + Zahlungsart pro Mitglied. Jedes Mitglied wählt: Online (Stripe), Bar (Kellner kassiert), oder Karte (Kellner kommt mit Terminal). Sobald alle Members eine Zahlungsart gewählt haben (unabhängig welche), geht die Order an die Küche. Bestehende UI (alle sehen was andere bestellen, Realtime) bleibt komplett unverändert.

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres + Realtime), Stripe Checkout Sessions, TypeScript

---

## Zahlungsarten-Übersicht

| Status | Bedeutung | Wer löst aus |
|--------|-----------|--------------|
| `pending` | Noch keine Wahl getroffen | — |
| `paid` | Online bezahlt via Stripe | Gast (automatisch via Webhook) |
| `covered` | Von anderem Member übernommen | Anderer Gast |
| `cash` | Zahlt bar an Kellner | Gast (klickt "Bar zahlen") |
| `terminal` | Zahlt per Karte an Kellner | Gast (klickt "Karte – Kellner kommt") |

**Order geht an Küche:** Sobald ALLE Members `status !== 'pending'` haben — egal welche Kombination.

---

## Wichtige Dateien

| Datei | Änderung |
|-------|----------|
| `supabase/migrations/20260403_007_split_payment.sql` | Neu: `group_payments` Tabelle + RLS |
| `app/app/api/stripe/group-checkout/route.ts` | Neu: Stripe Checkout für ein Gruppenmitglied |
| `app/app/api/group-payment/offline/route.ts` | Neu: Bar/Terminal-Wahl eintragen (kein Stripe) |
| `app/app/api/stripe/webhook/route.ts` | Erweitern: group_payment Event abfangen |
| `app/app/bestellen/[slug]/GroupPayView.tsx` | Neu: Zahlungsauswahl-UI |
| `app/app/order/[token]/GroupPayView.tsx` | Neu: Zahlungsauswahl-UI (identisch) |
| `app/app/bestellen/[slug]/page.tsx` | Erweitern: Split-Payment Flow einbinden |
| `app/app/order/[token]/page.tsx` | Erweitern: Split-Payment Flow einbinden |
| `app/types/database.ts` | Erweitern: `GroupPayment` Interface |

---

## Kontext: Was aktuell passiert

```
Gäste fügen Items in group_items ein (added_by = Gastname)
→ Creator klickt "Absenden"
→ Items werden aggregiert → eine Order (status: 'new') in orders-Tabelle
→ Gruppe bekommt status: 'submitted'
→ KEIN PAYMENT
```

## Was danach passiert (nach diesem Plan)

```
Gäste fügen Items ein (unverändert)
→ Creator klickt "Absenden"
→ Gruppe: status 'submitted', pro Member ein group_payments Eintrag (pending)
→ Jeder Gast sieht seine Items + 3 Buttons:
    [💳 Online zahlen]  [💵 Bar zahlen]  [🃏 Karte – Kellner kommt]
→ Online: Stripe Checkout → Webhook → status 'paid'
→ Bar: API-Call → status 'cash' (Kellner kassiert am Tisch)
→ Karte: API-Call → status 'terminal' (Kellner kommt mit Gerät)
→ Sobald ALLE !== 'pending' → Order erstellen (status: 'new') → Küche
→ Realtime: alle sehen wer schon gewählt hat
```

---

## Task 1: Datenbank-Migration

**Files:**
- Create: `supabase/migrations/20260403_007_split_payment.sql`

- [ ] **Schritt 1: Migration erstellen**

```sql
-- Split Payment: Zahlung pro Gruppenmitglied tracken

CREATE TABLE IF NOT EXISTS group_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES order_groups(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  stripe_session_id text,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'covered', 'cash', 'terminal')),
  covered_by text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, member_name)
);

CREATE INDEX IF NOT EXISTS idx_group_payments_group
  ON group_payments (group_id);

CREATE INDEX IF NOT EXISTS idx_group_payments_session
  ON group_payments (stripe_session_id);

ALTER TABLE group_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_group_payments"
  ON group_payments FOR SELECT
  USING (true);

CREATE POLICY "service_role_all_group_payments"
  ON group_payments FOR ALL
  TO service_role
  WITH CHECK (true);
```

- [ ] **Schritt 2: Migration einspielen**

```bash
supabase db push
```

Erwartet: Erfolgreich, keine Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add supabase/migrations/20260403_007_split_payment.sql
git commit -m "feat: add group_payments table for split payment"
```

---

## Task 2: TypeScript-Typen

**Files:**
- Modify: `app/types/database.ts`

- [ ] **Schritt 1: `GroupPayment` Interface hinzufügen**

Ans Ende der Datei `app/types/database.ts` anfügen:

```typescript
export type GroupPaymentStatus = 'pending' | 'paid' | 'covered' | 'cash' | 'terminal'

export interface GroupPayment {
  id: string
  group_id: string
  member_name: string
  stripe_session_id: string | null
  amount: number
  status: GroupPaymentStatus
  covered_by: string | null
  paid_at: string | null
  created_at: string
}
```

- [ ] **Schritt 2: Commit**

```bash
git add app/types/database.ts
git commit -m "feat: add GroupPayment type"
```

---

## Task 3: Stripe Checkout API für Online-Zahlung

**Files:**
- Create: `app/app/api/stripe/group-checkout/route.ts`

- [ ] **Schritt 1: Route erstellen**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const { group_id, member_name } = await request.json()

  if (!group_id || !member_name) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: group } = await supabase
    .from('order_groups')
    .select('id, status, restaurant_id, table_id')
    .eq('id', group_id)
    .eq('status', 'submitted')
    .single()

  if (!group) {
    return NextResponse.json({ error: 'Group not found or not submitted' }, { status: 404 })
  }

  const { data: existingPayment } = await supabase
    .from('group_payments')
    .select('status')
    .eq('group_id', group_id)
    .eq('member_name', member_name)
    .single()

  if (existingPayment && existingPayment.status !== 'pending') {
    return NextResponse.json({ error: 'Already paid or committed' }, { status: 409 })
  }

  // Items: eigene + ggf. übernommene Members (Variante B)
  const { data: coveredMembers } = await supabase
    .from('group_payments')
    .select('member_name')
    .eq('group_id', group_id)
    .eq('covered_by', member_name)

  const membersToCharge = [member_name, ...(coveredMembers?.map(c => c.member_name) ?? [])]

  const { data: items } = await supabase
    .from('group_items')
    .select('name, price, qty')
    .eq('group_id', group_id)
    .in('added_by', membersToCharge)

  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'No items for this member' }, { status: 404 })
  }

  // Redirect-URL: für Dine-In /order/[token], für Delivery/Pickup /bestellen/[slug]
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('slug')
    .eq('id', group.restaurant_id)
    .single()

  const { data: table } = await supabase
    .from('tables')
    .select('qr_token')
    .eq('id', group.table_id ?? '')
    .single()

  const base = table?.qr_token
    ? `${process.env.NEXT_PUBLIC_APP_URL}/order/${table.qr_token}`
    : `${process.env.NEXT_PUBLIC_APP_URL}/bestellen/${restaurant?.slug}`

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: items.map(i => ({
      price_data: {
        currency: 'eur',
        product_data: { name: i.name },
        unit_amount: Math.round(i.price * 100),
      },
      quantity: i.qty,
    })),
    metadata: {
      type: 'group_payment',
      group_id: group.id,
      member_name,
    },
    success_url: `${base}?group_paid=${group_id}&member=${encodeURIComponent(member_name)}`,
    cancel_url: `${base}?group_cancel=${group_id}`,
  })

  const total = items.reduce((s, i) => s + i.price * i.qty, 0)

  await supabase.from('group_payments').upsert({
    group_id: group.id,
    member_name,
    stripe_session_id: session.id,
    amount: Math.round(total * 100) / 100,
    status: 'pending',
  }, { onConflict: 'group_id,member_name' })

  return NextResponse.json({ url: session.url })
}

export const runtime = 'nodejs'
```

- [ ] **Schritt 2: Commit**

```bash
git add app/app/api/stripe/group-checkout/route.ts
git commit -m "feat: add group checkout API for online payment"
```

---

## Task 4: Offline-Zahlung API (Bar / Terminal)

**Files:**
- Create: `app/app/api/group-payment/offline/route.ts`

- [ ] **Schritt 1: Route erstellen**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const { group_id, member_name, method } = await request.json()

  if (!group_id || !member_name || !['cash', 'terminal'].includes(method)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Gruppe validieren
  const { data: group } = await supabase
    .from('order_groups')
    .select('id, status, restaurant_id, table_id')
    .eq('id', group_id)
    .eq('status', 'submitted')
    .single()

  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  // Nur wenn noch 'pending'
  const { data: payment } = await supabase
    .from('group_payments')
    .select('status')
    .eq('group_id', group_id)
    .eq('member_name', member_name)
    .single()

  if (payment && payment.status !== 'pending') {
    return NextResponse.json({ error: 'Already committed' }, { status: 409 })
  }

  // Status auf 'cash' oder 'terminal' setzen
  await supabase.from('group_payments')
    .update({ status: method })
    .eq('group_id', group_id)
    .eq('member_name', member_name)

  // Prüfen ob alle Members eine Wahl getroffen haben
  const { data: allPayments } = await supabase
    .from('group_payments')
    .select('status, added_by:member_name, group_id, amount')
    .eq('group_id', group_id)

  const allCommitted = allPayments?.every(p => p.status !== 'pending')

  if (allCommitted && allPayments) {
    await createOrderForGroup(supabase, group)
  }

  return NextResponse.json({ ok: true })
}

async function createOrderForGroup(
  supabase: ReturnType<typeof createClient>,
  group: { id: string; restaurant_id: string; table_id: string | null }
) {
  const { data: groupItems } = await supabase
    .from('group_items')
    .select('item_id, name, price, qty, added_by')
    .eq('group_id', group.id)

  if (!groupItems || groupItems.length === 0) return

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

  const total = groupItems.reduce((s, i) => s + i.price * i.qty, 0)

  await supabase.from('orders').insert({
    restaurant_id: group.restaurant_id,
    order_type: 'dine_in',
    table_id: group.table_id,
    status: 'new',
    items: Object.values(aggregated),
    note: `[Gruppenbestellung] ${groupNote}`,
    total: Math.round(total * 100) / 100,
  })
}

export const runtime = 'nodejs'
```

- [ ] **Schritt 2: Commit**

```bash
git add app/app/api/group-payment/offline/route.ts
git commit -m "feat: add offline payment API for cash/terminal group payments"
```

---

## Task 5: Webhook erweitern

**Files:**
- Modify: `app/app/api/stripe/webhook/route.ts`

- [ ] **Schritt 1: Group-Payment-Handler im Webhook ergänzen**

Im bestehenden `checkout.session.completed`-Block, nach dem bestehenden `session.mode === 'payment' && session.metadata?.order_id`-Check, folgenden Block hinzufügen:

```typescript
// Gruppenanteil online bezahlt
if (session.mode === 'payment' && session.metadata?.type === 'group_payment') {
  const groupId = session.metadata.group_id
  const memberName = session.metadata.member_name

  await supabaseAdmin
    .from('group_payments')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .eq('member_name', memberName)

  // Prüfen ob alle Members eine Wahl getroffen haben (kein 'pending' mehr)
  const { data: allPayments } = await supabaseAdmin
    .from('group_payments')
    .select('status')
    .eq('group_id', groupId)

  const allCommitted = allPayments?.every(p => p.status !== 'pending')

  if (allCommitted) {
    const { data: group } = await supabaseAdmin
      .from('order_groups')
      .select('id, restaurant_id, table_id')
      .eq('id', groupId)
      .single()

    if (group) {
      const { data: groupItems } = await supabaseAdmin
        .from('group_items')
        .select('item_id, name, price, qty, added_by')
        .eq('group_id', groupId)

      if (groupItems && groupItems.length > 0) {
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

        const total = groupItems.reduce((s, i) => s + i.price * i.qty, 0)

        await supabaseAdmin.from('orders').insert({
          restaurant_id: group.restaurant_id,
          order_type: 'dine_in',
          table_id: group.table_id,
          status: 'new',
          items: Object.values(aggregated),
          note: `[Gruppenbestellung] ${groupNote}`,
          total: Math.round(total * 100) / 100,
          customer_name: memberName,
        })
      }
    }
  }
}
```

- [ ] **Schritt 2: Commit**

```bash
git add app/app/api/stripe/webhook/route.ts
git commit -m "feat: handle group payment in stripe webhook"
```

---

## Task 6: GroupPayView Komponente

**Files:**
- Create: `app/app/bestellen/[slug]/GroupPayView.tsx`

- [ ] **Schritt 1: Komponente erstellen**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { GroupItem, GroupPayment } from '@/types/database'

interface Props {
  groupId: string
  memberName: string
  groupItems: GroupItem[]
  accent: string
}

const STATUS_LABEL: Record<string, string> = {
  paid: '✓ Online bezahlt',
  cash: '💵 Zahlt bar',
  terminal: '🃏 Karte – Kellner kommt',
  covered: '✓ Übernommen',
  pending: 'Ausstehend',
}

const STATUS_COLOR: Record<string, string> = {
  paid: '#10b981',
  cash: '#10b981',
  terminal: '#10b981',
  covered: '#10b981',
  pending: '#f59e0b',
}

export default function GroupPayView({ groupId, memberName, groupItems, accent }: Props) {
  const [payments, setPayments] = useState<GroupPayment[]>([])
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('group_payments').select('*').eq('group_id', groupId).then(({ data }) => {
      if (data) setPayments(data as GroupPayment[])
    })

    const channel = supabase
      .channel(`group-payments-${groupId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'group_payments',
        filter: `group_id=eq.${groupId}`,
      }, payload => {
        setPayments(prev => prev.map(p =>
          p.member_name === (payload.new as GroupPayment).member_name
            ? payload.new as GroupPayment
            : p
        ))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [groupId])

  const myItems = groupItems.filter(i => i.added_by === memberName)
  const myTotal = myItems.reduce((s, i) => s + i.price * i.qty, 0)
  const myPayment = payments.find(p => p.member_name === memberName)
  const alreadyCommitted = myPayment?.status !== 'pending' && myPayment?.status !== undefined
  const allMembers = [...new Set(groupItems.map(i => i.added_by))]
  const allCommitted = payments.length > 0 && payments.every(p => p.status !== 'pending')

  async function payOnline() {
    setLoading('online')
    const res = await fetch('/api/stripe/group-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, member_name: memberName }),
    })
    const json = await res.json()
    if (json.url) window.location.href = json.url
    else setLoading(null)
  }

  async function payOffline(method: 'cash' | 'terminal') {
    setLoading(method)
    await fetch('/api/group-payment/offline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, member_name: memberName, method }),
    })
    setPayments(prev => prev.map(p =>
      p.member_name === memberName ? { ...p, status: method } : p
    ))
    setLoading(null)
  }

  async function coverMember(targetMember: string) {
    const coveredItems = groupItems.filter(i => i.added_by === targetMember)
    const coveredAmount = coveredItems.reduce((s, i) => s + i.price * i.qty, 0)

    await supabase.from('group_payments')
      .update({ status: 'covered', covered_by: memberName })
      .eq('group_id', groupId)
      .eq('member_name', targetMember)

    const ownPayment = payments.find(p => p.member_name === memberName)
    if (ownPayment) {
      await supabase.from('group_payments')
        .update({ amount: ownPayment.amount + coveredAmount })
        .eq('group_id', groupId)
        .eq('member_name', memberName)
    }

    setPayments(prev => prev.map(p => {
      if (p.member_name === targetMember) return { ...p, status: 'covered' as const, covered_by: memberName }
      if (p.member_name === memberName) return { ...p, amount: p.amount + coveredAmount }
      return p
    }))
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px' }}>
      <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.2rem', marginBottom: '6px' }}>
        Zahlung
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
        Wähle wie du zahlen möchtest. Die Bestellung geht erst an die Küche wenn alle eine Wahl getroffen haben.
      </p>

      {/* Eigene Items */}
      <div style={{ background: 'var(--surface)', border: `1px solid ${accent}44`, borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
        <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '12px' }}>Deine Bestellung</p>
        {myItems.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{item.qty}× {item.name}</span>
            <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{(item.price * item.qty).toFixed(2)} €</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: '12px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text)', fontWeight: 700 }}>Gesamt</span>
          <span style={{ color: accent, fontWeight: 700, fontSize: '1.1rem' }}>{myTotal.toFixed(2)} €</span>
        </div>
      </div>

      {/* Zahlungsauswahl */}
      {!alreadyCommitted ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
          <button
            onClick={payOnline}
            disabled={loading !== null}
            style={{
              padding: '14px', borderRadius: '12px', border: 'none',
              background: accent, color: '#fff',
              fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
              opacity: loading === 'online' ? 0.7 : 1,
            }}
          >
            {loading === 'online' ? 'Weiterleitung...' : `💳 Online zahlen — ${myTotal.toFixed(2)} €`}
          </button>
          <button
            onClick={() => payOffline('cash')}
            disabled={loading !== null}
            style={{
              padding: '14px', borderRadius: '12px',
              border: '1.5px solid var(--border)', background: 'transparent',
              color: 'var(--text)', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
              opacity: loading === 'cash' ? 0.7 : 1,
            }}
          >
            {loading === 'cash' ? 'Wird gespeichert...' : '💵 Bar zahlen'}
          </button>
          <button
            onClick={() => payOffline('terminal')}
            disabled={loading !== null}
            style={{
              padding: '14px', borderRadius: '12px',
              border: '1.5px solid var(--border)', background: 'transparent',
              color: 'var(--text)', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
              opacity: loading === 'terminal' ? 0.7 : 1,
            }}
          >
            {loading === 'terminal' ? 'Wird gespeichert...' : '🃏 Mit Karte – Kellner kommt'}
          </button>
        </div>
      ) : (
        <div style={{
          background: '#10b98115', border: '1px solid #10b98133',
          borderRadius: '12px', padding: '14px', textAlign: 'center',
          color: '#10b981', fontWeight: 700, marginBottom: '24px', fontSize: '0.9rem',
        }}>
          {STATUS_LABEL[myPayment?.status ?? 'pending']}
        </div>
      )}

      {/* Status aller Mitglieder */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px' }}>
        <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '12px' }}>Gruppe</p>
        {allMembers.map(member => {
          const payment = payments.find(p => p.member_name === member)
          const status = payment?.status ?? 'pending'
          const committed = status !== 'pending'
          const memberTotal = groupItems
            .filter(i => i.added_by === member)
            .reduce((s, i) => s + i.price * i.qty, 0)

          return (
            <div key={member} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ color: member === memberName ? accent : 'var(--text)', fontWeight: member === memberName ? 700 : 400, fontSize: '0.9rem' }}>
                {member === memberName ? 'Du' : member}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{memberTotal.toFixed(2)} €</span>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                  background: `${STATUS_COLOR[status]}20`,
                  color: STATUS_COLOR[status],
                  whiteSpace: 'nowrap',
                }}>
                  {STATUS_LABEL[status]}
                </span>
                {/* Variante B: Für anderen zahlen */}
                {!committed && member !== memberName && alreadyCommitted && (
                  <button
                    onClick={() => coverMember(member)}
                    style={{
                      fontSize: '0.7rem', padding: '2px 7px', borderRadius: '6px',
                      border: '1px solid var(--border)', background: 'transparent',
                      color: 'var(--text-muted)', cursor: 'pointer',
                    }}
                  >
                    Ich zahle
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {allCommitted && (
          <p style={{ color: '#10b981', fontWeight: 700, fontSize: '0.85rem', marginTop: '14px', textAlign: 'center' }}>
            Alle haben gewählt — Bestellung wird vorbereitet!
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Schritt 2: Commit**

```bash
git add app/app/bestellen/[slug]/GroupPayView.tsx
git commit -m "feat: GroupPayView with online/cash/terminal payment options"
```

---

## Task 7: Submit-Flow einbinden (bestellen/[slug])

**Files:**
- Modify: `app/app/bestellen/[slug]/page.tsx`

- [ ] **Schritt 1: `submitGroupOrder`-Funktion ersetzen**

Bestehende `submitGroupOrder`-Funktion finden und ersetzen:

```typescript
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

  await supabase.from('group_payments').insert(payments)
  await supabase.from('order_groups').update({ status: 'submitted' }).eq('id', groupId)
  setOrderMode('group-pay')
}
```

- [ ] **Schritt 2: State-Typ erweitern**

Bestehende State-Definition:
```typescript
const [orderMode, setOrderMode] = useState<'solo' | 'group-create' | 'group-active' | 'group-join'>('solo')
```
Ersetzen durch:
```typescript
const [orderMode, setOrderMode] = useState<'solo' | 'group-create' | 'group-active' | 'group-join' | 'group-pay'>('solo')
```

- [ ] **Schritt 3: URL-Rückkehr nach Stripe-Zahlung**

Im URL-Parameter `useEffect` (dort wo `searchParams.get('order_id')` steht) ergänzen:

```typescript
const groupPaid = searchParams.get('group_paid')
const paidMember = searchParams.get('member')
if (groupPaid && paidMember) {
  setGroupId(groupPaid)
  setMemberName(decodeURIComponent(paidMember))
  setOrderMode('group-pay')
  supabase.from('group_items').select('*').eq('group_id', groupPaid).then(({ data }) => {
    if (data) setGroupItems(data as GroupItem[])
  })
}
```

- [ ] **Schritt 4: GroupPayView einbinden**

Import am Dateianfang hinzufügen:
```typescript
import GroupPayView from './GroupPayView'
```

Im JSX (nach dem `group-active` Block) hinzufügen:
```typescript
{orderMode === 'group-pay' && (
  <GroupPayView
    groupId={groupId!}
    memberName={memberName}
    groupItems={groupItems}
    accent={restaurant.primary_color ?? '#6c63ff'}
  />
)}
```

- [ ] **Schritt 5: Commit**

```bash
git add app/app/bestellen/[slug]/page.tsx
git commit -m "feat: integrate split payment into bestellen flow"
```

---

## Task 8: Submit-Flow einbinden (order/[token])

**Files:**
- Modify: `app/app/order/[token]/page.tsx`
- Create: `app/app/order/[token]/GroupPayView.tsx`

- [ ] **Schritt 1: GroupPayView kopieren**

Datei `app/app/bestellen/[slug]/GroupPayView.tsx` mit identischem Inhalt nach `app/app/order/[token]/GroupPayView.tsx` kopieren.

- [ ] **Schritt 2: `submitGroupOrder` ersetzen**

Gleiche Änderung wie Task 7 Schritt 1 — identischer Code in `app/app/order/[token]/page.tsx`.

- [ ] **Schritt 3: State-Typ erweitern**

Identisch zu Task 7 Schritt 2.

- [ ] **Schritt 4: URL-Rückkehr nach Stripe-Zahlung**

Identisch zu Task 7 Schritt 3.

- [ ] **Schritt 5: GroupPayView einbinden**

```typescript
import GroupPayView from './GroupPayView'
```

```typescript
{orderMode === 'group-pay' && (
  <GroupPayView
    groupId={groupId!}
    memberName={memberName}
    groupItems={groupItems}
    accent={restaurant.primary_color ?? '#6c63ff'}
  />
)}
```

- [ ] **Schritt 6: Commit**

```bash
git add app/app/order/[token]/page.tsx app/app/order/[token]/GroupPayView.tsx
git commit -m "feat: integrate split payment into dine-in order flow"
```

---

## Verifikation

- [ ] Gruppe mit 2 Mitgliedern erstellen, Items hinzufügen
- [ ] "Absenden" → `group_payments` in Supabase: 2 Einträge mit `status: 'pending'`
- [ ] Mitglied 1 wählt "Online zahlen" → Stripe Checkout öffnet, Test-Zahlung → `status: 'paid'`
- [ ] Mitglied 2 wählt "Bar zahlen" → sofort `status: 'cash'`, kein Stripe
- [ ] Da alle committed → `orders` Eintrag mit `status: 'new'` erscheint in Küche
- [ ] Realtime: Zweites Handy sieht in Echtzeit wenn Mitglied 1 bezahlt
- [ ] Mitglied 2 wählt "Karte – Kellner kommt" → `status: 'terminal'`, Order geht an Küche
- [ ] Variante B: Mitglied 1 zahlt für Mitglied 2 ("Ich zahle") → `covered`, Betrag addiert sich in Stripe-Checkout
- [ ] Solo-Bestellungen: komplett unverändert
- [ ] Kein Member kann Status nach Wahl zurücksetzen
