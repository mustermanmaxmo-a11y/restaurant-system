# Remove V1/V2 Design-Version System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the entire V1/V2 design-version system, leaving V1 as the only design — with zero visual change (everything already runs V1).

**Architecture:** This is a deletion refactor. Each surface's `page.tsx`/`layout.tsx` stops resolving a version and renders its `…V1` component directly; the `_v2` folders, the version resolver, the React provider, the platform switcher UI + APIs, the `theme-v2` CSS, and the 4 DB columns are deleted. The kept `_v1` folders are untouched.

**Tech Stack:** Next.js 15 (App Router, server components), TypeScript, Supabase (Postgres migration). **No test framework** in this repo — verification per task is `npm run build` (TypeScript catches dangling references) + targeted `grep` + a final visual spot-check after deploy.

**Spec:** `docs/superpowers/specs/2026-06-17-remove-design-v2-design.md`

---

## Codebase facts for the worker

- App root: `c:/Users/David/Desktop/restaurant-system/app` (contains `package.json`, `app/`, `components/`, `lib/`). Repo root is its parent (contains `supabase/`). Run `npm run build` from the app root.
- The `…V1` components (e.g. `OrderV1`, `BestellenV1`, `ReservierenV1`, `ClassicOverview`) are **client components that fetch their own data via `useParams()`** — they render correctly with **no props** (they already did when version was `v1`). Do not pass props.
- Ordering: delete the **consumers** (Tasks 1–3) before the **core** (`lib/design-version.ts` + provider, Task 4), so every intermediate build stays green.
- Windows + Git Bash. Delete folders with `rm -rf`.

---

## File Structure (after)

```
app/app/order/[token]/page.tsx          ← renders <OrderV1/> (keeps notFound guard)
app/app/bestellen/[slug]/page.tsx        ← renders <BestellenV1/>
app/app/reservieren/[slug]/page.tsx      ← renders <ReservierenV1/>
app/app/admin/layout.tsx                 ← renders <AdminLayoutInner> directly
app/app/admin/page.tsx                   ← renders <ClassicOverview/>
app/app/platform/layout.tsx              ← no version logic / banner
app/app/globals.css                      ← theme on :root / .dark only
app/app/layout.tsx                       ← <html> without theme-v1 class
app/components/PlatformSidebar.tsx       ← no "Design" switcher link
supabase/migrations/20260617_065_remove_design_versions.sql  ← drops 4 columns

DELETED: app/app/{order/[token],bestellen/[slug],reservieren/[slug],admin,platform}/_v2/
DELETED: app/app/platform/design/  ·  app/app/api/platform/design/
DELETED: app/lib/design-version.ts  ·  app/components/providers/design-version-provider.tsx
```

---

## Task 1: Guest pages render V1 directly + delete guest `_v2`

**Files:**
- Modify: `app/app/order/[token]/page.tsx`
- Modify: `app/app/bestellen/[slug]/page.tsx`
- Modify: `app/app/reservieren/[slug]/page.tsx`
- Delete: `app/app/order/[token]/_v2/`, `app/app/bestellen/[slug]/_v2/`, `app/app/reservieren/[slug]/_v2/`

- [ ] **Step 1: Replace `order/[token]/page.tsx` with this exact content**

```tsx
import { notFound } from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import OrderV1 from './_v1/OrderV1'

export const dynamic = 'force-dynamic'

export default async function OrderPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  let restaurantId: string | null = null
  try {
    const admin = createSupabaseAdmin()
    const { data } = await admin
      .from('tables')
      .select('restaurant_id')
      .eq('qr_token', token)
      .maybeSingle()
    restaurantId = data?.restaurant_id ?? null
  } catch {
    restaurantId = null
  }

  if (!restaurantId) {
    notFound()
  }

  return <OrderV1 />
}
```

- [ ] **Step 2: Replace `bestellen/[slug]/page.tsx` with this exact content**

```tsx
import BestellenV1 from './_v1/BestellenV1'

export const dynamic = 'force-dynamic'

export default function BestellenPage() {
  return <BestellenV1 />
}
```

- [ ] **Step 3: Replace `reservieren/[slug]/page.tsx` with this exact content**

```tsx
import ReservierenV1 from './_v1/ReservierenV1'

export const dynamic = 'force-dynamic'

export default function ReservierenPage() {
  return <ReservierenV1 />
}
```

- [ ] **Step 4: Delete the guest `_v2` folders**

Run (from app root):
```bash
rm -rf "app/order/[token]/_v2" "app/bestellen/[slug]/_v2" "app/reservieren/[slug]/_v2"
```
(Working dir is `app/`, so paths are relative to `app/app/` — adjust: the folders live at `app/app/...`. Run from `app/` with the `app/` prefix.)
```bash
rm -rf "app/app/order/[token]/_v2" "app/app/bestellen/[slug]/_v2" "app/app/reservieren/[slug]/_v2"
```
Use the second command (repo paths from app root are `app/app/...`).

- [ ] **Step 5: Build**

Run (from app root): `npm run build`
Expected: compiles successfully. (`lib/design-version.ts` and the provider still exist — used by admin/platform — so no dangling refs yet.)

- [ ] **Step 6: Commit**

```bash
git add "app/app/order/[token]/page.tsx" "app/app/bestellen/[slug]/page.tsx" "app/app/reservieren/[slug]/page.tsx"
git commit -m "refactor(guest): render V1 directly, drop guest _v2"
```

---

## Task 2: Admin renders V1 directly + delete `admin/_v2`

**Files:**
- Modify: `app/app/admin/layout.tsx`
- Modify: `app/app/admin/page.tsx`
- Delete: `app/app/admin/_v2/`

- [ ] **Step 1: Replace `admin/layout.tsx` with this exact content**

```tsx
import AdminLayoutInner from './AdminLayoutInner'

export const dynamic = 'force-dynamic'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutInner>{children}</AdminLayoutInner>
}
```

- [ ] **Step 2: Replace `admin/page.tsx` with this exact content**

```tsx
import ClassicOverview from './_v1/ClassicOverview'

export default function AdminPage() {
  return <ClassicOverview />
}
```

- [ ] **Step 3: Delete `admin/_v2`**

Run (from app root): `rm -rf "app/app/admin/_v2"`

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: compiles successfully.

- [ ] **Step 5: Commit**

```bash
git add app/app/admin/layout.tsx app/app/admin/page.tsx
git commit -m "refactor(admin): render ClassicOverview directly, drop admin _v2"
```

---

## Task 3: Platform — remove version + banner; delete `_v2`, switcher UI, design APIs, nav link

**Files:**
- Modify: `app/app/platform/layout.tsx`
- Modify: `app/components/PlatformSidebar.tsx`
- Delete: `app/app/platform/_v2/`, `app/app/platform/design/`, `app/app/api/platform/design/`

- [ ] **Step 1: Replace `platform/layout.tsx` with this exact content**

```tsx
import { requirePlatformAccess } from '@/lib/platform-auth'
import { PlatformSidebar } from '@/components/PlatformSidebar'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { PlatformPushSetup } from '@/components/PlatformPushSetup'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  manifest: '/manifest-platform.json',
}

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requirePlatformAccess()

  let legalPendingCount = 0
  let teamPendingCount = 0
  let designRequestCount = 0
  if (role === 'owner' || role === 'co_founder') {
    const admin = createSupabaseAdmin()
    const [{ data: legalDocs }, { data: teamRequests }, { data: designReqs }] = await Promise.all([
      admin.from('legal_documents').select('key').not('draft_content', 'is', null),
      admin.from('team_registration_requests').select('id').eq('status', 'pending'),
      admin.from('design_requests').select('id').eq('status', 'pending'),
    ])
    legalPendingCount = legalDocs?.length ?? 0
    teamPendingCount = teamRequests?.length ?? 0
    designRequestCount = designReqs?.length ?? 0
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#1a1a2e', color: '#e5e7eb' }}>
      <PlatformSidebar
        userEmail={user?.email ?? '—'}
        role={role}
        legalPendingCount={legalPendingCount}
        teamPendingCount={teamPendingCount}
        designRequestCount={designRequestCount}
      />
      <main style={{ flex: 1, minHeight: '100vh', overflowY: 'auto' }} className="platform-main">
        {children}
      </main>
      <PlatformPushSetup userId={user?.id} />
    </div>
  )
}
```

- [ ] **Step 2: Remove the "Design" switcher nav link in `PlatformSidebar.tsx`**

Delete this exact line (the `Paintbrush`/`/platform/design` entry — NOT the `Palette`/`design-requests` one above it):
```tsx
    { icon: Paintbrush,      label: 'Design',          href: '/platform/design',              roles: ['owner', 'co_founder'] },
```
Then check whether `Paintbrush` is still used elsewhere in the file:
```bash
grep -n "Paintbrush" "app/components/PlatformSidebar.tsx"
```
If the only remaining hit is the `lucide-react` import line, remove `Paintbrush` from that import. If there are other usages, leave the import.

- [ ] **Step 3: Delete platform `_v2`, the switcher page, and the design APIs**

Run (from app root):
```bash
rm -rf "app/app/platform/_v2" "app/app/platform/design" "app/app/api/platform/design"
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: compiles successfully. (Core resolver still exists; it's deleted next.)

- [ ] **Step 5: Commit**

```bash
git add app/app/platform/layout.tsx app/components/PlatformSidebar.tsx
git commit -m "refactor(platform): drop version logic, banner, design switcher UI + APIs"
```

---

## Task 4: Delete the design-version core + prove no references remain

**Files:**
- Delete: `app/lib/design-version.ts`
- Delete: `app/components/providers/design-version-provider.tsx`

- [ ] **Step 1: Delete the two core files**

Run (from app root):
```bash
rm -f "app/lib/design-version.ts" "app/components/providers/design-version-provider.tsx"
```

- [ ] **Step 2: Prove there are no remaining references (source only)**

Run (from repo root):
```bash
grep -rnE "resolveDesignVersion|design-version-provider|useDesignVersion|DesignVersionProvider|/_v2/|/platform/design'|/api/platform/design" app/app app/components app/lib 2>/dev/null | grep -vE "\.next|node_modules"
```
Expected: **no output.** If any line appears, fix that file (it's a leftover consumer) before continuing.

- [ ] **Step 3: Build**

Run (from app root): `npm run build`
Expected: compiles successfully with zero type errors. This is the proof that all consumers were removed.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: delete design-version resolver + provider (V2 fully removed from code)"
```

---

## Task 5: Simplify `globals.css` + drop the `theme-v1` html class

**Files:**
- Modify: `app/app/globals.css`
- Modify: `app/app/layout.tsx`

- [ ] **Step 1: In `globals.css`, change the light-theme selector (line ~4)**

Replace:
```css
:root, .theme-v1 {
```
with:
```css
:root {
```

- [ ] **Step 2: In `globals.css`, change the dark-theme selector (line ~35)**

Replace:
```css
.theme-v1.dark, :root.dark:not(.theme-v2) {
```
with:
```css
.dark {
```

- [ ] **Step 3: In `globals.css`, delete the entire `.theme-v2` block**

Delete the block that begins with:
```css
/* V2 Bento Premium — dark-only in this phase */
.theme-v2 {
```
through its closing `}` (the whole rule, ~lines 63–106). Verify nothing else references `theme-v2`:
```bash
grep -n "theme-v2" "app/app/globals.css"
```
Expected: no output.

- [ ] **Step 4: In `app/app/layout.tsx`, remove the `theme-v1` class from `<html>`**

Replace:
```tsx
    <html lang="de" className="theme-v1" suppressHydrationWarning>
```
with:
```tsx
    <html lang="de" suppressHydrationWarning>
```
(The dark-mode bootstrap script on the next line stays — it toggles the `dark` class, which the new `.dark` selector uses.)

- [ ] **Step 5: Build**

Run (from app root): `npm run build`
Expected: compiles successfully.

- [ ] **Step 6: Commit**

```bash
git add app/app/globals.css app/app/layout.tsx
git commit -m "refactor(css): collapse theme to :root/.dark, drop theme-v1 class + theme-v2 block"
```

---

## Task 6: Migration — drop the 4 unused columns

**Files:**
- Create: `supabase/migrations/20260617_065_remove_design_versions.sql`

- [ ] **Step 1: Confirm the next migration number**

Run (from repo root): `ls supabase/migrations | sort | tail -3`
Expected latest: `20260612_064_unify_brand.sql`. If the highest number is not `064`, name the new file with the next sequential number instead of `065` (keep the `20260617_` prefix + `_remove_design_versions` suffix).

- [ ] **Step 2: Create the migration with this exact content**

```sql
-- Remove the V1/V2 design-version columns (V2 fully decommissioned).
-- Columns are unused after the code removal. CHECK constraints + column-level
-- grants drop automatically with the columns. No RLS policy references them.

ALTER TABLE public.platform_settings
  DROP COLUMN IF EXISTS platform_design_version,
  DROP COLUMN IF EXISTS restaurants_default_version;

ALTER TABLE public.restaurants
  DROP COLUMN IF EXISTS admin_design_version,
  DROP COLUMN IF EXISTS guest_design_version;
```

- [ ] **Step 3: Sanity-check (no DB run here)**

Confirm by reading: no `CREATE TABLE` (so no GRANTs needed), only `DROP COLUMN IF EXISTS` (idempotent — re-running is a no-op). The migration is applied later via the Supabase SQL editor against a prod copy first, then prod.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260617_065_remove_design_versions.sql
git commit -m "feat(db): drop unused design-version columns"
```

---

## Final verification (after all tasks)

- [ ] From app root, full clean check:
```bash
grep -rnE "design-version|resolveDesignVersion|useDesignVersion|theme-v2|_v2/" app/app app/components app/lib 2>/dev/null | grep -vE "\.next|node_modules"
```
Expected: **no output** (a comment in `BestellenV1.tsx` referencing `.theme-v1.dark` historically may remain — that's fine; flag only live code/imports).
- [ ] `npm run build` green.
- [ ] After deploy + migration on a prod copy: spot-check `/order/<token>`, `/bestellen/<slug>`, `/reservieren/<slug>`, `/admin` (overview), `/platform` — all look identical to before.

---

## Self-Review (plan author)

**Spec coverage:** delete `_v2` (T1–T3) ✓ · switcher UI + APIs (T3) ✓ · `design-version.ts` + provider (T4) ✓ · 6 page/layout edits (T1–T3) ✓ · globals.css + html class (T5) ✓ · platform nav link (T3) ✓ · migration drops 4 columns (T6) ✓ · verification/no-visual-change (final) ✓.

**Placeholder scan:** none — every edit has exact full-file or exact-line content. Migration number has an explicit confirm step (the only deliberate variability).

**Consistency:** consumers deleted (T1–T3) before core (T4), so each build is green; the `.dark` selector in T5 matches the dark-class toggled by the existing layout bootstrap script; `…V1` components rendered prop-less as they already were.
