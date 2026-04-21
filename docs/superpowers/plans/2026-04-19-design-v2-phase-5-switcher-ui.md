# Design V2 — Phase 5: Theme Switcher UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Baue die `/platform/design`-Seite mit 3 Scopes (Platform-Admin-Theme, Restaurants-Default, Per-Restaurant-Override). Nutzt bestehende `platform_settings` + `restaurants`-Columns aus Phase 1.

**Architecture:** Server-Component fetcht State, Client-Component rendert Toggles, API-Routes persistieren Änderungen. Service-Role-Client (Platform-Admin bypass), `requirePlatformAccess()` als Gate.

**Tech Stack:** Next.js 15 App Router, Supabase Admin Client, React, TypeScript.

**Spec:** `docs/superpowers/specs/2026-04-19-design-v2-theme-system-design.md`

---

## File Structure

**Neu:**
- `app/app/platform/design/page.tsx` — Server-Component, fetcht settings + restaurants
- `app/app/platform/design/DesignSwitcherClient.tsx` — Client-UI, 3 Sections
- `app/app/api/platform/design/settings/route.ts` — PATCH platform_settings
- `app/app/api/platform/design/restaurants/route.ts` — PATCH restaurant overrides

**Modifiziert:**
- `app/components/PlatformSidebar.tsx` — Nav-Entry "Design" zwischen "Design-Anfragen" und "Einstellungen"

---

## Task 1: API Route — platform_settings updaten

**File:** Create `app/app/api/platform/design/settings/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

const VALID = new Set(['v1', 'v2'])

export async function PATCH(req: NextRequest) {
  const { role } = await requirePlatformAccess()
  if (role !== 'owner' && role !== 'co_founder') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as {
    platform_design_version?: string
    restaurants_default_version?: string
  } | null

  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const patch: Record<string, string> = {}
  if (body.platform_design_version) {
    if (!VALID.has(body.platform_design_version)) {
      return NextResponse.json({ error: 'invalid platform_design_version' }, { status: 400 })
    }
    patch.platform_design_version = body.platform_design_version
  }
  if (body.restaurants_default_version) {
    if (!VALID.has(body.restaurants_default_version)) {
      return NextResponse.json({ error: 'invalid restaurants_default_version' }, { status: 400 })
    }
    patch.restaurants_default_version = body.restaurants_default_version
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  patch.updated_at = new Date().toISOString()

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('platform_settings')
    .update(patch)
    .eq('id', 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

Commit: `feat(api): add PATCH /api/platform/design/settings`

---

## Task 2: API Route — restaurant overrides updaten

**File:** Create `app/app/api/platform/design/restaurants/route.ts`

Body: `{ restaurant_id: string, version: 'v1' | 'v2' | null }`.
Setzt beide Spalten (`admin_design_version` + `guest_design_version`) auf denselben Wert oder NULL.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function PATCH(req: NextRequest) {
  const { role } = await requirePlatformAccess()
  if (role !== 'owner' && role !== 'co_founder') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as {
    restaurant_id?: string
    version?: string | null
  } | null

  if (!body || !body.restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 })
  }
  if (body.version !== null && body.version !== 'v1' && body.version !== 'v2') {
    return NextResponse.json({ error: 'invalid version' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('restaurants')
    .update({
      admin_design_version: body.version,
      guest_design_version: body.version,
    })
    .eq('id', body.restaurant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

Commit: `feat(api): add PATCH /api/platform/design/restaurants`

---

## Task 3: Server-Page — fetcht State

**File:** Create `app/app/platform/design/page.tsx`

```typescript
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import DesignSwitcherClient from './DesignSwitcherClient'

export const dynamic = 'force-dynamic'

export default async function PlatformDesignPage() {
  const { role } = await requirePlatformAccess()
  const canEdit = role === 'owner' || role === 'co_founder'

  const admin = createSupabaseAdmin()
  const [{ data: settings }, { data: restaurants }] = await Promise.all([
    admin.from('platform_settings').select('*').eq('id', 1).maybeSingle(),
    admin.from('restaurants').select('id, name, admin_design_version, guest_design_version').order('name'),
  ])

  return (
    <DesignSwitcherClient
      canEdit={canEdit}
      initialPlatformVersion={settings?.platform_design_version ?? 'v1'}
      initialDefaultVersion={settings?.restaurants_default_version ?? 'v1'}
      restaurants={(restaurants ?? []).map(r => ({
        id: r.id,
        name: r.name,
        override: r.admin_design_version ?? null,
      }))}
    />
  )
}
```

Commit: `feat(platform): add /platform/design server page`

---

## Task 4: Client-Component mit 3 Sections

**File:** Create `app/app/platform/design/DesignSwitcherClient.tsx`

Drei Sections wie im Mockup:
1. **Platform Admin** — eine Toggle-Reihe mit V1/V2
2. **Restaurants Default** — eine Toggle-Reihe mit V1/V2 + Info-Box
3. **Per-Restaurant** — Liste mit Auto/V1/V2 pro Restaurant

State: lokal via `useState`, optimistic updates, rollback bei Fehler.

Style: Dark Platform-Theme-Palette (`#1a1a2e` bg, `#ef4444` accent — konsistent mit `/platform/*`).

```typescript
'use client'

import { useState } from 'react'
import { Zap, Building2, Target } from 'lucide-react'

type Version = 'v1' | 'v2'
type Override = Version | null
type Restaurant = { id: string; name: string; override: Override }

interface Props {
  canEdit: boolean
  initialPlatformVersion: Version
  initialDefaultVersion: Version
  restaurants: Restaurant[]
}

export default function DesignSwitcherClient({
  canEdit, initialPlatformVersion, initialDefaultVersion, restaurants: initialRestaurants,
}: Props) {
  const [platformVersion, setPlatformVersion] = useState<Version>(initialPlatformVersion)
  const [defaultVersion, setDefaultVersion] = useState<Version>(initialDefaultVersion)
  const [restaurants, setRestaurants] = useState<Restaurant[]>(initialRestaurants)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function patchSettings(field: 'platform_design_version' | 'restaurants_default_version', value: Version) {
    setError(null)
    setPending(true)
    const prev = field === 'platform_design_version' ? platformVersion : defaultVersion
    if (field === 'platform_design_version') setPlatformVersion(value)
    else setDefaultVersion(value)

    const res = await fetch('/api/platform/design/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    if (!res.ok) {
      if (field === 'platform_design_version') setPlatformVersion(prev)
      else setDefaultVersion(prev)
      setError('Konnte nicht speichern.')
    }
    setPending(false)
  }

  async function patchRestaurant(id: string, version: Override) {
    setError(null)
    setPending(true)
    const prev = restaurants.find(r => r.id === id)?.override ?? null
    setRestaurants(list => list.map(r => r.id === id ? { ...r, override: version } : r))

    const res = await fetch('/api/platform/design/restaurants', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: id, version }),
    })
    if (!res.ok) {
      setRestaurants(list => list.map(r => r.id === id ? { ...r, override: prev } : r))
      setError('Konnte nicht speichern.')
    }
    setPending(false)
  }

  return (
    <div style={{ padding: '32px 24px', maxWidth: '860px' }}>
      <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 800, marginBottom: '4px' }}>
        Design-System
      </h1>
      <p style={{ color: '#888', fontSize: '0.875rem', marginBottom: '32px' }}>
        Steuere das aktive Theme für dich und alle Restaurants auf der Plattform.
      </p>

      {!canEdit && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#fbbf24', marginBottom: '24px' }}>
          Nur Owner und Co-Founder können Änderungen speichern. Du siehst die Ansicht read-only.
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: '#fca5a5', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <SectionLabel>Platform Admin · nur für dich</SectionLabel>
      <Card
        icon={<Zap size={16} color="#fff" />}
        title="Dein Platform-Interface"
        desc="Wählt das Design für deine /platform/*-Seiten."
      >
        <VersionToggle
          value={platformVersion}
          onChange={v => canEdit && patchSettings('platform_design_version', v)}
          disabled={!canEdit || pending}
        />
      </Card>

      <Divider />

      <SectionLabel>Restaurants · Plattform-Default</SectionLabel>
      <Card
        icon={<Building2 size={16} color="#fff" />}
        title="Standard-Theme für alle Restaurants"
        desc="Gilt für Restaurant-Admin und Gast-Seiten. Einzelne Restaurants können überschreiben."
      >
        <VersionToggle
          value={defaultVersion}
          onChange={v => canEdit && patchSettings('restaurants_default_version', v)}
          disabled={!canEdit || pending}
        />
        <div style={{
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: '10px', padding: '10px 14px', fontSize: '11px', color: '#e5e7eb',
          lineHeight: 1.5, marginTop: '14px',
        }}>
          <strong style={{ color: '#ef4444' }}>Wichtig:</strong> Ändern des Defaults betrifft nur Restaurants, die keine eigene Wahl getroffen haben. Restaurant-Branding (Farben, Logos) bleibt unabhängig aktiv.
        </div>
      </Card>

      <Divider />

      <SectionLabel>Einzelne Restaurants · Override</SectionLabel>
      <Card
        icon={<Target size={16} color="#fff" />}
        title="Individuelle Zuweisung"
        desc={'Setze pro Restaurant explizit V1 oder V2. "Auto" = Plattform-Default wird verwendet.'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
          {restaurants.length === 0 && (
            <p style={{ color: '#888', fontSize: '12px' }}>Keine Restaurants.</p>
          )}
          {restaurants.map(r => (
            <RestaurantRow
              key={r.id}
              name={r.name}
              override={r.override}
              disabled={!canEdit || pending}
              onChange={v => patchRestaurant(r.id, v)}
            />
          ))}
        </div>
      </Card>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      color: '#ef4444', fontSize: '10px', textTransform: 'uppercase',
      letterSpacing: '2px', fontWeight: 700, marginBottom: '12px',
    }}>{children}</div>
  )
}

function Divider() {
  return <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '28px 0' }} />
}

function Card({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '14px', padding: '20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '16px' }}>
        <div>
          <div style={{ color: '#fff', fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>{title}</div>
          <div style={{ color: '#888', fontSize: '12px', lineHeight: 1.5 }}>{desc}</div>
        </div>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>
      {children}
    </div>
  )
}

function VersionToggle({ value, onChange, disabled }: { value: Version; onChange: (v: Version) => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
      {(['v1', 'v2'] as Version[]).map(v => (
        <button
          key={v}
          onClick={() => onChange(v)}
          disabled={disabled}
          style={{
            flex: 1, padding: '14px', borderRadius: '12px',
            background: value === v ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
            border: value === v ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)',
            boxShadow: value === v ? '0 0 0 1px #ef4444 inset' : 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            textAlign: 'left' as const,
            color: '#fff',
            position: 'relative' as const,
          }}
        >
          {value === v && (
            <span style={{
              position: 'absolute', top: '10px', right: '10px',
              padding: '3px 8px', background: '#ef4444', color: '#fff',
              borderRadius: '10px', fontSize: '9px', fontWeight: 700,
            }}>AKTIV</span>
          )}
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '3px' }}>
            {v === 'v1' ? 'V1 Classic' : 'V2 Bento Premium'}
          </div>
          <div style={{ fontSize: '11px', color: '#888' }}>
            {v === 'v1' ? 'Aktuelles Design · Syne + DM Sans' : 'Neu · Geist Font · Dark Bento'}
          </div>
        </button>
      ))}
    </div>
  )
}

function RestaurantRow({ name, override, disabled, onChange }: { name: string; override: Override; disabled?: boolean; onChange: (v: Override) => void }) {
  const modes: { label: string; value: Override }[] = [
    { label: 'Auto', value: null },
    { label: 'V1', value: 'v1' },
    { label: 'V2', value: 'v2' },
  ]
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 16px', background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
    }}>
      <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, paddingRight: '12px' }}>
        {name}
      </div>
      <div style={{
        display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '3px',
        flexShrink: 0,
      }}>
        {modes.map(m => {
          const isActive = override === m.value
          return (
            <button
              key={m.label}
              onClick={() => !disabled && onChange(m.value)}
              disabled={disabled}
              style={{
                padding: '5px 12px', borderRadius: '7px',
                background: isActive ? '#ef4444' : 'transparent',
                color: isActive ? '#fff' : '#888',
                border: 'none',
                fontSize: '11px', fontWeight: 600,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {m.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

Commit: `feat(platform): add /platform/design switcher UI with 3 scopes`

---

## Task 5: Sidebar-Link

**File:** Modify `app/components/PlatformSidebar.tsx`

Import `Paintbrush` icon from lucide-react, add Nav-Entry nach "Design-Anfragen" (gleiche roles):

```typescript
{ icon: Paintbrush, label: 'Design',          href: '/platform/design',              roles: ['owner', 'co_founder'] },
```

Commit: `feat(platform): add Design nav link in PlatformSidebar`

---

## Task 6: Lint + Build

Run:
```bash
cd app && npx tsc --noEmit
cd app && npm run lint
```

No new errors in new files.

---

## Definition of Done
- [x] `/platform/design` lädt mit 3 Sections
- [x] Platform-Admin-Toggle ändert `platform_settings.platform_design_version`
- [x] Default-Toggle ändert `platform_settings.restaurants_default_version`
- [x] Per-Restaurant Auto/V1/V2 setzt `admin_design_version` + `guest_design_version`
- [x] Read-only Mode für Non-Owner (Developer/Support/Billing)
- [x] Sidebar-Link vorhanden
- [x] Build/Lint clean
