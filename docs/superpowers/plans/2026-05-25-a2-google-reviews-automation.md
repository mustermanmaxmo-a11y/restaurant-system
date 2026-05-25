# Track A2 — Google Reviews Automation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nach jeder Bestellung wird X Stunden nach `status='served'` automatisch eine Rating-Email mit anklickbaren Sternen verschickt — via Upstash QStash für exakte Auslieferung pro Order, mit Skip-Logik wenn der Gast schon in-app bewertet hat.

**Architecture:** Migration 059 fügt `served_at` + `rating_email_sent_at` zu `orders` und `rating_email_enabled` + `rating_email_delay_hours` zu `restaurants`. Ein BEFORE-Trigger setzt `served_at` automatisch. Beim App-Code-Pfad, der `status='served'` setzt, wird zusätzlich ein QStash-Job mit konfigurierbarem Delay geschoben. Nach Delay POSTet QStash zu einem signaturverifizierten Webhook, der Skip-Conditions prüft und Track D's `sendEmail()` Queue nutzt. Owner-Config in `/admin/settings`, Stats-Dashboard auf neuer Seite `/admin/marketing/reviews`.

**Tech Stack:** PostgreSQL 15+ (Supabase), Next.js 15 App Router, TypeScript, **Upstash QStash** (neu), Resend (existing), `@supabase/supabase-js`.

**Spec:** [`docs/superpowers/specs/2026-05-25-a2-google-reviews-automation-design.md`](../specs/2026-05-25-a2-google-reviews-automation-design.md)

**Pre-Plan resolved (Open Questions aus Spec):**
- `status='served'` UPDATE-Call-Sites: `app/app/staff/page.tsx:230-238` (`updateOrderStatus`) + `app/app/admin/orders/page.tsx:279-281` (`advanceStatus`). Plan baut einen Helper `setOrderStatus()` und ersetzt beide Call-Sites.
- `marketing_subscribers` Schema: KEINE Spalte `opted_in`. Stattdessen: `opted_in_at timestamptz` (NULL = nie opted in) + `unsubscribed_at timestamptz` (NULL = noch subscribed). Opted-in-Check: `opted_in_at IS NOT NULL AND unsubscribed_at IS NULL`.
- `@upstash/qstash` Version: `^2.7.0` (latest stable per npm)
- `buildRatingEmailHtml` Refactor: existierender Code in `automation-run/route.ts` Zeilen 368-381 (HTML-Block) + 369-372 (HMAC-Star-Links).
- `google_review_clicked` Tracking: 2 Call-Sites — `OrderRating.tsx` (Klick auf "Auf Google bewerten" in-app) und `app/feedback/[orderId]/FeedbackClient.tsx` (Klick auf gleichen Button in Email-Landing).

---

## File Structure

**Create:**
- `supabase/migrations/20260525_059_rating_email_automation.sql` — Schema + BEFORE-Trigger + Indexes + GRANTs
- `app/lib/marketing/qstash.ts` — Typed QStash publish wrapper
- `app/lib/marketing/scheduleRatingEmail.ts` — High-level schedule function
- `app/lib/marketing/ratingEmail.ts` — Extracted `buildRatingEmailHtml()` from automation-run
- `app/lib/orders/setOrderStatus.ts` — Wrapper that does UPDATE + scheduleRatingEmail when transitioning to served
- `app/lib/marketing/trackEvent.ts` — Tiny fire-and-forget helper for client-side `marketing_events` inserts (used by google_review_clicked tracking)
- `app/app/api/jobs/send-rating-email/route.ts` — QStash webhook handler
- `app/app/admin/marketing/reviews/page.tsx` — Owner stats dashboard

**Modify:**
- `app/package.json` — add `@upstash/qstash` dependency
- `app/.env.example` — document new QSTASH_* + UNSUBSCRIBE_SECRET env vars (if not present)
- `app/app/api/marketing/automation-run/route.ts` — use new `buildRatingEmailHtml()` helper instead of inline HTML
- `app/app/staff/page.tsx` — `updateOrderStatus` uses `setOrderStatus()` helper
- `app/app/admin/orders/page.tsx` — `advanceStatus` uses `setOrderStatus()` helper
- `app/app/admin/settings/page.tsx` — neue Auto-Rating-Email Konfig-Sektion + Link zum Reviews-Dashboard
- `app/components/order/OrderRating.tsx` — track `google_review_clicked` on button click
- `app/app/feedback/[orderId]/FeedbackClient.tsx` — track `google_review_clicked` on button click

---

## Phase 1 — Database (Migration 059)

### Task 1: Schema + BEFORE-Trigger für served_at + GRANTs

**Files:**
- Create: `supabase/migrations/20260525_059_rating_email_automation.sql`

- [ ] **Step 1: Migration-Datei anlegen**

```sql
-- Migration 059: Rating-Email Automation
-- - orders.served_at + rating_email_sent_at
-- - restaurants.rating_email_enabled + rating_email_delay_hours
-- - BEFORE trigger to auto-set served_at on status transitions
-- - Index for stats queries

BEGIN;

-- 1) orders: served_at + dedup column
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS served_at timestamptz,
  ADD COLUMN IF NOT EXISTS rating_email_sent_at timestamptz;

-- 2) restaurants: per-restaurant config
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS rating_email_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rating_email_delay_hours int DEFAULT 4
    CHECK (rating_email_delay_hours BETWEEN 1 AND 72);

-- 3) BEFORE-Trigger: auto-set served_at when status transitions to 'served'
CREATE OR REPLACE FUNCTION public.set_served_at() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'served' AND OLD.status IS DISTINCT FROM 'served' THEN
    NEW.served_at := COALESCE(NEW.served_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_served_at ON public.orders;
CREATE TRIGGER trg_set_served_at
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_served_at();

-- 4) Index for stats queries (pending rating emails)
CREATE INDEX IF NOT EXISTS idx_orders_served_at_pending_rating
  ON public.orders (served_at)
  WHERE served_at IS NOT NULL AND rating_email_sent_at IS NULL;

-- 5) Backfill: existing served orders get served_at = updated_at as best approximation
-- (so historical orders don't trigger Email when feature is enabled)
UPDATE public.orders
  SET served_at = updated_at,
      rating_email_sent_at = COALESCE(updated_at, now())
  WHERE status = 'served' AND served_at IS NULL;

-- GRANTs (laut feedback_supabase_grants)
-- New columns inherit existing table grants — no extra GRANT needed for ALTERed tables.
-- Confirm: anon can SELECT restaurants (for client-side rating_email_delay lookup is not needed,
-- but rating_email_enabled stays anon-readable via existing restaurants SELECT grant)

COMMIT;
```

- [ ] **Step 2: Migration via Supabase Studio SQL Editor anwenden** (User-Schritt — Implementer informs user)

Expected: "Success. No rows returned"

- [ ] **Step 3: Schema-Verifikation**

```sql
\d public.orders        -- served_at, rating_email_sent_at present
\d public.restaurants   -- rating_email_enabled, rating_email_delay_hours present
SELECT proname FROM pg_proc WHERE proname = 'set_served_at';
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_set_served_at';
```

Expected: all four checks return data.

- [ ] **Step 4: Backfill-Verifikation**

```sql
SELECT COUNT(*) FROM orders WHERE status = 'served' AND served_at IS NULL;
-- Expected: 0
SELECT COUNT(*) FROM orders WHERE status = 'served' AND rating_email_sent_at IS NULL;
-- Expected: 0 (so historical served orders don't trigger automation)
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260525_059_rating_email_automation.sql
git commit -m "feat(db): migration 059 — rating email automation schema + served_at trigger"
```

---

## Phase 2 — QStash Setup + Wrapper

### Task 2: Install @upstash/qstash + ENV-Vars dokumentieren

**Files:**
- Modify: `app/package.json` (via npm install)
- Modify: `app/.env.example` (add new env vars)

- [ ] **Step 1: Package installieren**

```bash
cd app
npm install @upstash/qstash
```

Expected: `@upstash/qstash` added to `dependencies` in package.json (version ^2.7.0 or newer).

- [ ] **Step 2: ENV-Variablen in `.env.example` dokumentieren** (if file doesn't exist, create it)

Add to `app/.env.example`:

```
# Upstash QStash (Track A2 — delayed rating emails)
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
```

If `.env.example` doesn't exist or these variables are already documented elsewhere, just ensure they're listed somewhere obvious.

- [ ] **Step 3: User-Hinweis (Bash echo, NOT a code change)**

Print to console:
```
USER ACTION REQUIRED:
1. Upstash Dashboard → QStash aktivieren (free tier)
2. Copy QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY
3. Add to Vercel ENV (both Production + Preview)
4. Also add to local .env.local for dev testing
```

- [ ] **Step 4: Commit**

```bash
git add app/package.json app/package-lock.json app/.env.example
git commit -m "chore(deps): add @upstash/qstash for delayed rating-email scheduling"
```

---

### Task 3: QStash Wrapper

**Files:**
- Create: `app/lib/marketing/qstash.ts`

- [ ] **Step 1: Wrapper schreiben**

```typescript
import { Client } from '@upstash/qstash'

let _client: Client | null = null
function getClient(): Client {
  if (!_client) {
    const token = process.env.QSTASH_TOKEN
    if (!token) throw new Error('QSTASH_TOKEN not configured')
    _client = new Client({ token })
  }
  return _client
}

export interface PublishDelayedJobArgs {
  url: string
  body: Record<string, unknown>
  delaySeconds: number
  /** Optional dedup ID — QStash drops duplicate sends within ~24h window */
  dedupeId?: string
}

export type PublishResult =
  | { success: true; messageId: string }
  | { success: false; error: string }

export async function publishDelayedJob(args: PublishDelayedJobArgs): Promise<PublishResult> {
  try {
    const client = getClient()
    const res = await client.publishJSON({
      url: args.url,
      body: args.body,
      delay: args.delaySeconds,
      deduplicationId: args.dedupeId,
    })
    return { success: true, messageId: res.messageId }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'unknown' }
  }
}
```

- [ ] **Step 2: TypeScript-Check**

```bash
cd app && npx tsc --noEmit 2>&1 | grep -E "qstash" | head -5
```

Expected: no errors related to qstash.ts.

- [ ] **Step 3: Commit**

```bash
git add app/lib/marketing/qstash.ts
git commit -m "feat(marketing): add QStash typed wrapper for delayed job scheduling"
```

---

## Phase 3 — Email-Template Refactor

### Task 4: Extract buildRatingEmailHtml() into reusable helper

**Files:**
- Create: `app/lib/marketing/ratingEmail.ts`

- [ ] **Step 1: Helper schreiben**

```typescript
import crypto from 'crypto'

export interface RatingEmailInput {
  order: { id: string; customer_name?: string | null }
  restaurant: {
    name: string
    logo_url: string | null
    primary_color?: string | null
  }
  unsubscribeSecret: string
  appUrl: string
  /** Full unsubscribe URL (with token), used in footer + List-Unsubscribe header */
  unsubscribeUrl: string
}

export interface RatingEmailOutput {
  subject: string
  html: string
  text: string
  headers: Record<string, string>
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function computeStarToken(orderId: string, stars: number, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${orderId}:${stars}`).digest('hex').slice(0, 32)
}

export function buildRatingEmailHtml(input: RatingEmailInput): RatingEmailOutput {
  const { order, restaurant, unsubscribeSecret, appUrl, unsubscribeUrl } = input
  const customerName = order.customer_name?.trim() || 'Hallo'
  const primary = restaurant.primary_color || '#EA580C'

  // 5 HMAC-tokenized star links → /api/feedback?o=...&s=N&t=...
  const starLinks = [1, 2, 3, 4, 5].map(n => {
    const t = computeStarToken(order.id, n, unsubscribeSecret)
    return `${appUrl}/api/feedback?o=${order.id}&s=${n}&t=${t}`
  })

  const starsHtml = starLinks.map(href =>
    `<a href="${href}" style="display:inline-block;padding:6px 8px;text-decoration:none;font-size:32px;line-height:1;color:#d4d4d8;">&#9733;</a>`
  ).join('')

  const logoHtml = restaurant.logo_url
    ? `<img src="${escapeHtml(restaurant.logo_url)}" alt="${escapeHtml(restaurant.name)}" style="max-height:48px;max-width:180px;display:block;margin:0 auto;">`
    : `<div style="font-size:20px;font-weight:700;color:#0a0a0a;">${escapeHtml(restaurant.name)}</div>`

  const subject = `Wie war's bei ${restaurant.name}? ⭐`

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:32px 48px 16px;text-align:center;">${logoHtml}</td></tr>
      <tr><td style="padding:8px 48px 16px;">
        <p style="margin:0;font-size:16px;color:#0a0a0a;line-height:1.5;">Hallo ${escapeHtml(customerName)},</p>
        <p style="margin:12px 0 0;font-size:16px;color:#0a0a0a;line-height:1.5;">danke für deinen Besuch bei <strong>${escapeHtml(restaurant.name)}</strong>! Mit einem Klick kannst du uns bewerten.</p>
      </td></tr>
      <tr><td style="padding:8px 48px 16px;">
        <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;padding:24px 20px;text-align:center;">
          <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:0.12em;">Wie war dein Erlebnis?</p>
          <div style="margin:0 0 8px;">${starsHtml}</div>
          <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">Ein Klick reicht — danach kannst du optional Feedback hinzufügen.</p>
        </div>
      </td></tr>
      <tr><td style="padding:16px 48px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.5;">
          Du bekommst diese Email weil du bei deiner Bestellung "Angebote per Email" aktiviert hast.<br>
          <a href="${escapeHtml(unsubscribeUrl)}" style="color:#71717a;text-decoration:underline;">Abmelden</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

  const text = `Hallo ${customerName},

danke für deinen Besuch bei ${restaurant.name}!

Bewerte uns mit einem Klick:
⭐ 1 Stern: ${starLinks[0]}
⭐⭐ 2 Sterne: ${starLinks[1]}
⭐⭐⭐ 3 Sterne: ${starLinks[2]}
⭐⭐⭐⭐ 4 Sterne: ${starLinks[3]}
⭐⭐⭐⭐⭐ 5 Sterne: ${starLinks[4]}

Abmelden: ${unsubscribeUrl}
`

  const headers: Record<string, string> = {
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
  // Suppress unused warning for primary
  void primary

  return { subject, html, text, headers }
}
```

- [ ] **Step 2: TypeScript-Check**

```bash
cd app && npx tsc --noEmit 2>&1 | grep "ratingEmail" | head -5
```

Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add app/lib/marketing/ratingEmail.ts
git commit -m "feat(marketing): extract buildRatingEmailHtml helper (DRY shared by automation-run + new auto-trigger)"
```

---

### Task 5: Refactor automation-run/route.ts to use new helper

**Files:**
- Modify: `app/app/api/marketing/automation-run/route.ts` (lines ~365-385, the `ratingBlockHtml` block)

- [ ] **Step 1: Replace inline HTML with helper call**

Find the existing block around lines 365-385:

```typescript
let ratingBlockHtml: string | undefined
if (matchedOrder) {
  const starLinks = [1, 2, 3, 4, 5].map(n => {
    const t = crypto.createHmac('sha256', unsubSecret).update(`${matchedOrder.id}:${n}`).digest('hex').slice(0, 32)
    return `${appUrl}/api/feedback?o=${matchedOrder.id}&s=${n}&t=${t}`
  })
  const starsHtml = starLinks.map(href => `<a href="${href}" style="display:inline-block;padding:6px 8px;text-decoration:none;font-size:32px;line-height:1;color:#d4d4d8;">&#9733;</a>`).join('')
  ratingBlockHtml = `
  <tr><td style="padding:8px 48px 16px;">
    ...
  </td></tr>`
}
```

Replace with a **note** at the top of the file referencing the helper (the actual HTML production stays inline for now — the helper is used by the NEW automation in Task 9, not the existing automation-run).

**Rationale:** the existing `automation-run` route assembles a multi-block email (logo + greeting + rating block + items + discount + footer) where the rating block is one piece. Extracting only the rating block to use the new helper would require either (a) the helper returns only-the-rating-block (different shape) or (b) refactoring the whole automation-run template flow.

For A2 scope: leave `automation-run` unchanged. The new helper `buildRatingEmailHtml()` returns a **complete email** (logo + greeting + rating + footer) which is what the NEW webhook needs. Document this with a comment:

```typescript
// NOTE: This inline rating block is intentionally kept here.
// The standalone rating-email helper (lib/marketing/ratingEmail.ts) is used by
// /api/jobs/send-rating-email (Track A2) and produces a complete email.
// This route's `ratingBlockHtml` is one block inside a larger composite email
// (logo + greeting + rating + items + discount + footer), which requires the
// existing inline assembly. Refactoring both call-sites to share template
// pieces is out of scope for A2 and tracked as A2-followup.
```

Add this comment ABOVE the existing `let ratingBlockHtml: string | undefined` line (~line 367).

- [ ] **Step 2: Verify no behavior change**

```bash
cd app && npx tsc --noEmit 2>&1 | grep "automation-run" | head -5
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/app/api/marketing/automation-run/route.ts
git commit -m "docs(automation-run): note coexistence with new standalone rating-email helper"
```

---

## Phase 4 — Schedule Trigger

### Task 6: scheduleRatingEmail high-level function

**Files:**
- Create: `app/lib/marketing/scheduleRatingEmail.ts`

- [ ] **Step 1: Funktion schreiben**

```typescript
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { publishDelayedJob } from './qstash'

export interface ScheduleResult {
  scheduled: boolean
  reason?: 'feature_disabled' | 'order_not_found' | 'qstash_failed' | 'no_app_url'
  messageId?: string
  error?: string
}

export async function scheduleRatingEmail(orderId: string): Promise<ScheduleResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) return { scheduled: false, reason: 'no_app_url' }

  const supabase = createSupabaseAdmin()
  const { data: order } = await supabase
    .from('orders')
    .select('id, restaurant_id, restaurants!inner(rating_email_enabled, rating_email_delay_hours)')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return { scheduled: false, reason: 'order_not_found' }

  const restaurant = (order.restaurants as unknown) as {
    rating_email_enabled: boolean | null
    rating_email_delay_hours: number | null
  }
  if (!restaurant?.rating_email_enabled) {
    return { scheduled: false, reason: 'feature_disabled' }
  }

  const delayHours = restaurant.rating_email_delay_hours ?? 4
  const delaySeconds = Math.max(60, Math.min(72 * 3600, delayHours * 3600))

  const result = await publishDelayedJob({
    url: `${appUrl}/api/jobs/send-rating-email`,
    body: { orderId },
    delaySeconds,
    dedupeId: `rating-email:${orderId}`,
  })

  if (!result.success) {
    return { scheduled: false, reason: 'qstash_failed', error: result.error }
  }
  return { scheduled: true, messageId: result.messageId }
}
```

- [ ] **Step 2: TypeScript-Check**

```bash
cd app && npx tsc --noEmit 2>&1 | grep "scheduleRatingEmail" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/lib/marketing/scheduleRatingEmail.ts
git commit -m "feat(marketing): add scheduleRatingEmail — looks up restaurant config + publishes QStash job"
```

---

### Task 7: setOrderStatus wrapper (UPDATE + scheduleRatingEmail on served)

**Files:**
- Create: `app/lib/orders/setOrderStatus.ts`

- [ ] **Step 1: Wrapper schreiben**

```typescript
import { supabase } from '@/lib/supabase'
import { scheduleRatingEmail } from '@/lib/marketing/scheduleRatingEmail'

export interface SetOrderStatusOptions {
  /** Optional extra fields to update alongside status (e.g. claimed_by, claimed_at). */
  extra?: Record<string, unknown>
}

/**
 * Updates an order's status. When transitioning to 'served', also schedules
 * the rating-email QStash job (fire-and-forget — failures are logged but
 * never block the status update).
 */
export async function setOrderStatus(
  orderId: string,
  newStatus: string,
  options: SetOrderStatusOptions = {}
): Promise<{ error: string | null }> {
  const update: Record<string, unknown> = { status: newStatus, ...options.extra }
  const { error } = await supabase.from('orders').update(update).eq('id', orderId)
  if (error) return { error: error.message }

  // Schedule rating email when transitioning to 'served' (fire-and-forget).
  if (newStatus === 'served') {
    fetch('/api/jobs/schedule-rating-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    }).catch(e => console.warn('[setOrderStatus] schedule failed:', e))
  }

  return { error: null }
}
```

**Important:** Note that `scheduleRatingEmail()` uses `supabaseAdmin` (service role) and `process.env.QSTASH_TOKEN`. These are server-only. We can't call it directly from a client component — hence the `fetch` to a new internal API endpoint (created in Task 7b).

- [ ] **Step 2: Create the internal schedule endpoint**

Create `app/app/api/jobs/schedule-rating-email/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { scheduleRatingEmail } from '@/lib/marketing/scheduleRatingEmail'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json()
    if (typeof orderId !== 'string' || !orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 })
    }
    const result = await scheduleRatingEmail(orderId)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 }
    )
  }
}
```

**Note:** this endpoint has NO auth. It's called from authenticated staff/admin pages. Since `scheduleRatingEmail` only does work if the restaurant has `rating_email_enabled=true`, and the worst an unauthenticated POST could do is queue extra QStash messages (still bounded by `dedupeId`), this is acceptable for A2. Add a TODO comment noting future auth-tightening.

```typescript
// TODO(A2-followup): add session check — only authenticated staff should
// be able to schedule rating emails. Currently relies on the dedupeId
// to prevent abuse (one message per order regardless of caller).
```

- [ ] **Step 3: TypeScript-Check**

```bash
cd app && npx tsc --noEmit 2>&1 | grep -E "setOrderStatus|schedule-rating-email" | head -5
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/lib/orders/setOrderStatus.ts app/app/api/jobs/schedule-rating-email/route.ts
git commit -m "feat(orders): add setOrderStatus wrapper + internal schedule-rating-email endpoint"
```

---

### Task 8: Wire setOrderStatus into staff/page.tsx + admin/orders/page.tsx

**Files:**
- Modify: `app/app/staff/page.tsx:230-238`
- Modify: `app/app/admin/orders/page.tsx:279-281`

- [ ] **Step 1: Update staff/page.tsx**

Add import at the top:
```typescript
import { setOrderStatus } from '@/lib/orders/setOrderStatus'
```

Replace the body of `updateOrderStatus` (lines 230-238):

```typescript
async function updateOrderStatus(orderId: string, newStatus: Column | 'out_for_delivery') {
  setUpdatingOrder(orderId)
  const extra: Record<string, unknown> = {}
  if (newStatus === 'cooking' && session) {
    extra.claimed_by = session.staff.id
    extra.claimed_at = new Date().toISOString()
  }
  await setOrderStatus(orderId, newStatus, { extra })
  setUpdatingOrder(null)
}
```

- [ ] **Step 2: Update admin/orders/page.tsx**

Add import at the top:
```typescript
import { setOrderStatus } from '@/lib/orders/setOrderStatus'
```

Replace lines 279-281:

```typescript
const advanceStatus = useCallback(async (id: string, next: OrderStatus) => {
  await setOrderStatus(id, next)
}, [])
```

Leave `cancelOrder` unchanged (it sets status to 'cancelled', not 'served' — no scheduling needed, but for consistency we COULD route it through `setOrderStatus`; leaving it as-is is fine).

- [ ] **Step 3: TypeScript-Check**

```bash
cd app && npx tsc --noEmit 2>&1 | grep -E "staff/page|admin/orders/page" | head -5
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/app/staff/page.tsx app/app/admin/orders/page.tsx
git commit -m "feat(orders): route staff + admin status-updates through setOrderStatus wrapper"
```

---

## Phase 5 — Webhook

### Task 9: QStash webhook handler

**Files:**
- Create: `app/app/api/jobs/send-rating-email/route.ts`

- [ ] **Step 1: Webhook schreiben**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail } from '@/lib/marketing/sendEmail'
import { buildRatingEmailHtml } from '@/lib/marketing/ratingEmail'
import { getPlatformSettings } from '@/lib/platform-config'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

async function handler(request: NextRequest) {
  let body: { orderId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const orderId = body.orderId
  if (typeof orderId !== 'string' || !orderId) {
    return NextResponse.json({ error: 'orderId_required' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  // Load order + restaurant + subscriber in a single query
  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, status, customer_id, customer_name, restaurant_id, rating_email_sent_at,
      restaurants!inner(name, logo_url, primary_color, rating_email_enabled),
      marketing_subscribers!orders_customer_id_fkey(id, email, opted_in_at, unsubscribed_at)
    `)
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return NextResponse.json({ skipped: 'order_not_found' })
  if (order.status !== 'served') return NextResponse.json({ skipped: 'not_served' })
  if (order.rating_email_sent_at !== null) return NextResponse.json({ skipped: 'already_sent' })
  if (!order.customer_id) return NextResponse.json({ skipped: 'no_subscriber' })

  const restaurant = (order.restaurants as unknown) as {
    name: string
    logo_url: string | null
    primary_color: string | null
    rating_email_enabled: boolean | null
  }
  if (!restaurant?.rating_email_enabled) {
    return NextResponse.json({ skipped: 'feature_disabled' })
  }

  const subscriber = (order.marketing_subscribers as unknown) as {
    id: string
    email: string
    opted_in_at: string | null
    unsubscribed_at: string | null
  } | null
  if (!subscriber) return NextResponse.json({ skipped: 'subscriber_not_found' })
  if (!subscriber.opted_in_at) return NextResponse.json({ skipped: 'never_opted_in' })
  if (subscriber.unsubscribed_at) return NextResponse.json({ skipped: 'unsubscribed' })

  // Dedup: skip if already rated in-app or via prior email click
  const { count: ratingCount } = await supabase
    .from('order_ratings')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId)
  if ((ratingCount ?? 0) > 0) return NextResponse.json({ skipped: 'already_rated' })

  // Build email
  const settings = await getPlatformSettings()
  const unsubscribeSecret = settings.unsubscribe_secret
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? 'fallback'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const unsubToken = crypto.createHmac('sha256', unsubscribeSecret)
    .update(`unsub:${subscriber.email}:${order.restaurant_id}`)
    .digest('hex').slice(0, 32)
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?e=${encodeURIComponent(subscriber.email)}&r=${order.restaurant_id}&t=${unsubToken}`

  const { subject, html, text, headers } = buildRatingEmailHtml({
    order: { id: order.id, customer_name: order.customer_name },
    restaurant,
    unsubscribeSecret,
    appUrl,
    unsubscribeUrl,
  })

  // Resolve from address (use Resend default or platform-configured)
  const fromEmail = settings.resend_from_email ?? 'onboarding@resend.dev'
  const fromName = restaurant.name

  try {
    await sendEmail({
      restaurantId: order.restaurant_id,
      fromEmail,
      fromName,
      toEmail: subscriber.email,
      toSubscriberId: subscriber.id,
      subject,
      html,
      text,
      headers,
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'send_failed', detail: e instanceof Error ? e.message : 'unknown' },
      { status: 500 }
    )
  }

  // Mark sent
  await supabase
    .from('orders')
    .update({ rating_email_sent_at: new Date().toISOString() })
    .eq('id', orderId)

  // Log marketing event
  await supabase.from('marketing_events').insert({
    restaurant_id: order.restaurant_id,
    subscriber_id: order.customer_id,
    event_type: 'rating_email_sent',
    props: { order_id: orderId },
  })

  return NextResponse.json({ sent: true })
}

// QStash signature verification wraps the handler
export const POST = verifySignatureAppRouter(handler)
```

- [ ] **Step 2: Check that `getPlatformSettings` exposes `resend_from_email` and `unsubscribe_secret`**

```bash
grep -n "resend_from_email\|unsubscribe_secret" app/lib/platform-config.ts | head -5
```

Expected: both fields present. If not, the implementer should either add them or use `process.env.RESEND_FROM` as fallback.

- [ ] **Step 3: TypeScript-Check**

```bash
cd app && npx tsc --noEmit 2>&1 | grep "send-rating-email" | head -5
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/app/api/jobs/send-rating-email/route.ts
git commit -m "feat(marketing): add QStash webhook for delayed rating-email delivery"
```

---

## Phase 6 — Event Tracking + Owner UI

### Task 10: google_review_clicked event tracking

**Files:**
- Create: `app/lib/marketing/trackEvent.ts`
- Modify: `app/components/order/OrderRating.tsx` (the "Auf Google bewerten" `<a>` tag)
- Modify: `app/app/feedback/[orderId]/FeedbackClient.tsx` (the same button)

- [ ] **Step 1: trackEvent helper**

```typescript
import { supabase } from '@/lib/supabase'

export type MarketingEventType =
  | 'google_review_clicked'
  | 'rating_email_sent'
  | 'loyalty_credited'
  | 'redeemed_reward'

export async function trackEvent(args: {
  restaurantId: string
  eventType: MarketingEventType
  subscriberId?: string | null
  props?: Record<string, unknown>
}): Promise<void> {
  try {
    await supabase.from('marketing_events').insert({
      restaurant_id: args.restaurantId,
      subscriber_id: args.subscriberId ?? null,
      event_type: args.eventType,
      props: args.props ?? {},
    })
  } catch (e) {
    console.warn('[trackEvent] failed:', e)
  }
}
```

Note: This is a client-side helper using the anon Supabase client. `marketing_events` already has `INSERT` granted to anon per migration 047/055. If RLS blocks this (it might if there's no permissive INSERT policy), wrap it via an API endpoint instead. The implementer should verify by manually firing a test event in browser console.

- [ ] **Step 2: Hook into OrderRating.tsx**

Find the "Auf Google bewerten" `<a>` tag (around line 177-193). Wrap the onClick:

```tsx
<a
  href={googleReviewUrl}
  target="_blank"
  rel="noopener noreferrer"
  onClick={() => {
    trackEvent({
      restaurantId,
      eventType: 'google_review_clicked',
      props: { source: 'in_app_rating', order_id: orderId },
    })
  }}
  style={...}
>
  ⭐ Auf Google bewerten
</a>
```

Add import:
```typescript
import { trackEvent } from '@/lib/marketing/trackEvent'
```

- [ ] **Step 3: Hook into feedback/[orderId]/FeedbackClient.tsx**

Find the "Auf Google bewerten" `<a>` tag in this file (the equivalent button after the email-flow rating). Wrap onClick the same way:

```tsx
onClick={() => {
  trackEvent({
    restaurantId,
    eventType: 'google_review_clicked',
    props: { source: 'email_landing', order_id: orderId },
  })
}}
```

The `restaurantId` and `orderId` should already be in scope in FeedbackClient — if not, the implementer reads the file and adapts.

- [ ] **Step 4: TypeScript-Check**

```bash
cd app && npx tsc --noEmit 2>&1 | grep -E "OrderRating|FeedbackClient|trackEvent" | head -5
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/lib/marketing/trackEvent.ts app/components/order/OrderRating.tsx app/app/feedback/[orderId]/FeedbackClient.tsx
git commit -m "feat(marketing): track google_review_clicked event from both in-app + email-landing"
```

---

### Task 11: Owner-Settings — Auto-Rating-Email Konfig-Sektion

**Files:**
- Modify: `app/app/admin/settings/page.tsx`

- [ ] **Step 1: Find the existing google_review_url section**

Search for `google_review_url` in the file. There should be a load/save pattern + a UI field. Add the new fields to the same load/save flow:

```typescript
// In the data-loading useEffect (where google_review_url is loaded), also pull:
// restaurant.rating_email_enabled
// restaurant.rating_email_delay_hours
```

- [ ] **Step 2: Add UI block near the existing Google Review section**

```tsx
{/* Existing google_review_url input stays as-is */}

<label style={labelStyle}>
  <input
    type="checkbox"
    checked={ratingEmailEnabled}
    onChange={e => setRatingEmailEnabled(e.target.checked)}
  />
  {' '}Automatisch Bewertungs-Email senden
</label>

<label style={labelStyle}>Delay (Stunden nach 'serviert')
  <input
    type="number"
    min={1}
    max={72}
    value={ratingEmailDelayHours}
    onChange={e => setRatingEmailDelayHours(Math.max(1, Math.min(72, parseInt(e.target.value) || 4)))}
    style={inputStyle}
  />
  <small style={{ color: '#71717a', fontSize: '0.75rem', display: 'block', marginTop: '4px' }}>
    Default 4h. Pizzerien: 2h. Fine-Dining: 24h. Maximum 72h.
  </small>
</label>

<a href="/admin/marketing/reviews" style={{ color: '#EA580C', fontSize: '0.85rem' }}>
  → Reviews-Dashboard öffnen
</a>
```

- [ ] **Step 3: Wire the save handler**

Wherever the existing settings save function persists `google_review_url`, also persist `rating_email_enabled` and `rating_email_delay_hours`:

```typescript
await supabase.from('restaurants').update({
  google_review_url: googleReviewUrl || null,
  rating_email_enabled: ratingEmailEnabled,
  rating_email_delay_hours: ratingEmailDelayHours,
}).eq('id', restaurantId)
```

The exact pattern depends on how the settings page currently structures its saves — implementer reads the file and integrates naturally.

- [ ] **Step 4: TypeScript-Check**

```bash
cd app && npx tsc --noEmit 2>&1 | grep "admin/settings/page" | head -5
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/app/admin/settings/page.tsx
git commit -m "feat(admin-settings): add Auto-Rating-Email toggle + delay configuration"
```

---

### Task 12: New /admin/marketing/reviews stats dashboard

**Files:**
- Create: `app/app/admin/marketing/reviews/page.tsx`

- [ ] **Step 1: Stats-Page schreiben**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Stats {
  emails_sent: number
  ratings_received: number
  positive_ratings: number
  positive_percent: number
  google_clicks: number
  by_stars: Record<number, number>
}

interface FeedbackRow {
  id: string
  stars: number
  feedback: string
  created_at: string
}

export default function ReviewsAdminPage() {
  const [restaurantId, setRestaurantId] = useState<string>('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentFeedback, setRecentFeedback] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: resto } = await supabase
        .from('restaurants').select('id').eq('owner_id', user.id).maybeSingle()
      if (!resto) { setLoading(false); return }
      setRestaurantId(resto.id)

      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // Parallel queries
      const [emailsRes, ratingsRes, clicksRes, feedbackRes] = await Promise.all([
        supabase
          .from('marketing_events')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', resto.id)
          .eq('event_type', 'rating_email_sent')
          .gte('occurred_at', since),
        supabase
          .from('order_ratings')
          .select('id, stars, feedback, created_at')
          .eq('restaurant_id', resto.id)
          .gte('created_at', since),
        supabase
          .from('marketing_events')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', resto.id)
          .eq('event_type', 'google_review_clicked')
          .gte('occurred_at', since),
        supabase
          .from('order_ratings')
          .select('id, stars, feedback, created_at')
          .eq('restaurant_id', resto.id)
          .not('feedback', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      const ratings = ratingsRes.data ?? []
      const totalRatings = ratings.length
      const positiveRatings = ratings.filter(r => r.stars >= 4).length
      const byStars: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      for (const r of ratings) byStars[r.stars] = (byStars[r.stars] ?? 0) + 1

      setStats({
        emails_sent: emailsRes.count ?? 0,
        ratings_received: totalRatings,
        positive_ratings: positiveRatings,
        positive_percent: totalRatings > 0 ? Math.round((positiveRatings / totalRatings) * 100) : 0,
        google_clicks: clicksRes.count ?? 0,
        by_stars: byStars,
      })

      setRecentFeedback((feedbackRes.data ?? []).map(r => ({
        id: r.id,
        stars: r.stars,
        feedback: r.feedback ?? '',
        created_at: r.created_at,
      })))

      setLoading(false)
    })()
  }, [])

  if (loading) return <div style={{ padding: '24px' }}>Lädt…</div>
  if (!restaurantId) return <div style={{ padding: '24px' }}>Kein Restaurant gefunden.</div>

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '24px' }}>⭐ Google Reviews</h1>

      {stats && (
        <>
          <section style={sectionStyle}>
            <h2 style={h2Style}>Letzte 30 Tage</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <Stat label="Emails verschickt" value={stats.emails_sent.toString()} />
              <Stat label="Bewertungen" value={stats.ratings_received.toString()} />
              <Stat label="Davon positiv (4-5⭐)" value={`${stats.positive_ratings} (${stats.positive_percent}%)`} />
              <Stat label="Google-Klicks" value={stats.google_clicks.toString()} />
            </div>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>Sternverteilung</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[5, 4, 3, 2, 1].map(s => {
                const count = stats.by_stars[s] ?? 0
                const max = Math.max(...Object.values(stats.by_stars), 1)
                const pct = (count / max) * 100
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ minWidth: '60px', fontSize: '0.85rem' }}>{'⭐'.repeat(s)}</div>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '4px', height: '20px', position: 'relative' }}>
                      <div style={{ background: '#EA580C', width: `${pct}%`, height: '100%', borderRadius: '4px', transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ minWidth: '40px', textAlign: 'right', fontSize: '0.85rem', color: '#71717a' }}>{count}</div>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}

      <section style={sectionStyle}>
        <h2 style={h2Style}>Letzte Bewertungen mit Feedback</h2>
        {recentFeedback.length === 0 ? (
          <p style={{ color: '#71717a', fontSize: '0.85rem' }}>Noch keine Bewertungen mit Feedback.</p>
        ) : (
          <table style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead><tr>
              <th style={thStyle}>Datum</th>
              <th style={thStyle}>Sterne</th>
              <th style={thStyle}>Feedback</th>
            </tr></thead>
            <tbody>
              {recentFeedback.map(r => (
                <tr key={r.id}>
                  <td style={tdStyle}>{new Date(r.created_at).toLocaleDateString('de-DE')}</td>
                  <td style={tdStyle}>{'⭐'.repeat(r.stars)}</td>
                  <td style={tdStyle}>{r.feedback}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <a href="/admin/settings" style={{ color: '#EA580C', fontSize: '0.85rem' }}>
        → Auto-Email-Einstellungen ändern
      </a>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px' }}>
      <p style={{ fontSize: '0.7rem', color: '#8B8B93', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '1.2rem', fontWeight: 800 }}>{value}</p>
    </div>
  )
}

const sectionStyle: React.CSSProperties = {
  background: '#0f0f13', borderRadius: '14px', padding: '20px',
  border: '1px solid rgba(255,255,255,0.08)', marginBottom: '20px',
}
const h2Style: React.CSSProperties = { fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px', color: '#8B8B93', borderBottom: '1px solid rgba(255,255,255,0.08)' }
const tdStyle: React.CSSProperties = { padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }
```

- [ ] **Step 2: TypeScript-Check**

```bash
cd app && npx tsc --noEmit 2>&1 | grep "marketing/reviews/page" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/app/admin/marketing/reviews/page.tsx
git commit -m "feat(admin-reviews): add /admin/marketing/reviews stats dashboard (4 tiles + star distribution + recent feedback)"
```

---

## Phase 7 — E2E Verification (User Tasks)

### Task 13: User E2E test (manual)

This task is performed by the user manually after deployment.

- [ ] **Step 1: User schedules QStash credentials in Vercel ENV + .env.local**

```
QSTASH_TOKEN=<from Upstash dashboard>
QSTASH_CURRENT_SIGNING_KEY=<from Upstash dashboard>
QSTASH_NEXT_SIGNING_KEY=<from Upstash dashboard>
```

- [ ] **Step 2: User aktiviert Auto-Rating-Email für Test-Restaurant**

In Supabase SQL Editor:

```sql
UPDATE restaurants
  SET rating_email_enabled = true,
      rating_email_delay_hours = 1  -- 1h für Test, kann nach Test zurück auf 4h
  WHERE id = '<test_restaurant_id>';
```

- [ ] **Step 3: User macht Test-Bestellung mit Opt-In Email**

Im Browser: Bestellung mit Marketing-Opt-In aktiviert. Im Staff-Dashboard: Status auf `served` setzen.

- [ ] **Step 4: User verifiziert QStash-Schedule**

Vercel Logs öffnen, suchen nach `setOrderStatus` oder `schedule-rating-email` POST. Erwartet: 200 OK Response.

Im Upstash Dashboard (QStash Tab): die scheduled Message sollte sichtbar sein mit Status "Pending" und korrektem Delay.

- [ ] **Step 5: User wartet 1 Stunde**

QStash POSTet automatisch zu `/api/jobs/send-rating-email`.

- [ ] **Step 6: User checks email + DB**

```sql
-- Email gesendet?
SELECT rating_email_sent_at FROM orders WHERE id = '<test_order_id>';
-- Expected: timestamp ~now()

-- Event geloggt?
SELECT * FROM marketing_events
WHERE event_type = 'rating_email_sent' AND props->>'order_id' = '<test_order_id>';
-- Expected: 1 row

-- Email in Inbox?
-- User checks the test inbox (loyaltytest@beispiel.de oder ähnlich)
```

- [ ] **Step 7: User klickt 5 Sterne in Email → /feedback Page → "Auf Google bewerten"**

Verifiziert:
- `/api/feedback` Redirect funktioniert
- `order_ratings` Eintrag entsteht (stars=5)
- "Auf Google bewerten" Button erscheint (weil google_review_url gesetzt + 5 Sterne)
- Klick auf Button: `marketing_events('google_review_clicked')` Eintrag mit `source='email_landing'`

- [ ] **Step 8: User schaut /admin/marketing/reviews an**

Stats-Tiles zeigen aktualisierte Werte:
- Emails verschickt: ≥1
- Bewertungen: ≥1
- Davon positiv: ≥1
- Google-Klicks: ≥1

Sternverteilung zeigt einen Balken bei 5⭐.

- [ ] **Step 9: User markiert Task als done**

```bash
git commit --allow-empty -m "verify(a2-google-reviews): E2E flow confirmed (schedule → delay → email → rating → google click → stats)"
```

---

### Task 14: Memory aktualisieren + PR

- [ ] **Step 1: Memory `project_marketing_roadmap` aktualisieren**

In `C:\Users\David\.claude\projects\c--Users-David-Desktop-restaurant-system\memory\project_marketing_roadmap.md`:
- A2 als ✅ ABGESCHLOSSEN markieren
- A3 Birthday + Anniversary in den Vordergrund

- [ ] **Step 2: Push + PR**

```bash
git push -u origin track-a2-google-reviews-automation
gh pr create --title "feat(a2-google-reviews): auto rating-email via QStash + stats dashboard" --body "$(cat <<'EOF'
## Summary
- Migration 059: served_at, rating_email_sent_at, restaurants.rating_email_enabled + delay_hours
- BEFORE-Trigger trg_set_served_at
- Upstash QStash integration für per-order delayed email scheduling
- New /api/jobs/send-rating-email webhook with signature verification + 7 skip-conditions
- Reusable buildRatingEmailHtml() helper
- setOrderStatus() wrapper used by staff/page + admin/orders/page
- google_review_clicked event tracking from both in-app + email-landing
- Owner config in /admin/settings + new stats dashboard /admin/marketing/reviews

Spec: docs/superpowers/specs/2026-05-25-a2-google-reviews-automation-design.md

## Test plan
- [x] Migration 059 applied
- [x] QStash credentials configured
- [x] E2E flow verified (Task 13)
EOF
)"
```

---

## Spec Coverage Check

| Spec-Requirement | Plan-Task(s) |
|---|---|
| `orders.served_at` + `rating_email_sent_at` | Task 1 |
| `restaurants.rating_email_enabled` + `rating_email_delay_hours` (CHECK 1-72) | Task 1 |
| BEFORE-Trigger `trg_set_served_at` | Task 1 |
| Index for stats queries | Task 1 |
| Backfill existing served orders | Task 1 |
| `@upstash/qstash` dependency | Task 2 |
| ENV-Vars documented | Task 2 |
| `publishDelayedJob` wrapper | Task 3 |
| `buildRatingEmailHtml` helper | Task 4 |
| Coexistence with `automation-run` | Task 5 |
| `scheduleRatingEmail` function | Task 6 |
| `setOrderStatus` wrapper | Task 7 |
| Internal `/api/jobs/schedule-rating-email` endpoint | Task 7 |
| Hook into staff + admin/orders | Task 8 |
| `/api/jobs/send-rating-email` webhook + signature verification + 7 skip-conditions | Task 9 |
| `trackEvent` helper + `google_review_clicked` tracking | Task 10 |
| Owner-Settings: Auto-Email Toggle + Delay | Task 11 |
| `/admin/marketing/reviews` dashboard with stats + star distribution + recent feedback | Task 12 |
| E2E flow verification | Task 13 |
| Memory + PR | Task 14 |

All spec sections covered.
