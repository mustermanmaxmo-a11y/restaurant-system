# Track A2 — Google Reviews Automation

**Date:** 2026-05-25
**Status:** Approved
**Roadmap context:** Zweiter Sub-Track von Track A der Marketing-Macht Roadmap. Baut auf A1 (Trigger-Pattern bei `served`), Track D (sendEmail Queue, marketing_events) und nutzt Upstash QStash für exakte zeitversetzte Email-Auslieferung.

---

## Context

Eine umfangreiche Rating-Infrastruktur existiert bereits — sie ist nur nicht zu einem automatischen Flow verbunden:

- **`order_ratings` Tabelle** (Migration 031) — stars 1-5 + feedback text
- **`restaurants.google_review_url`** Spalte + Admin-Config Field
- **`OrderRating.tsx` Component** — nach Bestellung im Browser: bei 4-5 Sternen + URL direkt "Auf Google bewerten" Button
- **`/feedback/[orderId]?stars=X&t=token` Landing-Page** — empfängt Klicks aus Email-Rating-Links, leitet bei 4-5 Sternen zu Google weiter
- **`/api/feedback` Endpoint** — HMAC-tokenisierte Star-Klick-Verarbeitung
- **`ratingBlockHtml` in `automation-run/route.ts`** — fertige HTML-Komponente mit 5 anklickbaren Sternen (HMAC pro Stern)
- **Track D `sendEmail()` + `email_send_queue`** — robuste Email-Pipeline mit Retry + List-Unsubscribe Headers

**Was fehlt:** der **Trigger**, der nach jeder zufriedenstellenden Bestellung automatisch eine Rating-Email rausschickt — ohne dass der Restaurant-Owner manuell eine Automation erstellen oder den Cron-Plan tunen muss.

Heute muss der Owner manuell eine `post_order`-Automation in `/admin/marketing/automations` anlegen, deren Run ein Cron triggert. Das funktioniert für Massen-Newsletter, ist aber kein "Per-Order Auto-Trigger". A2 schließt diese Lücke.

## Goals

- **Set-and-forget für Owner:** Einmal aktivieren, delay-Stunden festlegen — danach läuft jede Rating-Email automatisch.
- **Exakte Auslieferung:** Email kommt genau X Stunden nach `status='served'`, nicht in einem 24h-Batch-Window.
- **Keine Doppelung:** Wenn Gast bereits in-app bewertet hat, keine Email. Wenn Email schon gesendet wurde, kein zweites Mal.
- **DSGVO-sicher:** Nur an `marketing_opt_in=true` Subscriber.
- **Architektur skaliert:** dieselbe Schedule-Mechanik kann später A3 Birthday + A4 Win-Back-Drip befeuern, ohne neue Infrastruktur.

## Non-Goals

- **Service-Recovery bei 1-3 Sternen** — eigener Sub-Track (A2b)
- **A/B-Tests verschiedener Subject-Lines / Templates** — späteres Polish
- **Multi-Channel (SMS, Push)** — nur Email
- **Custom Email-Template Editor** — Owner kann Inhalt nicht editieren (kommt mit später Template-Engine)
- **Multi-Restaurant Vergleich / Benchmarks im Stats-Dashboard** — pro-Restaurant Stats reichen; Cross-Restaurant kommt mit Platform-Level Analytics
- **Sub-Stunden-Delays** (z.B. 30 Min) — Range 1-72h reicht für Restaurant-Use-Case
- **Loyalty-übergreifende Rating-Aggregation** — jedes Restaurant isoliert

## Decisions

| Frage | Entscheidung | Begründung |
|---|---|---|
| Trigger-Event | `orders.status` Übergang zu `served` | Konsistent mit A1 Loyalty-Pattern, atomar mit der Staff-Aktion |
| Delay-Mechanismus | Upstash QStash (Per-Order delayed webhook) | Exakte Timing, kein Polling, Free Tier reicht, nutzt vorhandene Upstash-Verbindung |
| Delay-Config | `restaurants.rating_email_delay_hours int DEFAULT 4`, Range 1-72 | Restaurant-spezifisch (Café vs. Fine-Dining), keine Enum-Sackgasse |
| Empfänger-Kriterium | Nur opted_in marketing_subscribers | DSGVO-sicher |
| Dedup-Strategie | Skip wenn `order_ratings.order_id` existiert ODER `rating_email_sent_at IS NOT NULL` | Verhindert In-App-vs-Email Doppelung + Cron-Doppelläufe |
| Email-HTML | Refactor des bestehenden `ratingBlockHtml` aus `automation-run` in wiederverwendbare Helper-Function | DRY, beide Wege (Manual-Automation + Auto-Trigger) nutzen denselben Template-Code |

## Architecture

### Datenmodell (Migration 059)

```sql
-- orders: served_at + rating_email_sent_at für Schedule + Dedup
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS served_at timestamptz,
  ADD COLUMN IF NOT EXISTS rating_email_sent_at timestamptz;

-- restaurants: Owner-Config für Auto-Rating-Email
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS rating_email_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rating_email_delay_hours int DEFAULT 4
    CHECK (rating_email_delay_hours BETWEEN 1 AND 72);

CREATE INDEX IF NOT EXISTS idx_orders_served_at_pending_rating
  ON orders (served_at)
  WHERE served_at IS NOT NULL AND rating_email_sent_at IS NULL;
```

### Trigger-Erweiterung (kein neuer Trigger)

Der existierende A1-Trigger `credit_loyalty_on_served` bekommt **eine zusätzliche Zeile** am Anfang des `IF NEW.status='served'`-Blocks:

```sql
-- Set served_at timestamp (gleicher Status-Übergang wie Loyalty-Credit)
NEW.served_at := now();
```

Da der Trigger `BEFORE UPDATE` werden müsste damit `NEW.served_at` gesetzt wird, ohne separate UPDATE-Query — oder wir nutzen einen zweiten Trigger BEFORE, der nur `served_at` setzt, und der bestehende A1-Trigger AFTER UPDATE bleibt.

**Pragmatic choice:** separater BEFORE-Trigger nur für `served_at`, damit der A1-Loyalty-Trigger unverändert bleibt:

```sql
CREATE OR REPLACE FUNCTION set_served_at() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'served' AND OLD.status IS DISTINCT FROM 'served' THEN
    NEW.served_at := COALESCE(NEW.served_at, now());
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_served_at
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION set_served_at();
```

Beide Trigger feuern transaktional — entweder beide werden persistiert oder keiner.

### Scheduling-Layer (Application Code)

**Wo wird geplant:** Direkt in der App-Logik die `status='served'` setzt (vermutlich Staff-Dashboard API-Endpoint oder Server Action). Nach erfolgreicher UPDATE-Query wird `scheduleRatingEmail(orderId)` aufgerufen.

**`app/lib/marketing/qstash.ts`** — Wrapper um QStash Publish API:

```typescript
import { Client } from '@upstash/qstash'

const qstash = new Client({ token: process.env.QSTASH_TOKEN! })

export async function publishDelayedJob(args: {
  url: string
  body: Record<string, unknown>
  delaySeconds: number
  dedupeId?: string
}): Promise<{ messageId: string } | { error: string }> {
  try {
    const res = await qstash.publishJSON({
      url: args.url,
      body: args.body,
      delay: args.delaySeconds,
      deduplicationId: args.dedupeId,  // QStash dedup auf der API-Seite
    })
    return { messageId: res.messageId }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'unknown' }
  }
}
```

**`app/lib/marketing/scheduleRatingEmail.ts`** — High-level Function:

```typescript
import { supabaseAdmin } from '@/lib/supabase-admin'
import { publishDelayedJob } from './qstash'

export async function scheduleRatingEmail(orderId: string): Promise<void> {
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, restaurant_id, restaurants!inner(rating_email_enabled, rating_email_delay_hours)')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return
  const restaurant = (order.restaurants as unknown) as {
    rating_email_enabled: boolean
    rating_email_delay_hours: number
  }
  if (!restaurant.rating_email_enabled) return  // Owner hat's deaktiviert

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  await publishDelayedJob({
    url: `${appUrl}/api/jobs/send-rating-email`,
    body: { orderId },
    delaySeconds: restaurant.rating_email_delay_hours * 3600,
    dedupeId: `rating-email:${orderId}`,
  })
}
```

**`app/lib/marketing/ratingEmail.ts`** — Refactor des bestehenden `ratingBlockHtml` Codes aus `automation-run/route.ts`:

```typescript
import crypto from 'crypto'

export interface RatingEmailArgs {
  order: { id: string; customer_name?: string | null }
  restaurant: { name: string; logo_url: string | null; primary_color?: string | null }
  unsubscribeSecret: string
  appUrl: string
  unsubscribeUrl: string
}

export function buildRatingEmailHtml(args: RatingEmailArgs): {
  subject: string
  html: string
  text: string
} {
  // Build 5 HMAC-tokenized star links → /api/feedback?o=...&s=...&t=...
  // Wraps with logo header + greeting + stars block + footer + List-Unsubscribe note
  // Identical visual style to automation-run rating block
  // ...
}
```

### Webhook-Endpoint

**`app/app/api/jobs/send-rating-email/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifySignature } from '@upstash/qstash/nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail } from '@/lib/marketing/sendEmail'
import { buildRatingEmailHtml } from '@/lib/marketing/ratingEmail'

export const dynamic = 'force-dynamic'

async function handler(request: NextRequest) {
  const { orderId } = await request.json()

  // Load order + subscriber + restaurant
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select(`
      id, status, customer_id, customer_name, restaurant_id, rating_email_sent_at,
      restaurants!inner(name, logo_url, primary_color, rating_email_enabled),
      marketing_subscribers!orders_customer_id_fkey(id, email, opted_in)
    `)
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return NextResponse.json({ skipped: 'order_not_found' })

  // Conditions for sending
  if (order.status !== 'served') return NextResponse.json({ skipped: 'not_served' })
  if (order.rating_email_sent_at !== null) return NextResponse.json({ skipped: 'already_sent' })
  if (!order.customer_id) return NextResponse.json({ skipped: 'no_subscriber' })
  const subscriber = order.marketing_subscribers as unknown as { email: string; opted_in: boolean }
  if (!subscriber?.opted_in) return NextResponse.json({ skipped: 'not_opted_in' })
  const restaurant = (order.restaurants as unknown) as { rating_email_enabled: boolean; name: string; logo_url: string | null; primary_color: string | null }
  if (!restaurant.rating_email_enabled) return NextResponse.json({ skipped: 'feature_disabled' })

  // Dedup: skip if already rated in-app
  const { count: ratingCount } = await supabaseAdmin
    .from('order_ratings')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId)
  if ((ratingCount ?? 0) > 0) return NextResponse.json({ skipped: 'already_rated' })

  // Build + send
  const { subject, html, text } = buildRatingEmailHtml({
    order: { id: order.id, customer_name: order.customer_name },
    restaurant,
    unsubscribeSecret: process.env.UNSUBSCRIBE_SECRET ?? 'fallback',
    appUrl: process.env.NEXT_PUBLIC_APP_URL!,
    unsubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/unsubscribe?email=${encodeURIComponent(subscriber.email)}`,
  })

  await sendEmail({
    to: subscriber.email,
    subject,
    html,
    text,
    immediate: false,  // queue-based — Track D Sender handles retry
    restaurantId: order.restaurant_id,
    subscriberId: order.customer_id,
  })

  // Mark sent
  await supabaseAdmin
    .from('orders')
    .update({ rating_email_sent_at: new Date().toISOString() })
    .eq('id', orderId)

  // Log event
  await supabaseAdmin.from('marketing_events').insert({
    restaurant_id: order.restaurant_id,
    subscriber_id: order.customer_id,
    event_type: 'rating_email_sent',
    props: { order_id: orderId, delay_hours: undefined /* could compute from served_at */ },
  })

  return NextResponse.json({ sent: true })
}

// QStash signature verification wrapper
export const POST = verifySignature(handler)
```

### Owner-UI

Zwei Touchpoints — analog zur A1-Trennung (`/admin/settings` = Mini-Link, `/admin/marketing/loyalty` = Hauptseite):

**1. Mini-Sektion in `app/app/admin/settings/page.tsx`** — nur Toggle + Delay + Link zur Hauptseite. Bleibt eng beim bestehenden `google_review_url` Feld, weil das thematisch verwandt ist.

```tsx
<section>
  <h2>Google Reviews</h2>

  {/* Existierendes google_review_url Feld bleibt */}
  <label>Google Reviews URL
    <input type="text" value={restaurant.google_review_url ?? ''} onChange={...} />
  </label>

  {/* Neue Auto-Email-Config */}
  <label>
    <input type="checkbox" checked={restaurant.rating_email_enabled} onChange={...} />
    Automatisch Bewertungs-Email senden
  </label>

  <label>Delay (Stunden nach 'serviert')
    <input type="number" min={1} max={72} value={restaurant.rating_email_delay_hours} onChange={...} />
    <small>Default 4h. Pizzerien: 2h. Fine-Dining: 24h.</small>
  </label>

  <a href="/admin/marketing/reviews">→ Reviews-Dashboard öffnen</a>
</section>
```

**2. Neue Hauptseite `app/app/admin/marketing/reviews/page.tsx`** — vollständiges Stats-Dashboard:

```tsx
<div>
  <h1>⭐ Google Reviews</h1>

  {/* Stats-Tiles (letzte 30 Tage) */}
  <section>
    <h2>Letzte 30 Tage</h2>
    <Grid>
      <StatTile label="Rating-Emails verschickt" value={stats.emails_sent} />
      <StatTile label="Bewertungen erhalten" value={stats.ratings_received} />
      <StatTile label="Davon 4-5 Sterne" value={stats.positive_ratings} subline={`${stats.positive_percent}%`} />
      <StatTile label="Klicks auf Google-Button" value={stats.google_clicks} />
    </Grid>
  </section>

  {/* Sternverteilung */}
  <section>
    <h2>Sternverteilung (letzte 30 Tage)</h2>
    <BarChart data={[
      { stars: 5, count: stats.by_stars[5] },
      { stars: 4, count: stats.by_stars[4] },
      { stars: 3, count: stats.by_stars[3] },
      { stars: 2, count: stats.by_stars[2] },
      { stars: 1, count: stats.by_stars[1] },
    ]} />
  </section>

  {/* Letzte 10 Bewertungen mit Feedback-Text */}
  <section>
    <h2>Letzte Bewertungen mit Feedback</h2>
    <table>
      <thead><tr><th>Datum</th><th>Sterne</th><th>Feedback</th></tr></thead>
      <tbody>
        {recentFeedback.map(r => (
          <tr><td>{formatDate(r.created_at)}</td><td>{'⭐'.repeat(r.stars)}</td><td>{r.feedback}</td></tr>
        ))}
      </tbody>
    </table>
  </section>

  {/* Konfig-Shortcut */}
  <a href="/admin/settings">→ Auto-Email-Einstellungen ändern</a>
</div>
```

Stats werden bei Page-Load berechnet:
- `emails_sent` = COUNT WHERE `marketing_events.event_type='rating_email_sent'` AND `occurred_at > now() - 30 days`
- `ratings_received` = COUNT FROM `order_ratings` WHERE `restaurant_id=?` AND `created_at > now() - 30 days`
- `positive_ratings` = COUNT FROM `order_ratings` WHERE `stars >= 4` AND `created_at > now() - 30 days`
- `positive_percent` = `positive_ratings / ratings_received * 100` (gerundet)
- `google_clicks` = COUNT WHERE `marketing_events.event_type='google_review_clicked'` AND `occurred_at > now() - 30 days` — **Hinweis:** dieser Event existiert heute nicht; A2 muss ihn beim Klick auf den Google-Button in `/feedback/[orderId]` und in der OrderRating-Komponente schreiben (kleine Erweiterung).
- `by_stars[N]` = COUNT FROM `order_ratings` WHERE `stars=N` AND `created_at > now() - 30 days`
- `recentFeedback` = SELECT * FROM `order_ratings` WHERE `feedback IS NOT NULL` ORDER BY `created_at DESC` LIMIT 10

### ENV-Variablen (Setup einmalig)

```
QSTASH_TOKEN=                  # from Upstash QStash dashboard
QSTASH_CURRENT_SIGNING_KEY=    # for webhook signature verification
QSTASH_NEXT_SIGNING_KEY=       # for rotation grace period
NEXT_PUBLIC_APP_URL=https://...  # bereits da
UNSUBSCRIBE_SECRET=...           # bereits da (via platform_settings.unsubscribe_secret)
```

## Data Flow

```
Staff klickt "Serviert" im Dashboard
   │
   ▼
UPDATE orders SET status='served' WHERE id=...
   ├─► BEFORE Trigger trg_set_served_at: NEW.served_at = now()
   ├─► AFTER Trigger trg_loyalty_credit_on_served: A1 Loyalty-Punkte
   │
   ▼ (Server Action / API Handler unmittelbar danach)
scheduleRatingEmail(orderId)
   │
   ├─► Lookup restaurant.rating_email_enabled
   │   ├─► Wenn false: kein Schedule
   │   └─► Wenn true: QStash publish
   │       └─► POST https://qstash.upstash.io/v2/publish/...
   │           body={orderId}, delay=4*3600s, dedupId='rating-email:<orderId>'
   │
   ... 4 Stunden später ...
   │
   ▼ QStash POSTet
/api/jobs/send-rating-email
   │
   ├─► verifySignature() — sonst 401
   ├─► Load order + subscriber + restaurant
   ├─► Skip-Checks: not_served / already_sent / no_subscriber / not_opted_in / feature_disabled / already_rated
   ├─► buildRatingEmailHtml() → subject + html + text
   ├─► sendEmail({ immediate: false }) — queued (Track D)
   ├─► UPDATE orders SET rating_email_sent_at = now()
   └─► INSERT marketing_events('rating_email_sent')

Track D queue worker pickt Email aus email_send_queue
   │
   ▼
Email kommt beim Gast an
   │
   ▼ Gast klickt 4-5 Sterne
/api/feedback?o=...&s=5&t=...
   │
   ├─► HMAC verify
   ├─► UPSERT order_ratings (stars=5)
   └─► Redirect zu /feedback/<orderId>?stars=5
       │
       ▼
   Page zeigt "Auf Google bewerten" Button (mit google_review_url) — Gast klickt
   → Google-Review-Seite öffnet sich → Google-Reviews-Count steigt
```

## Error Handling

| Szenario | Verhalten |
|---|---|
| `scheduleRatingEmail` schlägt fehl (Network, QStash down) | Error logged, Order/Loyalty-Flow unbeeinträchtigt. Manueller Re-Schedule via Admin-Tool später möglich. |
| Order wird nach Schedule storniert (`status='cancelled'`) | Webhook checkt `order.status !== 'served'` → skip silently |
| Owner ändert `delay_hours` nach Schedule | Bestehende Jobs laufen mit altem Delay durch, neuer Delay gilt erst für nächste Bestellungen |
| Owner deaktiviert `rating_email_enabled` nach Schedule | Webhook checkt `restaurant.rating_email_enabled` → skip silently |
| Subscriber abbestellt zwischen Schedule und Webhook-Fire | Webhook checkt `opted_in` → skip |
| QStash retry'd nach Webhook-5xx | QStash macht 3 Retries automatisch; nach finalem Fail Dead-Letter-Queue im Upstash Dashboard (Owner kann dort manuell re-driven) |
| QStash Token rotiert | `QSTASH_CURRENT_SIGNING_KEY` + `QSTASH_NEXT_SIGNING_KEY` decken Grace-Period ab |
| `rating_email_sent_at` race (zwei Webhooks gleichzeitig — shouldn't happen mit dedupeId, aber...) | Sender check + Dedup-Index verhindert echte Doppel-Sendung; im schlimmsten Fall 2 identische Emails an Gast (sehr selten) |

## Testing-Strategie

**Unit-Tests:** Postgres-Funktion `set_served_at` via psql.

**Integration-Tests:**
1. `scheduleRatingEmail(orderId)` — mit/ohne `rating_email_enabled`, mit/ohne customer_id
2. `buildRatingEmailHtml(args)` — Snapshot des HTML-Output
3. Webhook `/api/jobs/send-rating-email` — mit/ohne valid signature, alle Skip-Conditions durchspielen

**E2E (manuell):**
1. Order placed mit Opt-In → status=served setzen → Vercel Logs zeigen `scheduleRatingEmail` Call → QStash Dashboard zeigt scheduled Message
2. Schnell-Test mit `delay_hours=1` (=1 Stunde warten) → Email kommt im Posteingang an
3. Gast klickt 5 Sterne → /feedback Page → Google-Bewertungs-Button erscheint
4. Negativ-Test: vor dem Klick `rating_email_sent_at` manuell auf NOW() setzen → Webhook returnt `skipped: already_sent`
5. Dedup-Test: in-app 4 Sterne klicken → `order_ratings` Eintrag entsteht → 1h später (delay) sendet QStash → Webhook returnt `skipped: already_rated`

## Migration & Rollout

1. **ENV-Setup** (User-Schritt): Upstash QStash aktivieren, Tokens in Vercel ENV einfügen
2. **Migration 059 deployen** — Spalten + BEFORE-Trigger
3. **NPM-Install:** `@upstash/qstash` Package
4. **Code deployen** — neue Files + Erweiterungen
5. **Test-Restaurant aktivieren** — `rating_email_enabled=true` + `rating_email_delay_hours=1` (für schnellen Test)
6. **E2E-Verifikation** wie oben
7. **Default-Wert für Bestandskunden:** `rating_email_enabled=false` (Owner muss aktiv einschalten — kein Surprise-Mailing)

## Open Questions (für Plan-Phase, nicht Spec-blockierend)

- **Wo genau wird `status='served'` UPDATE gemacht?** Wahrscheinlich in einer Staff-Dashboard API-Route oder Server Action — muss bei Plan-Erstellung gegrep't werden, damit der `scheduleRatingEmail`-Call dort eingebaut werden kann.
- **`marketing_subscribers.opted_in` Feldname** — Track D nutzte `opted_in` oder `subscribed`? Beim Plan verifizieren.
- **`@upstash/qstash` Version** — neueste stable verwenden, ggf. Breaking-Changes prüfen.
- **`buildRatingEmailHtml` Refactor:** existierender `ratingBlockHtml` Code in `automation-run/route.ts` Zeile ~368-381 ist eng mit dem dortigen Template-System verwoben — Extraktion sauber machen, beide Call-Sites müssen funktionieren.
- **`google_review_clicked` Event-Tracking:** Stats-Dashboard zeigt "Klicks auf Google-Button" — dieser Event existiert heute nicht. Bei Plan-Erstellung 2 Call-Sites identifizieren: `OrderRating.tsx` (in-app Klick) und `app/feedback/[orderId]/FeedbackClient.tsx` (Email-Landing-Klick). Beide müssen einen `marketing_events.insert` mit `event_type='google_review_clicked'` machen — vermutlich via fire-and-forget Endpoint `/api/events/track` (oder direkter Supabase RPC, je nach RLS-Stand).
