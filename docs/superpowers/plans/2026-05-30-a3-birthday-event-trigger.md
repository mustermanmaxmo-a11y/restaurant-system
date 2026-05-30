# A3 — Birthday + Event Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatisierte Geburtstags-, Jahrestags- und Event-Emails mit einmaligen Gutschein-Codes pro Subscriber — konfigurierbar per Owner-Dashboard oder KI-Chat.

**Architecture:** Täglicher Cron-Job (07:00) scannt `marketing_subscribers` auf Geburtstage/Jahrestage und `campaigns` auf geplante Events; generiert unique `discount_codes` pro Subscriber; sendet Lieferando-Style Emails via `sendEmail(immediate: true)`. Checkout liest `?code=` URL-Param, validiert server-side, wendet Rabatt auf `total` an.

**Tech Stack:** Next.js App Router, Supabase Admin Client, Resend, `sendEmail()` aus Track D, `createSupabaseAdmin()`, vercel.json Cron.

---

## Dateiübersicht

| Datei | Aktion | Zweck |
|-------|--------|-------|
| `supabase/migrations/20260530_061_campaigns_discount_codes.sql` | Neu | campaigns + discount_codes Tabellen, orders Spalten |
| `app/lib/marketing/generateDiscountCode.ts` | Neu | Unique Code Generator |
| `app/lib/marketing/campaignEmail.ts` | Neu | Email-Template (Lieferando-Stil) |
| `app/app/api/checkout/validate-code/route.ts` | Neu | Code-Validierung (liest, schreibt nicht) |
| `app/app/api/checkout/use-code/route.ts` | Neu | Code als used markieren nach Order |
| `app/app/bestellen/[slug]/_v2/BestellenV2.tsx` | Ändern | ?code= param, Rabatt-Banner, Discount auf Total |
| `app/app/bestellen/[slug]/_v1/BestellenV1.tsx` | Ändern | idem |
| `app/components/bestellen/LoyaltyWidget.tsx` | Ändern | Geburtstag-Feld im Profil-Tab + Registrierung |
| `app/app/api/cron/birthday-trigger/route.ts` | Neu | Täglicher Cron-Job |
| `app/vercel.json` | Ändern | Cron-Eintrag 07:00 |
| `app/app/api/admin/campaigns/route.ts` | Neu | CRUD für Campaigns |
| `app/app/admin/marketing/birthday/page.tsx` | Neu | Owner-Dashboard |
| `app/lib/marketing-system-prompt.ts` | Ändern | create_campaign Tool für KI-Chat |

---

## Task 1: Migration — campaigns + discount_codes + orders

**Files:**
- Create: `supabase/migrations/20260530_061_campaigns_discount_codes.sql`

- [ ] **Schritt 1: Migration erstellen**

```sql
-- Migration 061: A3 Birthday + Event Trigger
-- campaigns: per-restaurant trigger configs
-- discount_codes: unique per-subscriber codes
-- orders: discount tracking columns

-- 1) campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  trigger_type    text NOT NULL CHECK (trigger_type IN ('birthday', 'first_order_anniversary', 'custom_event')),
  send_date       date,
  subject         text NOT NULL,
  headline        text NOT NULL,
  body_text       text NOT NULL,
  discount_type   text CHECK (discount_type IN ('percent', 'fixed')),
  discount_value  numeric,
  expires_days    int NOT NULL DEFAULT 7,
  enabled         boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz
);

-- 2) discount_codes
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  subscriber_id   uuid REFERENCES public.marketing_subscribers(id) ON DELETE SET NULL,
  campaign_id     uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  code            text NOT NULL UNIQUE,
  discount_type   text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value  numeric NOT NULL,
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz,
  used_order_id   uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 3) orders: discount tracking
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_code text,
  ADD COLUMN IF NOT EXISTS discount_amount_cents int;

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_restaurant ON public.campaigns(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_send_date ON public.campaigns(send_date) WHERE trigger_type = 'custom_event';
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON public.discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_subscriber ON public.discount_codes(subscriber_id, campaign_id);

-- 5) GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_codes TO service_role;
GRANT SELECT ON public.campaigns TO authenticated;
GRANT SELECT ON public.discount_codes TO authenticated;
GRANT SELECT ON public.campaigns TO anon;
GRANT SELECT ON public.discount_codes TO anon;
```

- [ ] **Schritt 2: Migration in Supabase ausführen**

SQL Editor → Migration einfügen → Run. Prüfen: beide Tabellen erscheinen im Table Editor.

- [ ] **Schritt 3: Commit**

```bash
git add supabase/migrations/20260530_061_campaigns_discount_codes.sql
git commit -m "feat(db): campaigns + discount_codes tables, orders discount columns"
```

---

## Task 2: Code Generator

**Files:**
- Create: `app/lib/marketing/generateDiscountCode.ts`

- [ ] **Schritt 1: Datei erstellen**

```typescript
import crypto from 'crypto'

type Prefix = 'BDAY' | 'ANNI' | 'EVT'

export function generateDiscountCode(prefix: Prefix): string {
  const random = crypto.randomBytes(5).toString('hex').toUpperCase()
  return `${prefix}-${random}`
}
```

- [ ] **Schritt 2: Manuell testen (Node REPL oder curl)**

```bash
node -e "const c=require('./app/lib/marketing/generateDiscountCode'); console.log(c.generateDiscountCode('BDAY'))"
```
Erwartetes Output: `BDAY-A1B2C3D4E5` (10 zufällige Hex-Chars)

- [ ] **Schritt 3: Commit**

```bash
git add app/lib/marketing/generateDiscountCode.ts
git commit -m "feat(marketing): unique discount code generator"
```

---

## Task 3: Campaign Email Template

**Files:**
- Create: `app/lib/marketing/campaignEmail.ts`

- [ ] **Schritt 1: Datei erstellen**

```typescript
export interface CampaignEmailInput {
  customerName: string | null
  restaurantName: string
  restaurantLogoUrl: string | null
  primaryColor: string
  subject: string
  headline: string
  bodyText: string
  code: string | null
  discountLabel: string | null   // z.B. "10 % Rabatt" oder "5 € Rabatt" oder null
  expiresAt: Date | null
  ctaUrl: string
  unsubscribeUrl: string
}

export interface CampaignEmailOutput {
  subject: string
  html: string
  text: string
  headers: Record<string, string>
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function buildCampaignEmail(input: CampaignEmailInput): CampaignEmailOutput {
  const {
    customerName, restaurantName, restaurantLogoUrl, primaryColor,
    subject, headline, bodyText, code, discountLabel, expiresAt,
    ctaUrl, unsubscribeUrl,
  } = input

  const greeting = customerName ? `Hallo ${escapeHtml(customerName)},` : 'Hallo,'

  const logoHtml = restaurantLogoUrl
    ? `<img src="${escapeHtml(restaurantLogoUrl)}" alt="${escapeHtml(restaurantName)}" style="max-height:48px;max-width:180px;display:block;margin:0 auto;">`
    : `<div style="font-size:20px;font-weight:700;color:#0a0a0a;">${escapeHtml(restaurantName)}</div>`

  const codeHtml = code ? `
      <tr><td style="padding:8px 48px 4px;text-align:center;">
        <div style="border:2px dashed #d4d4d8;border-radius:12px;padding:16px;display:inline-block;min-width:200px;">
          <p style="margin:0;font-size:1.4rem;font-weight:800;letter-spacing:0.15em;color:#0a0a0a;font-family:monospace;">${escapeHtml(code)}</p>
        </div>
        ${expiresAt ? `<p style="margin:8px 0 0;font-size:12px;color:#71717a;">Gültig bis ${formatDate(expiresAt)}</p>` : ''}
      </td></tr>` : ''

  const discountBadge = discountLabel
    ? `<p style="margin:0 0 12px;font-size:1.1rem;font-weight:800;color:${escapeHtml(primaryColor)};">${escapeHtml(discountLabel)}</p>`
    : ''

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:32px 48px 16px;text-align:center;">${logoHtml}</td></tr>
      <tr><td style="padding:8px 48px;text-align:center;">
        <h1 style="margin:0;font-size:1.7rem;font-weight:800;color:#0a0a0a;line-height:1.2;">${escapeHtml(headline)}</h1>
      </td></tr>
      <tr><td style="padding:12px 48px 8px;text-align:center;">
        <p style="margin:0 0 4px;font-size:15px;color:#0a0a0a;">${greeting}</p>
        ${discountBadge}
        <p style="margin:0;font-size:15px;color:#52525b;line-height:1.6;">${escapeHtml(bodyText)}</p>
      </td></tr>
      ${codeHtml}
      <tr><td style="padding:20px 48px 32px;text-align:center;">
        <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${escapeHtml(primaryColor)};color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:1rem;">Jetzt einlösen →</a>
      </td></tr>
      <tr><td style="padding:16px 48px 24px;text-align:center;border-top:1px solid #f4f4f5;">
        <p style="margin:0;font-size:12px;color:#a1a1aa;">
          Du bekommst diese Email weil du unsere Angebote abonniert hast.<br>
          <a href="${escapeHtml(unsubscribeUrl)}" style="color:#71717a;text-decoration:underline;">Abmelden</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

  const codeText = code
    ? `\nDein Code: ${code}${expiresAt ? `\nGültig bis: ${formatDate(expiresAt)}` : ''}\n`
    : ''

  const text = `${greeting}\n\n${headline}\n\n${bodyText}${codeText}\n${ctaUrl}\n\nAbmelden: ${unsubscribeUrl}`

  return {
    subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}
```

- [ ] **Schritt 2: Commit**

```bash
git add app/lib/marketing/campaignEmail.ts
git commit -m "feat(marketing): Lieferando-style campaign email template"
```

---

## Task 4: Validate-Code API

**Files:**
- Create: `app/app/api/checkout/validate-code/route.ts`

- [ ] **Schritt 1: Datei erstellen**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const { code, restaurantId } = await request.json()

  if (!code || !restaurantId) {
    return NextResponse.json({ valid: false, error: 'missing_params' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('discount_codes')
    .select('id, discount_type, discount_value, expires_at, used_at, restaurant_id')
    .eq('code', code.toUpperCase().trim())
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ valid: false, error: 'not_found' })
  }
  if (data.restaurant_id !== restaurantId) {
    return NextResponse.json({ valid: false, error: 'wrong_restaurant' })
  }
  if (data.used_at) {
    return NextResponse.json({ valid: false, error: 'already_used' })
  }
  if (new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, error: 'expired' })
  }

  return NextResponse.json({
    valid: true,
    discountType: data.discount_type,
    discountValue: data.discount_value,
    expiresAt: data.expires_at,
  })
}
```

- [ ] **Schritt 2: Manuell testen**

```bash
curl -X POST https://getorderiq.de/api/checkout/validate-code \
  -H "Content-Type: application/json" \
  -d '{"code":"INVALID","restaurantId":"3f63e3c6-60ef-4bfb-aec3-db27bcb6130a"}'
# Erwartet: {"valid":false,"error":"not_found"}
```

- [ ] **Schritt 3: Commit**

```bash
git add app/app/api/checkout/validate-code/route.ts
git commit -m "feat(checkout): validate-code API endpoint"
```

---

## Task 5: Use-Code API

**Files:**
- Create: `app/app/api/checkout/use-code/route.ts`

- [ ] **Schritt 1: Datei erstellen**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const { code, orderId, restaurantId } = await request.json()

  if (!code || !orderId || !restaurantId) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  // Atomic: only mark if still unused and not expired
  const { data, error } = await supabase
    .from('discount_codes')
    .update({ used_at: new Date().toISOString(), used_order_id: orderId })
    .eq('code', code.toUpperCase().trim())
    .eq('restaurant_id', restaurantId)
    .is('used_at', null)
    .gte('expires_at', new Date().toISOString())
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    // Code already used or expired — order proceeds, just don't mark
    return NextResponse.json({ marked: false })
  }

  return NextResponse.json({ marked: true })
}
```

- [ ] **Schritt 2: Commit**

```bash
git add app/app/api/checkout/use-code/route.ts
git commit -m "feat(checkout): use-code API — atomic code marking after order"
```

---

## Task 6: BestellenV2 Checkout Integration

**Files:**
- Modify: `app/app/bestellen/[slug]/_v2/BestellenV2.tsx`

- [ ] **Schritt 1: State + URL-Param-Lesen hinzufügen**

Direkt nach den bestehenden `useState`-Deklarationen (ca. Zeile 50–80) einfügen:

```typescript
const searchParams = useSearchParams()
const [discountCode, setDiscountCode] = useState('')
const [discountInfo, setDiscountInfo] = useState<{
  type: 'percent' | 'fixed'
  value: number
  expiresAt: string
} | null>(null)
const [discountError, setDiscountError] = useState('')
const [discountLoading, setDiscountLoading] = useState(false)
```

Import am Anfang ergänzen:
```typescript
import { useSearchParams } from 'next/navigation'
```

- [ ] **Schritt 2: URL-Param beim Mount auslesen**

Im bestehenden `useEffect` (oder neuen) nach dem Restaurant-Laden:

```typescript
useEffect(() => {
  const codeFromUrl = searchParams.get('code')
  if (codeFromUrl) {
    setDiscountCode(codeFromUrl.toUpperCase())
    validateCode(codeFromUrl.toUpperCase())
  }
}, [searchParams])
```

- [ ] **Schritt 3: validateCode Funktion hinzufügen**

```typescript
async function validateCode(code: string) {
  if (!restaurant) return
  setDiscountLoading(true)
  setDiscountError('')
  try {
    const res = await fetch('/api/checkout/validate-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, restaurantId: restaurant.id }),
    })
    const data = await res.json()
    if (data.valid) {
      setDiscountInfo({ type: data.discountType, value: data.discountValue, expiresAt: data.expiresAt })
    } else {
      const msg: Record<string, string> = {
        not_found: 'Code nicht gefunden.',
        already_used: 'Code wurde bereits eingelöst.',
        expired: 'Code ist abgelaufen.',
        wrong_restaurant: 'Code gilt nicht für dieses Restaurant.',
      }
      setDiscountError(msg[data.error] ?? 'Ungültiger Code.')
      setDiscountInfo(null)
    }
  } catch {
    setDiscountError('Validierung fehlgeschlagen.')
  }
  setDiscountLoading(false)
}
```

- [ ] **Schritt 4: Rabatt auf Total anwenden**

Direkt vor dem `total`-Wert der im Order-Insert verwendet wird:

```typescript
function applyDiscount(subtotalCents: number): { finalCents: number; discountAmountCents: number } {
  if (!discountInfo) return { finalCents: subtotalCents, discountAmountCents: 0 }
  if (discountInfo.type === 'percent') {
    const discountAmountCents = Math.round(subtotalCents * discountInfo.value / 100)
    return { finalCents: subtotalCents - discountAmountCents, discountAmountCents }
  }
  const discountAmountCents = Math.round(discountInfo.value * 100)
  return { finalCents: Math.max(0, subtotalCents - discountAmountCents), discountAmountCents }
}
```

- [ ] **Schritt 5: Order-Insert mit Discount-Feldern ergänzen**

In der `handleSubmit`/`handleOrder` Funktion, wo `orders.insert(...)` aufgerufen wird:

```typescript
const subtotalCents = Math.round(total * 100)
const { finalCents, discountAmountCents } = applyDiscount(subtotalCents)
const finalTotal = finalCents / 100

// Im insert-Objekt ergänzen:
{
  ...existingFields,
  total: finalTotal,
  discount_code: discountInfo && discountCode ? discountCode : null,
  discount_amount_cents: discountAmountCents > 0 ? discountAmountCents : null,
}

// Nach erfolgreichem Insert, Code als used markieren:
if (discountCode && discountInfo && data?.id) {
  await fetch('/api/checkout/use-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: discountCode, orderId: data.id, restaurantId: restaurant.id }),
  })
}
```

- [ ] **Schritt 6: UI — Code-Feld + Rabatt-Banner im Checkout-Formular**

Im Checkout-Formular (wo Email-Opt-In steht), neuen Block hinzufügen:

```tsx
{/* Gutschein-Code */}
<div style={{ marginTop: '12px' }}>
  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
    Gutschein-Code (optional)
  </label>
  <div style={{ display: 'flex', gap: '8px' }}>
    <input
      type="text"
      value={discountCode}
      onChange={e => { setDiscountCode(e.target.value.toUpperCase()); setDiscountInfo(null); setDiscountError('') }}
      placeholder="z.B. BDAY-A1B2C3"
      style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.9rem', fontFamily: 'monospace', letterSpacing: '0.05em' }}
    />
    <button
      type="button"
      onClick={() => validateCode(discountCode)}
      disabled={!discountCode.trim() || discountLoading}
      style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: discountLoading ? 0.6 : 1 }}
    >
      {discountLoading ? '…' : 'Einlösen'}
    </button>
  </div>
  {discountInfo && (
    <div style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '8px', background: '#16a34a15', border: '1px solid #16a34a40', color: '#16a34a', fontSize: '0.85rem', fontWeight: 600 }}>
      🎉 {discountInfo.type === 'percent' ? `${discountInfo.value} % Rabatt` : `${discountInfo.value} € Rabatt`} aktiviert!
    </div>
  )}
  {discountError && (
    <p style={{ marginTop: '6px', fontSize: '0.8rem', color: '#ef4444' }}>{discountError}</p>
  )}
</div>
```

- [ ] **Schritt 7: Testen**

1. Öffne `getorderiq.de/bestellen/italiener?code=TESTCODE`
2. Prüfe: Code wird automatisch im Feld vorausgefüllt
3. Prüfe: "Ungültiger Code" erscheint (Code existiert noch nicht)
4. Prüfe: Manuell korrekten Code eingeben → grüner Banner erscheint

- [ ] **Schritt 8: Commit**

```bash
git add app/app/bestellen/[slug]/_v2/BestellenV2.tsx
git commit -m "feat(checkout): discount code field, URL param, banner, total reduction (V2)"
```

---

## Task 7: BestellenV1 Checkout Integration

**Files:**
- Modify: `app/app/bestellen/[slug]/_v1/BestellenV1.tsx`

- [ ] **Schritt 1: Gleiche Logik wie Task 6 für V1 einbauen**

Exakt dieselben Änderungen wie Task 6 (State, validateCode, applyDiscount, Order-Insert, UI-Block) in BestellenV1.tsx einfügen. Die Funktion `handleOrder` in V1 aufsuchen und dort die discount-Felder ergänzen.

Import ergänzen:
```typescript
import { useSearchParams } from 'next/navigation'
```

States und Funktionen identisch zu Task 6 einfügen.

Im Insert-Objekt (bei `supabase.from('orders').insert`):
```typescript
const subtotalCents = Math.round(total * 100)
const { finalCents, discountAmountCents } = applyDiscount(subtotalCents)

{
  ...existingFields,
  total: finalCents / 100,
  discount_code: discountInfo && discountCode ? discountCode : null,
  discount_amount_cents: discountAmountCents > 0 ? discountAmountCents : null,
}

// Nach erfolgreichem Insert:
if (discountCode && discountInfo && data?.id) {
  await fetch('/api/checkout/use-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: discountCode, orderId: data.id, restaurantId: restaurant.id }),
  })
}
```

UI-Block (Code-Feld + Banner) identisch zu Task 6 in V1 einbauen.

- [ ] **Schritt 2: Commit**

```bash
git add app/app/bestellen/[slug]/_v1/BestellenV1.tsx
git commit -m "feat(checkout): discount code field + reduction (V1 parity)"
```

---

## Task 8: Geburtstag-Feld in LoyaltyWidget

**Files:**
- Modify: `app/components/bestellen/LoyaltyWidget.tsx`

- [ ] **Schritt 1: State im LoyaltyCardDropdown für Birthday**

In `LoyaltyCardDropdown` (ca. Zeile 388), nach `const [savingPref, setSavingPref]` einfügen:

```typescript
const [birthday, setBirthday] = useState<string>('')
const [savingBirthday, setSavingBirthday] = useState(false)
const [birthdayMsg, setBirthdayMsg] = useState('')
```

- [ ] **Schritt 2: Birthday beim Mount laden**

Am Anfang der Komponente (nach den useState-Deklarationen):

```typescript
useEffect(() => {
  if (!mId) return
  supabase
    .from('marketing_subscribers')
    .select('birthday')
    .eq('user_id', (member as { user_id?: string } | null)?.user_id ?? '')
    .maybeSingle()
    .then(({ data }) => {
      if (data?.birthday) setBirthday(data.birthday.slice(0, 10))
    })
}, [mId])
```

Einfacher: Birthday aus dem `member`-Objekt nehmen — aber dafür müsste der API-Call erweitert werden. Stattdessen: Birthday via separaten Supabase-Call aus `marketing_subscribers` anhand `user_id`:

```typescript
useEffect(() => {
  supabase.auth.getUser().then(async ({ data: { user } }) => {
    if (!user) return
    const { data } = await supabase
      .from('marketing_subscribers')
      .select('birthday')
      .eq('restaurant_id', restaurantId)
      .eq('email', user.email ?? '')
      .maybeSingle()
    if (data?.birthday) setBirthday(data.birthday.slice(0, 10))
  })
}, [restaurantId])
```

- [ ] **Schritt 3: saveBirthday Funktion**

```typescript
async function saveBirthday() {
  if (!birthday) return
  setSavingBirthday(true)
  setBirthdayMsg('')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { setSavingBirthday(false); return }
  const { error } = await supabase
    .from('marketing_subscribers')
    .update({ birthday })
    .eq('restaurant_id', restaurantId)
    .eq('email', user.email ?? '')
  setSavingBirthday(false)
  setBirthdayMsg(error ? 'Fehler beim Speichern.' : 'Gespeichert! 🎂')
  setTimeout(() => setBirthdayMsg(''), 3000)
}
```

- [ ] **Schritt 4: UI im Profil-Tab**

Im `tab === 'profile'` Block, nach den Dietary-Checkboxen und vor dem Daten-Export-Block:

```tsx
{/* Geburtstag */}
<div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', marginBottom: '10px' }}>
  <p style={{ color: '#8B8B93', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
    Geburtstag {savingBirthday ? '(speichert…)' : ''}
  </p>
  <p style={{ color: '#8B8B93', fontSize: '0.7rem', marginBottom: '8px', lineHeight: 1.4 }}>
    Optional — für deinen Geburtstags-Rabatt 🎂
  </p>
  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
    <input
      type="date"
      value={birthday}
      onChange={e => setBirthday(e.target.value)}
      style={{ flex: 1, background: '#1a1a2a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 10px', color: '#F5F5F7', fontSize: '0.8rem', colorScheme: 'dark' }}
    />
    <button
      onClick={saveBirthday}
      disabled={savingBirthday || !birthday}
      style={{ padding: '6px 10px', borderRadius: '8px', border: 'none', background: accentColor, color: '#fff', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', opacity: savingBirthday ? 0.6 : 1 }}
    >
      💾
    </button>
  </div>
  {birthdayMsg && <p style={{ color: '#16a34a', fontSize: '0.75rem', marginTop: '4px' }}>{birthdayMsg}</p>}
</div>
```

- [ ] **Schritt 5: Birthday-Feld auch im Register-Modal**

Im `LoyaltyModal` (mode === 'register'), nach dem Passwort-Feld:

```tsx
{mode === 'register' && (
  <>
    <input
      type="date"
      value={birthdayReg}
      onChange={e => setBirthdayReg(e.target.value)}
      style={{ ...inputStyle, marginTop: '10px', colorScheme: 'dark' }}
      placeholder="Geburtstag (optional)"
    />
    <p style={{ fontSize: '0.72rem', color: '#8B8B93', marginTop: '6px', lineHeight: 1.4 }}>
      Optional — für deinen Geburtstags-Rabatt 🎂 (nur Monat + Tag wird gespeichert)
    </p>
  </>
)}
```

State im `LoyaltyModal` ergänzen:
```typescript
const [birthdayReg, setBirthdayReg] = useState('')
```

Im Register-Handler nach dem `marketing_subscribers.upsert` Call:
```typescript
if (birthdayReg && data.user) {
  await supabase
    .from('marketing_subscribers')
    .update({ birthday: birthdayReg })
    .eq('restaurant_id', restaurantId)
    .eq('email', email)
}
```

- [ ] **Schritt 6: Testen**

1. `getorderiq.de/bestellen/italiener` → "Anmelden" → einloggen
2. Profil-Tab → Geburtstag-Feld erscheint
3. Datum eingeben → speichern → grüner "Gespeichert!" Text
4. Supabase prüfen: `SELECT birthday FROM marketing_subscribers WHERE email='...'`

- [ ] **Schritt 7: Commit**

```bash
git add app/components/bestellen/LoyaltyWidget.tsx
git commit -m "feat(loyalty): birthday field in profile tab + register modal"
```

---

## Task 9: Birthday-Trigger Cron-Job

**Files:**
- Create: `app/app/api/cron/birthday-trigger/route.ts`
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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''
const FROM_EMAIL = process.env.RESEND_FROM ?? 'onboarding@resend.dev'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseAdmin()
  let totalSent = 0
  let totalSkipped = 0

  // ── 1. Personal Triggers (Birthday + First-Order Anniversary) ─────────────
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .in('trigger_type', ['birthday', 'first_order_anniversary'])
    .eq('enabled', true)

  for (const campaign of campaigns ?? []) {
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, slug, logo_url, primary_color')
      .eq('id', campaign.restaurant_id)
      .single()
    if (!restaurant) continue

    let subscribers: Array<{ id: string; email: string; name: string | null }> = []

    if (campaign.trigger_type === 'birthday') {
      const { data } = await supabase.rpc('get_birthday_subscribers_today', {
        p_restaurant_id: campaign.restaurant_id,
        p_campaign_id: campaign.id,
      })
      subscribers = data ?? []
    } else {
      const { data } = await supabase.rpc('get_anniversary_subscribers_today', {
        p_restaurant_id: campaign.restaurant_id,
        p_campaign_id: campaign.id,
      })
      subscribers = data ?? []
    }

    for (const sub of subscribers) {
      const { sent, skipped } = await sendCampaignEmail({ supabase, campaign, restaurant, subscriber: sub })
      totalSent += sent
      totalSkipped += skipped
    }
  }

  // ── 2. Custom Events ──────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const { data: eventCampaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('trigger_type', 'custom_event')
    .eq('send_date', today)
    .eq('enabled', true)
    .is('sent_at', null)

  for (const campaign of eventCampaigns ?? []) {
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, slug, logo_url, primary_color')
      .eq('id', campaign.restaurant_id)
      .single()
    if (!restaurant) continue

    const { data: subscribers } = await supabase
      .from('marketing_subscribers')
      .select('id, email, name')
      .eq('restaurant_id', campaign.restaurant_id)
      .is('unsubscribed_at', null)

    for (const sub of subscribers ?? []) {
      const { sent, skipped } = await sendCampaignEmail({ supabase, campaign, restaurant, subscriber: sub })
      totalSent += sent
      totalSkipped += skipped
    }

    await supabase
      .from('campaigns')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', campaign.id)
  }

  return NextResponse.json({ totalSent, totalSkipped })
}

async function sendCampaignEmail({
  supabase, campaign, restaurant, subscriber,
}: {
  supabase: ReturnType<typeof createSupabaseAdmin>
  campaign: Record<string, unknown>
  restaurant: { id: string; name: string; slug: string; logo_url: string | null; primary_color: string | null }
  subscriber: { id: string; email: string; name: string | null }
}): Promise<{ sent: number; skipped: number }> {
  // Dedup: already sent for this campaign+subscriber?
  const { data: existing } = await supabase
    .from('discount_codes')
    .select('id')
    .eq('subscriber_id', subscriber.id)
    .eq('campaign_id', campaign.id as string)
    .maybeSingle()
  if (existing) return { sent: 0, skipped: 1 }

  const prefix = campaign.trigger_type === 'birthday' ? 'BDAY'
    : campaign.trigger_type === 'first_order_anniversary' ? 'ANNI' : 'EVT'

  const hasDiscount = campaign.discount_type && campaign.discount_value
  let code: string | null = null
  let expiresAt: Date | null = null

  if (hasDiscount) {
    const expiryDays = (campaign.expires_days as number) ?? 7
    expiresAt = new Date(Date.now() + expiryDays * 86400 * 1000)
    code = generateDiscountCode(prefix as 'BDAY' | 'ANNI' | 'EVT')

    await supabase.from('discount_codes').insert({
      restaurant_id: restaurant.id,
      subscriber_id: subscriber.id,
      campaign_id: campaign.id,
      code,
      discount_type: campaign.discount_type,
      discount_value: campaign.discount_value,
      expires_at: expiresAt.toISOString(),
    })
  }

  const discountLabel = hasDiscount
    ? campaign.discount_type === 'percent'
      ? `${campaign.discount_value} % Rabatt`
      : `${campaign.discount_value} € Rabatt`
    : null

  const unsubToken = Buffer.from(`${subscriber.id}:unsub`).toString('base64url')
  const unsubscribeUrl = `${APP_URL}/unsubscribe?t=${unsubToken}`
  const ctaUrl = code
    ? `${APP_URL}/bestellen/${restaurant.slug}?code=${code}`
    : `${APP_URL}/bestellen/${restaurant.slug}`

  const { subject, html, text, headers } = buildCampaignEmail({
    customerName: subscriber.name,
    restaurantName: restaurant.name,
    restaurantLogoUrl: restaurant.logo_url,
    primaryColor: restaurant.primary_color ?? '#EA580C',
    subject: campaign.subject as string,
    headline: campaign.headline as string,
    bodyText: campaign.body_text as string,
    code,
    discountLabel,
    expiresAt,
    ctaUrl,
    unsubscribeUrl,
  })

  await sendEmail({
    restaurantId: restaurant.id,
    fromEmail: FROM_EMAIL,
    fromName: restaurant.name,
    toEmail: subscriber.email,
    toSubscriberId: subscriber.id,
    subject,
    html,
    text,
    headers,
    campaignId: campaign.id as string,
    immediate: true,
  })

  return { sent: 1, skipped: 0 }
}
```

- [ ] **Schritt 2: Zwei SQL-Hilfsfunktionen in Supabase erstellen**

Im Supabase SQL Editor ausführen:

```sql
-- Subscribers mit Geburtstag heute (kein Doppelversand)
CREATE OR REPLACE FUNCTION public.get_birthday_subscribers_today(
  p_restaurant_id uuid,
  p_campaign_id uuid
) RETURNS TABLE(id uuid, email text, name text) LANGUAGE sql STABLE AS $$
  SELECT ms.id, ms.email, ms.name
  FROM marketing_subscribers ms
  WHERE ms.restaurant_id = p_restaurant_id
    AND ms.unsubscribed_at IS NULL
    AND ms.birthday IS NOT NULL
    AND EXTRACT(MONTH FROM ms.birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY FROM ms.birthday) = EXTRACT(DAY FROM CURRENT_DATE)
    AND NOT EXISTS (
      SELECT 1 FROM discount_codes dc
      WHERE dc.subscriber_id = ms.id AND dc.campaign_id = p_campaign_id
    );
$$;

-- Subscribers mit Bestell-Jahrestag heute (kein Doppelversand)
CREATE OR REPLACE FUNCTION public.get_anniversary_subscribers_today(
  p_restaurant_id uuid,
  p_campaign_id uuid
) RETURNS TABLE(id uuid, email text, name text) LANGUAGE sql STABLE AS $$
  SELECT DISTINCT ms.id, ms.email, ms.name
  FROM marketing_subscribers ms
  JOIN orders o ON o.customer_id = ms.id
  WHERE ms.restaurant_id = p_restaurant_id
    AND ms.unsubscribed_at IS NULL
    AND DATE_TRUNC('day', o.created_at) = CURRENT_DATE - INTERVAL '1 year'
    AND NOT EXISTS (
      SELECT 1 FROM discount_codes dc
      WHERE dc.subscriber_id = ms.id AND dc.campaign_id = p_campaign_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_birthday_subscribers_today TO service_role;
GRANT EXECUTE ON FUNCTION public.get_anniversary_subscribers_today TO service_role;
```

- [ ] **Schritt 3: vercel.json Cron-Eintrag**

`app/vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/marketing-automations",
      "schedule": "0 7 * * *"
    },
    {
      "path": "/api/cron/marketing-retry",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/birthday-trigger",
      "schedule": "0 7 * * *"
    }
  ]
}
```

- [ ] **Schritt 4: Manuell testen**

```bash
curl -X GET https://getorderiq.de/api/cron/birthday-trigger \
  -H "Authorization: Bearer $CRON_SECRET"
# Erwartet: {"totalSent":0,"totalSkipped":0}  (noch keine Campaigns)
```

- [ ] **Schritt 5: Commit**

```bash
git add app/app/api/cron/birthday-trigger/route.ts app/vercel.json
git commit -m "feat(cron): birthday-trigger daily job — birthday + anniversary + custom events"
```

---

## Task 10: Campaigns CRUD API

**Files:**
- Create: `app/app/api/admin/campaigns/route.ts`

- [ ] **Schritt 1: Datei erstellen**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { supabase as clientSupabase } from '@/lib/supabase'

export const runtime = 'nodejs'

async function getRestaurantId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await clientSupabase.auth.getUser(token)
  if (!user) return null
  const admin = createSupabaseAdmin()
  const { data } = await admin.from('restaurants').select('id').eq('owner_id', user.id).single()
  return data?.id ?? null
}

export async function GET(request: NextRequest) {
  const restaurantId = await getRestaurantId(request)
  if (!restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const restaurantId = await getRestaurantId(request)
  if (!restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('campaigns')
    .insert({ ...body, restaurant_id: restaurantId })
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
  const { data, error } = await supabase
    .from('campaigns')
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
    .from('campaigns')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
```

- [ ] **Schritt 2: Commit**

```bash
git add app/app/api/admin/campaigns/route.ts
git commit -m "feat(api): campaigns CRUD endpoint for owner dashboard + AI chat"
```

---

## Task 11: Owner Dashboard

**Files:**
- Create: `app/app/admin/marketing/birthday/page.tsx`

- [ ] **Schritt 1: Datei erstellen**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Campaign = {
  id: string
  trigger_type: 'birthday' | 'first_order_anniversary' | 'custom_event'
  send_date: string | null
  subject: string
  headline: string
  body_text: string
  discount_type: 'percent' | 'fixed' | null
  discount_value: number | null
  expires_days: number
  enabled: boolean
  sent_at: string | null
  created_at: string
}

type FormState = Omit<Campaign, 'id' | 'sent_at' | 'created_at'>

const DEFAULT_FORM: FormState = {
  trigger_type: 'birthday',
  send_date: null,
  subject: '',
  headline: '',
  body_text: '',
  discount_type: null,
  discount_value: null,
  expires_days: 7,
  enabled: true,
}

export default function BirthdayDashboard() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/owner-login'); return }
      setToken(session.access_token)
    })
  }, [router])

  const loadCampaigns = useCallback(async () => {
    if (!token) return
    const res = await fetch('/api/admin/campaigns', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    setCampaigns(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [token])

  useEffect(() => { loadCampaigns() }, [loadCampaigns])

  async function saveCampaign() {
    if (!token) return
    setSaving(true)
    await fetch('/api/admin/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    })
    setShowForm(false)
    setForm(DEFAULT_FORM)
    await loadCampaigns()
    setSaving(false)
  }

  async function toggleEnabled(c: Campaign) {
    if (!token) return
    await fetch('/api/admin/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: c.id, enabled: !c.enabled }),
    })
    await loadCampaigns()
  }

  async function deleteCampaign(id: string) {
    if (!token || !confirm('Kampagne löschen?')) return
    await fetch('/api/admin/campaigns', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    await loadCampaigns()
  }

  const triggerLabel: Record<string, string> = {
    birthday: '🎂 Geburtstag',
    first_order_anniversary: '🗓 Bestell-Jahrestag',
    custom_event: '🎉 Restaurant-Event',
  }

  if (loading) return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Lade…</div>

  return (
    <div style={{ padding: '24px', maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.4rem', margin: 0 }}>
            🎂 Geburtstag & Events
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Automatische Emails mit individuellen Gutschein-Codes
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
        >
          + Neue Kampagne
        </button>
      </div>

      {/* Campaign List */}
      {campaigns.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '12px' }}>
          Noch keine Kampagnen. Erstelle deine erste Geburtstags-Email!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {campaigns.map(c => (
            <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {triggerLabel[c.trigger_type]}
                    {c.send_date ? ` · ${c.send_date}` : ''}
                    {c.sent_at ? ' · ✅ Gesendet' : ''}
                  </span>
                  <p style={{ color: 'var(--text)', fontWeight: 700, margin: '4px 0 2px' }}>{c.headline}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
                    {c.discount_type ? `${c.discount_value} ${c.discount_type === 'percent' ? '%' : '€'} Rabatt · ${c.expires_days} Tage gültig` : 'Kein Rabatt'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => toggleEnabled(c)}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: c.enabled ? '#16a34a20' : 'var(--surface-2)', color: c.enabled ? '#16a34a' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    {c.enabled ? 'Aktiv' : 'Inaktiv'}
                  </button>
                  <button
                    onClick={() => deleteCampaign(c.id)}
                    style={{ padding: '6px 10px', borderRadius: '8px', border: 'none', background: '#ef444415', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>Neue Kampagne</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            {/* Trigger Type */}
            <label style={labelStyle}>Trigger</label>
            <select value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value as FormState['trigger_type'] }))} style={inputStyle}>
              <option value="birthday">🎂 Geburtstag</option>
              <option value="first_order_anniversary">🗓 Bestell-Jahrestag</option>
              <option value="custom_event">🎉 Restaurant-Event (einmalig)</option>
            </select>

            {form.trigger_type === 'custom_event' && (
              <>
                <label style={labelStyle}>Sendedatum</label>
                <input type="date" value={form.send_date ?? ''} onChange={e => setForm(f => ({ ...f, send_date: e.target.value }))} style={inputStyle} />
              </>
            )}

            <label style={labelStyle}>Betreff (Email-Betreff)</label>
            <input type="text" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Alles Gute zum Geburtstag 🎂" style={inputStyle} />

            <label style={labelStyle}>Headline (groß in der Email)</label>
            <input type="text" value={form.headline} onChange={e => setForm(f => ({ ...f, headline: e.target.value }))} placeholder="Heute ist dein Tag!" style={inputStyle} />

            <label style={labelStyle}>Text</label>
            <textarea value={form.body_text} onChange={e => setForm(f => ({ ...f, body_text: e.target.value }))} placeholder="Wir freuen uns, deinen Geburtstag mit dir zu feiern…" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />

            <label style={labelStyle}>Rabatt-Typ (optional)</label>
            <select value={form.discount_type ?? ''} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value as 'percent' | 'fixed' | null || null }))} style={inputStyle}>
              <option value="">Kein Rabatt</option>
              <option value="percent">Prozent (%)</option>
              <option value="fixed">Fixer Betrag (€)</option>
            </select>

            {form.discount_type && (
              <>
                <label style={labelStyle}>Rabatt-Wert</label>
                <input type="number" min={0} value={form.discount_value ?? ''} onChange={e => setForm(f => ({ ...f, discount_value: parseFloat(e.target.value) || null }))} placeholder={form.discount_type === 'percent' ? '10' : '5'} style={inputStyle} />
                <label style={labelStyle}>Gültig für (Tage)</label>
                <input type="number" min={1} value={form.expires_days} onChange={e => setForm(f => ({ ...f, expires_days: parseInt(e.target.value) || 7 }))} style={inputStyle} />
              </>
            )}

            <button
              onClick={saveCampaign}
              disabled={saving || !form.subject || !form.headline || !form.body_text}
              style={{ width: '100%', marginTop: '20px', padding: '14px', borderRadius: '12px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Speichert…' : 'Kampagne erstellen'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem',
  fontWeight: 600, marginBottom: '5px', marginTop: '12px', textTransform: 'uppercase',
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
  borderRadius: '8px', border: '1px solid var(--border)',
  background: 'var(--surface-2, #1a1a2a)', color: 'var(--text)',
  fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit',
}
```

- [ ] **Schritt 2: Link im Admin-Sidebar hinzufügen**

In der Admin-Navigation (Datei suchen mit `grep -r "marketing/loyalty" app/`), neuen Link hinzufügen:

```tsx
{ href: '/admin/marketing/birthday', label: '🎂 Geburtstag & Events' }
```

- [ ] **Schritt 3: Testen**

1. `/admin/marketing/birthday` aufrufen
2. "+ Neue Kampagne" → Formular ausfüllen → Speichern
3. Campaign erscheint in der Liste
4. Toggle Aktiv/Inaktiv funktioniert

- [ ] **Schritt 4: Commit**

```bash
git add app/app/admin/marketing/birthday/page.tsx
git commit -m "feat(dashboard): birthday + event campaigns management page"
```

---

## Task 12: KI-Chat create_campaign Tool

**Files:**
- Modify: `app/lib/marketing-system-prompt.ts`

- [ ] **Schritt 1: `create_campaign` Tool-Definition lesen und ergänzen**

`app/lib/marketing-system-prompt.ts` öffnen. Das Array mit Tool-Definitionen suchen. Neues Tool hinzufügen:

```typescript
{
  name: 'create_campaign',
  description: 'Erstellt eine neue Kampagne (Geburtstag, Jahrestag oder Restaurant-Event) mit optionalem Rabatt-Code.',
  input_schema: {
    type: 'object',
    properties: {
      trigger_type: {
        type: 'string',
        enum: ['birthday', 'first_order_anniversary', 'custom_event'],
        description: 'birthday = täglich für Geburtstage, first_order_anniversary = täglich für Jahrestage, custom_event = einmalig an send_date',
      },
      send_date: {
        type: 'string',
        description: 'ISO-Datum (YYYY-MM-DD) — nur für custom_event',
      },
      subject: { type: 'string', description: 'Email-Betreff' },
      headline: { type: 'string', description: 'Große Headline in der Email' },
      body_text: { type: 'string', description: 'Fließtext unter der Headline' },
      discount_type: {
        type: 'string',
        enum: ['percent', 'fixed'],
        description: 'percent = Prozent, fixed = fixer Euro-Betrag',
      },
      discount_value: { type: 'number', description: 'Rabatt-Wert (z.B. 10 für 10% oder 5 für 5€)' },
      expires_days: { type: 'number', description: 'Wie viele Tage der Code gültig ist (Standard: 7)' },
    },
    required: ['trigger_type', 'subject', 'headline', 'body_text'],
  },
},
```

- [ ] **Schritt 2: Tool-Handler im Chat-API-Route ergänzen**

Die Route suchen die Tool-Calls verarbeitet (suchen mit `grep -r "tool_use\|toolName\|create_campaign" app/`). Dort Case hinzufügen:

```typescript
case 'create_campaign': {
  const session = await getSession(request)
  if (!session) break
  const admin = createSupabaseAdmin()
  const { data: resto } = await admin.from('restaurants').select('id').eq('owner_id', session.user.id).single()
  if (!resto) break
  const { data } = await admin.from('campaigns').insert({ ...toolInput, restaurant_id: resto.id }).select().single()
  toolResult = data
    ? `✅ Kampagne erstellt: "${toolInput.headline}" (${toolInput.trigger_type}${toolInput.send_date ? ` am ${toolInput.send_date}` : ''})`
    : '❌ Fehler beim Erstellen.'
  break
}
```

- [ ] **Schritt 3: Testen via AI-Chat**

Im Admin-Chat eingeben:
> "Erstelle eine Geburtstags-Kampagne mit 10% Rabatt, Betreff 'Herzlichen Glückwunsch 🎂', Headline 'Heute ist dein Tag!', Text 'Feier deinen Geburtstag bei uns mit einem besonderen Rabatt.'"

Prüfen: Campaign erscheint in `/admin/marketing/birthday`.

- [ ] **Schritt 4: Commit**

```bash
git add app/lib/marketing-system-prompt.ts
git commit -m "feat(ai-chat): create_campaign tool — owner can configure campaigns via chat"
```

---

## Self-Review

- ✅ Migration: campaigns vor discount_codes (FK-Reihenfolge korrekt)
- ✅ GRANTs für service_role, authenticated, anon vorhanden
- ✅ Dedup: `discount_codes` Check vor jedem Versand verhindert Doppelversand
- ✅ Atomic Code-Marking: `.is('used_at', null)` im use-code UPDATE
- ✅ V1 + V2 beide abgedeckt (Task 6 + 7)
- ✅ DSGVO: nur Monat+Tag relevant, kein Jahrgang gespeichert — Info-Text im Widget
- ✅ Skip-Conditions: `unsubscribed_at IS NULL` in SQL-Funktionen
- ✅ Keine Placeholder — alle Code-Blöcke vollständig
- ✅ `generateDiscountCode` Prefix-Typen stimmen überein (Task 2 + Task 9)
- ✅ `buildCampaignEmail` Interface stimmt mit Aufruf in Cron überein (Task 3 + 9)
- ✅ Campaigns API nutzt denselben Auth-Pattern wie andere Admin-Routes
