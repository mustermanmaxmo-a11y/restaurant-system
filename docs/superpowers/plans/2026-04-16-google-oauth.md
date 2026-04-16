# Google OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Mit Google anmelden" button to `/owner-login`, `/register`, and `/platform-login`.

**Architecture:** A single `GoogleAuthButton` component calls `supabase.auth.signInWithOAuth({ provider: 'google' })` with a `redirectTo` pointing at the existing `/auth/callback?next=<destination>` route. The middleware (`proxy.ts`) already enforces `is_platform_owner` for `/platform/*`, so no new callback logic is needed.

**Tech Stack:** Next.js 15 App Router, Supabase SSR, `react-icons/fc` (FcGoogle)

---

## File Map

| Action | File |
|--------|------|
| Create | `app/components/ui/google-auth-button.tsx` |
| Modify | `app/app/owner-login/page.tsx` |
| Modify | `app/app/register/page.tsx` |
| Modify | `app/app/platform-login/page.tsx` |

---

## Pre-requisite (manual — not code)

Before running the app, activate the Google provider in Supabase:
1. Supabase Dashboard → Authentication → Providers → Google → Enable
2. Add your Google OAuth Client ID + Secret (from Google Cloud Console)
3. Copy the Supabase callback URL shown there and add it to Google Cloud Console → Authorized redirect URIs

---

### Task 1: Install react-icons

**Files:**
- Run in: `app/`

- [ ] **Step 1: Install the package**

```bash
cd app && npm install react-icons
```

Expected output: `added X packages` with no errors.

- [ ] **Step 2: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "chore: install react-icons"
```

---

### Task 2: Create GoogleAuthButton component

**Files:**
- Create: `app/components/ui/google-auth-button.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { FcGoogle } from 'react-icons/fc'
import { supabase } from '@/lib/supabase'

interface GoogleAuthButtonProps {
  redirectTo: string
  label?: string
}

export function GoogleAuthButton({
  redirectTo,
  label = 'Mit Google anmelden',
}: GoogleAuthButtonProps) {
  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    })
  }

  return (
    <button
      type="button"
      onClick={handleGoogleLogin}
      style={{
        width: '100%',
        padding: '12px 16px',
        borderRadius: '10px',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--text)',
        fontSize: '1rem',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        transition: 'border-color 0.15s ease, background 0.15s ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
      }}
    >
      <FcGoogle size={20} />
      {label}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/ui/google-auth-button.tsx
git commit -m "feat: add GoogleAuthButton component"
```

---

### Task 3: Add Google Login to /owner-login

**Files:**
- Modify: `app/app/owner-login/page.tsx`

The button goes below the submit button, separated by an "oder" divider.

- [ ] **Step 1: Add the import at the top of the file**

Find the existing imports block and add:
```tsx
import { GoogleAuthButton } from '@/components/ui/google-auth-button'
```

- [ ] **Step 2: Add divider + Google button after the submit button**

Find the existing submit `<button>` element (the one with `{loading ? '...' : t('auth.login')}`).

Directly after the closing `</button>` tag of that submit button, add:

```tsx
            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>oder</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>
            <GoogleAuthButton
              redirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback?next=/admin`}
            />
```

- [ ] **Step 3: Verify the page renders — start dev server if not running**

```bash
cd app && npm run dev
```

Open `http://localhost:3000/owner-login` — verify Google button appears below the login button.

- [ ] **Step 4: Commit**

```bash
git add app/app/owner-login/page.tsx
git commit -m "feat: add Google OAuth to owner-login"
```

---

### Task 4: Add Google Login to /register

**Files:**
- Modify: `app/app/register/page.tsx`

On register, Google OAuth bypasses the AGB checkbox. A consent note is added below the button.

- [ ] **Step 1: Add the import**

Add to the existing imports:
```tsx
import { GoogleAuthButton } from '@/components/ui/google-auth-button'
```

- [ ] **Step 2: Add divider + Google button + consent note after the submit button**

Find the submit `<button>` (the one with `{loading ? '...' : t('auth.register')}`). Add directly after its closing `</button>`:

```tsx
            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>oder</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>
            <GoogleAuthButton
              label="Mit Google registrieren"
              redirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback?next=/admin/setup`}
            />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', lineHeight: 1.5 }}>
              Mit Google fortfahren bedeutet, dass du unsere{' '}
              <a href="/agb" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>AGB</a>
              {' '}und{' '}
              <a href="/datenschutz" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Datenschutzerklärung</a>
              {' '}akzeptierst.
            </p>
```

- [ ] **Step 3: Check the page**

Open `http://localhost:3000/register` — Google button + consent note erscheint unter dem Register-Button.

- [ ] **Step 4: Commit**

```bash
git add app/app/register/page.tsx
git commit -m "feat: add Google OAuth to register"
```

---

### Task 5: Add Google Login to /platform-login

**Files:**
- Modify: `app/app/platform-login/page.tsx`

After Google OAuth the user lands on `/platform`. `proxy.ts` middleware checks `is_platform_owner` there — unauthorized users get redirected back to `/platform-login` automatically.

- [ ] **Step 1: Add the import**

Add to the existing imports:
```tsx
import { GoogleAuthButton } from '@/components/ui/google-auth-button'
```

- [ ] **Step 2: Add divider + Google button after the submit button**

Find the submit `<button>` (the one with `{loading ? 'Prüfe…' : 'Anmelden'}`). Add directly after its closing `</button>`:

```tsx
            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
              <div style={{ flex: 1, height: '1px', background: '#2a2a3e' }} />
              <span style={{ color: '#555', fontSize: '0.75rem' }}>oder</span>
              <div style={{ flex: 1, height: '1px', background: '#2a2a3e' }} />
            </div>
            <GoogleAuthButton
              redirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback?next=/platform`}
            />
```

Note: Platform-Login uses hardcoded hex colors (`#2a2a3e`, `#555`) statt CSS-Variablen — der Divider folgt dem gleichen Pattern wie der Rest der Seite.

- [ ] **Step 3: Check the page**

Open `http://localhost:3000/platform-login` — Google button erscheint unter dem Anmelden-Button.

- [ ] **Step 4: Final commit**

```bash
git add app/app/platform-login/page.tsx
git commit -m "feat: add Google OAuth to platform-login"
```

---

## Smoke Test (manuell nach Supabase-Setup)

1. `/owner-login` → Google Button klicken → Google OAuth Flow → landet auf `/admin`
2. `/register` → Google Button klicken → Google OAuth Flow → landet auf `/admin/setup`
3. `/platform-login` → Google Button klicken → mit einem Non-Owner-Account → landet zurück auf `/platform-login`
4. `/platform-login` → Google Button klicken → mit einem Platform-Owner-Account → landet auf `/platform`
