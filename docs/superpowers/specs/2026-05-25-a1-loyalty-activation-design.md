# Track A1 — Loyalty-Mechanik aktivieren

**Date:** 2026-05-25
**Status:** Approved
**Roadmap context:** Erster Sub-Track von Track A der Marketing-Macht Roadmap (D→A→C→B). Baut direkt auf Track D auf (`orders.customer_id → marketing_subscribers`).

---

## Context

Eine partielle Loyalty-Implementierung existiert bereits:

- **DB (Migration 032):** `loyalty_programs` (config pro Restaurant) + `loyalty_members` (per `user_id → auth.users`).
- **UI (`app/components/bestellen/LoyaltyWidget.tsx`):** Login/Register/Magic-Link Modal, Stempel/Punkte-Anzeige, Card-Dropdown, Profil-Tab, DSGVO-Buttons. `creditStamp(total)` Funktion implementiert.
- **Client-Calls:** `creditStamp` wird in `BestellenV1`, `BestellenV2`, `OrderV2` nach Order-Insert aufgerufen.

Die Implementierung hat sieben strukturelle Lücken, die A1 schließt:

1. **Auth-Mismatch (kritisch):** `loyalty_members.user_id` referenziert `auth.users`. Nur registrierte User können sammeln. Track D verknüpft jeden Gast mit Marketing-Opt-In an `marketing_subscribers` — das bleibt für Loyalty ungenutzt.
2. **Kein Reward-Einlösungs-Flow:** UI zeigt "🎉 Belohnung verfügbar", aber kein Code wendet sie auf eine Bestellung an.
3. **Trigger-Zeitpunkt falsch:** Gutschrift passiert client-seitig direkt nach Insert (Status=`new`). Stornierte Bestellungen behalten Punkte. Voraussetzung: Gast bleibt in der App.
4. **`OrderV1` (Tisch-App V1) ruft `creditStamp` nicht auf** — V1/V2-Drift.
5. **`total_redeemed` Spalte existiert, wird nie geschrieben.**
6. **Reward-Wert ist nur Freitext** (`reward_text` = "Gratis-Getränk") — keine numerische Basis für Auto-Apply.
7. **Kein zentrales Owner-Dashboard** — Konfiguration verstreut in `/admin/settings`, keine Mitglieder-Übersicht.

A1 macht Loyalty zur ersten ernsthaft funktionierenden, marketing-relevanten Mechanik im Produkt.

## Goals

- **Maximale Beteiligung:** Jeder Gast mit Marketing-Opt-In ist automatisch loyalty-fähig — ohne Konto-Registrierung.
- **Robuste Buchung:** Punkte werden server-seitig bei Status=`served` gutgeschrieben, nicht client-seitig bei Insert.
- **Schmerzfreie Einlösung:** Auto-Apply im Checkout — kein Code, kein Schritt zum Kellner.
- **Race-Sicherheit:** Reward kann nicht doppelt eingelöst werden, auch nicht bei parallelen Bestellungen.
- **Konsistenz V1/V2:** Beide Gast-Apps (Tisch + Online) in jeweils V1 und V2 zeigen dasselbe Verhalten.

## Non-Goals (ausdrücklich nicht in A1)

- Tier-System (Bronze/Silver/Gold) — Folge-Sub-Track A1b
- Konkretes Free-Item als Reward (statt €-Rabatt) — A1c
- Email-Notifications "Du hast Punkte gesammelt" — A4 Win-Back-Drip
- Geburtstags-Bonus / Anniversary — A3
- Tier-spezifische Rewards
- Loyalty-übergreifend über mehrere Restaurants (jedes Restaurant bleibt isoliert)

## Decisions

| Frage | Entscheidung | Begründung |
|---|---|---|
| Teilnehmerkreis | Anonyme (per Email-Opt-In) + registrierte User | Track D hat das Email-System bereits — leveragen, max. Beteiligung |
| Trigger-Zeitpunkt | Server-Trigger bei `orders.status` Übergang zu `served` | Atomar, robust gegen Stornierung, unabhängig von Client-App-State |
| Reward-Einlösung | Auto-Apply im Checkout (Toggle) | Höchste Conversion, keine Personal-Schulung, kein 2-Schritt-Flow |
| Reward-Wert | Fester €-Rabatt (`reward_value_cents`) | Einfach, vorhersehbar, kompatibel mit jeder Speisekarte |
| Tier-System | Nicht in A1 | YAGNI — vermischt mit Goal-Logik, eigene Mechanik |

## Architecture

### Datenmodell-Änderungen (Migration 058)

Eine einzelne Migration `058_loyalty_anon_and_redemption.sql`:

```sql
-- 1) loyalty_members: subscriber_id wird primärer Anker
ALTER TABLE loyalty_members
  ADD COLUMN subscriber_id uuid REFERENCES marketing_subscribers(id) ON DELETE CASCADE,
  ALTER COLUMN user_id DROP NOT NULL;

-- Backfill: bestehende user_id-Members via Email zu Subscribers linken
UPDATE loyalty_members lm
SET subscriber_id = ms.id
FROM auth.users au, marketing_subscribers ms
WHERE lm.user_id = au.id
  AND au.email = ms.email
  AND ms.restaurant_id = lm.restaurant_id
  AND lm.subscriber_id IS NULL;

-- Neuer Unique-Constraint
ALTER TABLE loyalty_members
  DROP CONSTRAINT IF EXISTS loyalty_members_user_id_restaurant_id_key,
  ADD CONSTRAINT loyalty_members_subscriber_unique UNIQUE (subscriber_id, restaurant_id);

-- 2) loyalty_programs: Reward-Wert als Cents
ALTER TABLE loyalty_programs
  ADD COLUMN IF NOT EXISTS reward_value_cents int DEFAULT 400;

-- 3) orders: Reward-Tracking
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS reward_applied jsonb;
-- Shape: { reward_text, value_cents, member_id, redeemed_at }

-- 4) GRANTs (gemäß feedback_supabase_grants)
GRANT SELECT ON public.loyalty_programs TO anon;
-- (Members nur authenticated; Anonyme greifen via RPC zu, nicht direkt)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_members TO authenticated;
GRANT ALL ON public.loyalty_members TO service_role;
```

**Hinweis:** `loyalty_members` bleibt für Anon-User per Direct-Query unzugänglich (RLS bleibt). Anon-Lookup läuft über eine separate RPC `get_loyalty_status(p_subscriber_id, p_restaurant_id)`, die mit `SECURITY DEFINER` läuft.

### Server-Side Trigger: Punkte-Gutschrift

```sql
CREATE OR REPLACE FUNCTION credit_loyalty_on_served() RETURNS trigger AS $$
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

    -- Upsert member (idempotent)
    INSERT INTO loyalty_members (subscriber_id, restaurant_id)
      VALUES (NEW.customer_id, NEW.restaurant_id)
      ON CONFLICT (subscriber_id, restaurant_id) DO NOTHING;

    SELECT id INTO v_member_id FROM loyalty_members
      WHERE subscriber_id = NEW.customer_id AND restaurant_id = NEW.restaurant_id;

    -- Credit
    IF v_program.mechanic = 'stamps' THEN
      UPDATE loyalty_members SET stamp_count = stamp_count + 1 WHERE id = v_member_id;
    ELSE
      UPDATE loyalty_members
        SET points = points + FLOOR(NEW.total * v_program.points_per_euro)
        WHERE id = v_member_id;
    END IF;

    -- Event log
    INSERT INTO marketing_events (event_type, subscriber_id, order_id, restaurant_id, linked, metadata)
      VALUES ('loyalty_credited', NEW.customer_id, NEW.id, NEW.restaurant_id, true,
              jsonb_build_object('mechanic', v_program.mechanic, 'order_total', NEW.total));
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_loyalty_credit_on_served
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION credit_loyalty_on_served();
```

Der Trigger ergänzt `marketing_events` um den Event-Type `loyalty_credited` — bisher existieren `placed_order`, `redeemed_reward` etc. (siehe `app/lib/marketing/events.ts`).

### Reward-Redemption RPC (Race-Safe)

```sql
CREATE OR REPLACE FUNCTION redeem_loyalty_reward(
  p_subscriber_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_program loyalty_programs%ROWTYPE;
  v_member loyalty_members%ROWTYPE;
  v_current int;
BEGIN
  SELECT * INTO v_program FROM loyalty_programs
    WHERE restaurant_id = p_restaurant_id AND enabled = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_program'; END IF;

  -- Lock member row
  SELECT * INTO v_member FROM loyalty_members
    WHERE subscriber_id = p_subscriber_id AND restaurant_id = p_restaurant_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_member'; END IF;

  v_current := CASE v_program.mechanic
                 WHEN 'stamps' THEN v_member.stamp_count
                 ELSE v_member.points
               END;
  IF v_current < v_program.goal THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  -- Deduct + bump total_redeemed
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

  -- Mark order
  UPDATE orders
    SET reward_applied = jsonb_build_object(
      'reward_text', v_program.reward_text,
      'value_cents', v_program.reward_value_cents,
      'member_id', v_member.id,
      'redeemed_at', now()
    )
    WHERE id = p_order_id;

  -- Event log
  INSERT INTO marketing_events (event_type, subscriber_id, order_id, restaurant_id, linked, metadata)
    VALUES ('redeemed_reward', p_subscriber_id, p_order_id, p_restaurant_id, true,
            jsonb_build_object('reward_text', v_program.reward_text,
                               'value_cents', v_program.reward_value_cents));

  RETURN jsonb_build_object('success', true,
                            'reward_text', v_program.reward_text,
                            'value_cents', v_program.reward_value_cents);
END $$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION redeem_loyalty_reward TO anon, authenticated;
```

### Status-Lookup RPC (Anonym-fähig)

```sql
CREATE OR REPLACE FUNCTION get_loyalty_status(
  p_subscriber_id uuid,
  p_restaurant_id uuid
) RETURNS jsonb AS $$
  SELECT jsonb_build_object(
    'program', to_jsonb(lp.*),
    'member', to_jsonb(lm.*)
  )
  FROM loyalty_programs lp
  LEFT JOIN loyalty_members lm
    ON lm.restaurant_id = lp.restaurant_id AND lm.subscriber_id = p_subscriber_id
  WHERE lp.restaurant_id = p_restaurant_id AND lp.enabled = true;
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_loyalty_status TO anon, authenticated;
```

### Frontend-Komponenten

**1. Erweiterung `useLoyalty` Hook** (`app/components/bestellen/LoyaltyWidget.tsx`):

- Neuer Parameter: `subscriberId?: string` — kann aus Track-D Opt-In-State (LocalStorage `marketing_subscriber_id`) oder aus auth.user-Mapping kommen.
- Nutzt RPC `get_loyalty_status` statt direkten `loyalty_members` Query.
- `creditStamp` wird **entfernt** (jetzt Server-Trigger).
- Neue Funktion `redeemReward(orderId)` → wrappt RPC `redeem_loyalty_reward`.

**2. Checkout-Block** in BestellenV1, BestellenV2, OrderV1, OrderV2:

Neuer wiederverwendbarer Component `app/components/bestellen/LoyaltyRedeemBlock.tsx`:

```
┌──────────────────────────────────────────┐
│ ⭐ Du hast 10/10 Stempel!                │
│ [✓] Belohnung "Gratis-Getränk" einlösen │
│     (-4,00 €)                            │
└──────────────────────────────────────────┘
```

- Nur sichtbar wenn: Program enabled + Member existiert + `current >= goal`
- Toggle: lokales `applyReward: boolean` State
- Beim Submit-Flow:
  1. Order wird inserted (Track-D-Trigger setzt `customer_id`)
  2. Wenn `applyReward=true`: RPC `redeem_loyalty_reward(...)` aufrufen
  3. Bei Erfolg: UI-Total um `value_cents` reduzieren, Toast "✓ Belohnung eingelöst"
  4. Bei Fehler (`insufficient_balance` etc.): nicht-blockierende Warnung, Order bleibt bestehen

**3. Anonyme Sichtbarkeit:**

Wenn `subscriberId` aus LocalStorage kommt (Anon-Pfad):
- LoyaltyButton zeigt "★ N Punkte" statt "Anmelden"
- Card-Dropdown ist Read-Only (Profil-Tab nur für Eingeloggte)
- `Anmelden`-Hinweis bleibt für Anon-User mit Verweis "Anmelden, um über alle Restaurants zu sammeln"

**4. OrderV1 (Tisch-App V1) Angleichung:**

OrderV1 bekommt:
- `useLoyalty` Hook
- LoyaltyButton + LoyaltyBanner
- LoyaltyRedeemBlock im Checkout
→ Funktional identisch mit OrderV2.

### Owner-Dashboard: `/admin/marketing/loyalty`

Neue Seite mit drei Sektionen:

1. **Konfiguration** (Migration von `/admin/settings`):
   - `enabled`, `mechanic`, `goal`, `points_per_euro`, `reward_text`, `reward_value_cents`, `show_banner`, `email_link_enabled`
   - Live-Preview der Stempelkarte
2. **Mitglieder-Übersicht:**
   - Anzahl Members
   - Top 10 nach Punkten (mit Email + Anzahl Bestellungen aus `marketing_subscribers`)
3. **Statistiken:**
   - Eingelöste Rewards (Total + letzte 30 Tage)
   - Gesamtwert verschenkter Rewards (Sum `reward_value_cents`)

## Data Flow

```
Gast bestellt mit Opt-In
   │
   ▼
INSERT orders (customer_id wird durch Track-D-Trigger gesetzt)
   │
   ▼
Status: new ──► cooking ──► served
                              │
                              ▼ AFTER UPDATE Trigger
                          credit_loyalty_on_served()
                              │
                              ├─► UPSERT loyalty_members
                              ├─► UPDATE stamp_count/points
                              └─► INSERT marketing_events('loyalty_credited')

Gast bestellt erneut + Goal erreicht
   │
   ▼
Frontend: get_loyalty_status() ──► zeigt "Belohnung verfügbar"
   │
   ▼ Toggle aktiviert + Submit
INSERT orders
   │
   ▼
RPC redeem_loyalty_reward(subscriber_id, restaurant_id, order_id)
   │
   ├─► FOR UPDATE Lock auf loyalty_members
   ├─► Punkte abziehen, total_redeemed++
   ├─► orders.reward_applied SET
   └─► INSERT marketing_events('redeemed_reward')
```

## Error Handling

| Fehler | Verhalten |
|---|---|
| `no_program` (Loyalty disabled) | Frontend versteckt Block silently — kein User-facing Error |
| `no_member` (existiert nicht) | Sollte nicht passieren wenn Block sichtbar war. Frontend: Toast "Belohnung konnte nicht eingelöst werden" |
| `insufficient_balance` (Race-Lost) | Toast "Belohnung nicht mehr verfügbar — Bestellung wird normal verarbeitet"; Order behält vollen Preis |
| RPC-Netzwerkfehler | Toast "Bitte erneut versuchen"; Order ist bereits inserted, Reward kann manuell durch Owner später nachgetragen werden |
| Trigger-Fehler bei Status-Update | Order-Status-Update läuft trotzdem durch (Trigger-Exception wird im DB-Log gespeichert, aber kein User-blocking Error). |

## Testing-Strategie

**Unit-Tests:** Postgres-Funktionen via `psql` direkt aufgerufen.
- `credit_loyalty_on_served`: Status-Übergang, idempotenz beim doppelten Update, stamp vs. points
- `redeem_loyalty_reward`: insufficient_balance, parallele Calls via `pg_advisory_xact_lock` testen
- `get_loyalty_status`: anonym vs. registriert, ohne Program

**E2E-Verifikation (manuell):**
1. Tisch-App V2: Bestellung mit Opt-In → in Staff-Dashboard auf `served` → `loyalty_members.stamp_count` = 1
2. Wiederholen 9× → Goal erreicht
3. Bestellung 11: Toggle erscheint → aktivieren → Submit → `orders.reward_applied` gesetzt, `total_redeemed` = 1, `stamp_count` zurück auf 0
4. Online-App V1: gleicher Flow → muss identisch funktionieren
5. Race-Test: 2 Tabs parallel öffnen, gleichzeitig Reward einlösen → einer succeedet, einer kriegt `insufficient_balance` Toast

## Migration & Rollout

1. **Migration 058 deployen** — schema-additiv, kein Risiko (keine DROPs ausgenommen die UNIQUE-Constraint Ersetzung, die durch ON CONFLICT idempotent ist).
2. **Trigger aktivieren** — sofort live, beginnt Punkte zu vergeben.
3. **Frontend deployen** — Anon-Pfad funktioniert, sobald LocalStorage-Subscriber-ID gesetzt wird (passiert beim ersten Opt-In nach Deployment).
4. **Owner-Dashboard live** — Owner können Reward-Wert konfigurieren. Default 400 Cents (4€).
5. **Verifikations-Bestellung** wie oben im Testing-Block.

**Rollback-Plan:** Migration ist additiv. Bei Problemen: Trigger droppen (`DROP TRIGGER trg_loyalty_credit_on_served`), neue Spalten bleiben harmlos.

## Open Questions (für Plan-Phase, nicht Spec-blockierend)

- Wo genau in `LocalStorage` speichert das Bestellformular die `subscriber_id`? (Track D hat `customer_id` in Orders gesetzt, aber Client-State?). → Prüfen während Plan-Erstellung.
- `marketing_events.event_type` Enum: hat die DB einen CHECK-Constraint oder ist es Freitext? `loyalty_credited` muss ggf. zum Enum hinzugefügt werden. → Prüfen während Plan-Erstellung.
- `OrderV1` Branding/Style — wie weit weicht es von OrderV2 ab? Sollten wir die neuen Components in OrderV1 stil-anpassen oder den OrderV2-Look übernehmen? → Während Plan-Erstellung mit Branding-Spec abgleichen.
