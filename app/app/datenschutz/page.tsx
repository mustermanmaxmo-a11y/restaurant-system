export default function DatenschutzPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: '48px 24px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', fontFamily: 'sans-serif' }}>
        <a href="javascript:history.back()" style={{ color: '#6c63ff', fontSize: '0.875rem', textDecoration: 'none', display: 'inline-block', marginBottom: '32px' }}>← Zurück</a>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '8px' }}>Datenschutzerklärung</h1>
        <p style={{ color: '#888', fontSize: '0.875rem', marginBottom: '40px' }}>Stand: [DATUM EINTRAGEN, z.B. März 2026]</p>

        <Section title="1. Verantwortlicher">
          <P>
            Verantwortlicher im Sinne der DSGVO (Art. 4 Nr. 7 DSGVO) ist:<br /><br />
            <Placeholder>DEIN NAME / FIRMENNAME</Placeholder><br />
            <Placeholder>STRASSE HAUSNUMMER</Placeholder><br />
            <Placeholder>PLZ ORT</Placeholder><br />
            E-Mail: <Placeholder>DEINE@EMAIL.DE</Placeholder>
          </P>
        </Section>

        <Section title="2. Welche Daten wir verarbeiten und warum">
          <SubTitle>2.1 Restaurantbetreiber (Kunden unserer SaaS-Plattform)</SubTitle>
          <P>Bei der Registrierung und Nutzung der Plattform verarbeiten wir:</P>
          <List items={[
            'E-Mail-Adresse und Passwort (Konto-Erstellung, Login)',
            'Restaurantname, URL-Slug (Einrichtung des Restaurants)',
            'Zahlungsdaten über Stripe (Abonnement-Verwaltung) — wir speichern keine Kreditkartendaten selbst',
            'IP-Adresse und Geräteinformationen (Sicherheit, Logs)',
          ]} />
          <P>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung), Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Sicherheit).</P>

          <SubTitle>2.2 Gäste (Endkunden der Restaurants)</SubTitle>
          <P>Wenn Gäste über unsere Plattform bestellen oder reservieren, verarbeiten wir im Auftrag des jeweiligen Restaurants:</P>
          <List items={[
            'Name, Telefonnummer (Bestellung / Reservierung)',
            'E-Mail-Adresse (optional, für Bestätigungsmails)',
            'Lieferadresse (nur bei Lieferbestellungen)',
            'Bestellinhalt, Bestellzeitpunkt, Gesamtbetrag',
            'Reservierungsdaten (Datum, Uhrzeit, Personenanzahl)',
          ]} />
          <P>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung mit dem Restaurant). Der jeweilige Restaurantbetreiber ist für die Verarbeitung dieser Daten selbst verantwortlich. RestaurantOS handelt dabei als Auftragsverarbeiter gemäß Art. 28 DSGVO.</P>
        </Section>

        <Section title="3. Auftragsverarbeiter und Drittanbieter">
          <P>Wir setzen folgende Dienstleister ein, mit denen Auftragsverarbeitungsverträge (AVV) gemäß Art. 28 DSGVO geschlossen wurden:</P>

          <SubTitle>Supabase (Datenbank & Authentifizierung)</SubTitle>
          <P>Supabase Inc., 970 Toa Payoh North, Singapur. Datenbank-Hosting und Authentifizierung. Daten werden in der EU (Frankfurt, AWS eu-central-1) gespeichert. Datenschutzinformationen: <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#6c63ff' }}>supabase.com/privacy</a>. Datenübertragung in Drittländer erfolgt auf Basis von Standardvertragsklauseln (SCC) gemäß Art. 46 Abs. 2 lit. c DSGVO.</P>

          <SubTitle>Stripe (Zahlungsabwicklung)</SubTitle>
          <P>Stripe Payments Europe, Ltd., The One Building, 1 Grand Canal Street Lower, Dublin 2, Irland. Verarbeitung von Zahlungen (Abonnements und Bestellungen). Datenschutzinformationen: <a href="https://stripe.com/de/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#6c63ff' }}>stripe.com/de/privacy</a>.</P>

          <SubTitle>Resend (E-Mail-Versand)</SubTitle>
          <P>Resend Inc., USA. Versand von Transaktions-E-Mails (Bestellbestätigungen, Reservierungsbestätigungen). Datenübertragung in die USA auf Basis von SCC gemäß Art. 46 Abs. 2 lit. c DSGVO. Datenschutzinformationen: <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: '#6c63ff' }}>resend.com/legal/privacy-policy</a>.</P>

          <SubTitle>Hosting (<Placeholder>VERCEL ODER NETLIFY EINTRAGEN</Placeholder>)</SubTitle>
          <P>
            <Placeholder>Vercel Inc., 340 Pine Street Suite 1101, San Francisco, CA 94104, USA — oder — Netlify Inc., 512 Second Street Suite 200, San Francisco, CA 94107, USA</Placeholder>. Hosting der Web-Applikation. Datenübertragung in die USA auf Basis von SCC. Datenschutzinformationen: <Placeholder>[LINK ZUR DATENSCHUTZSEITE DES HOSTERS EINTRAGEN]</Placeholder>
          </P>
        </Section>

        <Section title="4. Speicherdauer">
          <P>Wir speichern personenbezogene Daten nur so lange, wie es für den jeweiligen Zweck erforderlich ist:</P>
          <List items={[
            'Kontodaten von Restaurantbetreibern: Bis zur Kündigung des Kontos + 30 Tage Kulanzfrist',
            'Bestellungen und Reservierungen: 3 Jahre (handels- und steuerrechtliche Aufbewahrungspflichten gemäß § 257 HGB, § 147 AO)',
            'Zahlungsdaten bei Stripe: Gemäß Stripe-Datenschutzrichtlinie (i.d.R. 7 Jahre)',
            'Server-Logs: 30 Tage',
          ]} />
        </Section>

        <Section title="5. Cookies und lokale Speicherung">
          <P>Unsere Anwendung setzt technisch notwendige Cookies und localStorage-Einträge für die Authentifizierung (Supabase Auth Session). Diese sind für den Betrieb der Plattform zwingend erforderlich und bedürfen keiner gesonderten Einwilligung (Art. 6 Abs. 1 lit. b DSGVO). Wir setzen keine Marketing- oder Tracking-Cookies ein.</P>
        </Section>

        <Section title="6. Deine Rechte als betroffene Person">
          <P>Gemäß DSGVO stehen dir folgende Rechte zu:</P>
          <List items={[
            'Auskunftsrecht (Art. 15 DSGVO): Recht auf Auskunft über die gespeicherten Daten',
            'Berichtigungsrecht (Art. 16 DSGVO): Recht auf Korrektur unrichtiger Daten',
            'Löschungsrecht (Art. 17 DSGVO): Recht auf Löschung ("Recht auf Vergessenwerden")',
            'Einschränkungsrecht (Art. 18 DSGVO): Recht auf Einschränkung der Verarbeitung',
            'Datenübertragbarkeit (Art. 20 DSGVO): Recht auf Erhalt der Daten in maschinenlesbarem Format',
            'Widerspruchsrecht (Art. 21 DSGVO): Recht auf Widerspruch gegen die Verarbeitung',
            'Widerruf einer Einwilligung (Art. 7 Abs. 3 DSGVO): Jederzeit möglich, ohne Auswirkung auf die Rechtmäßigkeit der bisherigen Verarbeitung',
          ]} />
          <P>Zur Ausübung deiner Rechte wende dich an: <Placeholder>DEINE@EMAIL.DE</Placeholder></P>
        </Section>

        <Section title="7. Beschwerderecht bei einer Aufsichtsbehörde">
          <P>Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO). Die zuständige Behörde richtet sich nach deinem Wohnort. Eine Liste aller deutschen Aufsichtsbehörden findest du unter: <a href="https://www.bfdi.bund.de/DE/Infothek/Anschriften_Links/anschriften_links-node.html" target="_blank" rel="noopener noreferrer" style={{ color: '#6c63ff' }}>bfdi.bund.de</a></P>
        </Section>

        <Section title="8. Datensicherheit">
          <P>Wir setzen technische und organisatorische Maßnahmen ein, um deine Daten zu schützen: verschlüsselte Übertragung via HTTPS/TLS, Row-Level Security in der Datenbank, gehashte Passwörter, Zugriffskontrolle nach dem Prinzip der minimalen Rechte.</P>
        </Section>

        <Section title="9. Änderungen dieser Datenschutzerklärung">
          <P>Wir behalten uns vor, diese Datenschutzerklärung bei Bedarf anzupassen. Die jeweils aktuelle Version ist auf dieser Seite abrufbar. Bei wesentlichen Änderungen informieren wir registrierte Nutzer per E-Mail.</P>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '40px' }}>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid #e0e0e0' }}>{title}</h2>
      {children}
    </div>
  )
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <p style={{ fontWeight: 700, color: '#1a1a2e', fontSize: '0.9rem', marginTop: '16px', marginBottom: '4px' }}>{children}</p>
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ color: '#444', fontSize: '0.875rem', lineHeight: 1.75, marginBottom: '8px' }}>{children}</p>
}

function List({ items }: { items: string[] }) {
  return (
    <ul style={{ paddingLeft: '20px', margin: '8px 0 12px' }}>
      {items.map((item, i) => (
        <li key={i} style={{ color: '#444', fontSize: '0.875rem', lineHeight: 1.75, marginBottom: '4px' }}>{item}</li>
      ))}
    </ul>
  )
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <span style={{ color: '#ef4444', fontWeight: 600 }}>[{children}]</span>
}
