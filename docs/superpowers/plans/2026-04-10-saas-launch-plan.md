# SaaS Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform RestaurantOS from a single-project app into a launch-ready SaaS product with trial mode, pricing tiers, feature gating, guided onboarding, QR-code PDF export, and PWA support.

**Architecture:** Extend existing Supabase + Next.js stack. Add `trial_ends_at` field and new plan values to `restaurants` table. Centralize plan logic in `lib/plan-limits.ts`. Expand the 2-step setup into a 5-step onboarding wizard. Generate QR-code PDFs client-side with `jsPDF` + `qrcode`. Remove all guest payment routes (Stripe stays only for SaaS billing). Refactor stats page to honest "Bestellanalyse".

**Tech Stack:** Next.js 16, Supabase, Stripe (subscriptions only), TypeScript, jsPDF, qrcode, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-10-saas-launch-design.md`

---

## File Structure

### New files
- `app/lib/plan-limits.ts` — Central plan limits + helper functions
- `app/components/UpgradeHint.tsx` — Upgrade prompt for locked features
- `app/components/TrialBanner.tsx` — Trial status/expiry banner for admin dashboard
- `app/lib/qr-pdf.ts` — QR-code PDF generation logic
- `app/public/manifest.json` — PWA manifest
- `app/public/sw.js` — Service worker (app-shell caching only)
- `app/public/icons/icon-192.png` — PWA icon 192x192
- `app/public/icons/icon-512.png` — PWA icon 512x512

### Modified files
- `app/types/database.ts` — Add `'trial'`, `'starter'`, `'expired'` to RestaurantPlan, add `trial_ends_at`
- `app/app/admin/setup/page.tsx` — Full rewrite: 5-step onboarding wizard
- `app/app/admin/page.tsx` — Add TrialBanner, update welcome flow
- `app/app/admin/layout.tsx` — Add TrialBanner integration
- `app/app/admin/stats/page.tsx` — Refactor to Bestellanalyse (remove revenue, keep order analytics)
- `app/app/admin/tables/page.tsx` — Add QR PDF download button, plan limit check
- `app/app/admin/staff/page.tsx` — Add plan limit check for staff count
- `app/app/admin/branding/page.tsx` — Add UpgradeHint for starter plan
- `app/app/admin/reservations/page.tsx` — Add UpgradeHint for starter plan
- `app/app/admin/billing/page.tsx` — Update for 3 plans + trial display
- `app/app/api/stripe/checkout/route.ts` — Rename basic→starter, update price IDs
- `app/app/api/stripe/webhook/route.ts` — Handle new plan names, subscription.deleted→expired
- `app/app/api/restaurant/[slug]/route.ts` — Check trial expiry + active status
- `app/app/bestellen/[slug]/page.tsx` — Remove payment flow, remove GroupPayView import
- `app/app/layout.tsx` — Add PWA meta tags + manifest link
- `app/lib/ai-key.ts` — Update plan check from 'basic' to include 'starter'

### Deleted files
- `app/app/api/stripe/order-checkout/route.ts`
- `app/app/api/stripe/table-checkout/route.ts`
- `app/app/api/stripe/group-checkout/route.ts`
- `app/app/bestellen/[slug]/GroupPayView.tsx`

---

## Task 1: Update Types & Create Plan Limits

**Files:**
- Modify: `app/types/database.ts:4,7-39`
- Create: `app/lib/plan-limits.ts`

- [ ] **Step 1: Update RestaurantPlan type**

In `app/types/database.ts`, change line 4:

```typescript
export type RestaurantPlan = 'trial' | 'starter' | 'pro' | 'enterprise' | 'expired'
```

Add `trial_ends_at` to the `Restaurant` interface, after line 15 (`active: boolean`):

```typescript
  trial_ends_at: string | null
```

- [ ] **Step 2: Create plan-limits.ts**

Create `app/lib/plan-limits.ts`:

```typescript
import type { RestaurantPlan } from '@/types/database'

export interface PlanLimits {
  maxTables: number
  maxStaff: number
  hasKiChat: boolean
  hasReservations: boolean
  hasBranding: boolean
  hasFullAnalytics: boolean
  hasMultiLocation: boolean
  hasPosIntegration: boolean
  analyticsRangeDays: number // max days of analytics data
}

const PLAN_LIMITS: Record<RestaurantPlan, PlanLimits> = {
  trial: {
    maxTables: Infinity,
    maxStaff: Infinity,
    hasKiChat: true,
    hasReservations: true,
    hasBranding: true,
    hasFullAnalytics: true,
    hasMultiLocation: false,
    hasPosIntegration: false,
    analyticsRangeDays: 30,
  },
  starter: {
    maxTables: 15,
    maxStaff: 3,
    hasKiChat: false,
    hasReservations: false,
    hasBranding: false,
    hasFullAnalytics: false,
    hasMultiLocation: false,
    hasPosIntegration: false,
    analyticsRangeDays: 7,
  },
  pro: {
    maxTables: Infinity,
    maxStaff: Infinity,
    hasKiChat: true,
    hasReservations: true,
    hasBranding: true,
    hasFullAnalytics: true,
    hasMultiLocation: false,
    hasPosIntegration: false,
    analyticsRangeDays: 365,
  },
  enterprise: {
    maxTables: Infinity,
    maxStaff: Infinity,
    hasKiChat: true,
    hasReservations: true,
    hasBranding: true,
    hasFullAnalytics: true,
    hasMultiLocation: true,
    hasPosIntegration: true,
    analyticsRangeDays: 365,
  },
  expired: {
    maxTables: 0,
    maxStaff: 0,
    hasKiChat: false,
    hasReservations: false,
    hasBranding: false,
    hasFullAnalytics: false,
    hasMultiLocation: false,
    hasPosIntegration: false,
    analyticsRangeDays: 0,
  },
}

export function getPlanLimits(plan: RestaurantPlan): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.expired
}

export function isTrialExpired(trialEndsAt: string | null): boolean {
  if (!trialEndsAt) return false
  return new Date(trialEndsAt) < new Date()
}

export function getTrialDaysLeft(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0
  const diff = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function isRestaurantActive(plan: RestaurantPlan, trialEndsAt: string | null): boolean {
  if (plan === 'expired') return false
  if (plan === 'trial') return !isTrialExpired(trialEndsAt)
  return true // starter, pro, enterprise are active if subscription is active
}

export const PLAN_DISPLAY_NAMES: Record<RestaurantPlan, string> = {
  trial: 'Testphase',
  starter: 'Starter',
  pro: 'Professional',
  enterprise: 'Enterprise',
  expired: 'Abgelaufen',
}
```

- [ ] **Step 3: Verify build**

Run: `cd app && npx next build 2>&1 | head -30`

Expected: Build may show warnings for existing code using `'basic'` plan, but no errors in the new files. We'll fix those references in later tasks.

- [ ] **Step 4: Commit**

```bash
git add app/types/database.ts app/lib/plan-limits.ts
git commit -m "feat: add plan limits system with trial/starter/pro/enterprise/expired tiers"
```

---

## Task 2: Database Migration

**Files:**
- No code files — SQL migration only

- [ ] **Step 1: Run Supabase migration**

Execute the following SQL in Supabase SQL Editor (Dashboard → SQL Editor → New Query):

```sql
-- Add trial_ends_at column
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT NULL;

-- Migrate existing 'basic' plans to 'starter'
UPDATE restaurants SET plan = 'starter' WHERE plan = 'basic';
```

- [ ] **Step 2: Verify migration**

Run in Supabase SQL Editor:

```sql
SELECT id, name, plan, trial_ends_at, active FROM restaurants LIMIT 10;
```

Expected: All rows show `'starter'` instead of `'basic'`, `trial_ends_at` is NULL for existing restaurants.

---

## Task 3: TrialBanner + UpgradeHint Components

**Files:**
- Create: `app/components/TrialBanner.tsx`
- Create: `app/components/UpgradeHint.tsx`

- [ ] **Step 1: Create TrialBanner component**

Create `app/components/TrialBanner.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import type { RestaurantPlan } from '@/types/database'
import { getTrialDaysLeft, PLAN_DISPLAY_NAMES } from '@/lib/plan-limits'

interface TrialBannerProps {
  plan: RestaurantPlan
  trialEndsAt: string | null
}

export function TrialBanner({ plan, trialEndsAt }: TrialBannerProps) {
  const router = useRouter()

  if (plan === 'trial') {
    const daysLeft = getTrialDaysLeft(trialEndsAt)
    const urgent = daysLeft <= 3

    return (
      <div style={{
        background: urgent ? '#431407' : 'var(--accent-subtle)',
        border: `1px solid ${urgent ? '#fb923c44' : 'var(--accent)'}33`,
        borderRadius: '12px',
        padding: '14px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <p style={{
            color: urgent ? '#fdba74' : 'var(--accent)',
            fontWeight: 700,
            fontSize: '0.875rem',
            marginBottom: '2px',
          }}>
            {daysLeft > 0
              ? `Testphase: noch ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tage'}`
              : 'Testphase abgelaufen'
            }
          </p>
          <p style={{
            color: urgent ? '#fb923c88' : 'var(--text-muted)',
            fontSize: '0.8rem',
          }}>
            {daysLeft > 0
              ? 'Alle Pro-Features sind freigeschaltet. Wähle einen Plan, um weiterzumachen.'
              : 'Deine Bestellseite ist offline. Wähle einen Plan, um sie zu reaktivieren.'
            }
          </p>
        </div>
        <button
          onClick={() => router.push('/admin/billing')}
          style={{
            padding: '8px 20px',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Plan wählen
        </button>
      </div>
    )
  }

  if (plan === 'expired') {
    return (
      <div style={{
        background: '#431407',
        border: '1px solid #fb923c44',
        borderRadius: '12px',
        padding: '14px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <p style={{ color: '#fdba74', fontWeight: 700, fontSize: '0.875rem', marginBottom: '2px' }}>
            Abo abgelaufen
          </p>
          <p style={{ color: '#fb923c88', fontSize: '0.8rem' }}>
            Deine Bestellseite ist offline. Wähle einen Plan, um sie zu reaktivieren.
          </p>
        </div>
        <button
          onClick={() => router.push('/admin/billing')}
          style={{
            padding: '8px 20px', borderRadius: '8px', border: 'none',
            background: 'var(--accent)', color: '#fff', fontWeight: 700,
            fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          Plan wählen
        </button>
      </div>
    )
  }

  // Active paid plans — no banner needed
  return null
}
```

- [ ] **Step 2: Create UpgradeHint component**

Create `app/components/UpgradeHint.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'

interface UpgradeHintProps {
  feature: string
  requiredPlan?: 'pro' | 'enterprise'
}

export function UpgradeHint({ feature, requiredPlan = 'pro' }: UpgradeHintProps) {
  const router = useRouter()
  const planLabel = requiredPlan === 'enterprise' ? 'Enterprise' : 'Professional'

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px dashed var(--border)',
      borderRadius: '16px',
      padding: '40px 24px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔒</div>
      <p style={{
        color: 'var(--text)',
        fontWeight: 700,
        fontSize: '1rem',
        marginBottom: '8px',
      }}>
        {feature}
      </p>
      <p style={{
        color: 'var(--text-muted)',
        fontSize: '0.85rem',
        marginBottom: '20px',
      }}>
        Verfügbar im {planLabel}-Plan
      </p>
      <button
        onClick={() => router.push('/admin/billing')}
        style={{
          padding: '10px 24px',
          borderRadius: '10px',
          border: 'none',
          background: 'var(--accent)',
          color: '#fff',
          fontWeight: 700,
          fontSize: '0.85rem',
          cursor: 'pointer',
        }}
      >
        Upgrade auf {planLabel}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/components/TrialBanner.tsx app/components/UpgradeHint.tsx
git commit -m "feat: add TrialBanner and UpgradeHint components"
```

---

## Task 4: Update Stripe Checkout + Webhook

**Files:**
- Modify: `app/app/api/stripe/checkout/route.ts`
- Modify: `app/app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Update checkout route**

In `app/app/api/stripe/checkout/route.ts`, change the plan validation on line 7:

```typescript
const BodySchema = z.object({
  plan: z.enum(['starter', 'pro']),
})
```

Change the price ID lookup on line 34:

```typescript
  const priceId = plan === 'pro' ? process.env.STRIPE_PRICE_PRO! : process.env.STRIPE_PRICE_STARTER!
```

- [ ] **Step 2: Update webhook — subscription plan mapping**

In `app/app/api/stripe/webhook/route.ts`, update the subscription checkout handler (around line 32):

```typescript
      const plan = (session.metadata?.plan as 'starter' | 'pro') || 'starter'
```

Update the `customer.subscription.updated` handler (around line 177):

```typescript
    const plan = priceId === process.env.STRIPE_PRICE_PRO ? 'pro' : 'starter'
```

- [ ] **Step 3: Update webhook — subscription.deleted sets expired**

In `app/app/api/stripe/webhook/route.ts`, update the `customer.subscription.deleted` handler (around line 145-153):

Replace:
```typescript
    await supabaseAdmin
      .from('restaurants')
      .update({ active: false })
      .eq('stripe_customer_id', customerId)
```

With:
```typescript
    await supabaseAdmin
      .from('restaurants')
      .update({ active: false, plan: 'expired' })
      .eq('stripe_customer_id', customerId)
```

- [ ] **Step 4: Commit**

```bash
git add app/app/api/stripe/checkout/route.ts app/app/api/stripe/webhook/route.ts
git commit -m "feat: update Stripe routes for starter/pro plans, expired on cancellation"
```

---

## Task 5: Update Restaurant API + Guest Page for Trial Enforcement

**Files:**
- Modify: `app/app/api/restaurant/[slug]/route.ts`
- Modify: `app/lib/ai-key.ts`

- [ ] **Step 1: Update restaurant API to check trial**

Read `app/app/api/restaurant/[slug]/route.ts` and replace the full file content:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isRestaurantActive } from '@/lib/plan-limits'
import type { RestaurantPlan } from '@/types/database'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .limit(1)
    .single()

  if (!restaurant) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const active = isRestaurantActive(
    restaurant.plan as RestaurantPlan,
    restaurant.trial_ends_at
  )

  if (!active) {
    return NextResponse.json(
      { error: 'Restaurant ist aktuell offline' },
      { status: 403 }
    )
  }

  return NextResponse.json(restaurant)
}
```

- [ ] **Step 2: Update ai-key.ts for new plan names**

In `app/lib/ai-key.ts`, find any reference to `'basic'` and update it. The function `resolveAiKey` checks plan — update it to treat `'starter'` as the non-AI plan (same as old `'basic'`). Read the file first to confirm exact code, then replace `'basic'` checks with `'starter'`.

- [ ] **Step 3: Commit**

```bash
git add app/app/api/restaurant/[slug]/route.ts app/lib/ai-key.ts
git commit -m "feat: enforce trial expiry on guest page, update plan names in ai-key"
```

---

## Task 6: Remove Guest Payment Routes

**Files:**
- Delete: `app/app/api/stripe/order-checkout/route.ts`
- Delete: `app/app/api/stripe/table-checkout/route.ts`
- Delete: `app/app/api/stripe/group-checkout/route.ts`
- Delete: `app/app/bestellen/[slug]/GroupPayView.tsx`
- Modify: `app/app/bestellen/[slug]/page.tsx`

- [ ] **Step 1: Delete payment route files**

```bash
rm app/app/api/stripe/order-checkout/route.ts
rm app/app/api/stripe/table-checkout/route.ts
rm app/app/api/stripe/group-checkout/route.ts
rm app/app/bestellen/\[slug\]/GroupPayView.tsx
```

- [ ] **Step 2: Clean up bestellen page**

In `app/app/bestellen/[slug]/page.tsx`:

1. Remove the `GroupPayView` import (line 14)
2. Remove `'group-pay'` from the `OrderMode` type (line 23) — keep only: `'solo' | 'group-create' | 'group-join' | 'group-active' | 'confirmed-solo'`
3. Find and remove all code that calls `/api/stripe/order-checkout` — the order submission should insert the order directly with `status: 'new'` instead of `'pending_payment'`
4. Remove the Stripe payment button/section from the checkout view
5. Remove the `GroupPayView` component rendering

The order flow becomes: Guest selects items → confirms → order goes directly to kitchen (status: 'new') with no payment step.

**Important:** Read the full file before editing. The changes are spread across ~600 lines. Focus on:
- Removing payment-related state variables
- Changing order insert from `status: 'pending_payment'` to `status: 'new'`
- Removing the payment redirect logic
- Keeping reservation tab and all menu/cart functionality intact

- [ ] **Step 3: Also clean up the dine-in order page if it references table-checkout**

Check `app/app/order/[token]/page.tsx` for references to `/api/stripe/table-checkout`. Remove the payment flow there too — orders should go directly to `status: 'new'`.

- [ ] **Step 4: Remove payment webhook handlers for order payments**

In `app/app/api/stripe/webhook/route.ts`, remove the handler for `checkout.session.completed` in `payment` mode (lines 48-131) that handles `order_id` and `group_payment` metadata. Also remove the `checkout.session.expired` handler (lines 134-143). Keep only:
- `checkout.session.completed` for `subscription` mode
- `customer.subscription.deleted`
- `customer.subscription.updated`
- `payment_intent.succeeded` (terminal — keep for POS)

- [ ] **Step 5: Verify build**

Run: `cd app && npx next build 2>&1 | tail -20`

Expected: Build succeeds with no import errors for deleted files.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: remove guest payment flow, orders go directly to kitchen"
```

---

## Task 7: Stats Page → Bestellanalyse

**Files:**
- Modify: `app/app/admin/stats/page.tsx`
- Modify: `app/app/admin/layout.tsx` (nav label)

- [ ] **Step 1: Update nav label**

In `app/app/admin/layout.tsx`, change the stats nav item (line 33). Update the translation key or hardcode:

The nav currently uses `t('nav.stats')`. Update the translations in `app/lib/translations.ts` — change the `nav.stats` key from `'Statistik'`/`'Statistics'` to `'Bestellanalyse'`/`'Order Analytics'` for DE/EN. Check all 8 languages.

- [ ] **Step 2: Refactor stats page**

In `app/app/admin/stats/page.tsx`, make these changes:

1. **Remove revenue KPIs** — Remove "Gesamtumsatz", "QR-Digital", "Ø Bestellwert" StatCards and the `totalRevenue`, `qrRevenue`, `extRevenue`, `avgOrder` calculations
2. **Remove "Umsatz nach Quelle"** — Remove the entire `sourceBreakdown` section
3. **Remove "Umsatzverlauf"** chart — Remove the AreaChart with revenue over time
4. **Remove "Bareinnahmen" button and modal** — Remove `cashModal` state and the entire modal JSX + `saveCashEntry` function
5. **Remove external_transactions fetch** — Remove the `externalTx` state and its fetch from the `Promise.all`
6. **Remove inventory section** — Remove `ingredients` fetch, `lowStockIngredients`, `inventoryValue`, and the low-stock alert banner
7. **Add plan-gated range limit** — Import `getPlanLimits` and limit date range selector based on plan

**Keep:**
- Bestellungen count
- Gerichte count
- Bestseller chart (BarChart)
- Bestelltypen chart (PieChart)
- Reservierungen count
- Stoßzeiten (add new hourly distribution chart using order data)
- Tisch-Aktivität (add: which tables get most orders)

**Add new KPIs:**
```typescript
// Stoßzeiten — orders per hour
const hourlyDistribution = Array.from({ length: 24 }, (_, h) => ({
  label: `${h}h`,
  count: orders.filter(o => new Date(o.created_at).getHours() === h).length,
})).filter(h => h.count > 0)

// Tisch-Aktivität — orders per table
const tableActivity: Record<string, number> = {}
orders.filter(o => o.table_id).forEach(o => {
  tableActivity[o.table_id!] = (tableActivity[o.table_id!] || 0) + 1
})
```

**Replace the header title** from `'Statistik'` to `'Bestellanalyse'`.

**Add plan gating for date range:** Starter plan only gets "7 Tage" option, no "30 Tage".

- [ ] **Step 3: Commit**

```bash
git add app/app/admin/stats/page.tsx app/app/admin/layout.tsx app/lib/translations.ts
git commit -m "feat: refactor stats to Bestellanalyse, remove revenue/payment data"
```

---

## Task 8: Feature Gating in Admin Pages

**Files:**
- Modify: `app/app/admin/branding/page.tsx`
- Modify: `app/app/admin/reservations/page.tsx`
- Modify: `app/app/admin/tables/page.tsx`
- Modify: `app/app/admin/staff/page.tsx`
- Modify: `app/app/admin/page.tsx`

- [ ] **Step 1: Gate branding page**

In `app/app/admin/branding/page.tsx`, at the top of the return statement, after the loading check, add a plan check:

```tsx
import { getPlanLimits } from '@/lib/plan-limits'
import { UpgradeHint } from '@/components/UpgradeHint'
import type { RestaurantPlan } from '@/types/database'

// Inside the component, after restaurant is loaded:
const limits = getPlanLimits(restaurant.plan as RestaurantPlan)

// At the start of the return, before the existing JSX:
if (!limits.hasBranding) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px' }}>
      <div style={{ maxWidth: '600px', margin: '80px auto' }}>
        <UpgradeHint feature="Branding & Design" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Gate reservations page**

Same pattern in `app/app/admin/reservations/page.tsx`:

```tsx
import { getPlanLimits } from '@/lib/plan-limits'
import { UpgradeHint } from '@/components/UpgradeHint'
import type { RestaurantPlan } from '@/types/database'

// After restaurant loaded:
const limits = getPlanLimits(restaurant.plan as RestaurantPlan)

if (!limits.hasReservations) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px' }}>
      <div style={{ maxWidth: '600px', margin: '80px auto' }}>
        <UpgradeHint feature="Reservierungen" />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add table limit check**

In `app/app/admin/tables/page.tsx`, in the `addTable` function, add a limit check before the insert:

```tsx
import { getPlanLimits } from '@/lib/plan-limits'
import type { RestaurantPlan } from '@/types/database'

// Inside addTable(), before the supabase insert:
const limits = getPlanLimits(restaurant.plan as RestaurantPlan)
if (tables.length >= limits.maxTables) {
  alert(`Dein Plan erlaubt maximal ${limits.maxTables} Tische. Upgrade auf Professional für unbegrenzte Tische.`)
  setSaving(false)
  return
}
```

- [ ] **Step 4: Add staff limit check**

In `app/app/admin/staff/page.tsx`, add the same pattern in the add-staff function:

```tsx
import { getPlanLimits } from '@/lib/plan-limits'
import type { RestaurantPlan } from '@/types/database'

// Inside the add-staff handler, before the supabase insert:
const limits = getPlanLimits(restaurant.plan as RestaurantPlan)
if (staffList.length >= limits.maxStaff) {
  alert(`Dein Plan erlaubt maximal ${limits.maxStaff} Mitarbeiter. Upgrade auf Professional für unbegrenzte Mitarbeiter.`)
  return
}
```

- [ ] **Step 5: Add TrialBanner to admin dashboard**

In `app/app/admin/page.tsx`, add the TrialBanner at the top of the page content:

```tsx
import { TrialBanner } from '@/components/TrialBanner'
import type { RestaurantPlan } from '@/types/database'

// Inside the return, at the top of the content area:
<TrialBanner plan={restaurant.plan as RestaurantPlan} trialEndsAt={restaurant.trial_ends_at} />
```

- [ ] **Step 6: Commit**

```bash
git add app/app/admin/branding/page.tsx app/app/admin/reservations/page.tsx app/app/admin/tables/page.tsx app/app/admin/staff/page.tsx app/app/admin/page.tsx
git commit -m "feat: add feature gating and trial banner to admin pages"
```

---

## Task 9: Onboarding Wizard (5 Steps)

**Files:**
- Modify: `app/app/admin/setup/page.tsx` (full rewrite)

This is the largest task. The existing 2-step setup (info → plan) becomes a 5-step wizard (info → menu → tables → QR download → go-live). No Stripe step during onboarding.

- [ ] **Step 1: Rewrite setup page**

Replace the full content of `app/app/admin/setup/page.tsx` with a 5-step wizard. The file should:

1. Define `type Step = 'info' | 'menu' | 'tables' | 'qr' | 'golive'`
2. Track `restaurantId` in state once created in step 1
3. Each step saves data directly to Supabase (no data loss on refresh)
4. On return visit, detect which step to resume based on DB state

**Step 1 (Info)** — Keep the existing name + slug form. On submit, insert restaurant with:
```typescript
{
  owner_id: userId,
  name,
  slug,
  plan: 'trial',
  trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  active: false,
}
```

**Step 2 (Menu)** — Simplified inline form:
- "Kategorie hinzufügen" input + button
- For each category: "Gericht hinzufügen" with name + price fields
- Minimum 1 category + 1 item to proceed
- Save directly to `menu_categories` and `menu_items`

**Step 3 (Tables)** — Single number input "Wie viele Tische?":
- On submit: bulk insert tables numbered 1..N into `tables`
- Show created tables as confirmation

**Step 4 (QR Codes)** — Show preview and download button:
- Import and call `generateQrPdf` from `lib/qr-pdf.ts` (created in Task 10)
- Show "QR-Codes herunterladen" button
- "Überspringen" link to proceed without downloading

**Step 5 (Go Live)** — Summary + activation:
- Show count of categories, items, tables
- Big "Restaurant aktivieren" button → sets `active: true`
- On success: confetti-style animation (CSS keyframes, no library) + redirect to `/admin`

**Resume logic** in `useEffect`:
```typescript
// Check if restaurant already exists for this user
const { data: existing } = await supabase
  .from('restaurants')
  .select('id, name, slug, active')
  .eq('owner_id', session.user.id)
  .limit(1)
  .maybeSingle()

if (existing) {
  setRestaurantId(existing.id)
  // Determine which step to show
  const { count: menuCount } = await supabase
    .from('menu_items')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', existing.id)
  const { count: tableCount } = await supabase
    .from('tables')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', existing.id)

  if (existing.active) { router.push('/admin'); return }
  if ((tableCount ?? 0) > 0) setStep('qr')
  else if ((menuCount ?? 0) > 0) setStep('tables')
  else setStep('menu')
}
```

**UI Pattern:** Same progress bar as current (5 segments instead of 2). Same styling with CSS custom properties. Each step has a back button (except step 1).

Since this file is ~300+ lines, the implementing agent should write the full file. Key constraints:
- No external dependencies beyond what's already installed
- Use same inline style patterns as existing admin pages
- The file must be self-contained (no new components to import except `generateQrPdf` from Task 10)

- [ ] **Step 2: Verify the wizard loads**

Run: `cd app && npx next dev`

Navigate to `/admin/setup` — should show step 1 with 5-segment progress bar.

- [ ] **Step 3: Commit**

```bash
git add app/app/admin/setup/page.tsx
git commit -m "feat: 5-step onboarding wizard with trial mode"
```

---

## Task 10: QR-Code PDF Generation

**Files:**
- Create: `app/lib/qr-pdf.ts`
- Modify: `app/package.json` (add dependencies)

- [ ] **Step 1: Install dependencies**

```bash
cd app && npm install jspdf qrcode
npm install -D @types/qrcode
```

- [ ] **Step 2: Create QR PDF generator**

Create `app/lib/qr-pdf.ts`:

```typescript
import jsPDF from 'jspdf'
import QRCode from 'qrcode'

interface QrPdfOptions {
  restaurantName: string
  logoUrl?: string | null
  tables: Array<{ table_num: number; label: string; qr_token: string }>
  baseUrl: string // e.g. https://example.com
}

export async function generateQrPdf(options: QrPdfOptions): Promise<void> {
  const { restaurantName, logoUrl, tables, baseUrl } = options
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const pageHeight = 297

  // Try to load logo as base64 if provided
  let logoBase64: string | null = null
  if (logoUrl) {
    try {
      const response = await fetch(logoUrl)
      const blob = await response.blob()
      logoBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    } catch {
      // Logo fetch failed — continue without logo
    }
  }

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i]
    if (i > 0) doc.addPage()

    const qrUrl = `${baseUrl}/order/${table.qr_token}`

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })

    let yPos = 35

    // Logo or restaurant name header
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', pageWidth / 2 - 15, yPos, 30, 30)
        yPos += 35
      } catch {
        // Logo render failed — use text fallback
        doc.setFontSize(22)
        doc.setFont('helvetica', 'bold')
        doc.text(restaurantName, pageWidth / 2, yPos + 10, { align: 'center' })
        yPos += 20
      }
    } else {
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text(restaurantName, pageWidth / 2, yPos + 10, { align: 'center' })
      yPos += 20
    }

    // Restaurant name below logo (if logo exists)
    if (logoBase64) {
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text(restaurantName, pageWidth / 2, yPos + 5, { align: 'center' })
      yPos += 15
    }

    yPos += 10

    // QR Code (centered, ~80mm)
    const qrSize = 80
    const qrX = (pageWidth - qrSize) / 2
    doc.addImage(qrDataUrl, 'PNG', qrX, yPos, qrSize, qrSize)
    yPos += qrSize + 12

    // Table label
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text(table.label, pageWidth / 2, yPos, { align: 'center' })
    yPos += 20

    // Divider line
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(40, yPos, pageWidth - 40, yPos)
    yPos += 15

    // Instructions — German
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(
      'Scannen Sie den QR-Code, um die',
      pageWidth / 2, yPos, { align: 'center' }
    )
    yPos += 6
    doc.text(
      'Speisekarte zu öffnen und zu bestellen.',
      pageWidth / 2, yPos, { align: 'center' }
    )
    yPos += 14

    // Instructions — English
    doc.setFontSize(10)
    doc.setTextColor(130, 130, 130)
    doc.text(
      'Scan the QR code to open the menu',
      pageWidth / 2, yPos, { align: 'center' }
    )
    yPos += 5
    doc.text(
      'and place your order.',
      pageWidth / 2, yPos, { align: 'center' }
    )
    doc.setTextColor(0, 0, 0) // Reset
  }

  // Download the PDF
  doc.save(`${restaurantName.replace(/[^a-zA-Z0-9]/g, '-')}-QR-Codes.pdf`)
}
```

- [ ] **Step 3: Verify build with new dependencies**

Run: `cd app && npx next build 2>&1 | tail -10`

Expected: Build succeeds. jsPDF and qrcode are client-side only, so no server-side issues.

- [ ] **Step 4: Commit**

```bash
git add app/lib/qr-pdf.ts app/package.json app/package-lock.json
git commit -m "feat: add QR-code PDF generator with restaurant branding"
```

---

## Task 11: QR PDF Download in Tables Page

**Files:**
- Modify: `app/app/admin/tables/page.tsx`

- [ ] **Step 1: Add download button to tables page**

In `app/app/admin/tables/page.tsx`, add the QR PDF download functionality:

1. Import the generator at the top:
```tsx
import { generateQrPdf } from '@/lib/qr-pdf'
```

2. Add state for PDF generation:
```tsx
const [generatingPdf, setGeneratingPdf] = useState(false)
```

3. Add download handler:
```tsx
async function downloadAllQrCodes() {
  if (!restaurant || tables.length === 0) return
  setGeneratingPdf(true)
  try {
    await generateQrPdf({
      restaurantName: restaurant.name,
      logoUrl: restaurant.logo_url,
      tables: tables.filter(t => t.active),
      baseUrl: window.location.origin,
    })
  } catch (err) {
    console.error('PDF generation failed:', err)
  }
  setGeneratingPdf(false)
}
```

4. Add the button next to the existing "+ Tisch anlegen" button in the header (around line 94-101):

```tsx
<div style={{ display: 'flex', gap: '8px' }}>
  {tables.length > 0 && (
    <button
      onClick={downloadAllQrCodes}
      disabled={generatingPdf}
      style={{
        background: 'transparent',
        border: '1.5px solid var(--accent)',
        borderRadius: '8px',
        padding: '8px 16px',
        color: 'var(--accent)',
        fontWeight: 600,
        fontSize: '0.875rem',
        cursor: generatingPdf ? 'wait' : 'pointer',
        opacity: generatingPdf ? 0.6 : 1,
      }}
    >
      {generatingPdf ? 'Generiere PDF...' : 'QR-Codes PDF'}
    </button>
  )}
  <button
    onClick={() => setShowModal(true)}
    style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '8px 16px', color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
  >
    + Tisch anlegen
  </button>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add app/app/admin/tables/page.tsx
git commit -m "feat: add QR-code PDF download button to tables page"
```

---

## Task 12: Billing Page Update

**Files:**
- Modify: `app/app/admin/billing/page.tsx`

- [ ] **Step 1: Update billing page for 3 plans + trial**

Read `app/app/admin/billing/page.tsx` first. Then update it to show:

1. Current plan display with `PLAN_DISPLAY_NAMES` from plan-limits
2. Trial info with days remaining (if on trial)
3. Three plan cards (Starter 29EUR, Pro 59EUR, Enterprise) instead of two
4. Feature comparison list per plan
5. "Plan wählen" buttons that call `/api/stripe/checkout` with `'starter'` or `'pro'`
6. Enterprise card shows "Kontakt aufnehmen" button (mailto or link)
7. If already on a paid plan, show "Zum Stripe Portal" button for plan changes

Import:
```tsx
import { getPlanLimits, PLAN_DISPLAY_NAMES, getTrialDaysLeft } from '@/lib/plan-limits'
import { TrialBanner } from '@/components/TrialBanner'
import type { RestaurantPlan } from '@/types/database'
```

The pricing cards should follow the same visual style as the rest of the admin dashboard (CSS custom properties, border-radius 16px, etc.).

- [ ] **Step 2: Commit**

```bash
git add app/app/admin/billing/page.tsx
git commit -m "feat: update billing page with 3 plan tiers and trial support"
```

---

## Task 13: PWA Setup

**Files:**
- Create: `app/public/manifest.json`
- Create: `app/public/sw.js`
- Modify: `app/app/layout.tsx`

- [ ] **Step 1: Create manifest.json**

Create `app/public/manifest.json`:

```json
{
  "name": "RestaurantOS",
  "short_name": "RestaurantOS",
  "description": "Restaurant Management Dashboard",
  "start_url": "/admin",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#6c63ff",
  "orientation": "any",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 2: Create minimal service worker**

Create `app/public/sw.js`:

```javascript
const CACHE_NAME = 'restaurantos-v1'

// App shell files to cache
const APP_SHELL = [
  '/admin',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Network-first strategy — only use cache as fallback for navigation
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/admin'))
    )
  }
})
```

- [ ] **Step 3: Generate PWA icons**

Create simple placeholder icons. The implementing agent should create a basic SVG-based icon and convert it, OR use a solid-color placeholder. For now, create the icons directory:

```bash
mkdir -p app/public/icons
```

Create a simple icon generation script or use a canvas-based approach. At minimum, create two PNG files at 192x192 and 512x512 with the RestaurantOS branding (purple `#6c63ff` background with a white utensils icon). The implementing agent can use any approach — even a simple solid-color square is fine for MVP.

- [ ] **Step 4: Add meta tags to layout**

In `app/app/layout.tsx`, add inside the `<head>` section (or via metadata export):

```tsx
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#6c63ff" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

Add service worker registration at the end of the layout body (as a script or inline):

```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {})
      }
    `,
  }}
/>
```

- [ ] **Step 5: Commit**

```bash
git add app/public/manifest.json app/public/sw.js app/public/icons/ app/app/layout.tsx
git commit -m "feat: add PWA support for staff dashboard"
```

---

## Task 14: Final Integration + Build Verification

**Files:**
- Various — fix any remaining references to old plan names

- [ ] **Step 1: Search for remaining 'basic' plan references**

```bash
cd app && grep -r "'basic'" --include="*.ts" --include="*.tsx" -l
```

For each file found, update `'basic'` to `'starter'` where it refers to the plan name. Common locations:
- `app/admin/setup/page.tsx` (already rewritten in Task 9)
- `app/api/stripe/checkout/route.ts` (already updated in Task 4)
- `app/api/stripe/webhook/route.ts` (already updated in Task 4)

Fix any remaining occurrences.

- [ ] **Step 2: Full build verification**

```bash
cd app && npx next build
```

Expected: Build succeeds with no errors. Warnings are acceptable.

- [ ] **Step 3: Manual smoke test checklist**

Run `cd app && npx next dev` and verify:

1. `/register` → creates account, email confirmation works
2. `/admin/setup` → 5-step wizard loads, progress bar shows 5 segments
3. Step 1: Enter restaurant name → creates restaurant with `plan: 'trial'`
4. Step 2: Add a category + item → saved to DB
5. Step 3: Enter table count → tables created
6. Step 4: QR PDF download → generates branded PDF
7. Step 5: Go-Live button → activates restaurant, redirects to `/admin`
8. `/admin` → shows TrialBanner with days remaining
9. `/admin/branding` → if plan is starter, shows UpgradeHint
10. `/admin/reservations` → if plan is starter, shows UpgradeHint
11. `/admin/stats` → shows "Bestellanalyse" title, no revenue data
12. `/admin/billing` → shows 3 plan cards
13. `/bestellen/[slug]` → no payment buttons, order goes directly to kitchen
14. `/admin/tables` → "QR-Codes PDF" button downloads PDF

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: resolve remaining plan name references and build issues"
```

---

## Summary

| Task | Description | Estimated Complexity |
|------|-------------|---------------------|
| 1 | Types + plan-limits.ts | Small |
| 2 | Database migration (SQL) | Small |
| 3 | TrialBanner + UpgradeHint components | Small |
| 4 | Stripe checkout + webhook updates | Medium |
| 5 | Restaurant API trial enforcement | Small |
| 6 | Remove guest payment routes | Medium |
| 7 | Stats → Bestellanalyse refactor | Medium |
| 8 | Feature gating in admin pages | Medium |
| 9 | Onboarding wizard (5 steps) | Large |
| 10 | QR-code PDF generation | Medium |
| 11 | QR PDF in tables page | Small |
| 12 | Billing page update | Medium |
| 13 | PWA setup | Small |
| 14 | Final integration + build verification | Small |
