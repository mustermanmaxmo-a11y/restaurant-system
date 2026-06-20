# Mitarbeiten an RestaurantOS

Gemeinsame Spielregeln für alle, die an diesem Projekt arbeiten (Menschen **und** Claude-Code-Instanzen). Kurz halten, dran halten — das spart Merge-Konflikte und kaputte Deploys.

> Die KI-Regeln stehen in `CLAUDE.md` (im Repo-Root) — jede Claude-Code-Instanz liest die automatisch. Diese Datei hier ist für den *Workflow*.

---

## Projektaufbau

```
app/            ← die eigentliche App: Next.js 16 (App Router) + TypeScript + Tailwind
supabase/migrations/   ← SQL-Migrationen (Postgres)
docs/superpowers/      ← specs/ (Designs) + plans/ (Implementierungspläne)
wordpress/ · n8n/ · backend/ · frontend/   ← Hilfs-/Altbereiche
```
**Wichtig:** `npm`-Befehle laufen aus dem Ordner **`app/`**, nicht aus dem Repo-Root.

---

## Lokales Setup

1. Repo klonen, dann:
   ```bash
   cd app
   npm install
   ```
2. Datei `app/.env.local` anlegen (ist gitignored — kommt **nie** ins Repo). Die Werte bekommst du vom Team (Passwort-Manager o.ä.), **nicht** per Klartext-Chat.

   **Minimal nötig für lokale Entwicklung:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ANTHROPIC_API_KEY=...            # für die KI-Features
   ```
   **Optional je nach Bereich** (Zahlungen, Mails, Caching, Push, POS, Marketing):
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CLIENT_ID`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`,
   `RESEND_API_KEY`, `RESEND_FROM`,
   `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `QSTASH_URL`, `QSTASH_TOKEN`,
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`,
   `SUMUP_WEBHOOK_SECRET`, `ZETTLE_WEBHOOK_SECRET`, `SQUARE_WEBHOOK_SIGNATURE_KEY`,
   `CRON_SECRET`, `EMAIL_API_SECRET`, `MARKETING_AUTOMATION_SECRET`, `MARKETING_TRACKING_SECRET`,
   `N8N_WEBHOOK_SECRET`, `PUSH_WEBHOOK_SECRET`, `UNSUBSCRIBE_SECRET`, `FAL_API_KEY`, `KLING_API_KEY`.
3. Starten: `npm run dev` → http://localhost:3000

> `.env.local` niemals lesen/commiten/teilen über unsichere Kanäle. Vor Go-Live werden ohnehin alle Keys rotiert.

---

## Zugänge

- **GitHub:** Als Collaborator mit **Write** (Repo → Settings → Collaborators). Dann Branches pushen + PRs öffnen.
- **Supabase:** Zugriff gilt **pro Organization**, nicht pro Projekt. Mitglied der geteilten Org = Zugriff auf **alle** Projekte dieser Org. Solo-Projekte daher in eine **separate** Org legen. (Org-Mitglieder: Organization Settings → Team.)
- **Vercel:** Deploys laufen automatisch; pro PR gibt es eine Preview-URL. Dashboard-Zugriff braucht ein (kostenpflichtiges) Vercel-Team — für reine Entwicklung nicht nötig.

---

## Branch- & PR-Workflow

- **Nie direkt auf `main` committen.** Immer ein Feature-Branch:
  - `feat/<kurz>` neue Funktion · `fix/<kurz>` Bugfix · `refactor/<kurz>` · `chore/<kurz>` · `docs/<kurz>`
- Arbeiten → committen → `git push -u origin <branch>` → **Pull Request** gegen `main`.
- **Vor dem Merge muss `npm run build` (aus `app/`) grün sein.**
- Commit-Nachrichten im Conventional-Style (`feat(scope): …`, `fix(scope): …`). Bei KI-Hilfe ans Ende:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```

---

## Datenbank-Migrationen

- Liegen in `supabase/migrations/`, Namensschema: `YYYYMMDD_NNN_beschreibung.sql` (fortlaufende `NNN`).
- **Vor dem Schreiben kurz abstimmen, welche Nummer du nimmst** — nicht zwei Leute dieselbe `NNN`. (Aktuell höchste Nummer per `ls supabase/migrations | sort | tail -1` prüfen.)
- **Idempotent** schreiben: `CREATE TABLE IF NOT EXISTS`, `DROP … IF EXISTS`, `ON CONFLICT DO NOTHING`, `ADD COLUMN IF NOT EXISTS`.
- **Bei neuen Tabellen immer GRANTs** für `anon`, `authenticated`, `service_role` setzen (sonst greift die App nicht zu) — und RLS aktivieren/Policies definieren.
- **Ausführen:** Supabase-Dashboard → SQL Editor → Inhalt einfügen → Run. **Erst gegen eine Prod-Kopie/Branch testen**, dann Prod. Migrationen laufen (noch) nicht automatisch beim Deploy.

---

## Build & Tests

- **Build / Typecheck:** `npm run build` (aus `app/`). Schlägt der Build fehl, ist meist ein Typfehler oder eine tote Referenz die Ursache.
- **Unit-Tests:** `npm test` (vitest). Aktuell vor allem für `lib/resolve-brand.ts`. Neue pure Funktionen gern mit Tests absichern.
- Es gibt (noch) kein E2E-Framework — visuelle Änderungen nach Deploy kurz manuell prüfen.

---

## Wichtige Projekt-Konventionen (nicht kaputt machen)

- **Brand/Design:** `restaurants.design_config` (jsonb) ist die **einzige** Design-Quelle. Gast-Flächen lesen Design über `lib/resolve-brand.ts` (`resolveBrand`). Farben/Fonts nicht hart kodieren.
- **Öffentliche Server-Seiten, die den Brand rendern, brauchen** `export const dynamic = 'force-dynamic'` — sonst cached Next.js eine veraltete Farbe (Vorbild: `app/app/bestellen/[slug]/page.tsx`).
- **Ein Design-System:** Das frühere V1/V2-System wurde entfernt — es gibt nur noch eine Generation.

---

## Mit Claude Code arbeiten

- `CLAUDE.md` = gemeinsame Regeln, wird automatisch gelesen.
- Ablauf für größere Features: **Brainstorm → Spec** (`docs/superpowers/specs/`) **→ Plan** (`docs/superpowers/plans/`) **→ Umsetzung** (Branch/PR). Bestehende Specs/Pläne dort als Vorbild nutzen.

---

## Bereichsaufteilung

> _Wer welchen Bereich besitzt, wird noch final festgelegt._ Bis dahin: **vorher kurz absprechen, wer woran arbeitet**, damit ihr nicht gleichzeitig dieselben Dateien ändert.
