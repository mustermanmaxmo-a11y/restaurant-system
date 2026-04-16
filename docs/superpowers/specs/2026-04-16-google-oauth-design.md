# Google OAuth — Design Spec

**Date:** 2026-04-16  
**Status:** Approved

## Ziel

Google-Login auf allen drei Restaurant-Auth-Seiten einführen, damit sich Inhaber schneller registrieren und einloggen können — kein Passwort nötig.

---

## Betroffene Seiten

| Route | Ziel nach Login |
|---|---|
| `/owner-login` | `/admin` |
| `/register` | `/admin/setup` |
| `/platform-login` | `/platform` |

---

## Architektur

### GoogleAuthButton Component
- Datei: `app/components/ui/google-auth-button.tsx`
- Props: `redirectTo: string`, `label?: string`
- Ruft `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })` auf
- Icon: `FcGoogle` aus `react-icons/fc`
- Styling: passt zum bestehenden Dark-Theme (var(--surface), var(--border), var(--text))

### OAuth Callback
- `/auth/callback/route.ts` — bereits vorhanden, unterstützt PKCE
- Liest `?next=` Query-Param für das Redirect-Ziel
- Owner-Login & Register: `redirectTo` → `{origin}/auth/callback?next=/admin`
- Platform-Login: `redirectTo` → `{origin}/auth/callback?next=/platform`

### Platform-Login Sonderfall
- Nach Google OAuth landet der User auf `/platform`
- `/platform/page.tsx` hat bereits einen Auth-Guard — dieser übernimmt den `is_platform_owner` Check
- Kein separater Callback nötig

### Register + AGB
- Google OAuth überspringt die AGB-Checkbox
- Lösung: Hinweis-Text unter dem Google Button: _"Mit Google fortfahren bedeutet, dass du unsere AGB und Datenschutzerklärung akzeptierst."_

---

## Abhängigkeiten

- `react-icons` installieren (`npm install react-icons`)
- Google OAuth Provider in Supabase Dashboard aktivieren (einmalig, manuell)

---

## Was NICHT gemacht wird

- Kein neuer Callback-Route
- Keine Änderung am Staff-PIN-Login (`/login`)
- Keine shadcn `Button`/`Input` Migration (bestehende Styles bleiben)
