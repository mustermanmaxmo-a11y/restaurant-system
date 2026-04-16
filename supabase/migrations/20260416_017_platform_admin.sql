-- ============================================================
-- PLATFORM ADMIN — User-Rollen, Legal-CMS, RLS-Gating
-- Run in Supabase SQL Editor after 20260415_016_rls_harden.sql
-- ============================================================

-- ── 1. USER ROLES ────────────────────────────────────────────
create table if not exists public.user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('platform_owner')),
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

-- Nur der User selbst kann seine eigene Rolle lesen (keine Enumeration)
drop policy if exists "user_roles_self_select" on public.user_roles;
create policy "user_roles_self_select" on public.user_roles
  for select using (user_id = auth.uid());

-- Kein anon/authenticated write — Rollen werden manuell per SQL vergeben
-- (kein Insert/Update/Delete policy = default deny)


-- ── 2. HELPER: is_platform_owner() ───────────────────────────
-- SECURITY DEFINER umgeht RLS-Rekursion beim Lesen der user_roles Tabelle.
create or replace function public.is_platform_owner()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'platform_owner'
  );
$$;

grant execute on function public.is_platform_owner() to authenticated;
grant execute on function public.is_platform_owner() to anon;


-- ── 3. LEGAL DOCUMENTS (CMS) ─────────────────────────────────
create table if not exists public.legal_documents (
  key         text primary key check (key in ('agb','datenschutz','impressum','cookie_banner')),
  content     text not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id)
);

alter table public.legal_documents enable row level security;

-- Öffentlich lesbar (Legal-Seiten sind öffentlich)
drop policy if exists "legal_documents_public_read" on public.legal_documents;
create policy "legal_documents_public_read" on public.legal_documents
  for select using (true);

-- Nur platform_owner schreibt
drop policy if exists "legal_documents_owner_all" on public.legal_documents;
create policy "legal_documents_owner_all" on public.legal_documents
  for all using (public.is_platform_owner())
  with check (public.is_platform_owner());


-- ── 4. PLATFORM-OWNER READ-ACCESS auf restaurants ────────────
-- Erweitert das bestehende owner_id-Gating um platform_owner-Durchgriff.
drop policy if exists "restaurants_platform_owner_select" on public.restaurants;
create policy "restaurants_platform_owner_select" on public.restaurants
  for select using (public.is_platform_owner());

-- Platform-Owner darf Trial verlängern / active togglen (über DB)
drop policy if exists "restaurants_platform_owner_update" on public.restaurants;
create policy "restaurants_platform_owner_update" on public.restaurants
  for update using (public.is_platform_owner())
  with check (public.is_platform_owner());


-- ── 5. SEEDS: Legal-Dokumente ────────────────────────────────
-- HTML-Inhalt wird im Frontend per dangerouslySetInnerHTML gerendert.
-- Platform-Owner editiert diese Inhalte über /platform/legal.
-- Inhalte basieren auf den aktuell statischen Seiten und werden später
-- durch David im Editor finalisiert (Platzhalter in eckigen Klammern).

insert into public.legal_documents (key, content) values
  ('cookie_banner',
'Diese Seite verwendet nur technisch notwendige Cookies für Login und Einstellungen. Keine Tracking- oder Marketing-Cookies. <a href="/datenschutz">Mehr erfahren</a>'
  ),
  ('impressum',
'<h2>Anbieter</h2>
<p><strong>[DEIN NAME / FIRMENNAME]</strong><br>
[STRASSE] [HAUSNUMMER]<br>
[PLZ] [ORT]<br>
Deutschland</p>

<h2>Kontakt</h2>
<p>E-Mail: [DEINE@EMAIL.DE]<br>
Telefon: [+49 XXX XXXXXXX]</p>

<h2>Unternehmensform &amp; Register</h2>
<p>Rechtsform: [z.B. Einzelunternehmen / GmbH / UG]<br>
Handelsregister: [z.B. HRB 12345, Amtsgericht Stadt] — oder: Nicht eingetragen<br>
USt-IdNr.: [z.B. DE123456789] — oder: Kleinunternehmerregelung § 19 UStG</p>

<h2>Inhaltlich verantwortlich</h2>
<p>Verantwortlich für den Inhalt gemäß § 18 Abs. 2 MStV:<br>
<strong>[DEIN NAME]</strong><br>
[STRASSE] [HAUSNUMMER], [PLZ] [ORT]</p>

<h2>Haftungsausschluss</h2>
<p><strong>Haftung für Inhalte:</strong> Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen.</p>
<p><strong>Haftung für Links:</strong> Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen Einfluss haben. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.</p>

<h2>Online-Streitbeilegung</h2>
<p>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr</a>. Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>'
  ),
  ('datenschutz',
'<p><em>Stand: April 2026</em></p>

<h2>1. Verantwortlicher</h2>
<p>Verantwortlicher im Sinne der DSGVO (Art. 4 Nr. 7 DSGVO) ist:<br>
<strong>[DEIN NAME / FIRMENNAME]</strong><br>
[STRASSE HAUSNUMMER], [PLZ ORT]<br>
E-Mail: [DEINE@EMAIL.DE]</p>

<h2>2. Welche Daten wir verarbeiten und warum</h2>
<h3>2.1 Restaurantbetreiber (Kunden unserer SaaS-Plattform)</h3>
<p>Bei der Registrierung und Nutzung der Plattform verarbeiten wir:</p>
<ul>
  <li>E-Mail-Adresse und Passwort (Konto-Erstellung, Login)</li>
  <li>Restaurantname, URL-Slug (Einrichtung des Restaurants)</li>
  <li>Zahlungsdaten über Stripe (Abonnement-Verwaltung) — wir speichern keine Kreditkartendaten selbst</li>
  <li>IP-Adresse und Geräteinformationen (Sicherheit, Logs)</li>
</ul>
<p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung), Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Sicherheit).</p>

<h3>2.2 Gäste (Endkunden der Restaurants)</h3>
<p>Wenn Gäste über unsere Plattform bestellen oder reservieren, verarbeiten wir im Auftrag des jeweiligen Restaurants: Name, Telefonnummer, E-Mail (optional), Lieferadresse (nur bei Lieferbestellungen), Bestellinhalt, Bestellzeitpunkt, Gesamtbetrag, Reservierungsdaten.</p>
<p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO. Der jeweilige Restaurantbetreiber ist für die Verarbeitung dieser Daten selbst verantwortlich. RestaurantOS handelt dabei als Auftragsverarbeiter gemäß Art. 28 DSGVO.</p>

<h2>3. Auftragsverarbeiter und Drittanbieter</h2>
<p>Wir setzen folgende Dienstleister ein, mit denen Auftragsverarbeitungsverträge (AVV) gemäß Art. 28 DSGVO geschlossen wurden:</p>
<ul>
  <li><strong>Supabase</strong> (Datenbank &amp; Auth) — Singapur, Daten in EU (Frankfurt, AWS eu-central-1). <a href="https://supabase.com/privacy" target="_blank" rel="noopener">supabase.com/privacy</a></li>
  <li><strong>Stripe</strong> (Zahlungsabwicklung) — Irland. <a href="https://stripe.com/de/privacy" target="_blank" rel="noopener">stripe.com/de/privacy</a></li>
  <li><strong>Resend</strong> (E-Mail-Versand) — USA. Datenübertragung auf Basis SCC. <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener">resend.com/legal/privacy-policy</a></li>
  <li><strong>Hosting: [VERCEL ODER NETLIFY EINTRAGEN]</strong> — Datenübertragung USA auf Basis SCC.</li>
</ul>

<h2>4. Speicherdauer</h2>
<ul>
  <li>Kontodaten von Restaurantbetreibern: Bis Kündigung + 30 Tage Kulanzfrist</li>
  <li>Bestellungen und Reservierungen: 3 Jahre (handels- und steuerrechtliche Aufbewahrungspflichten § 257 HGB, § 147 AO)</li>
  <li>Zahlungsdaten bei Stripe: Gemäß Stripe-Datenschutzrichtlinie (i.d.R. 7 Jahre)</li>
  <li>Server-Logs: 30 Tage</li>
</ul>

<h2>5. Cookies und lokale Speicherung</h2>
<p>Unsere Anwendung setzt technisch notwendige Cookies und localStorage-Einträge für die Authentifizierung (Supabase Auth Session). Diese sind für den Betrieb der Plattform zwingend erforderlich und bedürfen keiner gesonderten Einwilligung (Art. 6 Abs. 1 lit. b DSGVO). Wir setzen keine Marketing- oder Tracking-Cookies ein.</p>

<h2>6. Deine Rechte als betroffene Person</h2>
<p>Gemäß DSGVO stehen dir folgende Rechte zu: Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20), Widerspruch (Art. 21), Widerruf (Art. 7 Abs. 3).</p>
<p>Zur Ausübung deiner Rechte wende dich an: [DEINE@EMAIL.DE]</p>

<h2>7. Beschwerderecht bei einer Aufsichtsbehörde</h2>
<p>Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO). Liste aller deutschen Aufsichtsbehörden: <a href="https://www.bfdi.bund.de/DE/Infothek/Anschriften_Links/anschriften_links-node.html" target="_blank" rel="noopener">bfdi.bund.de</a></p>

<h2>8. Datensicherheit</h2>
<p>Wir setzen technische und organisatorische Maßnahmen ein: verschlüsselte Übertragung via HTTPS/TLS, Row-Level Security in der Datenbank, gehashte Passwörter, Zugriffskontrolle nach dem Prinzip der minimalen Rechte.</p>

<h2>9. Änderungen dieser Datenschutzerklärung</h2>
<p>Wir behalten uns vor, diese Datenschutzerklärung bei Bedarf anzupassen. Die jeweils aktuelle Version ist auf dieser Seite abrufbar. Bei wesentlichen Änderungen informieren wir registrierte Nutzer per E-Mail.</p>'
  ),
  ('agb',
'<p><em>Stand: April 2026</em></p>

<h2>1. Geltungsbereich</h2>
<p>Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für die Nutzung der SaaS-Plattform RestaurantOS (nachfolgend „Plattform") sowie für alle über die Plattform abgewickelten Bestellungen und Reservierungen. Anbieter der Plattform ist der im Impressum genannte Betreiber.</p>
<p>Durch die Registrierung oder Nutzung der Plattform erklärst du dich mit diesen AGB einverstanden.</p>

<h2>2. Leistungsbeschreibung</h2>
<p>RestaurantOS stellt Restaurantbetreibern eine digitale Infrastruktur bereit, die folgende Funktionen umfasst:</p>
<ul>
  <li>QR-Code-basierte Speisekarten und Bestellsysteme für Gäste</li>
  <li>Echtzeit-Bestellverwaltung für Restaurantpersonal</li>
  <li>Tischreservierungssystem</li>
  <li>Analyse- und Berichtsfunktionen</li>
  <li>Zahlungsabwicklung über Stripe</li>
</ul>
<p>Die Plattform wird als Software-as-a-Service (SaaS) bereitgestellt. Ein Anspruch auf eine bestimmte Verfügbarkeit besteht nicht, wir streben jedoch eine Verfügbarkeit von mindestens 99 % an.</p>

<h2>3. Registrierung und Nutzerkonto</h2>
<p>Für die Nutzung als Restaurantbetreiber ist eine Registrierung erforderlich. Du verpflichtest dich, bei der Registrierung wahrheitsgemäße Angaben zu machen und diese aktuell zu halten.</p>
<p>Du bist für die Sicherheit deiner Zugangsdaten verantwortlich. Bei unbefugtem Zugriff auf dein Konto bist du verpflichtet, uns unverzüglich zu informieren.</p>

<h2>4. Abonnement und Preise</h2>
<p>Die Nutzung der Plattform erfolgt gegen ein monatliches oder jährliches Abonnement. Die aktuellen Preise sind auf der Preisseite einsehbar.</p>
<p>Abonnements verlängern sich automatisch um den gewählten Zeitraum, sofern sie nicht vor Ablauf der Laufzeit gekündigt werden. Die Kündigung ist jederzeit zum Ende des laufenden Abrechnungszeitraums möglich.</p>
<p>Zahlungen werden über Stripe abgewickelt. Es gelten zusätzlich die Nutzungsbedingungen von Stripe. Preisänderungen werden mindestens 30 Tage im Voraus per E-Mail mitgeteilt.</p>

<h2>5. Pflichten der Restaurantbetreiber</h2>
<p>Als Restaurantbetreiber bist du verantwortlich für:</p>
<ul>
  <li>Die Richtigkeit der auf der Plattform eingestellten Speisekarten, Preise und Informationen</li>
  <li>Die Einhaltung aller lebensmittelrechtlichen Kennzeichnungspflichten (Allergene etc.)</li>
  <li>Die korrekte Abwicklung von Bestellungen und Reservierungen gegenüber deinen Gästen</li>
  <li>Die Einhaltung datenschutzrechtlicher Pflichten gegenüber deinen Gästen (du bist Verantwortlicher im Sinne der DSGVO)</li>
  <li>Die Verwendung der Plattform ausschließlich für legale Zwecke</li>
</ul>

<h2>6. Gastbestellungen und Reservierungen</h2>
<p>Bestellungen und Reservierungen, die Gäste über die Plattform aufgeben, kommen ausschließlich zwischen dem Gast und dem jeweiligen Restaurantbetreiber zustande. RestaurantOS ist kein Vertragspartner dieser Bestellungen.</p>

<h2>7. Haftung</h2>
<p>Wir haften unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit.</p>
<p>Bei leichter Fahrlässigkeit haften wir nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten). In diesem Fall ist die Haftung auf den vorhersehbaren, vertragstypischen Schaden begrenzt.</p>
<p>Eine weitergehende Haftung ist ausgeschlossen. Insbesondere haften wir nicht für Umsatzausfälle oder entgangene Gewinne, die durch Ausfälle oder Fehler der Plattform entstehen.</p>

<h2>8. Datenschutz</h2>
<p>Informationen zur Verarbeitung personenbezogener Daten findest du in unserer <a href="/datenschutz">Datenschutzerklärung</a>. Als Restaurantbetreiber bist du eigenverantwortlicher Verantwortlicher im Sinne der DSGVO für die Daten deiner Gäste. Wir handeln insoweit als Auftragsverarbeiter gemäß Art. 28 DSGVO.</p>

<h2>9. Änderungen der AGB</h2>
<p>Wir behalten uns vor, diese AGB mit einer Ankündigungsfrist von mindestens 30 Tagen per E-Mail zu ändern. Widersprichst du den geänderten AGB nicht innerhalb von 30 Tagen nach Zugang der Mitteilung, gelten die geänderten AGB als angenommen.</p>

<h2>10. Kündigung und Sperrung</h2>
<p>Du kannst dein Konto jederzeit über die Kontoeinstellungen oder per E-Mail an uns kündigen. Mit der Kündigung werden deine Daten nach einer Kulanzfrist von 30 Tagen gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.</p>

<h2>11. Anwendbares Recht und Gerichtsstand</h2>
<p>Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts (CISG). Gerichtsstand ist, soweit gesetzlich zulässig, der Sitz des Anbieters laut Impressum.</p>

<h2>12. Salvatorische Klausel</h2>
<p>Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, berührt dies die Wirksamkeit der übrigen Bestimmungen nicht.</p>'
  )
on conflict (key) do nothing;


-- ── 6. MANUELLER SETUP-SCHRITT (NACH MIGRATION) ──────────────
-- Nach Deploy: Davids auth.user_id einmalig als platform_owner eintragen:
--
--   insert into public.user_roles (user_id, role)
--   values ('<DAVIDS_AUTH_USER_ID>', 'platform_owner');
--
-- User-ID findest du in: Supabase Dashboard → Authentication → Users
