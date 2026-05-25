# Track A1 — Loyalty-Mechanik aktivieren — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loyalty wird vom client-seitigen, auth-only Feature zu einem server-seitig getriggerten, anon-fähigen Marketing-Hebel mit Auto-Apply-Rewards.

**Architecture:** Migration 058 erweitert `loyalty_members` um `subscriber_id` (FK zu `marketing_subscribers`), führt zwei `SECURITY DEFINER` RPCs ein (`get_loyalty_status` + `redeem_loyalty_reward`), und ersetzt client-`creditStamp` durch einen Postgres-Trigger bei `orders.status='served'`. Frontend bekommt eine wiederverwendbare `LoyaltyRedeemBlock` Komponente in allen vier Gast-Apps (BestellenV1/V2 + OrderV1/V2) sowie eine LocalStorage-Email-Persistenz für anonyme Re-Identifikation. Owner-Dashboard `/admin/marketing/loyalty` löst die alte Settings-Sektion ab.

**Tech Stack:** PostgreSQL 15+ (Supabase), Next.js 15 App Router (App-spezifische APIs siehe `app/AGENTS.md`), TypeScript, Tailwind, `@supabase/supabase-js`.

**Spec:** [`docs/superpowers/specs/2026-05-25-a1-loyalty-activation-design.md`](../specs/2026-05-25-a1-loyalty-activation-design.md)

---

## File Structure

**Create:**
- `supabase/migrations/20260525_058_loyalty_anon_and_redemption.sql` — Schema-Erweiterung, RPCs, Trigger, GRANTs
- `app/lib/loyalty/storage.ts` — LocalStorage-Helper für Gast-Email-Persistenz pro Restaurant
- `app/lib/loyalty/api.ts` — Typed Wrapper um die zwei neuen RPCs
- `app/components/bestellen/LoyaltyRedeemBlock.tsx` — Checkout-Block (Toggle + Preview)
- `app/app/admin/marketing/loyalty/page.tsx` — Neues Owner-Dashboard

**Modify:**
- `app/components/bestellen/LoyaltyWidget.tsx` — Refactor `useLoyalty` auf Subscriber-Basis, `creditStamp` entfernen
- `app/app/order/[token]/_v1/OrderV1.tsx` — Loyalty-Widget + RedeemBlock einbinden (heute komplett fehlend)
- `app/app/order/[token]/_v2/OrderV2.tsx` — RedeemBlock einbinden, `creditStamp` Call entfernen
- `app/app/bestellen/[slug]/_v1/BestellenV1.tsx` — RedeemBlock einbinden, `creditStamp` entfernen, Email→LocalStorage
- `app/app/bestellen/[slug]/_v2/BestellenV2.tsx` — RedeemBlock einbinden, `creditStamp` entfernen, Email→LocalStorage
- `app/app/admin/settings/page.tsx` — Loyalty-Sektion entfernen + Link zu `/admin/marketing/loyalty`

---

## Phase 1 — Database Schema (Migration 058)

### Task 1: Schema-Erweiterung schreiben

**Files:**
- Create: `supabase/migrations/20260525_058_loyalty_anon_and_redemption.sql`

- [ ] **Step 1: Migration-Datei anlegen mit Schema-Block**

```sql
-- Migration 058: Loyalty Anon Support + Reward Redemption
-- - loyalty_members: subscriber_id FK + user_id nullable
-- - loyalty_programs: reward_value_cents
-- - orders: reward_applied jsonb
-- - RPCs: get_loyalty_status, redeem_loyalty_reward
-- - Trigger: credit_loyalty_on_served

BEGIN;

-- 1) loyalty_members: subscriber_id als neuer primärer Anker
ALTER TABLE public.loyalty_members
  ADD COLUMN IF NOT EXISTS subscriber_id uuid REFERENCES public.marketing_subscribers(id) ON DELETE CASCADE,
  ALTER COLUMN user_id DROP NOT NULL;

-- Backfill aus auth.users via Email
UPDATE public.loyalty_members lm
SET subscriber_id = ms.id
FROM auth.users au, public.marketing_subscribers ms
WHERE lm.user_id = au.id
  AND au.email = ms.email
  AND ms.restaurant_id = lm.restaurant_id
  AND lm.subscriber_id IS NULL;

-- Unique-Constraint umstellen
ALTER TABLE public.loyalty_members
  DROP CONSTRAINT IF EXISTS loyalty_members_user_id_restaurant_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_members_subscriber_unique
  ON public.loyalty_members (subscriber_id, restaurant_id)
  WHERE subscriber_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loyalty_members_restaurant
  ON public.loyalty_members (restaurant_id);

-- 2) loyalty_programs: Reward-Wert in Cents
ALTER TABLE public.loyalty_programs
  ADD COLUMN IF NOT EXISTS reward_value_cents int DEFAULT 400;

-- 3) orders: Reward-Application tracken
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS reward_applied jsonb;

COMMIT;
```

- [ ] **Step 2: Migration lokal anwenden**

Run: `npx supabase db push` (oder Supabase Studio SQL Editor)
Expected: "Applied migration 058_loyalty_anon_and_redemption"

- [ ] **Step 3: Schema-Verifikation via psql**

```sql
\d public.loyalty_members
\d public.loyalty_programs
\d public.orders
```

Expected:
- `loyalty_members` hat Spalten `subscriber_id`, `user_id` (nullable)
- `loyalty_programs` hat `reward_value_cents` (default 400)
- `orders` hat `reward_applied jsonb`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260525_058_loyalty_anon_and_redemption.sql
git commit -m "feat(db): migration 058 — loyalty subscriber_id + reward_applied schema"
```

---

### Task 2: GRANT-Statements ergänzen (laut feedback_supabase_grants)

**Files:**
- Modify: `supabase/migrations/20260525_058_loyalty_anon_and_redemption.sql` (append before COMMIT)

- [ ] **Step 1: GRANTs hinzufügen**

Im SQL-File, VOR dem letzten `COMMIT;` einfügen:

```sql
-- GRANTs (Pflicht laut feedback_supabase_grants)
GRANT SELECT ON public.loyalty_programs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_programs TO authenticated;
GRANT ALL ON public.loyalty_programs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_members TO authenticated;
GRANT ALL ON public.loyalty_members TO service_role;
-- Anon hat KEIN direct table access — geht nur über RPCs (Task 3 + 4)
```

- [ ] **Step 2: Migration erneut anwenden** (idempotent dank `IF EXISTS` / GRANTs sind nicht-destruktiv)

Run: `npx supabase db push`

- [ ] **Step 3: Verifikation**

```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('loyalty_members','loyalty_programs')
ORDER BY table_name, grantee;
```

Expected: `anon` darf `loyalty_programs` SELECTen; `authenticated` darf beide voll; keine direkten anon-Rechte auf `loyalty_members`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260525_058_loyalty_anon_and_redemption.sql
git commit -m "feat(db): migration 058 — add explicit GRANTs"
```

---

## Phase 2 — Database Functions (RPCs + Trigger)

### Task 3: RPC `get_loyalty_status`

**Files:**
- Modify: `supabase/migrations/20260525_058_loyalty_anon_and_redemption.sql` (append before COMMIT)

- [ ] **Step 1: Funktion hinzufügen**

```sql
-- RPC: Loyalty-Status für anonyme oder registrierte Gäste
-- Sucht subscriber_id zuerst direkt, fallback via email
CREATE OR REPLACE FUNCTION public.get_loyalty_status(
  p_restaurant_id uuid,
  p_subscriber_id uuid DEFAULT NULL,
  p_email text DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH resolved AS (
    SELECT COALESCE(
      p_subscriber_id,
      (SELECT id FROM marketing_subscribers
         WHERE restaurant_id = p_restaurant_id
           AND lower(email) = lower(p_email)
         LIMIT 1)
    ) AS subscriber_id
  )
  SELECT jsonb_build_object(
    'program', to_jsonb(lp.*),
    'member', to_jsonb(lm.*),
    'subscriber_id', (SELECT subscriber_id FROM resolved)
  )
  FROM loyalty_programs lp
  LEFT JOIN loyalty_members lm
    ON lm.restaurant_id = lp.restaurant_id
   AND lm.subscriber_id = (SELECT subscriber_id FROM resolved)
  WHERE lp.restaurant_id = p_restaurant_id AND lp.enabled = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_loyalty_status(uuid, uuid, text) TO anon, authenticated;
```

- [ ] **Step 2: Migration anwenden**

Run: `npx supabase db push`

- [ ] **Step 3: Verifikation mit Test-Daten (psql)**

```sql
-- Restaurant + Subscriber suchen (manuell)
SELECT id, name FROM restaurants LIMIT 1;
-- z.B. ID = '11111111-...'

-- Disabled program → leeres Result
SELECT public.get_loyalty_status('11111111-...'::uuid);
-- Expected: NULL (kein enabled program)

-- Program enabled + subscriber-loser Aufruf
UPDATE loyalty_programs SET enabled=true WHERE restaurant_id='11111111-...';
SELECT public.get_loyalty_status('11111111-...'::uuid);
-- Expected: { "program": {...}, "member": null, "subscriber_id": null }
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260525_058_loyalty_anon_and_redemption.sql
git commit -m "feat(db): RPC get_loyalty_status — anon + registered lookup"
```

---

### Task 4: RPC `redeem_loyalty_reward` (Race-Safe)

**Files:**
- Modify: `supabase/migrations/20260525_058_loyalty_anon_and_redemption.sql`

- [ ] **Step 1: Funktion hinzufügen**

```sql
-- RPC: Race-safe Reward-Einlösung
CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward(
  p_subscriber_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_program loyalty_programs%ROWTYPE;
  v_member loyalty_members%ROWTYPE;
  v_current int;
BEGIN
  SELECT * INTO v_program FROM loyalty_programs
    WHERE restaurant_id = p_restaurant_id AND enabled = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_program'; END IF;

  -- Lock member row (verhindert Double-Spend bei parallelen Calls)
  SELECT * INTO v_member FROM loyalty_members
    WHERE subscriber_id = p_subscriber_id AND restaurant_id = p_restaurant_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_member'; END IF;

  v_current := CASE v_program.mechanic
                 WHEN 'stamps' THEN v_member.stamp_count
                 ELSE v_member.points
               END;
  IF v_current < v_program.goal THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  IF v_program.mechanic = 'stamps' THEN
    UPDATE loyalty_members
      SET stamp_count = stamp_count - v_program.goal,
          total_redeemed = total_redeemed + 1
      WHERE id = v_member.id;
  ELSE
    UPDATE loyalty_members
      SET points = points - v_program.goal,
          total_redeemed = total_redeemed + 1
      WHERE id = v_member.id;
  END IF;

  UPDATE orders
    SET reward_applied = jsonb_build_object(
      'reward_text', v_program.reward_text,
      'value_cents', v_program.reward_value_cents,
      'member_id', v_member.id,
      'redeemed_at', now()
    )
    WHERE id = p_order_id;

  INSERT INTO marketing_events (restaurant_id, subscriber_id, event_type, props)
    VALUES (p_restaurant_id, p_subscriber_id, 'redeemed_reward',
            jsonb_build_object('order_id', p_order_id,
                               'reward_text', v_program.reward_text,
                               'value_cents', v_program.reward_value_cents));

  RETURN jsonb_build_object('success', true,
                            'reward_text', v_program.reward_text,
                            'value_cents', v_program.reward_value_cents);
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_loyalty_reward(uuid, uuid, uuid) TO anon, authenticated;
```

- [ ] **Step 2: Migration anwenden**

Run: `npx supabase db push`

- [ ] **Step 3: Negativ-Test (insufficient_balance)**

```sql
-- Subscriber + Member ohne Goal-Erreichen
-- (Member mit stamp_count=2, goal=10)
SELECT public.redeem_loyalty_reward(
  '<subscriber_id>'::uuid,
  '<restaurant_id>'::uuid,
  '<order_id>'::uuid
);
-- Expected: ERROR: insufficient_balance
```

- [ ] **Step 4: Positiv-Test**

```sql
-- Member auf goal setzen
UPDATE loyalty_members SET stamp_count = 10 WHERE subscriber_id = '<sub_id>';

SELECT public.redeem_loyalty_reward(
  '<subscriber_id>'::uuid,
  '<restaurant_id>'::uuid,
  '<order_id>'::uuid
);
-- Expected: { "success": true, "reward_text": "...", "value_cents": 400 }

-- Verify
SELECT stamp_count, total_redeemed FROM loyalty_members WHERE subscriber_id='<sub_id>';
-- Expected: stamp_count=0, total_redeemed=1

SELECT reward_applied FROM orders WHERE id='<order_id>';
-- Expected: { reward_text, value_cents, member_id, redeemed_at }

SELECT event_type, props FROM marketing_events WHERE subscriber_id='<sub_id>' ORDER BY occurred_at DESC LIMIT 1;
-- Expected: event_type='redeemed_reward'
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260525_058_loyalty_anon_and_redemption.sql
git commit -m "feat(db): RPC redeem_loyalty_reward — race-safe with FOR UPDATE lock"
```

---

### Task 5: Trigger `credit_loyalty_on_served`

**Files:**
- Modify: `supabase/migrations/20260525_058_loyalty_anon_and_redemption.sql`

- [ ] **Step 1: Trigger-Funktion hinzufügen**

```sql
CREATE OR REPLACE FUNCTION public.credit_loyalty_on_served() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_program loyalty_programs%ROWTYPE;
  v_member_id uuid;
BEGIN
  IF NEW.status = 'served'
     AND OLD.status IS DISTINCT FROM 'served'
     AND NEW.customer_id IS NOT NULL THEN

    SELECT * INTO v_program FROM loyalty_programs
      WHERE restaurant_id = NEW.restaurant_id AND enabled = true;
    IF NOT FOUND THEN RETURN NEW; END IF;

    INSERT INTO loyalty_members (subscriber_id, restaurant_id)
      VALUES (NEW.customer_id, NEW.restaurant_id)
      ON CONFLICT (subscriber_id, restaurant_id) DO NOTHING;

    SELECT id INTO v_member_id FROM loyalty_members
      WHERE subscriber_id = NEW.customer_id AND restaurant_id = NEW.restaurant_id;

    IF v_program.mechanic = 'stamps' THEN
      UPDATE loyalty_members SET stamp_count = stamp_count + 1 WHERE id = v_member_id;
    ELSE
      UPDATE loyalty_members
        SET points = points + FLOOR(NEW.total * v_program.points_per_euro)
        WHERE id = v_member_id;
    END IF;

    INSERT INTO marketing_events (restaurant_id, subscriber_id, event_type, props)
      VALUES (NEW.restaurant_id, NEW.customer_id, 'loyalty_credited',
              jsonb_build_object('order_id', NEW.id,
                                 'mechanic', v_program.mechanic,
                                 'order_total', NEW.total));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loyalty_credit_on_served ON public.orders;
CREATE TRIGGER trg_loyalty_credit_on_served
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.credit_loyalty_on_served();
```

- [ ] **Step 2: Migration anwenden**

Run: `npx supabase db push`

- [ ] **Step 3: Trigger-Test (Stempel-Mechanik)**

```sql
-- Setup
UPDATE loyalty_programs SET mechanic='stamps', goal=10 WHERE restaurant_id='<rid>';

-- Test-Order mit customer_id (durch Track-D-Trigger gesetzt)
INSERT INTO orders (restaurant_id, table_id, items, total, status, customer_id)
  VALUES ('<rid>', '<tid>', '[]'::jsonb, 25.00, 'new', '<sub_id>')
  RETURNING id;
-- z.B. order_id = 'abc...'

-- Transition zu served
UPDATE orders SET status = 'served' WHERE id = 'abc...';

-- Verify
SELECT stamp_count FROM loyalty_members WHERE subscriber_id='<sub_id>';
-- Expected: stamp_count = 1 (oder +1 wenn schon Punkte da waren)

SELECT event_type, props FROM marketing_events
  WHERE subscriber_id='<sub_id>' ORDER BY occurred_at DESC LIMIT 1;
-- Expected: event_type='loyalty_credited', props.order_id='abc...'
```

- [ ] **Step 4: Idempotenz-Test**

```sql
-- Zweites Update mit gleichem Status (nicht-Transition) sollte nichts tun
UPDATE orders SET status='served' WHERE id='abc...';
-- (Trigger ist AFTER UPDATE OF status, aber wegen OLD = NEW = 'served' skipt der IF-Block)
SELECT stamp_count FROM loyalty_members WHERE subscriber_id='<sub_id>';
-- Expected: unverändert
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260525_058_loyalty_anon_and_redemption.sql
git commit -m "feat(db): trigger credit_loyalty_on_served — server-side point crediting"
```

---

## Phase 3 — TypeScript-Helper-Layer

### Task 6: LocalStorage-Helper

**Files:**
- Create: `app/lib/loyalty/storage.ts`

- [ ] **Step 1: Datei anlegen**

```typescript
// LocalStorage-Helper für anonyme Loyalty-Identifikation.
// Pro Restaurant-Slug wird die zuletzt eingegebene Email gespeichert,
// damit Wiederkehrer ihren Loyalty-Status sehen.

const KEY_PREFIX = 'loyalty_email:'

export function saveLoyaltyEmail(restaurantSlugOrId: string, email: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY_PREFIX + restaurantSlugOrId, email.toLowerCase().trim())
  } catch {
    // Quota/Privacy-Mode: silently ignore
  }
}

export function getLoyaltyEmail(restaurantSlugOrId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(KEY_PREFIX + restaurantSlugOrId)
  } catch {
    return null
  }
}

export function clearLoyaltyEmail(restaurantSlugOrId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY_PREFIX + restaurantSlugOrId)
  } catch { /* ignore */ }
}
```

- [ ] **Step 2: Manueller Test in Browser-DevTools** (nach Frontend-Deploy)

Nicht jetzt — wird in Phase 6 verifiziert.

- [ ] **Step 3: Commit**

```bash
git add app/lib/loyalty/storage.ts
git commit -m "feat(loyalty): add LocalStorage helper for anonymous email persistence"
```

---

### Task 7: Typed RPC-Wrapper

**Files:**
- Create: `app/lib/loyalty/api.ts`

- [ ] **Step 1: Datei anlegen**

```typescript
import { supabase } from '@/lib/supabase'

export interface LoyaltyProgram {
  id: string
  restaurant_id: string
  enabled: boolean
  mechanic: 'stamps' | 'points'
  goal: number
  points_per_euro: number
  reward_text: string
  reward_value_cents: number
  show_banner: boolean
  email_link_enabled: boolean
}

export interface LoyaltyMember {
  id: string
  subscriber_id: string | null
  user_id: string | null
  restaurant_id: string
  stamp_count: number
  points: number
  total_redeemed: number
  dietary_preferences?: string[] | null
  favorite_item_ids?: string[] | null
}

export interface LoyaltyStatus {
  program: LoyaltyProgram | null
  member: LoyaltyMember | null
  subscriber_id: string | null
}

export async function fetchLoyaltyStatus(args: {
  restaurantId: string
  subscriberId?: string | null
  email?: string | null
}): Promise<LoyaltyStatus | null> {
  const { data, error } = await supabase.rpc('get_loyalty_status', {
    p_restaurant_id: args.restaurantId,
    p_subscriber_id: args.subscriberId ?? null,
    p_email: args.email ?? null,
  })
  if (error || !data) return null
  return data as LoyaltyStatus
}

export type RedeemResult =
  | { success: true; reward_text: string; value_cents: number }
  | { success: false; reason: 'no_program' | 'no_member' | 'insufficient_balance' | 'unknown' }

export async function redeemLoyaltyReward(args: {
  subscriberId: string
  restaurantId: string
  orderId: string
}): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc('redeem_loyalty_reward', {
    p_subscriber_id: args.subscriberId,
    p_restaurant_id: args.restaurantId,
    p_order_id: args.orderId,
  })
  if (error) {
    const msg = error.message ?? ''
    const reason: RedeemResult extends { reason: infer R } ? R : never =
      msg.includes('no_program') ? 'no_program' :
      msg.includes('no_member') ? 'no_member' :
      msg.includes('insufficient_balance') ? 'insufficient_balance' : 'unknown'
    return { success: false, reason: reason as Exclude<typeof reason, never> }
  }
  return data as RedeemResult
}
```

- [ ] **Step 2: TypeScript-Check**

Run: `npx tsc --noEmit` (im `app/` Verzeichnis)
Expected: kein Fehler in `lib/loyalty/api.ts`

- [ ] **Step 3: Commit**

```bash
git add app/lib/loyalty/api.ts
git commit -m "feat(loyalty): add typed RPC wrappers (get_loyalty_status, redeem_loyalty_reward)"
```

---

## Phase 4 — `useLoyalty` Hook Refactor

### Task 8: Hook auf Subscriber-Basis umstellen

**Files:**
- Modify: `app/components/bestellen/LoyaltyWidget.tsx:36-98` (kompletter `useLoyalty` Hook)

- [ ] **Step 1: Hook umschreiben**

Ersetze den `useLoyalty` Block (Zeilen 36-98) durch:

```typescript
export function useLoyalty(restaurantId: string) {
  const [program, setProgram] = useState<LoyaltyProgram | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [member, setMember] = useState<LoyaltyMember | null>(null)
  const [subscriberId, setSubscriberId] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Auth-Watch (registrierte User)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load status (anon + registered)
  const reload = useCallback(async () => {
    if (!restaurantId) return
    const email = user?.email ?? getLoyaltyEmail(restaurantId)
    const status = await fetchLoyaltyStatus({
      restaurantId,
      subscriberId: null,
      email: email ?? null,
    })
    setProgram(status?.program ?? null)
    setMember((status?.member as LoyaltyMember | null) ?? null)
    setSubscriberId(status?.subscriber_id ?? null)
  }, [restaurantId, user])

  useEffect(() => { reload() }, [reload])

  // Re-Load wenn Email gerade gespeichert wurde
  const refreshFromEmail = useCallback(async (email: string) => {
    saveLoyaltyEmail(restaurantId, email)
    await reload()
  }, [restaurantId, reload])

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4000)
  }, [])

  return {
    program, user, member, subscriberId, toastMsg,
    setUser, setMember, refreshFromEmail, reload, showToast,
  }
}
```

Außerdem oben in der Datei die Imports ergänzen:

```typescript
import { fetchLoyaltyStatus, type LoyaltyMember, type LoyaltyProgram } from '@/lib/loyalty/api'
import { getLoyaltyEmail, saveLoyaltyEmail } from '@/lib/loyalty/storage'
```

Und die lokalen Type-Definitionen `interface LoyaltyProgram` + `interface LoyaltyMember` (Zeilen 9-26) **entfernen** — werden jetzt aus `@/lib/loyalty/api` importiert.

- [ ] **Step 2: TypeScript-Check**

Run: `cd app && npx tsc --noEmit`
Expected: alle Aufrufer von `useLoyalty` kompilieren (LoyaltyButton, LoyaltyBanner, etc.) — möglicherweise gibt es Type-Errors wenn das alte `member.dietary_preferences` Casting wegfällt; akzeptieren wenn nur Warnings.

- [ ] **Step 3: Commit**

```bash
git add app/components/bestellen/LoyaltyWidget.tsx
git commit -m "refactor(loyalty): useLoyalty hook uses subscriber_id + RPC (anon-fähig)"
```

---

### Task 9: `creditStamp` aus LoyaltyWidget entfernen

**Files:**
- Modify: `app/components/bestellen/LoyaltyWidget.tsx` (gesamter `creditStamp` Block — bestand vorher in Zeilen 71-95)

- [ ] **Step 1: `creditStamp` aus dem Hook-Return entfernen**

Stelle sicher, dass der `useLoyalty` Hook (nach Task 8) **kein** `creditStamp` mehr exportiert. Wenn nach Task 8 noch Reste da sind, entfernen.

- [ ] **Step 2: TypeScript-Check zeigt alle Call-Sites**

Run: `cd app && npx tsc --noEmit`
Expected: Errors in 3 Dateien:
- `app/app/order/[token]/_v2/OrderV2.tsx`
- `app/app/bestellen/[slug]/_v1/BestellenV1.tsx`
- `app/app/bestellen/[slug]/_v2/BestellenV2.tsx`

(Diese werden in Task 13-15 angepasst — erstmal hier dokumentieren, nicht beheben.)

- [ ] **Step 3: Commit**

```bash
git add app/components/bestellen/LoyaltyWidget.tsx
git commit -m "refactor(loyalty): remove client-side creditStamp (now server trigger)"
```

---

## Phase 5 — LoyaltyRedeemBlock Komponente

### Task 10: Reusable Checkout-Block bauen

**Files:**
- Create: `app/components/bestellen/LoyaltyRedeemBlock.tsx`

- [ ] **Step 1: Komponente schreiben**

```typescript
'use client'

import type { LoyaltyMember, LoyaltyProgram } from '@/lib/loyalty/api'

interface Props {
  program: LoyaltyProgram | null
  member: LoyaltyMember | null
  applyReward: boolean
  onToggle: (next: boolean) => void
  accentColor?: string
}

export function LoyaltyRedeemBlock({
  program, member, applyReward, onToggle, accentColor = '#EA580C',
}: Props) {
  if (!program?.enabled || !member) return null

  const current = program.mechanic === 'stamps' ? member.stamp_count : member.points
  if (current < program.goal) return null

  const valueEur = (program.reward_value_cents / 100).toFixed(2).replace('.', ',')

  return (
    <div
      style={{
        background: accentColor + '15',
        border: `1px solid ${accentColor}40`,
        borderRadius: '12px',
        padding: '14px 16px',
        marginBottom: '12px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
      }}
    >
      <div style={{ fontSize: '1.4rem', lineHeight: 1 }}>⭐</div>
      <div style={{ flex: 1 }}>
        <p style={{ color: '#F5F5F7', fontWeight: 700, fontSize: '0.9rem', margin: 0, marginBottom: '4px' }}>
          Du hast {current}/{program.goal} {program.mechanic === 'stamps' ? 'Stempel' : 'Punkte'}!
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={applyReward}
            onChange={(e) => onToggle(e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor }}
          />
          <span style={{ color: '#F5F5F7', fontSize: '0.85rem' }}>
            Belohnung „{program.reward_text}" einlösen{' '}
            <span style={{ color: accentColor, fontWeight: 700 }}>(–{valueEur} €)</span>
          </span>
        </label>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript-Check**

Run: `cd app && npx tsc --noEmit`
Expected: kein Fehler in `LoyaltyRedeemBlock.tsx`

- [ ] **Step 3: Commit**

```bash
git add app/components/bestellen/LoyaltyRedeemBlock.tsx
git commit -m "feat(loyalty): add LoyaltyRedeemBlock — checkout toggle component"
```

---

## Phase 6 — Integration in BestellenV2 (Referenz-Implementierung)

### Task 11: BestellenV2 — RedeemBlock einbinden + creditStamp entfernen + Email-Storage

**Files:**
- Modify: `app/app/bestellen/[slug]/_v2/BestellenV2.tsx`

- [ ] **Step 1: Imports + State erweitern**

Suche den Block mit `import { useLoyalty } from '@/components/bestellen/LoyaltyWidget'` (oder Equivalent) und ergänze:

```typescript
import { LoyaltyRedeemBlock } from '@/components/bestellen/LoyaltyRedeemBlock'
import { redeemLoyaltyReward } from '@/lib/loyalty/api'
import { saveLoyaltyEmail } from '@/lib/loyalty/storage'
```

Im Component-State (neben anderen useStates):

```typescript
const [applyReward, setApplyReward] = useState(false)
```

- [ ] **Step 2: `useLoyalty` Destructuring anpassen**

Zeile 166 (alt: `const { program: loyaltyProgram, creditStamp } = useLoyalty(...)`) ersetzen durch:

```typescript
const {
  program: loyaltyProgram,
  member: loyaltyMember,
  subscriberId: loyaltySubscriberId,
  refreshFromEmail,
  showToast,
} = useLoyalty(loyaltyRestaurantId)
```

- [ ] **Step 3: RedeemBlock in JSX einfügen**

Im Checkout-Bereich (vor dem "Bestellen abschicken" Button) einfügen:

```tsx
<LoyaltyRedeemBlock
  program={loyaltyProgram}
  member={loyaltyMember}
  applyReward={applyReward}
  onToggle={setApplyReward}
  accentColor={accentColor /* falls vorhanden, sonst weglassen */}
/>
```

- [ ] **Step 4: Submit-Logik anpassen**

Suche den Block mit `if (loyaltyProgram?.enabled) { creditStamp(total) }` (war Zeile 214-216).
Ersetzen durch:

```typescript
// Punkte werden jetzt server-seitig bei status=served gutgeschrieben (Trigger).
// Hier nur noch: Email-Persistenz + Reward-Einlösung (falls aktiviert).
if (email && loyaltyProgram?.enabled) {
  await refreshFromEmail(email)
}

if (applyReward && loyaltySubscriberId && insertedOrderId) {
  const result = await redeemLoyaltyReward({
    subscriberId: loyaltySubscriberId,
    restaurantId: loyaltyRestaurantId,
    orderId: insertedOrderId,
  })
  if (result.success) {
    showToast(`✓ Belohnung „${result.reward_text}" eingelöst`)
  } else if (result.reason === 'insufficient_balance') {
    showToast('Belohnung nicht mehr verfügbar — Bestellung wird normal verarbeitet')
  } else {
    showToast('Belohnung konnte nicht eingelöst werden')
  }
}
```

**Hinweis:** `insertedOrderId` ist die ID, die der `INSERT orders ... RETURNING id` zurückgibt. Falls die aktuelle Submit-Funktion das nicht zurückgibt, ergänzen: `.select('id').single()` und ID merken.

- [ ] **Step 5: TypeScript + lokale UI-Verifikation**

Run: `cd app && npx tsc --noEmit`
Expected: kein Fehler in BestellenV2.tsx.

Manuell: `npm run dev`, `/bestellen/<test-slug>` öffnen, Bestellvorgang durchklicken. RedeemBlock soll nur erscheinen wenn Member + Goal erreicht ist (Test-Daten ggf. via psql vorbereiten).

- [ ] **Step 6: Commit**

```bash
git add app/app/bestellen/[slug]/_v2/BestellenV2.tsx
git commit -m "feat(bestellen-v2): integrate LoyaltyRedeemBlock + remove client creditStamp"
```

---

### Task 12: BestellenV1 — gleiche Integration

**Files:**
- Modify: `app/app/bestellen/[slug]/_v1/BestellenV1.tsx`

- [ ] **Step 1: Identische Anpassungen wie Task 11 in BestellenV1**

**Wichtig:** BestellenV1 hat einen zweiten `orders.insert` Pfad bei Zeile ~372 (Group-Orders). Dieser Pfad **bekommt KEIN** RedeemBlock — Group-Orders sind out-of-scope für A1 (siehe `[[project_marketing_roadmap]]` Followup C).

Folge den gleichen 4 Schritten wie Task 11 Step 1-4, aber auf den primären Single-Order-Pfad in BestellenV1.

- [ ] **Step 2: TypeScript-Check**

Run: `cd app && npx tsc --noEmit`
Expected: kein Fehler in BestellenV1.tsx.

- [ ] **Step 3: Commit**

```bash
git add app/app/bestellen/[slug]/_v1/BestellenV1.tsx
git commit -m "feat(bestellen-v1): integrate LoyaltyRedeemBlock + remove client creditStamp"
```

---

### Task 13: OrderV2 — gleiche Integration

**Files:**
- Modify: `app/app/order/[token]/_v2/OrderV2.tsx`

- [ ] **Step 1: Gleiche Anpassungen wie Task 11**

Identische 4 Schritte wie BestellenV2. Achtung: OrderV2 hat (`token`-basierte) Tisch-App, kein Slug — `restaurantId` kommt aus `table.restaurant_id`, Email aus Opt-In-Field.

- [ ] **Step 2: TypeScript-Check**

Run: `cd app && npx tsc --noEmit`
Expected: kein Fehler.

- [ ] **Step 3: Commit**

```bash
git add app/app/order/[token]/_v2/OrderV2.tsx
git commit -m "feat(order-v2): integrate LoyaltyRedeemBlock + remove client creditStamp"
```

---

### Task 14: OrderV1 — komplette Loyalty-Anbindung

**Files:**
- Modify: `app/app/order/[token]/_v1/OrderV1.tsx`

- [ ] **Step 1: useLoyalty + LoyaltyButton einbinden**

OrderV1 hat heute **gar kein** Loyalty. Ergänze:

```typescript
import { useLoyalty, LoyaltyButton, LoyaltyBanner } from '@/components/bestellen/LoyaltyWidget'
import { LoyaltyRedeemBlock } from '@/components/bestellen/LoyaltyRedeemBlock'
import { redeemLoyaltyReward } from '@/lib/loyalty/api'

// Im Component:
const loyaltyRestaurantId = restaurant?.id ?? ''
const {
  program: loyaltyProgram,
  member: loyaltyMember,
  subscriberId: loyaltySubscriberId,
  refreshFromEmail,
  showToast,
} = useLoyalty(loyaltyRestaurantId)
const [applyReward, setApplyReward] = useState(false)
```

In den Header (passt zu V2-Layout): `<LoyaltyButton restaurantId={loyaltyRestaurantId} accentColor={accentColor} />`

Oberhalb der Speisekarte (analog zu V2): `<LoyaltyBanner restaurantId={loyaltyRestaurantId} accentColor={accentColor} />`

Im Checkout: `<LoyaltyRedeemBlock ... />` (wie Task 11 Step 3) + Submit-Logik (wie Task 11 Step 4).

- [ ] **Step 2: TypeScript-Check + Manuelle UI-Verifikation**

Run: `cd app && npx tsc --noEmit`

Manuell: V1 muss dieselbe Loyalty-UX wie V2 zeigen.

- [ ] **Step 3: Commit**

```bash
git add app/app/order/[token]/_v1/OrderV1.tsx
git commit -m "feat(order-v1): add loyalty widget + RedeemBlock (parity with V2)"
```

---

## Phase 7 — Owner-Dashboard

### Task 15: Loyalty-Sektion aus `/admin/settings` entfernen

**Files:**
- Modify: `app/app/admin/settings/page.tsx`

- [ ] **Step 1: Loyalty-Block entfernen**

Suche `from('loyalty_programs')` in der Datei (mehrere Stellen — Load + Save).

Entferne:
- Den Load-Block (~Zeilen 91-96)
- Den Save-Block (~Zeilen 261-266)
- Den UI-Block (vermutlich später in der JSX — Felder für mechanic, goal, points_per_euro, reward_text, etc.)
- Die States `loyalty`, `setLoyalty`

Ersetze den UI-Block durch einen Link:

```tsx
<section style={{ /* gleicher Stil wie andere Sektionen */ }}>
  <h2>Loyalty / Stempelkarte</h2>
  <p>Konfiguration ist umgezogen.</p>
  <a href="/admin/marketing/loyalty" style={{ color: accentColor }}>→ Loyalty-Dashboard öffnen</a>
</section>
```

- [ ] **Step 2: TypeScript-Check**

Run: `cd app && npx tsc --noEmit`
Expected: kein Fehler (alle Loyalty-Variablen entfernt).

- [ ] **Step 3: Commit**

```bash
git add app/app/admin/settings/page.tsx
git commit -m "refactor(admin-settings): remove loyalty config (moved to /admin/marketing/loyalty)"
```

---

### Task 16: Neues Owner-Dashboard `/admin/marketing/loyalty`

**Files:**
- Create: `app/app/admin/marketing/loyalty/page.tsx`

- [ ] **Step 1: Page anlegen**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { LoyaltyProgram } from '@/lib/loyalty/api'

interface TopMember {
  id: string
  subscriber_email: string | null
  stamp_count: number
  points: number
  total_redeemed: number
}

interface Stats {
  total_members: number
  total_redemptions: number
  redemptions_30d: number
  value_redeemed_cents: number
}

export default function LoyaltyAdminPage() {
  const [restaurantId, setRestaurantId] = useState<string>('')
  const [program, setProgram] = useState<Partial<LoyaltyProgram>>({})
  const [topMembers, setTopMembers] = useState<TopMember[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: resto } = await supabase
        .from('restaurants').select('id').eq('owner_id', user.id).maybeSingle()
      if (!resto) return
      setRestaurantId(resto.id)
      const { data: lp } = await supabase
        .from('loyalty_programs').select('*').eq('restaurant_id', resto.id).maybeSingle()
      if (lp) setProgram(lp)

      // Top 10 Members
      const { data: members } = await supabase
        .from('loyalty_members')
        .select('id, stamp_count, points, total_redeemed, marketing_subscribers!loyalty_members_subscriber_id_fkey(email)')
        .eq('restaurant_id', resto.id)
        .order('stamp_count', { ascending: false })
        .limit(10)
      if (members) {
        setTopMembers(members.map((m: any) => ({
          id: m.id,
          subscriber_email: m.marketing_subscribers?.email ?? null,
          stamp_count: m.stamp_count,
          points: m.points,
          total_redeemed: m.total_redeemed,
        })))
      }

      // Stats
      const { count: totalMembers } = await supabase
        .from('loyalty_members').select('*', { count: 'exact', head: true })
        .eq('restaurant_id', resto.id)

      const { data: redemptions } = await supabase
        .from('marketing_events')
        .select('occurred_at, props')
        .eq('restaurant_id', resto.id)
        .eq('event_type', 'redeemed_reward')

      const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString()
      const totalRed = redemptions?.length ?? 0
      const red30d = redemptions?.filter(r => r.occurred_at >= thirtyDaysAgo).length ?? 0
      const valueCents = (redemptions ?? []).reduce((sum: number, r: any) =>
        sum + (Number(r.props?.value_cents) || 0), 0)

      setStats({
        total_members: totalMembers ?? 0,
        total_redemptions: totalRed,
        redemptions_30d: red30d,
        value_redeemed_cents: valueCents,
      })
    })()
  }, [])

  async function saveProgram() {
    if (!restaurantId) return
    setSaving(true)
    const payload = { ...program, restaurant_id: restaurantId }
    const { error } = program.id
      ? await supabase.from('loyalty_programs').update(payload).eq('id', program.id)
      : await supabase.from('loyalty_programs').insert(payload).select('id').single()
          .then(r => { if (r.data?.id) setProgram(p => ({ ...p, id: r.data!.id })); return r })
    setSaving(false)
    if (!error) { setSavedMsg('Gespeichert ✓'); setTimeout(() => setSavedMsg(''), 2500) }
  }

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '24px' }}>
        ⭐ Loyalty-Programm
      </h1>

      {/* Konfiguration */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>Konfiguration</h2>
        <label style={labelStyle}>
          <input type="checkbox" checked={program.enabled ?? false}
                 onChange={e => setProgram(p => ({ ...p, enabled: e.target.checked }))} />
          Aktiviert
        </label>

        <label style={labelStyle}>Mechanik
          <select value={program.mechanic ?? 'stamps'}
                  onChange={e => setProgram(p => ({ ...p, mechanic: e.target.value as 'stamps' | 'points' }))}>
            <option value="stamps">Stempel (z.B. 10 Bestellungen)</option>
            <option value="points">Punkte (pro Euro)</option>
          </select>
        </label>

        <label style={labelStyle}>Ziel (Stempel oder Punkte)
          <input type="number" value={program.goal ?? 10}
                 onChange={e => setProgram(p => ({ ...p, goal: parseInt(e.target.value) || 10 }))} />
        </label>

        {program.mechanic === 'points' && (
          <label style={labelStyle}>Punkte pro Euro
            <input type="number" value={program.points_per_euro ?? 10}
                   onChange={e => setProgram(p => ({ ...p, points_per_euro: parseInt(e.target.value) || 10 }))} />
          </label>
        )}

        <label style={labelStyle}>Reward-Text (was bekommt der Gast?)
          <input type="text" value={program.reward_text ?? ''}
                 placeholder="z.B. Gratis-Getränk"
                 onChange={e => setProgram(p => ({ ...p, reward_text: e.target.value }))} />
        </label>

        <label style={labelStyle}>Reward-Wert (in Cents — z.B. 400 = 4€)
          <input type="number" value={program.reward_value_cents ?? 400}
                 onChange={e => setProgram(p => ({ ...p, reward_value_cents: parseInt(e.target.value) || 0 }))} />
        </label>

        <label style={labelStyle}>
          <input type="checkbox" checked={program.show_banner ?? false}
                 onChange={e => setProgram(p => ({ ...p, show_banner: e.target.checked }))} />
          Banner oberhalb der Speisekarte zeigen
        </label>

        <button onClick={saveProgram} disabled={saving} style={btnStyle}>
          {saving ? 'Speichert…' : 'Speichern'}
        </button>
        {savedMsg && <span style={{ marginLeft: '12px', color: '#22c55e' }}>{savedMsg}</span>}
      </section>

      {/* Statistiken */}
      {stats && (
        <section style={sectionStyle}>
          <h2 style={h2Style}>Statistiken</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            <Stat label="Mitglieder" value={stats.total_members.toString()} />
            <Stat label="Einlösungen Gesamt" value={stats.total_redemptions.toString()} />
            <Stat label="Einlösungen 30 Tage" value={stats.redemptions_30d.toString()} />
            <Stat label="Verschenkt (Wert)"
                  value={(stats.value_redeemed_cents/100).toFixed(2).replace('.', ',') + ' €'} />
          </div>
        </section>
      )}

      {/* Top Members */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>Top Mitglieder</h2>
        <table style={{ width: '100%', fontSize: '0.85rem' }}>
          <thead><tr>
            <th style={thStyle}>Email</th>
            <th style={thStyle}>Stempel</th>
            <th style={thStyle}>Punkte</th>
            <th style={thStyle}>Eingelöst</th>
          </tr></thead>
          <tbody>
            {topMembers.map(m => (
              <tr key={m.id}>
                <td style={tdStyle}>{m.subscriber_email ?? '(anonym)'}</td>
                <td style={tdStyle}>{m.stamp_count}</td>
                <td style={tdStyle}>{m.points}</td>
                <td style={tdStyle}>{m.total_redeemed}</td>
              </tr>
            ))}
            {topMembers.length === 0 && (
              <tr><td colSpan={4} style={{ ...tdStyle, color: '#8B8B93' }}>Noch keine Mitglieder.</td></tr>
            )}
          </tbody>
        </table>
      </section>
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
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '12px', fontSize: '0.85rem' }
const btnStyle: React.CSSProperties = {
  background: '#EA580C', color: '#fff', border: 'none', borderRadius: '8px',
  padding: '10px 18px', fontWeight: 700, cursor: 'pointer',
}
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px', color: '#8B8B93', borderBottom: '1px solid rgba(255,255,255,0.08)' }
const tdStyle: React.CSSProperties = { padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }
```

- [ ] **Step 2: TypeScript-Check + Browser-Verifikation**

Run: `cd app && npx tsc --noEmit`
Manuell: `npm run dev`, als Owner einloggen, `/admin/marketing/loyalty` öffnen. Felder editieren, speichern, neu laden — Werte persistieren.

- [ ] **Step 3: Commit**

```bash
git add app/app/admin/marketing/loyalty/page.tsx
git commit -m "feat(admin-loyalty): add /admin/marketing/loyalty dashboard (config + members + stats)"
```

---

## Phase 8 — E2E-Verifikation

### Task 17: Stempel-Mechanik End-to-End testen

- [ ] **Step 1: Test-Restaurant + Subscriber vorbereiten**

In psql:
```sql
-- Loyalty enabled mit stamps mechanic, goal=3 (für schnelleren Test), reward_value_cents=200
UPDATE loyalty_programs SET enabled=true, mechanic='stamps', goal=3, reward_value_cents=200,
  reward_text='Gratis Espresso'
  WHERE restaurant_id='<dein_test_restaurant_id>';

-- Cleanup für sauberen Test
DELETE FROM loyalty_members WHERE restaurant_id='<dein_test_restaurant_id>';
```

- [ ] **Step 2: 3× Bestellung mit Opt-In abschicken (Tisch-App V2)**

Im Browser: QR-Code → OrderV2 → 3 separate Bestellungen mit derselben Email + Marketing-Opt-In aktiviert.

- [ ] **Step 3: Staff-Dashboard: Status auf `served` setzen** für jede der 3 Bestellungen

- [ ] **Step 4: DB-Verifikation**

```sql
SELECT stamp_count, total_redeemed FROM loyalty_members
  WHERE subscriber_id = (SELECT id FROM marketing_subscribers WHERE email='<deine_test_email>');
-- Expected: stamp_count=3, total_redeemed=0
```

- [ ] **Step 5: 4. Bestellung → RedeemBlock muss erscheinen**

Im Browser: 4. Bestellung anlegen. Im Checkout-Schritt muss der `LoyaltyRedeemBlock` sichtbar sein („Du hast 3/3 Stempel! [✓] Belohnung „Gratis Espresso" einlösen (–2,00 €)").

Toggle aktivieren → Bestellung abschicken.

- [ ] **Step 6: Reward-Verifikation**

```sql
SELECT id, status, reward_applied FROM orders ORDER BY created_at DESC LIMIT 1;
-- Expected: reward_applied IS NOT NULL, enthält reward_text + value_cents=200

SELECT stamp_count, total_redeemed FROM loyalty_members WHERE ...;
-- Expected: stamp_count=0 (3-3=0), total_redeemed=1
```

- [ ] **Step 7: Wenn alles passt: Commit nicht nötig (kein Code-Change), aber Status festhalten**

```bash
# Optional: leere Markierungs-Commit, wenn explizite Verifikation als Meilenstein dokumentiert werden soll
git commit --allow-empty -m "verify(a1-loyalty): E2E stamps mechanic + redeem confirmed"
```

---

### Task 18: Points-Mechanik + Race-Test

- [ ] **Step 1: Auf points umschalten**

```sql
UPDATE loyalty_programs SET mechanic='points', goal=100, points_per_euro=10
  WHERE restaurant_id='<rid>';
DELETE FROM loyalty_members WHERE restaurant_id='<rid>';
```

- [ ] **Step 2: Bestellung über 25€ mit Opt-In → status=served**

Expected: `points = FLOOR(25 * 10) = 250` (über goal=100)

- [ ] **Step 3: Race-Test — zwei Browser-Tabs parallel**

Tab A: Bestellung mit RedeemBlock-Toggle aktiv, kurz vor Submit pausieren (z.B. via DevTools Breakpoint im Submit-Handler).
Tab B: gleicher Account, gleiche Aktion → Submit.
Tab A: Submit ausführen.

Expected: einer der beiden bekommt `success: true`, der andere `insufficient_balance` mit Toast — keiner hängt, keine doppelte Einlösung.

- [ ] **Step 4: DB-Verifikation**

```sql
SELECT stamp_count, points, total_redeemed FROM loyalty_members WHERE ...;
-- Expected: points=150 (250-100), total_redeemed=1 (nicht 2)
```

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "verify(a1-loyalty): points mechanic + race condition handling confirmed"
```

---

### Task 19: BestellenV1 / OrderV1 Konsistenzcheck

- [ ] **Step 1: Gleichen Flow wie Task 17 auf BestellenV1 (Online-App, V1-Slug)**

Stelle sicher, dass:
- LoyaltyButton im Header sichtbar
- RedeemBlock im Checkout (wenn Goal erreicht)
- Submit löst Reward ein

- [ ] **Step 2: Gleichen Flow auf OrderV1 (Tisch-App V1)**

Dito.

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "verify(a1-loyalty): V1 parity (BestellenV1 + OrderV1) confirmed"
```

---

### Task 20: Final-Sweep — Memories aktualisieren

- [ ] **Step 1: Memory `project_marketing_roadmap` aktualisieren**

In `C:\Users\David\.claude\projects\c--Users-David-Desktop-restaurant-system\memory\project_marketing_roadmap.md`:
- "Track A — In-Product Killer-Features" Abschnitt: A1 als ✅ ABGESCHLOSSEN markieren
- Nächste Schritte: A2 Google-Reviews-Automation in den Vordergrund

- [ ] **Step 2: Followup im Memory ergänzen, falls bei E2E-Tests Reste aufgefallen sind**

- [ ] **Step 3: PR erstellen**

```bash
git push origin <branch-name>
gh pr create --title "feat(a1-loyalty): activate anon-fähige loyalty + auto-apply rewards" --body "$(cat <<'EOF'
## Summary
- Migration 058: loyalty_members.subscriber_id, loyalty_programs.reward_value_cents, orders.reward_applied
- RPCs: get_loyalty_status, redeem_loyalty_reward (race-safe)
- Trigger: credit_loyalty_on_served — server-side point crediting
- LoyaltyRedeemBlock in allen 4 Gast-Apps
- Neues Owner-Dashboard /admin/marketing/loyalty

Spec: docs/superpowers/specs/2026-05-25-a1-loyalty-activation-design.md

## Test plan
- [x] Stamps mechanic E2E (Task 17)
- [x] Points mechanic + race condition (Task 18)
- [x] V1 parity (Task 19)
EOF
)"
```

---

## Spec Coverage Check

| Spec-Requirement | Plan-Task(s) |
|---|---|
| `loyalty_members.subscriber_id` Spalte + Backfill | Task 1 |
| Unique-Constraint Umstellung | Task 1 |
| `reward_value_cents` Spalte | Task 1 |
| `orders.reward_applied` Spalte | Task 1 |
| GRANTs anon/authenticated/service_role | Task 2 |
| RPC `get_loyalty_status` (anon-fähig) | Task 3 |
| RPC `redeem_loyalty_reward` (FOR UPDATE Lock) | Task 4 |
| Server-Trigger `credit_loyalty_on_served` | Task 5 |
| LocalStorage-Email-Persistenz | Task 6 |
| Typed RPC-Wrapper | Task 7 |
| `useLoyalty` Hook auf subscriber_id | Task 8 |
| Client-`creditStamp` entfernen | Task 9 |
| `LoyaltyRedeemBlock` Komponente | Task 10 |
| Integration BestellenV2 | Task 11 |
| Integration BestellenV1 (ohne Group-Orders) | Task 12 |
| Integration OrderV2 | Task 13 |
| Integration OrderV1 (komplette Loyalty-Anbindung) | Task 14 |
| Loyalty aus `/admin/settings` entfernen | Task 15 |
| Owner-Dashboard `/admin/marketing/loyalty` | Task 16 |
| E2E stamps | Task 17 |
| E2E points + Race-Test | Task 18 |
| V1-Parity-Check | Task 19 |
| Memory + PR | Task 20 |

Alle Spec-Sektionen sind durch mindestens einen Task abgedeckt.
