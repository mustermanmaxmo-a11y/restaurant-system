# Plan 2: Auth & Stripe Onboarding — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restaurant-Owner können sich registrieren, einen Plan bei Stripe buchen und danach ihr Restaurant per Setup-Wizard einrichten — das System ist dann live und zahlend.

**Architecture:** Next.js App Router + Supabase Auth (Email/Password) für Owner-Auth. Stripe Checkout Sessions für Subscription. Webhook-Handler aktualisiert die `restaurants`-Tabelle nach erfolgreicher Zahlung. Next.js Middleware schützt `/admin`-Routen.

**Tech Stack:** Next.js 16 App Router, `@supabase/ssr` (Middleware-Auth), `stripe` npm SDK, Supabase Auth, Tailwind CSS

---

## Onboarding-Flow (wichtig zum Verstehen)

```
/register → Supabase signUp → /admin/setup (Wizard: Name + Slug)
         → createRestaurant(active=false) → Stripe Checkout
         → [Stripe zahlt] → Webhook: active=true, stripe IDs setzen
         → Redirect zu /admin?welcome=true
```

**Owner-Login (wiederkehrend):**
```
/owner-login → Supabase signInWithPassword → /admin
```

**Middleware-Schutz:**
- `/admin/*` → kein Auth-Session → Redirect zu `/owner-login`
- `/admin/setup` → kein Restaurant-Datensatz → erlaubt (Wizard läuft)
- `/admin` → kein aktives Abo → Weiterleitung zu `/admin/billing`

---

## Dateistruktur

```
app/
├── app/
│   ├── register/
│   │   └── page.tsx              -- Registrierungs-Formular (Email + PW)
│   ├── owner-login/
│   │   └── page.tsx              -- Owner Email-Login
│   ├── admin/
│   │   ├── page.tsx              -- Admin-Startseite (prüft Setup-Status)
│   │   ├── setup/
│   │   │   └── page.tsx          -- Setup-Wizard (Name, Slug, Stripe)
│   │   └── billing/
│   │       └── page.tsx          -- Billing-Status (wenn inaktiv)
│   └── api/
│       └── stripe/
│           ├── checkout/
│           │   └── route.ts      -- POST: Stripe Checkout Session erstellen
│           └── webhook/
│               └── route.ts      -- POST: Stripe Events verarbeiten
├── middleware.ts                 -- Route-Schutz für /admin
└── lib/
    └── supabase-middleware.ts    -- Supabase SSR Client für Middleware
```

**Neue packages:**
- `stripe` — Stripe Node.js SDK
- `@supabase/ssr` — Supabase Session-Handling in Middleware + Server Components

---

## Task 1: Packages installieren + Env-Vars einrichten

**Files:**
- Modify: `app/package.json` (via npm install)
- Modify: `app/.env.local`

- [ ] **Schritt 1: Packages installieren**

```bash
cd app && npm install stripe @supabase/ssr
```

Erwartung: Beide Packages in `node_modules`, kein Error.

- [ ] **Schritt 2: Env-Vars ergänzen**

`app/.env.local` — folgende Zeilen hinzufügen (bestehende SUPABASE-Vars bleiben):
```
STRIPE_SECRET_KEY=sk_test_DEIN_KEY_HIER
STRIPE_WEBHOOK_SECRET=whsec_DEIN_WEBHOOK_SECRET_HIER
STRIPE_PRICE_BASIC=price_DEIN_BASIC_PRICE_ID
STRIPE_PRICE_PRO=price_DEIN_PRO_PRICE_ID
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Wo du die Werte findest:**
- `STRIPE_SECRET_KEY` → Stripe Dashboard → Developers → API Keys → Secret key
- `STRIPE_PRICE_BASIC` / `STRIPE_PRICE_PRO` → Stripe Dashboard → Products → dein Produkt → Prices (zuerst Produkt anlegen falls noch nicht geschehen)
- `STRIPE_WEBHOOK_SECRET` → kommt in Task 5 (Webhook einrichten)

**Stripe-Produkte anlegen (falls noch nicht done):**
Stripe Dashboard → Products → Add product:
- Name: "RestaurantOS Basic", Preis: 29,00 € / Monat (recurring) → Price ID kopieren → `STRIPE_PRICE_BASIC`
- Name: "RestaurantOS Pro", Preis: 79,00 € / Monat (recurring) → Price ID kopieren → `STRIPE_PRICE_PRO`

- [ ] **Schritt 3: TypeScript-Check**

```bash
cd app && npx tsc --noEmit
```

Erwartung: Keine Fehler (neue Packages haben eigene Types).

---

## Task 2: Supabase SSR + Middleware

**Files:**
- Create: `app/lib/supabase-middleware.ts`
- Create: `app/middleware.ts`

- [ ] **Schritt 1: Supabase SSR Helper erstellen**

`app/lib/supabase-middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export function createMiddlewareClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )
}
```

- [ ] **Schritt 2: Middleware erstellen**

`app/middleware.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase-middleware'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createMiddlewareClient(request, response)

  const { data: { session } } = await supabase.auth.getSession()

  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  const isSetupRoute = request.nextUrl.pathname.startsWith('/admin/setup')

  // /admin/* ohne Session → Owner-Login
  if (isAdminRoute && !session) {
    return NextResponse.redirect(new URL('/owner-login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
```

- [ ] **Schritt 3: Testen dass Middleware aktiv ist**

```bash
cd app && npm run dev
```

Browser: `http://localhost:3000/admin` öffnen.
Erwartung: Redirect zu `/owner-login` (auch wenn die Seite noch nicht gebaut ist — 404 ist ok, aber der Redirect muss passieren).

---

## Task 3: Registrierungsseite

**Files:**
- Create: `app/app/register/page.tsx`

- [ ] **Schritt 1: Register-Seite erstellen**

```bash
mkdir -p app/app/register
```

`app/app/register/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein.')
      setLoading(false)
      return
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    router.push('/admin/setup')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-10">
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🍽️</div>
          <h1 style={{ color: 'var(--text)', fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>
            RestaurantOS starten
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Kostenloses Konto erstellen — dann Plan wählen
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label
              htmlFor="email"
              style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="chef@meinrestaurant.de"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '1rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Passwort
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Mindestens 8 Zeichen"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '1rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '0.875rem', background: '#ef444415', padding: '10px 14px', borderRadius: '8px' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '10px',
              border: 'none',
              background: loading ? 'var(--border)' : 'var(--accent)',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '8px',
            }}
          >
            {loading ? 'Wird erstellt...' : 'Konto erstellen →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Bereits ein Konto?{' '}
          <Link href="/owner-login" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            Einloggen
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Schritt 2: Im Browser testen**

`http://localhost:3000/register` öffnen.
Prüfen:
- Formular wird angezeigt
- Dark/Light Mode funktioniert (CSS Vars)
- Zu früh absenden → Validierung greift

- [ ] **Schritt 3: Commit**

```bash
cd app && git add -A && git commit -m "feat: add registration page"
```

---

## Task 4: Owner-Login-Seite

**Files:**
- Create: `app/app/owner-login/page.tsx`

- [ ] **Schritt 1: Owner-Login erstellen**

```bash
mkdir -p app/app/owner-login
```

`app/app/owner-login/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function OwnerLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError('E-Mail oder Passwort falsch.')
      setLoading(false)
      return
    }

    router.push('/admin')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🍽️</div>
          <h1 style={{ color: 'var(--text)', fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>
            Admin-Login
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Melde dich mit deinem Restaurant-Account an
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label
              htmlFor="email"
              style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="chef@meinrestaurant.de"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '1rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Passwort
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Dein Passwort"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '1rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '0.875rem', background: '#ef444415', padding: '10px 14px', borderRadius: '8px' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '10px',
              border: 'none',
              background: loading ? 'var(--border)' : 'var(--accent)',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '8px',
            }}
          >
            {loading ? 'Einloggen...' : 'Einloggen →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Noch kein Konto?{' '}
          <Link href="/register" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            Jetzt starten
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Schritt 2: Testen**

`http://localhost:3000/owner-login`
- Falsches Passwort → Fehlermeldung erscheint
- Dark/Light Mode korrekt
- Link zu /register funktioniert

- [ ] **Schritt 3: Commit**

```bash
cd app && git add -A && git commit -m "feat: add owner login page"
```

---

## Task 5: Stripe Checkout API Route

**Files:**
- Create: `app/app/api/stripe/checkout/route.ts`

- [ ] **Schritt 1: API-Ordner erstellen**

```bash
mkdir -p app/app/api/stripe/checkout app/app/api/stripe/webhook
```

- [ ] **Schritt 2: Checkout Route erstellen**

`app/app/api/stripe/checkout/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  }

  const body = await request.json()
  const { plan } = body as { plan: 'basic' | 'pro' }

  const priceId = plan === 'pro'
    ? process.env.STRIPE_PRICE_PRO!
    : process.env.STRIPE_PRICE_BASIC!

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/admin?welcome=true`,
    cancel_url: `${appUrl}/admin/setup?cancelled=true`,
    metadata: {
      user_id: session.user.id,
      plan,
    },
    subscription_data: {
      metadata: {
        user_id: session.user.id,
        plan,
      },
    },
    customer_email: session.user.email,
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
```

---

## Task 6: Stripe Webhook Handler

**Files:**
- Create: `app/app/api/stripe/webhook/route.ts`

- [ ] **Schritt 1: Webhook Route erstellen**

`app/app/api/stripe/webhook/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Service Role Client — bypasses RLS für Webhook-Updates
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return NextResponse.json({ error: 'Webhook signature invalid' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.user_id
    const plan = (session.metadata?.plan as 'basic' | 'pro') || 'basic'
    const customerId = session.customer as string
    const subscriptionId = session.subscription as string

    if (userId) {
      await supabaseAdmin
        .from('restaurants')
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          plan,
          active: true,
        })
        .eq('owner_id', userId)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const customerId = subscription.customer as string

    await supabaseAdmin
      .from('restaurants')
      .update({ active: false })
      .eq('stripe_customer_id', customerId)
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription
    const customerId = subscription.customer as string
    const priceId = subscription.items.data[0]?.price.id

    const plan = priceId === process.env.STRIPE_PRICE_PRO ? 'pro' : 'basic'
    const active = subscription.status === 'active'

    await supabaseAdmin
      .from('restaurants')
      .update({ plan, active })
      .eq('stripe_customer_id', customerId)
  }

  return NextResponse.json({ received: true })
}

// Stripe Webhooks brauchen den raw body — Body-Parser muss deaktiviert sein
export const runtime = 'nodejs'
```

- [ ] **Schritt 2: SUPABASE_SERVICE_ROLE_KEY zu .env.local hinzufügen**

`app/.env.local` — diese Zeile ergänzen:
```
SUPABASE_SERVICE_ROLE_KEY=dein_service_role_key_hier
```

**Wo:** Supabase Dashboard → Project Settings → API → `service_role` key (Secret).

**Wichtig:** Dieser Key bypassed RLS — niemals im Frontend verwenden, nur in API Routes / Webhooks.

- [ ] **Schritt 3: Stripe Webhook im Dashboard registrieren (Local Dev)**

Für lokales Testen Stripe CLI installieren:
```bash
# Windows: via Scoop oder direkter Download von stripe.com/docs/stripe-cli
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Der CLI gibt einen `whsec_...` Key aus → in `.env.local` als `STRIPE_WEBHOOK_SECRET` eintragen.

**Für Production:** Stripe Dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://deine-app.vercel.app/api/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.updated`

---

## Task 7: Setup-Wizard

**Files:**
- Create: `app/app/admin/setup/page.tsx`

Der Wizard läuft in 2 Schritten:
1. Restaurant-Infos eingeben (Name + Slug) → speichert in Supabase
2. Plan wählen → Redirect zu Stripe Checkout

- [ ] **Schritt 1: Setup-Ordner erstellen**

```bash
mkdir -p app/app/admin/setup
```

- [ ] **Schritt 2: Setup-Wizard Seite erstellen**

`app/app/admin/setup/page.tsx`:
```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Step = 'info' | 'plan'

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('info')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/owner-login'); return }
      setUserId(session.user.id)
    })
  }, [router])

  function handleNameChange(val: string) {
    setName(val)
    // Auto-Slug aus Name generieren
    const autoSlug = val
      .toLowerCase()
      .replace(/[äöüß]/g, c => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c] || c))
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    setSlug(autoSlug)
  }

  async function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!userId) return

    // Slug auf Eindeutigkeit prüfen
    const { data: existing } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .limit(1)

    if (existing && existing.length > 0) {
      setError('Dieser URL-Name ist bereits vergeben. Bitte wähle einen anderen.')
      setLoading(false)
      return
    }

    // Restaurant anlegen (noch inaktiv — wird nach Stripe aktiv)
    const { error: insertError } = await supabase
      .from('restaurants')
      .insert({
        owner_id: userId,
        name,
        slug,
        plan: 'basic',
        active: false,
      })

    if (insertError) {
      // Falls schon vorhanden (User kam nochmal zum Setup) → updaten
      if (insertError.code === '23505') {
        await supabase
          .from('restaurants')
          .update({ name, slug })
          .eq('owner_id', userId)
      } else {
        setError('Fehler beim Speichern. Bitte versuche es erneut.')
        setLoading(false)
        return
      }
    }

    setStep('plan')
    setLoading(false)
  }

  async function handlePlanSelect(plan: 'basic' | 'pro') {
    setLoading(true)
    setError('')

    const response = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })

    const data = await response.json()

    if (!response.ok || !data.url) {
      setError('Stripe-Checkout konnte nicht gestartet werden. Bitte versuche es erneut.')
      setLoading(false)
      return
    }

    window.location.href = data.url
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontWeight: 600,
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '1rem',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-md">
        {/* Progress */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', justifyContent: 'center' }}>
          {(['info', 'plan'] as Step[]).map((s, i) => (
            <div
              key={s}
              style={{
                height: '4px',
                flex: 1,
                borderRadius: '2px',
                background: step === s || (s === 'info' && step === 'plan')
                  ? 'var(--accent)'
                  : 'var(--border)',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        {step === 'info' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🏪</div>
              <h1 style={{ color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
                Dein Restaurant einrichten
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Diese Infos erscheinen später für deine Gäste.
              </p>
            </div>

            <form onSubmit={handleInfoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label htmlFor="name" style={labelStyle}>Restaurant-Name</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={e => handleNameChange(e.target.value)}
                  required
                  placeholder="z.B. Trattoria Roma"
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="slug" style={labelStyle}>URL-Name</label>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--surface)', overflow: 'hidden' }}>
                  <span style={{ padding: '12px 12px 12px 16px', color: 'var(--text-muted)', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                    /bestellen/
                  </span>
                  <input
                    id="slug"
                    type="text"
                    value={slug}
                    onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    required
                    placeholder="trattoria-roma"
                    style={{ ...inputStyle, border: 'none', borderRadius: 0, paddingLeft: 0 }}
                  />
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '6px' }}>
                  Dein Bestelllink: restaurantos.de/bestellen/{slug || 'dein-name'}
                </p>
              </div>

              {error && (
                <p style={{ color: '#ef4444', fontSize: '0.875rem', background: '#ef444415', padding: '10px 14px', borderRadius: '8px' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !name || !slug}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: loading || !name || !slug ? 'var(--border)' : 'var(--accent)',
                  color: '#fff',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: loading || !name || !slug ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Wird gespeichert...' : 'Weiter → Plan wählen'}
              </button>
            </form>
          </>
        )}

        {step === 'plan' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>💳</div>
              <h1 style={{ color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
                Plan wählen
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Jederzeit kündbar. Keine versteckten Kosten.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Basic Plan */}
              <button
                onClick={() => handlePlanSelect('basic')}
                disabled={loading}
                style={{
                  background: 'var(--surface)',
                  border: '2px solid var(--border)',
                  borderRadius: '14px',
                  padding: '24px',
                  textAlign: 'left',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => !loading && (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>Basic</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>Perfekt zum Start</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.5rem' }}>29€</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>/Monat</span>
                  </div>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {['QR-Bestellung (Dine-In, Delivery, Pickup)', 'Realtime Staff-Dashboard', 'Menü-Verwaltung', 'Bis 10 Tische', 'QR-Codes generieren'].map(f => (
                    <li key={f} style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ color: 'var(--accent)' }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
              </button>

              {/* Pro Plan */}
              <button
                onClick={() => handlePlanSelect('pro')}
                disabled={loading}
                style={{
                  background: 'var(--surface)',
                  border: '2px solid var(--accent)',
                  borderRadius: '14px',
                  padding: '24px',
                  textAlign: 'left',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  position: 'absolute', top: '12px', right: '12px',
                  background: 'var(--accent)', color: '#fff',
                  fontSize: '0.7rem', fontWeight: 700,
                  padding: '3px 10px', borderRadius: '20px',
                }}>
                  EMPFOHLEN
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>Pro</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>Unbegrenzt skalieren</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.5rem' }}>79€</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>/Monat</span>
                  </div>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {['Alles aus Basic', 'Unbegrenzte Tische', 'KI-Chatbot für Gäste', 'Analytics-KI für Owner', 'Reservierungssystem'].map(f => (
                    <li key={f} style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ color: 'var(--accent)' }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
              </button>
            </div>

            {error && (
              <p style={{ color: '#ef4444', fontSize: '0.875rem', background: '#ef444415', padding: '10px 14px', borderRadius: '8px', marginTop: '16px' }}>
                {error}
              </p>
            )}

            {loading && (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '16px', fontSize: '0.875rem' }}>
                Weiterleitung zu Stripe...
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Schritt 2: Testen**

`http://localhost:3000/admin/setup`
- Schritt 1: Name eingeben → Slug wird auto-generiert
- Slug ist editierbar
- Weiter → Schritt 2: Plan-Karten erscheinen
- Plan klicken → Weiterleitung zu Stripe Checkout (wenn STRIPE_SECRET_KEY gesetzt)

- [ ] **Schritt 3: Commit**

```bash
cd app && git add -A && git commit -m "feat: add setup wizard with restaurant info + plan selection"
```

---

## Task 8: Admin-Startseite (Status-Check)

**Files:**
- Modify: `app/app/admin/page.tsx`

Die Admin-Startseite prüft beim Laden:
1. Ist User eingeloggt? (Middleware handelt das, aber doppelt geprüft)
2. Hat User ein Restaurant? Wenn nicht → `/admin/setup`
3. Ist Restaurant aktiv (Stripe bezahlt)? Wenn nicht → Billing-Hinweis

- [ ] **Schritt 1: Admin-Startseite updaten**

`app/app/admin/page.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Restaurant } from '@/types/database'
import { Suspense } from 'react'

function AdminContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const welcome = searchParams.get('welcome') === 'true'
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }

      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', session.user.id)
        .limit(1)
        .single()

      if (!data) {
        router.push('/admin/setup')
        return
      }

      setRestaurant(data)
      setLoading(false)
    }
    load()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/owner-login')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <p style={{ color: 'var(--text-muted)' }}>Lädt...</p>
      </div>
    )
  }

  if (!restaurant) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '32px 24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700 }}>
              {restaurant.name}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Plan: <span style={{ color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase' }}>{restaurant.plan}</span>
              {' · '}
              {restaurant.active ? (
                <span style={{ color: '#10b981' }}>● Aktiv</span>
              ) : (
                <span style={{ color: '#ef4444' }}>● Inaktiv</span>
              )}
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '8px 16px',
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Ausloggen
          </button>
        </div>

        {/* Welcome Banner */}
        {welcome && (
          <div style={{
            background: 'var(--accent-subtle)',
            border: '1px solid var(--border-accent)',
            borderRadius: '12px',
            padding: '20px 24px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <span style={{ fontSize: '2rem' }}>🎉</span>
            <div>
              <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '4px' }}>
                Willkommen bei RestaurantOS!
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Dein Restaurant ist eingerichtet. Leg jetzt dein Menü an und generiere QR-Codes.
              </p>
            </div>
          </div>
        )}

        {/* Inactive Banner */}
        {!restaurant.active && (
          <div style={{
            background: '#ef444415',
            border: '1px solid #ef444433',
            borderRadius: '12px',
            padding: '20px 24px',
            marginBottom: '24px',
          }}>
            <p style={{ color: '#ef4444', fontWeight: 700, marginBottom: '4px' }}>
              ⚠️ Abo noch nicht aktiv
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '12px' }}>
              Bitte schließe den Zahlungsvorgang ab um dein Restaurant zu aktivieren.
            </p>
            <button
              onClick={() => router.push('/admin/setup')}
              style={{
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 20px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Plan abschließen →
            </button>
          </div>
        )}

        {/* Navigation Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {[
            { icon: '🍔', label: 'Menü verwalten', href: '/admin/menu', available: true },
            { icon: '🪑', label: 'Tische & QR-Codes', href: '/admin/tables', available: true },
            { icon: '👨‍🍳', label: 'Staff verwalten', href: '/admin/staff', available: true },
            { icon: '📊', label: 'Analytics', href: '/admin/analytics', available: restaurant.plan === 'pro' },
            { icon: '💳', label: 'Billing', href: '/admin/billing', available: true },
          ].map(card => (
            <button
              key={card.label}
              onClick={() => card.available && router.push(card.href)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '24px 20px',
                textAlign: 'left',
                cursor: card.available ? 'pointer' : 'not-allowed',
                opacity: card.available ? 1 : 0.5,
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => card.available && (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div style={{ fontSize: '1.75rem', marginBottom: '10px' }}>{card.icon}</div>
              <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem' }}>{card.label}</div>
              {!card.available && (
                <div style={{ color: 'var(--accent)', fontSize: '0.7rem', marginTop: '4px', fontWeight: 600 }}>PRO</div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
      <AdminContent />
    </Suspense>
  )
}
```

- [ ] **Schritt 2: Billing-Unterseite anlegen (Placeholder)**

```bash
mkdir -p app/app/admin/billing
```

`app/app/admin/billing/page.tsx`:
```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function BillingPage() {
  const router = useRouter()

  useEffect(() => {
    // Stripe Customer Portal öffnen (kommt in Plan 5: Admin Panel)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/owner-login')
    })
  }, [router])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--text)', fontSize: '1.25rem', fontWeight: 600 }}>💳 Billing</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '8px' }}>Stripe Customer Portal — kommt in Plan 5</p>
        <button onClick={() => router.push('/admin')} style={{ marginTop: '16px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>
          ← Zurück zum Admin
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Schritt 3: Testen**

1. `http://localhost:3000/admin` ohne Login → Redirect zu `/owner-login` ✓
2. Einloggen → Redirect zu `/admin`
3. Wenn kein Restaurant → Redirect zu `/admin/setup`
4. Wenn Restaurant aber `active=false` → Inaktiv-Banner erscheint

- [ ] **Schritt 4: Commit**

```bash
cd app && git add -A && git commit -m "feat: add admin dashboard with status checks and setup redirect"
```

---

## Task 9: Landing Page mit Register-Link

**Files:**
- Modify: `app/app/page.tsx`

- [ ] **Schritt 1: Landing Page mit CTAs versehen**

`app/app/page.tsx`:
```tsx
import Link from 'next/link'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export default function HomePage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 32px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>
          🍽️ RestaurantOS
        </span>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <ThemeToggle />
          <Link
            href="/owner-login"
            style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textDecoration: 'none' }}
          >
            Login
          </Link>
          <Link
            href="/register"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              padding: '8px 20px',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Jetzt starten
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '24px' }}>🍽️</div>
        <h1 style={{ color: 'var(--text)', fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.1, maxWidth: '700px', marginBottom: '20px' }}>
          Digitale Bestellungen für dein Restaurant
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '500px', lineHeight: 1.7, marginBottom: '40px' }}>
          QR-Code am Tisch scannen, bestellen, Status live verfolgen. Für Dine-In, Delivery & Pickup.
        </p>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link
            href="/register"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              padding: '16px 36px',
              borderRadius: '12px',
              fontSize: '1.1rem',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Kostenlos starten →
          </Link>
          <Link
            href="/owner-login"
            style={{
              background: 'var(--surface)',
              color: 'var(--text)',
              padding: '16px 36px',
              borderRadius: '12px',
              fontSize: '1.1rem',
              fontWeight: 600,
              textDecoration: 'none',
              border: '1px solid var(--border)',
            }}
          >
            Einloggen
          </Link>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Schritt 2: Testen**

`http://localhost:3000`
- Navbar mit Login + "Jetzt starten"
- Hero mit CTAs
- Theme Toggle funktioniert
- "Jetzt starten" → `/register`

- [ ] **Schritt 3: Commit**

```bash
cd app && git add -A && git commit -m "feat: add landing page with registration CTAs"
```

---

## Task 10: Build-Test + End-to-End Smoke Test

- [ ] **Schritt 1: TypeScript-Check**

```bash
cd app && npx tsc --noEmit
```

Erwartung: Keine Fehler.

- [ ] **Schritt 2: Build**

```bash
cd app && npm run build
```

Erwartung: Build erfolgreich.

- [ ] **Schritt 3: End-to-End Smoke Test**

Mit laufendem Dev-Server (`npm run dev`) und Stripe CLI (`stripe listen --forward-to localhost:3000/api/stripe/webhook`):

1. `http://localhost:3000` → Hero + CTAs sichtbar
2. "Jetzt starten" → `/register` → Formular ausfüllen → absenden
3. Redirect zu `/admin/setup` (Middleware erlaubt da Session vorhanden)
4. Setup-Wizard: Name + Slug → Weiter → Plan-Karten
5. "Basic" wählen → Stripe Checkout öffnet (Test-Kreditkarte: `4242 4242 4242 4242`, Datum: beliebig future, CVC: `424`)
6. Stripe Zahlung → Redirect zu `/admin?welcome=true`
7. Welcome-Banner erscheint, Restaurant-Name in Header
8. Stripe CLI zeigt: `checkout.session.completed` verarbeitet
9. Supabase Dashboard: `restaurants`-Tabelle → `active=true`, `stripe_customer_id` gesetzt
10. Ausloggen → `/admin` → Redirect zu `/owner-login` ✓

- [ ] **Schritt 4: Final Commit**

```bash
cd app && git add -A && git commit -m "feat: plan 2 complete — auth, stripe onboarding, setup wizard"
```

---

## Verifikation (nach vollständiger Implementierung)

- [ ] Neuer User kann sich registrieren und gelangt zum Setup-Wizard
- [ ] Middleware blockiert `/admin` ohne Session
- [ ] Stripe Checkout öffnet sich mit korrektem Plan
- [ ] Webhook aktualisiert `restaurants.active=true` nach Zahlung
- [ ] Bestehender User kann sich einloggen und landet direkt im Admin
- [ ] User ohne Restaurant wird zu Setup-Wizard weitergeleitet
- [ ] Dark/Light Mode funktioniert auf allen neuen Seiten
- [ ] Build ist fehlerfrei
