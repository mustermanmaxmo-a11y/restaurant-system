export default function ImpressumPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: '48px 24px' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', fontFamily: 'sans-serif' }}>
        <a href="javascript:history.back()" style={{ color: '#6c63ff', fontSize: '0.875rem', textDecoration: 'none', display: 'inline-block', marginBottom: '32px' }}>← Zurück</a>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '8px' }}>Impressum</h1>
        <p style={{ color: '#888', fontSize: '0.875rem', marginBottom: '40px' }}>Angaben gemäß § 5 TMG</p>

        <Section title="Anbieter">
          <Field label="Name / Unternehmen" value="[DEIN NAME / FIRMENNAME]" />
          <Field label="Straße & Hausnummer" value="[STRASSE] [HAUSNUMMER]" />
          <Field label="PLZ & Ort" value="[PLZ] [ORT]" />
          <Field label="Land" value="Deutschland" />
        </Section>

        <Section title="Kontakt">
          <Field label="E-Mail" value="[DEINE@EMAIL.DE]" />
          <Field label="Telefon" value="[+49 XXX XXXXXXX]" />
        </Section>

        <Section title="Unternehmensform & Register">
          <Field label="Rechtsform" value="[z.B. Einzelunternehmen / GmbH / UG]" />
          <Field label="Handelsregister" value="[z.B. HRB 12345, Amtsgericht [Stadt]] — oder: Nicht eingetragen" />
          <Field label="USt-IdNr." value="[z.B. DE123456789] — oder: Nicht vorhanden (Kleinunternehmerregelung § 19 UStG)" />
          <Field label="Geschäftsführer/in" value="[DEIN NAME] — nur bei GmbH/UG erforderlich" />
        </Section>

        <Section title="Inhaltlich verantwortlich">
          <p style={{ color: '#444', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Verantwortlich für den Inhalt gemäß § 18 Abs. 2 MStV:<br />
            <strong>[DEIN NAME]</strong><br />
            [STRASSE] [HAUSNUMMER]<br />
            [PLZ] [ORT]
          </p>
        </Section>

        <Section title="Haftungsausschluss">
          <p style={{ color: '#444', fontSize: '0.9rem', lineHeight: 1.7 }}>
            <strong>Haftung für Inhalte:</strong> Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen.
          </p>
          <p style={{ color: '#444', fontSize: '0.9rem', lineHeight: 1.7, marginTop: '12px' }}>
            <strong>Haftung für Links:</strong> Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen Einfluss haben. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
          </p>
        </Section>

        <Section title="Online-Streitbeilegung">
          <p style={{ color: '#444', fontSize: '0.9rem', lineHeight: 1.7 }}>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
            <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" style={{ color: '#6c63ff' }}>
              https://ec.europa.eu/consumers/odr
            </a>
            <br />
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '36px' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #e0e0e0' }}>{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  const isPlaceholder = value.startsWith('[')
  return (
    <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', flexWrap: 'wrap' }}>
      <span style={{ color: '#888', fontSize: '0.875rem', minWidth: '180px' }}>{label}</span>
      <span style={{ color: isPlaceholder ? '#ef4444' : '#1a1a2e', fontSize: '0.875rem', fontWeight: isPlaceholder ? 600 : 400 }}>{value}</span>
    </div>
  )
}
