# A4 — Multi-Step Win-Back Drip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatische mehrstufige Email-Serie die startet wenn ein Gast zu lange nicht bestellt hat — konfigurierbar per Owner-Dashboard mit beliebig vielen Steps, optionalen Rabatt-Codes und KI-Generator.

**Architecture:** Täglicher Cron-Job (08:00) enrolled neue inaktive Subscribers in `drip_enrollments` und sendet fällige Steps via bestehendem `sendEmail(immediate: true)` + `buildCampaignEmail()`. State-Machine in `drip_enrollments.current_step` verhindert Doppelversand. Drip stoppt automatisch bei neuer Bestellung via fire-and-forget POST zu `/api/drip/stop`.

**Tech Stack:** Next.js 15 App Router, Supabase Admin Client, `sendEmail()` + `buildCampaignEmail()` + `generateDiscountCode()` aus A3, vercel.json Cron, Anthropic SDK für KI-Generator.

---

## Dateiübersicht

| Datei | Aktion | Zweck |
|-------|--------|-------|
| `supabase/migrations/20260530_062_drip_sequences.sql` | Neu | 3 Tabellen + discount_codes Erweiterung |
| `app/app/api/drip/stop/route.ts` | Neu | Enrollment stoppen bei Bestellung |
| `app/app/api/admin/drip/sequences/route.ts` | Neu | CRUD Sequenzen |
| `app/app/api/admin/drip/steps/route.ts` | Neu | CRUD Steps |
| `app/app/api/cron/drip-trigger/route.ts` | Neu | Täglicher Cron-Job |
| `app/app/api/ai/create-drip-sequence/route.ts` | Neu | KI-Generator für Steps |
| `app/app/admin/marketing/drip/page.tsx` | Neu | Owner-Dashboard |
| `app/vercel.json` | Ändern | Cron-Eintrag 08:00 |
| `app/app/admin/marketing/layout.tsx` | Ändern | Sidebar-Link |
| `app/app/bestellen/[slug]/_v2/BestellenV2.tsx` | Ändern | drip/stop nach Order-Insert |
| `app/app/bestellen/[slug]/_v1/BestellenV1.tsx` | Ändern | idem |

---

## Task 1: Migration

**Files:**
- Create: `supabase/migrations/20260530_062_drip_sequences.sql`

- [ ] **Schritt 1: Migration erstellen**

```sql
-- Migration 062: A4 Win-Back Drip
-- drip_sequences: pro-Restaurant Drip-Konfiguration
-- drip_steps: einzelne Steps einer Sequenz
-- drip_enrollments: trackt Subscriber-Fortschritt
-- discount_codes: drip_step_id Spalte ergänzt

-- 1) drip_sequences
CREATE TABLE IF NOT EXISTS public.drip_sequences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name          text NOT NULL DEFAULT 'Win-Back Drip',
  trigger_days  int NOT NULL DEFAULT 14,
  enabled       boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 2) drip_steps
CREATE TABLE IF NOT EXISTS public.drip_steps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id   uuid NOT NULL REFERENCES public.drip_sequences(id) ON DELETE CASCADE,
  position      int NOT NULL,
  delay_days    int NOT NULL DEFAULT 7,
  subject       text NOT NULL,
  headline      text NOT NULL,
  body_text     text NOT NULL,
  discount_type text CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric,
  expires_days  int NOT NULL DEFAULT 7
);

-- 3) drip_enrollments
CREATE TABLE IF NOT EXISTS public.drip_enrollments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id   uuid NOT NULL REFERENCES public.drip_sequences(id) ON DELETE CASCADE,
  subscriber_id uuid NOT NULL REFERENCES public.marketing_subscribers(id) ON DELETE CASCADE,
  current_step  int NOT NULL DEFAULT 0,
  next_due_at   date NOT NULL,
  enrolled_at   timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  stop_reason   text CHECK (stop_reason IN ('ordered','code_redeemed','unsubscribed','manual','completed')),
  UNIQUE (sequence_id, subscriber_id)
);

-- 4) discount_codes: drip_step_id für Tracking
ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS drip_step_id uuid REFERENCES public.drip_steps(id) ON DELETE SET NULL;

-- 5) Indexes
CREATE INDEX IF NOT EXISTS idx_drip_sequences_restaurant ON public.drip_sequences(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_drip_steps_sequence ON public.drip_steps(sequence_id, position);
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_due ON public.drip_enrollments(next_due_at) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_subscriber ON public.drip_enrollments(subscriber_id) WHERE completed_at IS NULL;

-- 6) GRANTs + RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drip_sequences TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drip_steps TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drip_enrollments TO service_role;

ALTER TABLE public.drip_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drip_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drip_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY drip_sequences_owner_read ON public.drip_sequences
  FOR SELECT TO authenticated
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()));
```

- [ ] **Schritt 2: Migration in Supabase ausführen**

Supabase Dashboard → SQL Editor → Migration einfügen → Run. Prüfen: alle 3 Tabellen erscheinen im Table Editor.

- [ ] **Schritt 3: Commit**

```bash
git add supabase/migrations/20260530_062_drip_sequences.sql
git commit -m "feat(db): drip_sequences + drip_steps + drip_enrollments tables"
```

---

## Task 2: Drip-Stop API

**Files:**
- Create: `app/app/api/drip/stop/route.ts`

- [ ] **Schritt 1: Verzeichnis anlegen und Datei erstellen**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const { subscriberId, reason } = await request.json()

  if (!subscriberId || !reason) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 })
  }

  const validReasons = ['ordered', 'code_redeemed', 'unsubscribed', 'manual']
  if (!validReasons.includes(reason)) {
    return NextResponse.json({ error: 'invalid_reason' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { error } = await supabase
    .from('drip_enrollments')
    .update({ completed_at: new Date().toISOString(), stop_reason: reason })
    .eq('subscriber_id', subscriberId)
    .is('completed_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ stopped: true })
}
```

- [ ] **Schritt 2: Commit**

```bash
git add app/app/api/drip/stop/route.ts
git commit -m "feat(drip): stop enrollment API endpoint"
```

---

## Task 3: Drip CRUD APIs

**Files:**
- Create: `app/app/api/admin/drip/sequences/route.ts`
- Create: `app/app/api/admin/drip/steps/route.ts`

- [ ] **Schritt 1: sequences/route.ts erstellen**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

async function getRestaurantId(request: NextRequest): Promise<string | null> {
  const token = request.headers.get('authorization')?.slice(7)
  if (!token) return null
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await client.auth.getUser(token)
  if (!user) return null
  const admin = createSupabaseAdmin()
  const { data } = await admin.from('restaurants').select('id').eq('owner_id', user.id).maybeSingle()
  return data?.id ?? null
}

export async function GET(request: NextRequest) {
  const restaurantId = await getRestaurantId(request)
  if (!restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('drip_sequences')
    .select('*, drip_steps(*)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const restaurantId = await getRestaurantId(request)
  if (!restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, trigger_days, enabled, steps } = await request.json()
  const supabase = createSupabaseAdmin()

  const { data: seq, error: seqErr } = await supabase
    .from('drip_sequences')
    .insert({ restaurant_id: restaurantId, name: name ?? 'Win-Back Drip', trigger_days: trigger_days ?? 14, enabled: enabled ?? true })
    .select()
    .single()

  if (seqErr || !seq) return NextResponse.json({ error: seqErr?.message }, { status: 500 })

  if (Array.isArray(steps) && steps.length > 0) {
    const stepsToInsert = steps.map((s: Record<string, unknown>, i: number) => ({
      sequence_id: seq.id,
      position: i + 1,
      delay_days: s.delay_days ?? 7,
      subject: s.subject,
      headline: s.headline,
      body_text: s.body_text,
      discount_type: s.discount_type ?? null,
      discount_value: s.discount_value ?? null,
      expires_days: s.expires_days ?? 7,
    }))
    await supabase.from('drip_steps').insert(stepsToInsert)
  }

  const { data: full } = await supabase
    .from('drip_sequences')
    .select('*, drip_steps(*)')
    .eq('id', seq.id)
    .single()

  return NextResponse.json(full, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const restaurantId = await getRestaurantId(request)
  if (!restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await request.json()
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('drip_sequences')
    .update(updates)
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const restaurantId = await getRestaurantId(request)
  if (!restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  const supabase = createSupabaseAdmin()
  const { error } = await supabase
    .from('drip_sequences')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
```

- [ ] **Schritt 2: steps/route.ts erstellen**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

async function getRestaurantId(request: NextRequest): Promise<string | null> {
  const token = request.headers.get('authorization')?.slice(7)
  if (!token) return null
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await client.auth.getUser(token)
  if (!user) return null
  const admin = createSupabaseAdmin()
  const { data } = await admin.from('restaurants').select('id').eq('owner_id', user.id).maybeSingle()
  return data?.id ?? null
}

export async function POST(request: NextRequest) {
  const restaurantId = await getRestaurantId(request)
  if (!restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sequence_id, position, delay_days, subject, headline, body_text, discount_type, discount_value, expires_days } = await request.json()

  // Verify sequence belongs to this restaurant
  const supabase = createSupabaseAdmin()
  const { data: seq } = await supabase.from('drip_sequences').select('id').eq('id', sequence_id).eq('restaurant_id', restaurantId).maybeSingle()
  if (!seq) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('drip_steps')
    .insert({ sequence_id, position, delay_days: delay_days ?? 7, subject, headline, body_text, discount_type: discount_type ?? null, discount_value: discount_value ?? null, expires_days: expires_days ?? 7 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const restaurantId = await getRestaurantId(request)
  if (!restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await request.json()
  const supabase = createSupabaseAdmin()

  // Verify ownership via join
  const { data: step } = await supabase
    .from('drip_steps')
    .select('id, drip_sequences!inner(restaurant_id)')
    .eq('id', id)
    .maybeSingle()

  const seq = step?.drip_sequences as { restaurant_id: string } | null
  if (!step || seq?.restaurant_id !== restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.from('drip_steps').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const restaurantId = await getRestaurantId(request)
  if (!restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  const supabase = createSupabaseAdmin()

  const { data: step } = await supabase
    .from('drip_steps')
    .select('id, drip_sequences!inner(restaurant_id)')
    .eq('id', id)
    .maybeSingle()

  const seq = step?.drip_sequences as { restaurant_id: string } | null
  if (!step || seq?.restaurant_id !== restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('drip_steps').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
```

- [ ] **Schritt 3: Commit**

```bash
git add app/app/api/admin/drip/
git commit -m "feat(api): drip sequences + steps CRUD endpoints"
```

---

## Task 4: Bestellseiten — Drip stoppen bei Bestellung

**Files:**
- Modify: `app/app/bestellen/[slug]/_v2/BestellenV2.tsx`
- Modify: `app/app/bestellen/[slug]/_v1/BestellenV1.tsx`

- [ ] **Schritt 1: BestellenV2 — nach Order-Insert drip/stop aufrufen**

Datei lesen. Im Order-Insert-Handler (nach `const insertedOrderId = data.id`), direkt nach dem bestehenden `if (discountCode && discountInfo ...)` Block einfügen:

```typescript
// Stop any active drip enrollment when guest orders
if (data.customer_id) {
  fetch('/api/drip/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscriberId: data.customer_id, reason: 'ordered' }),
  }).catch(() => {})
}
```

`data.customer_id` ist die `marketing_subscribers.id` — wird vom DB-Trigger (Migration 055) beim Order-Insert automatisch gesetzt.

- [ ] **Schritt 2: BestellenV1 — gleiche Änderung**

Datei lesen. Im Solo-Order-Handler nach `const newOrder = data as Order`, nach dem bestehenden `if (discountCode && discountInfo ...)` Block einfügen:

```typescript
// Stop any active drip enrollment when guest orders
if (data.customer_id) {
  fetch('/api/drip/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscriberId: data.customer_id, reason: 'ordered' }),
  }).catch(() => {})
}
```

- [ ] **Schritt 3: Commit**

```bash
git add "app/app/bestellen/[slug]/_v2/BestellenV2.tsx"
git add "app/app/bestellen/[slug]/_v1/BestellenV1.tsx"
git commit -m "feat(checkout): stop drip enrollment on new order (V1+V2)"
```

---

## Task 5: Cron-Job + vercel.json

**Files:**
- Create: `app/app/api/cron/drip-trigger/route.ts`
- Modify: `app/vercel.json`

- [ ] **Schritt 1: Cron-Route erstellen**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail } from '@/lib/marketing/sendEmail'
import { buildCampaignEmail } from '@/lib/marketing/campaignEmail'
import { generateDiscountCode } from '@/lib/marketing/generateDiscountCode'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
const FROM_EMAIL = process.env.RESEND_FROM ?? 'onboarding@resend.dev'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseAdmin()
  const today = new Date().toISOString().slice(0, 10)
  let enrolled = 0
  let sent = 0
  let skipped = 0

  // ── Phase 1: Neue Enrollments ─────────────────────────────────
  const { data: sequences } = await supabase
    .from('drip_sequences')
    .select('id, restaurant_id, trigger_days')
    .eq('enabled', true)

  for (const seq of sequences ?? []) {
    const cutoff = new Date(Date.now() - seq.trigger_days * 86400 * 1000).toISOString()

    const { data: candidates } = await supabase
      .from('marketing_subscribers')
      .select('id')
      .eq('restaurant_id', seq.restaurant_id)
      .not('opted_in_at', 'is', null)
      .is('unsubscribed_at', null)
      .not('last_order_at', 'is', null)
      .lte('last_order_at', cutoff)

    for (const sub of candidates ?? []) {
      // Check existing enrollment
      const { data: existing } = await supabase
        .from('drip_enrollments')
        .select('id, completed_at')
        .eq('sequence_id', seq.id)
        .eq('subscriber_id', sub.id)
        .maybeSingle()

      if (existing) {
        if (!existing.completed_at) continue // active — skip
        // Completed — re-enroll
        await supabase
          .from('drip_enrollments')
          .update({ current_step: 0, next_due_at: today, completed_at: null, enrolled_at: new Date().toISOString() })
          .eq('id', existing.id)
        enrolled++
      } else {
        await supabase
          .from('drip_enrollments')
          .insert({ sequence_id: seq.id, subscriber_id: sub.id, current_step: 0, next_due_at: today })
        enrolled++
      }
    }
  }

  // ── Phase 2: Fällige Steps versenden ──────────────────────────
  const { data: dueEnrollments } = await supabase
    .from('drip_enrollments')
    .select('id, sequence_id, subscriber_id, current_step, next_due_at')
    .is('completed_at', null)
    .lte('next_due_at', today)

  for (const enrollment of dueEnrollments ?? []) {
    // Lade alle Steps der Sequenz
    const { data: steps } = await supabase
      .from('drip_steps')
      .select('*')
      .eq('sequence_id', enrollment.sequence_id)
      .order('position', { ascending: true })

    if (!steps || steps.length === 0) {
      await supabase
        .from('drip_enrollments')
        .update({ completed_at: new Date().toISOString(), stop_reason: 'completed' })
        .eq('id', enrollment.id)
      continue
    }

    if (enrollment.current_step >= steps.length) {
      await supabase
        .from('drip_enrollments')
        .update({ completed_at: new Date().toISOString(), stop_reason: 'completed' })
        .eq('id', enrollment.id)
      skipped++
      continue
    }

    const step = steps[enrollment.current_step]

    // Lade Subscriber + Restaurant
    const { data: sub } = await supabase
      .from('marketing_subscribers')
      .select('id, email, name')
      .eq('id', enrollment.subscriber_id)
      .maybeSingle()

    if (!sub || !sub.email) { skipped++; continue }

    const { data: sequence } = await supabase
      .from('drip_sequences')
      .select('restaurant_id')
      .eq('id', enrollment.sequence_id)
      .single()

    if (!sequence) { skipped++; continue }

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, slug, logo_url, primary_color')
      .eq('id', sequence.restaurant_id)
      .maybeSingle()

    if (!restaurant) { skipped++; continue }

    // Discount Code generieren falls konfiguriert
    let code: string | null = null
    let expiresAt: Date | null = null

    if (step.discount_type && step.discount_value) {
      code = generateDiscountCode('EVT')
      expiresAt = new Date(Date.now() + (step.expires_days ?? 7) * 86400 * 1000)

      const { error: codeErr } = await supabase.from('discount_codes').insert({
        restaurant_id: restaurant.id,
        subscriber_id: sub.id,
        drip_step_id: step.id,
        code,
        discount_type: step.discount_type,
        discount_value: step.discount_value,
        expires_at: expiresAt.toISOString(),
      })
      if (codeErr) { skipped++; continue }
    }

    const discountLabel = step.discount_type && step.discount_value
      ? step.discount_type === 'percent' ? `${step.discount_value} % Rabatt` : `${step.discount_value} € Rabatt`
      : null

    const unsubToken = Buffer.from(`${sub.id}:unsub`).toString('base64url')
    const unsubscribeUrl = `${APP_URL}/unsubscribe?t=${unsubToken}`
    const ctaUrl = code ? `${APP_URL}/bestellen/${restaurant.slug}?code=${code}` : `${APP_URL}/bestellen/${restaurant.slug}`

    const { subject, html, text, headers } = buildCampaignEmail({
      customerName: sub.name,
      restaurantName: restaurant.name,
      restaurantLogoUrl: restaurant.logo_url,
      primaryColor: restaurant.primary_color ?? '#EA580C',
      subject: step.subject,
      headline: step.headline,
      bodyText: step.body_text,
      code,
      discountLabel,
      expiresAt,
      ctaUrl,
      unsubscribeUrl,
    })

    try {
      await sendEmail({
        restaurantId: restaurant.id,
        fromEmail: FROM_EMAIL,
        fromName: restaurant.name,
        toEmail: sub.email,
        toSubscriberId: sub.id,
        subject,
        html,
        text,
        headers,
        immediate: true,
      })
    } catch {
      skipped++
      continue
    }

    // State-Machine vorwärts
    const isLastStep = enrollment.current_step >= steps.length - 1
    const nextStep = enrollment.current_step + 1
    const nextStepData = steps[nextStep]
    const nextDue = new Date(Date.now() + (nextStepData?.delay_days ?? 7) * 86400 * 1000).toISOString().slice(0, 10)

    await supabase
      .from('drip_enrollments')
      .update(
        isLastStep
          ? { current_step: nextStep, completed_at: new Date().toISOString(), stop_reason: 'completed' }
          : { current_step: nextStep, next_due_at: nextDue }
      )
      .eq('id', enrollment.id)

    sent++
  }

  return NextResponse.json({ enrolled, sent, skipped })
}
```

- [ ] **Schritt 2: vercel.json Cron-Eintrag hinzufügen**

`app/vercel.json` lesen und vierten Eintrag ergänzen:

```json
{
  "crons": [
    { "path": "/api/cron/marketing-automations", "schedule": "0 7 * * *" },
    { "path": "/api/cron/marketing-retry",       "schedule": "0 8 * * *" },
    { "path": "/api/cron/birthday-trigger",      "schedule": "0 7 * * *" },
    { "path": "/api/cron/drip-trigger",          "schedule": "30 7 * * *" }
  ]
}
```

(07:30 UTC — leicht versetzt zu birthday-trigger um DB-Last zu verteilen)

- [ ] **Schritt 3: Commit**

```bash
git add app/app/api/cron/drip-trigger/route.ts app/vercel.json
git commit -m "feat(cron): drip-trigger daily job — enrollment + step sending"
```

---

## Task 6: KI-Generator API

**Files:**
- Create: `app/app/api/ai/create-drip-sequence/route.ts`

- [ ] **Schritt 1: Datei erstellen**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { resolveAiKey } from '@/lib/ai-key'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabaseSSR = await createSupabaseServerSSR()
  const { data: { user } } = await supabaseSSR.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { description } = await request.json()
  if (!description?.trim()) return NextResponse.json({ error: 'description required' }, { status: 400 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: restaurant } = await supabase.from('restaurants').select('id, name').eq('owner_id', user.id).maybeSingle()
  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 403 })

  const apiKey = await resolveAiKey(restaurant.id)
  if (!apiKey) return NextResponse.json({ error: 'KI-Feature requires Pro plan.' }, { status: 402 })

  const anthropic = new Anthropic({ apiKey })

  const systemPrompt = `Du bist ein Email-Marketing-Experte für Restaurants. Erstelle eine Win-Back Drip-Sequenz.

Antworte NUR mit einem validen JSON-Objekt ohne Markdown-Blöcke:
{
  "name": "Name der Sequenz",
  "trigger_days": Zahl (wann der Drip startet, Standard: 14),
  "steps": [
    {
      "position": 1,
      "delay_days": 0,
      "subject": "Email-Betreff (max 60 Zeichen)",
      "headline": "Headline (max 50 Zeichen)",
      "body_text": "Text (max 150 Zeichen)",
      "discount_type": "percent" | "fixed" | null,
      "discount_value": Zahl | null,
      "expires_days": 7
    }
  ]
}

Regeln:
- 2-4 Steps sinnvoll, erster Step delay_days=0 (startet sofort nach trigger_days)
- Spätere Steps haben delay_days=7 (Woche Pause zwischen Steps)
- Erster Step: freundliche Erinnerung, kein Rabatt nötig
- Zweiter Step: kleiner Rabatt (5-10%)
- Dritter Step (falls vorhanden): größerer Rabatt (10-15%) als letzter Versuch
- Texte auf Deutsch, warmherzig und einladend`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: description.trim() }],
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const sequence = JSON.parse(cleaned)

    return NextResponse.json({ sequence })
  } catch {
    return NextResponse.json({ error: 'KI-Generierung fehlgeschlagen.' }, { status: 500 })
  }
}
```

- [ ] **Schritt 2: Commit**

```bash
git add app/app/api/ai/create-drip-sequence/route.ts
git commit -m "feat(ai): drip sequence generator via Claude"
```

---

## Task 7: Owner Dashboard

**Files:**
- Create: `app/app/admin/marketing/drip/page.tsx`

- [ ] **Schritt 1: Datei erstellen**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type DripStep = {
  id: string
  sequence_id: string
  position: number
  delay_days: number
  subject: string
  headline: string
  body_text: string
  discount_type: 'percent' | 'fixed' | null
  discount_value: number | null
  expires_days: number
}

type DripSequence = {
  id: string
  name: string
  trigger_days: number
  enabled: boolean
  created_at: string
  drip_steps: DripStep[]
}

type StepForm = {
  position: number
  delay_days: string
  subject: string
  headline: string
  body_text: string
  discount_type: 'percent' | 'fixed' | ''
  discount_value: string
  expires_days: string
}

const EMPTY_STEP: StepForm = {
  position: 1, delay_days: '7', subject: '', headline: '', body_text: '',
  discount_type: '', discount_value: '', expires_days: '7',
}

export default function DripDashboard() {
  const router = useRouter()
  const [sequences, setSequences] = useState<DripSequence[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)

  // New sequence form
  const [showNewSeq, setShowNewSeq] = useState(false)
  const [seqName, setSeqName] = useState('Win-Back Drip')
  const [seqTrigger, setSeqTrigger] = useState('14')
  const [savingSeq, setSavingSeq] = useState(false)

  // Step editor
  const [editingStep, setEditingStep] = useState<{ sequenceId: string; step: DripStep | null } | null>(null)
  const [stepForm, setStepForm] = useState<StepForm>(EMPTY_STEP)
  const [savingStep, setSavingStep] = useState(false)

  // AI generator
  const [showAi, setShowAi] = useState(false)
  const [aiDesc, setAiDesc] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/owner-login'); return }
      setToken(session.access_token)
    })
  }, [router])

  const load = useCallback(async () => {
    if (!token) return
    const res = await fetch('/api/admin/drip/sequences', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const data = await res.json()
    setSequences(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [token])

  useEffect(() => { load() }, [load])

  async function createSequence() {
    if (!token) return
    setSavingSeq(true)
    await fetch('/api/admin/drip/sequences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: seqName, trigger_days: parseInt(seqTrigger) || 14 }),
    })
    setShowNewSeq(false)
    setSeqName('Win-Back Drip')
    setSeqTrigger('14')
    await load()
    setSavingSeq(false)
  }

  async function toggleSequence(seq: DripSequence) {
    if (!token) return
    await fetch('/api/admin/drip/sequences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: seq.id, enabled: !seq.enabled }),
    })
    await load()
  }

  async function deleteSequence(id: string) {
    if (!token || !confirm('Sequenz und alle Steps löschen?')) return
    await fetch('/api/admin/drip/sequences', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    await load()
  }

  function openNewStep(sequenceId: string) {
    const seq = sequences.find(s => s.id === sequenceId)
    const nextPos = (seq?.drip_steps?.length ?? 0) + 1
    setStepForm({ ...EMPTY_STEP, position: nextPos, delay_days: nextPos === 1 ? '0' : '7' })
    setEditingStep({ sequenceId, step: null })
  }

  function openEditStep(sequenceId: string, step: DripStep) {
    setStepForm({
      position: step.position,
      delay_days: String(step.delay_days),
      subject: step.subject,
      headline: step.headline,
      body_text: step.body_text,
      discount_type: step.discount_type ?? '',
      discount_value: step.discount_value != null ? String(step.discount_value) : '',
      expires_days: String(step.expires_days),
    })
    setEditingStep({ sequenceId, step })
  }

  async function saveStep() {
    if (!token || !editingStep) return
    setSavingStep(true)
    const body = {
      sequence_id: editingStep.sequenceId,
      position: stepForm.position,
      delay_days: parseInt(stepForm.delay_days) || 7,
      subject: stepForm.subject,
      headline: stepForm.headline,
      body_text: stepForm.body_text,
      discount_type: stepForm.discount_type || null,
      discount_value: stepForm.discount_value ? parseFloat(stepForm.discount_value) : null,
      expires_days: parseInt(stepForm.expires_days) || 7,
    }

    if (editingStep.step) {
      await fetch('/api/admin/drip/steps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: editingStep.step.id, ...body }),
      })
    } else {
      await fetch('/api/admin/drip/steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
    }
    setEditingStep(null)
    await load()
    setSavingStep(false)
  }

  async function deleteStep(stepId: string) {
    if (!token || !confirm('Step löschen?')) return
    await fetch('/api/admin/drip/steps', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: stepId }),
    })
    await load()
  }

  async function moveStep(step: DripStep, direction: 'up' | 'down', steps: DripStep[]) {
    if (!token) return
    const sorted = [...steps].sort((a, b) => a.position - b.position)
    const idx = sorted.findIndex(s => s.id === step.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const other = sorted[swapIdx]
    await Promise.all([
      fetch('/api/admin/drip/steps', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: step.id, position: other.position }) }),
      fetch('/api/admin/drip/steps', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: other.id, position: step.position }) }),
    ])
    await load()
  }

  async function generateWithAi() {
    if (!token || !aiDesc.trim()) return
    setAiLoading(true)
    setAiError('')
    try {
      const res = await fetch('/api/ai/create-drip-sequence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: aiDesc }),
      })
      const data = await res.json()
      if (!res.ok) { setAiError(data.error ?? 'Fehler'); setAiLoading(false); return }

      const seq = data.sequence
      await fetch('/api/admin/drip/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: seq.name, trigger_days: seq.trigger_days, steps: seq.steps }),
      })
      setShowAi(false)
      setAiDesc('')
      await load()
    } catch {
      setAiError('Generierung fehlgeschlagen.')
    }
    setAiLoading(false)
  }

  if (loading && token) return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Lade…</div>

  return (
    <div style={{ padding: '24px', maxWidth: '800px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.4rem', margin: 0 }}>💧 Win-Back Drip</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', marginBottom: 0 }}>
            Automatische Email-Serie für inaktive Gäste
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowAi(true)} style={btnSecondary}>✨ Mit KI</button>
          <button onClick={() => setShowNewSeq(true)} style={btnPrimary}>+ Neue Sequenz</button>
        </div>
      </div>

      {/* Sequences */}
      {sequences.length === 0 && !loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '12px' }}>
          Noch keine Sequenz. Erstelle deine erste Win-Back Serie!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sequences.map(seq => {
            const sortedSteps = [...(seq.drip_steps ?? [])].sort((a, b) => a.position - b.position)
            return (
              <div key={seq.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <p style={{ color: 'var(--text)', fontWeight: 700, margin: 0, fontSize: '0.95rem' }}>{seq.name}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '2px 0 0' }}>
                      Startet nach {seq.trigger_days} Tagen Inaktivität · {sortedSteps.length} Step{sortedSteps.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={() => toggleSequence(seq)} style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: seq.enabled ? '#16a34a20' : 'transparent', color: seq.enabled ? '#16a34a' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                      {seq.enabled ? 'Aktiv' : 'Inaktiv'}
                    </button>
                    <button onClick={() => deleteSequence(seq.id)} style={{ padding: '5px 10px', borderRadius: '8px', border: 'none', background: '#ef444415', color: '#ef4444', cursor: 'pointer' }}>🗑</button>
                  </div>
                </div>

                {/* Steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {sortedSteps.map((step, idx) => (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'var(--surface-2, #1a1a2a)', borderRadius: '8px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, minWidth: '50px' }}>
                        {idx === 0 ? `Tag 0` : `+${step.delay_days}T`}
                      </span>
                      <span style={{ color: 'var(--text)', fontSize: '0.82rem', flex: 1 }}>{step.subject}</span>
                      {step.discount_value && (
                        <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>
                          {step.discount_value}{step.discount_type === 'percent' ? '%' : '€'}
                        </span>
                      )}
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => moveStep(step, 'up', sortedSteps)} disabled={idx === 0} style={iconBtn}>↑</button>
                        <button onClick={() => moveStep(step, 'down', sortedSteps)} disabled={idx === sortedSteps.length - 1} style={iconBtn}>↓</button>
                        <button onClick={() => openEditStep(seq.id, step)} style={iconBtn}>✏️</button>
                        <button onClick={() => deleteStep(step.id)} style={{ ...iconBtn, color: '#ef4444' }}>✕</button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => openNewStep(seq.id)} style={{ marginTop: '4px', padding: '6px', borderRadius: '8px', border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left' }}>
                    + Step hinzufügen
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New Sequence Modal */}
      {showNewSeq && (
        <Modal onClose={() => setShowNewSeq(false)} title="Neue Sequenz">
          <label style={labelStyle}>Name</label>
          <input value={seqName} onChange={e => setSeqName(e.target.value)} style={inputStyle} />
          <label style={labelStyle}>Starten nach (Tage Inaktivität)</label>
          <input type="number" min={1} value={seqTrigger} onChange={e => setSeqTrigger(e.target.value)} style={inputStyle} />
          <button onClick={createSequence} disabled={savingSeq || !seqName.trim()} style={{ ...btnPrimary, width: '100%', marginTop: '16px' }}>
            {savingSeq ? 'Speichert…' : 'Sequenz erstellen'}
          </button>
        </Modal>
      )}

      {/* Step Editor Modal */}
      {editingStep && (
        <Modal onClose={() => setEditingStep(null)} title={editingStep.step ? 'Step bearbeiten' : 'Neuer Step'}>
          <label style={labelStyle}>Delay (Tage nach vorherigem Step)</label>
          <input type="number" min={0} value={stepForm.delay_days} onChange={e => setStepForm(f => ({ ...f, delay_days: e.target.value }))} style={inputStyle} />
          <label style={labelStyle}>Betreff</label>
          <input value={stepForm.subject} onChange={e => setStepForm(f => ({ ...f, subject: e.target.value }))} placeholder="Wir vermissen dich! 🍕" style={inputStyle} />
          <label style={labelStyle}>Headline</label>
          <input value={stepForm.headline} onChange={e => setStepForm(f => ({ ...f, headline: e.target.value }))} placeholder="Schön, dich wiederzusehen" style={inputStyle} />
          <label style={labelStyle}>Text</label>
          <textarea value={stepForm.body_text} onChange={e => setStepForm(f => ({ ...f, body_text: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} />
          <label style={labelStyle}>Rabatt (optional)</label>
          <select value={stepForm.discount_type} onChange={e => setStepForm(f => ({ ...f, discount_type: e.target.value as StepForm['discount_type'] }))} style={inputStyle}>
            <option value="">Kein Rabatt</option>
            <option value="percent">Prozent (%)</option>
            <option value="fixed">Fixer Betrag (€)</option>
          </select>
          {stepForm.discount_type && (
            <>
              <label style={labelStyle}>Wert</label>
              <input type="number" min={0} value={stepForm.discount_value} onChange={e => setStepForm(f => ({ ...f, discount_value: e.target.value }))} style={inputStyle} />
              <label style={labelStyle}>Gültig (Tage)</label>
              <input type="number" min={1} value={stepForm.expires_days} onChange={e => setStepForm(f => ({ ...f, expires_days: e.target.value }))} style={inputStyle} />
            </>
          )}
          <button onClick={saveStep} disabled={savingStep || !stepForm.subject.trim() || !stepForm.headline.trim() || !stepForm.body_text.trim()} style={{ ...btnPrimary, width: '100%', marginTop: '16px' }}>
            {savingStep ? 'Speichert…' : 'Speichern'}
          </button>
        </Modal>
      )}

      {/* AI Modal */}
      {showAi && (
        <Modal onClose={() => { setShowAi(false); setAiDesc(''); setAiError('') }} title="✨ Mit KI generieren">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
            Beschreibe dein Ziel — die KI erstellt alle Steps automatisch.
          </p>
          <textarea value={aiDesc} onChange={e => setAiDesc(e.target.value)} placeholder="z.B. 3-stufige Drip-Sequenz für Gäste die 2 Wochen nicht bestellt haben, mit kleinen Rabatten die werden" rows={4} style={{ ...inputStyle, resize: 'vertical' as const }} />
          {aiError && <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: '8px' }}>{aiError}</p>}
          <button onClick={generateWithAi} disabled={aiLoading || !aiDesc.trim()} style={{ ...btnPrimary, width: '100%', marginTop: '14px' }}>
            {aiLoading ? '✨ Generiert…' : '✨ Sequenz generieren'}
          </button>
        </Modal>
      )}
    </div>
  )
}

function Modal({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const btnPrimary: React.CSSProperties = { padding: '10px 18px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }
const btnSecondary: React.CSSProperties = { padding: '10px 18px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }
const iconBtn: React.CSSProperties = { padding: '3px 6px', borderRadius: '6px', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }
const labelStyle: React.CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, marginBottom: '4px', marginTop: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface-2, #1a1a2a)', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit' }
```

- [ ] **Schritt 2: Commit**

```bash
git add app/app/admin/marketing/drip/page.tsx
git commit -m "feat(dashboard): win-back drip dashboard with step editor + AI generator"
```

---

## Task 8: Sidebar-Link

**Files:**
- Modify: `app/app/admin/marketing/layout.tsx`

- [ ] **Schritt 1: Link einfügen**

Datei lesen. Nach dem Geburtstag-Eintrag ergänzen:

```typescript
{ href: '/admin/marketing/drip', icon: '💧', label: 'Win-Back Drip', badge: null },
```

Einfügen direkt nach der Zeile mit `birthday`:
```typescript
{ href: '/admin/marketing/birthday', icon: '🎂', label: 'Geburtstag',   badge: null },
{ href: '/admin/marketing/drip',     icon: '💧', label: 'Win-Back Drip', badge: null },
```

- [ ] **Schritt 2: Commit + Push**

```bash
git add app/app/admin/marketing/layout.tsx
git commit -m "feat(nav): Win-Back Drip link in Marketing-Sidebar"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ drip_sequences + drip_steps + drip_enrollments → Task 1
- ✅ discount_codes.drip_step_id → Task 1
- ✅ opted_in_at IS NOT NULL filter → Task 5 (Phase 1)
- ✅ Re-Enrollment via update statt ON CONFLICT DO NOTHING → Task 5
- ✅ State-Machine (current_step) als Dedup → Task 5
- ✅ Auto-Stop bei Bestellung → Task 4
- ✅ drip/stop API → Task 2
- ✅ CRUD Sequences + Steps → Task 3
- ✅ Cron 07:30 → Task 5
- ✅ KI-Generator → Task 6
- ✅ Dashboard mit ↑↓ Buttons statt Drag&Drop → Task 7
- ✅ Sidebar-Link → Task 8

**Placeholder scan:** Keine TBDs, keine leeren Codeblöcke.

**Type consistency:**
- `DripSequence.drip_steps: DripStep[]` — konsistent in GET (select mit join) + Dashboard
- `stepForm.discount_type: 'percent' | 'fixed' | ''` — konsistent im PATCH/POST Body
- `generateDiscountCode('EVT')` — Typ `'BDAY' | 'ANNI' | 'EVT'` aus Task 2 von A3 ✅
