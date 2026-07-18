import Link from 'next/link'
import type { Metadata } from 'next'
import {
  QrCode, Zap, Bot, Star, Gift, Mail, ArrowRight,
  ShieldCheck, CreditCard, CalendarClock, Radio, LayoutGrid, Store,
} from 'lucide-react'
import { LegalFooter } from '@/components/LegalFooter'

export const metadata: Metadata = {
  title: 'OrderIQ — Digitales Bestellsystem für Restaurants',
  description:
    'QR-Bestellung am Tisch und online, Live-Küchenansicht und automatisiertes Marketing. Ein System für dein Restaurant — ab 29 € im Monat.',
}

const accent = '#0E7490'          // Petrol-Füllung (weißer Text darauf)
const accentFg = '#0E7490'        // Petrol als Textfarbe auf hellem Grund (5.46:1)
const bg = '#F7F6F3'              // warmes Off-White
const surface = '#FFFFFF'
const surfaceSoft = '#F1EFEA'    // leicht getönte Fläche für Karten-Alternativen
const border = 'rgba(0,0,0,0.09)'
const text = '#161513'
const muted = 'rgba(0,0,0,0.56)'

const features = [
  { icon: QrCode, title: 'QR-Bestellung', desc: 'Gäste scannen, bestellen und zahlen ohne App — am Tisch und für zu Hause, in einem System.' },
  { icon: Zap, title: 'Live-Küchenansicht', desc: 'Bestellungen erscheinen in Echtzeit in der Küche. Status-Updates ohne Neuladen, ohne Verzögerung.' },
  { icon: Bot, title: 'KI-Marketing', desc: 'Ein Marketing-Assistent, der deine Zahlen kennt und Kampagnen vorschlägt, die zu deinem Betrieb passen.' },
  { icon: Star, title: 'Bewertungen automatisiert', desc: 'Nach der Bestellung automatisch nach Feedback fragen. Zufriedene Gäste zu Google, Kritik intern.' },
  { icon: Gift, title: 'Treue & Empfehlungen', desc: 'Digitale Stempelkarte, Punkte und Empfehlungsprogramm — Stammgäste halten, neue gewinnen.' },
  { icon: Mail, title: 'E-Mail-Automation', desc: 'Geburtstags-Mails, Win-Back-Serien und Kampagnen laufen automatisch im Hintergrund.' },
]

const steps = [
  { n: '1', title: 'Restaurant einrichten', desc: 'Speisekarte, Tische und Erscheinungsbild — in wenigen Minuten, ohne technisches Wissen.' },
  { n: '2', title: 'QR-Codes aufstellen', desc: 'Jeder Tisch bekommt einen eigenen Code. Ausdrucken, hinstellen, fertig.' },
  { n: '3', title: 'Bestellungen empfangen', desc: 'Gäste bestellen vom eigenen Handy. Du siehst alles live im Dashboard.' },
]

const reasons = [
  { icon: Radio, title: 'Echtzeit statt Nachladen', desc: 'Jede Bestellung, jeder Statuswechsel erscheint sofort — bei Gast, Küche und Service gleichzeitig.' },
  { icon: LayoutGrid, title: 'Ein System, keine Insellösungen', desc: 'Tisch-Bestellung, Online-Bestellung, Küche und Marketing greifen ineinander statt nebeneinander.' },
  { icon: Bot, title: 'KI, die deinen Betrieb kennt', desc: 'Vorschläge auf Basis deiner echten Daten — kein generisches Marketing von der Stange.' },
  { icon: ShieldCheck, title: 'DSGVO & EU-Hosting', desc: 'Daten bleiben in der EU. Rechtstexte, Cookie-Banner und Datenexport sind eingebaut.' },
]

const faqs = [
  { q: 'Brauchen meine Gäste eine App?', a: 'Nein. Gäste scannen den QR-Code und bestellen direkt im Browser — ohne Installation, ohne Konto.' },
  { q: 'Wie lange dauert die Einrichtung?', a: 'Speisekarte, Tische und Branding sind in wenigen Minuten angelegt. Du brauchst keine IT-Kenntnisse.' },
  { q: 'Was passiert bei Internetausfall?', a: 'Dein Personal kann Bestellungen weiter über das Dashboard aufnehmen. Sobald die Verbindung zurück ist, synchronisiert sich alles.' },
  { q: 'Ist das System DSGVO-konform?', a: 'Ja. Die Daten liegen auf EU-Servern, Rechtstexte und Cookie-Banner sind integriert, und Gäste können ihre Daten exportieren oder löschen lassen.' },
  { q: 'Kann ich monatlich kündigen?', a: 'Ja. Die Abrechnung läuft monatlich, ohne Mindestlaufzeit. Du kannst jederzeit zum Monatsende kündigen.' },
]

// Live-Demo nur verlinken, wenn ein kuratiertes Demo-Restaurant konfiguriert ist.
const demoSlug = process.env.NEXT_PUBLIC_DEMO_SLUG

function OrderBoardMock() {
  const cols = [
    { label: 'Neu', color: accentFg, dot: accent, items: [['Tisch 4', 'Pizza Margherita · Cola'], ['Tisch 9', 'Pasta · Tiramisu']] },
    { label: 'In Zubereitung', color: '#FBBF24', dot: '#D97706', items: [['Tisch 2', 'Burger · Pommes']] },
    { label: 'Serviert', color: '#34D399', dot: '#059669', items: [['Tisch 7', 'Salat · Wasser'], ['Tisch 1', 'Steak · Rotwein']] },
  ]
  return (
    <div
      aria-hidden="true"
      style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px',
        background: surface, border: `1px solid ${border}`, borderRadius: '16px', padding: '14px',
        boxShadow: '0 20px 48px rgba(0,0,0,0.10)',
      }}
    >
      {cols.map(col => (
        <div key={col.label} style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: col.dot }} />
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: col.color, letterSpacing: '0.02em' }}>{col.label}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {col.items.map(([t, d], i) => (
              <div key={i} style={{ background: surfaceSoft, border: `1px solid ${border}`, borderRadius: '10px', padding: '9px 10px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: text }}>{t}</div>
                <div style={{ fontSize: '0.64rem', color: muted, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function HomePage() {
  return (
    <main style={{ minHeight: '100vh', background: bg, color: text, fontFamily: 'var(--font-geist), system-ui, sans-serif' }}>

      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(247,246,243,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${border}`,
        padding: '0 clamp(16px, 4vw, 32px)', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em' }}>
          Order<span style={{ color: accentFg }}>IQ</span>
        </span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <Link href="/roi-rechner" style={{ color: muted, fontSize: '0.875rem', textDecoration: 'none', padding: '8px 14px' }}>ROI-Rechner</Link>
          <Link href="/pricing" style={{ color: muted, fontSize: '0.875rem', textDecoration: 'none', padding: '8px 14px' }}>Preise</Link>
          <Link href="/owner-login" style={{ color: muted, fontSize: '0.875rem', textDecoration: 'none', padding: '8px 14px' }}>Einloggen</Link>
          <Link href="/register" style={{
            background: accent, color: '#fff', padding: '9px 18px', borderRadius: '10px',
            fontSize: '0.875rem', fontWeight: 700, textDecoration: 'none',
          }}>
            Kostenlos testen
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        maxWidth: '1120px', margin: '0 auto',
        padding: 'clamp(48px, 8vw, 96px) clamp(20px, 5vw, 40px) 64px',
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '48px', alignItems: 'center',
      }}>
        <div className="hero-grid">
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              background: 'rgba(14,116,144,0.12)', border: '1px solid rgba(14,116,144,0.28)',
              color: accentFg, borderRadius: '20px', padding: '5px 14px',
              fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.02em', marginBottom: '24px',
            }}>
              <Store size={13} /> Bestellsystem für Restaurants & Cafés
            </div>
            <h1 style={{ fontSize: 'clamp(2.4rem, 6vw, 4rem)', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.05, margin: '0 0 20px' }}>
              Mehr Bestellungen.<br />
              <span style={{ color: accentFg }}>Weniger Aufwand.</span>
            </h1>
            <p style={{ color: muted, fontSize: 'clamp(1rem, 2vw, 1.15rem)', maxWidth: '480px', margin: '0 0 32px', lineHeight: 1.65 }}>
              QR-Bestellung am Tisch und online, Live-Küchenansicht und automatisiertes Marketing — alles in einem System.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link href="/register" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: accent, color: '#fff', padding: '15px 28px', borderRadius: '12px',
                fontSize: '1rem', fontWeight: 700, textDecoration: 'none',
              }}>
                14 Tage kostenlos testen <ArrowRight size={17} />
              </Link>
              {demoSlug ? (
                <Link href={`/${demoSlug}/info`} style={{
                  background: surface, color: text, padding: '15px 24px', borderRadius: '12px',
                  fontSize: '1rem', fontWeight: 600, textDecoration: 'none', border: `1px solid ${border}`,
                }}>
                  Live-Demo ansehen
                </Link>
              ) : (
                <Link href="/pricing" style={{
                  background: surface, color: text, padding: '15px 24px', borderRadius: '12px',
                  fontSize: '1rem', fontWeight: 600, textDecoration: 'none', border: `1px solid ${border}`,
                }}>
                  Preise ansehen
                </Link>
              )}
            </div>
            <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: '0.8rem', marginTop: '16px' }}>
              Keine Kreditkarte · monatlich kündbar · DSGVO-konform
            </p>
          </div>
          <OrderBoardMock />
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section style={{
        borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`,
        padding: '28px 24px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '24px', textAlign: 'center', maxWidth: '900px', margin: '0 auto',
      }}>
        {[
          { val: 'Ohne App', label: 'Gäste bestellen im Browser' },
          { val: '3 Apps', label: 'Tisch · Online · Personal' },
          { val: 'Echtzeit', label: 'Live-Updates ohne Neuladen' },
          { val: 'Ab 29 €', label: 'pro Monat, monatlich kündbar' },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: text, letterSpacing: '-0.02em' }}>{s.val}</div>
            <div style={{ color: muted, fontSize: '0.8rem', marginTop: '4px', fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── Features ── */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.3rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '12px' }}>
            Alles, was ein modernes Restaurant braucht
          </h2>
          <p style={{ color: muted, fontSize: '1rem', maxWidth: '460px', margin: '0 auto' }}>
            Von der Bestellung bis zum Marketing — ein System statt vieler Einzeltools.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {features.map(f => {
            const Icon = f.icon
            return (
              <div key={f.title} style={{ background: surface, border: `1px solid ${border}`, borderRadius: '16px', padding: '24px' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '40px', height: '40px', borderRadius: '11px',
                  background: 'rgba(14,116,144,0.14)', color: accentFg, marginBottom: '14px',
                }}>
                  <Icon size={20} />
                </div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '8px' }}>{f.title}</div>
                <div style={{ color: muted, fontSize: '0.9rem', lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ background: surface, borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`, padding: '72px 24px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '48px' }}>
            In drei Schritten startklar
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '32px' }}>
            {steps.map(s => (
              <div key={s.n}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: 'rgba(14,116,144,0.14)', color: accentFg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.1rem', fontWeight: 800, margin: '0 auto 16px',
                  border: '1px solid rgba(14,116,144,0.28)',
                }}>
                  {s.n}
                </div>
                <div style={{ fontWeight: 700, fontSize: '1.02rem', marginBottom: '8px' }}>{s.title}</div>
                <div style={{ color: muted, fontSize: '0.9rem', lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Warum OrderIQ ── */}
      <section style={{ maxWidth: '1000px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '12px' }}>
            Warum OrderIQ
          </h2>
          <p style={{ color: muted, fontSize: '1rem' }}>Was das System im Alltag ausmacht.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {reasons.map(r => {
            const Icon = r.icon
            return (
              <div key={r.title} style={{ display: 'flex', gap: '14px', background: surface, border: `1px solid ${border}`, borderRadius: '14px', padding: '20px' }}>
                <div style={{ flexShrink: 0, color: accentFg, marginTop: '2px' }}><Icon size={22} /></div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '6px' }}>{r.title}</div>
                  <div style={{ color: muted, fontSize: '0.9rem', lineHeight: 1.6 }}>{r.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Pricing teaser ── */}
      <section style={{ background: surface, borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`, padding: '72px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' }}>
            Einfache Preise
          </h2>
          <p style={{ color: muted, marginBottom: '40px' }}>14 Tage gratis testen — danach ab 29 € im Monat.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            {[
              { name: 'Starter', price: '29 €', note: 'Bis 15 Tische', highlight: false },
              { name: 'Pro', price: '59 €', note: 'Unbegrenzt + KI', highlight: true },
              { name: 'Enterprise', price: '99 €', note: 'Multi-Standort + Kassenanbindung', highlight: false },
            ].map(p => (
              <div key={p.name} style={{
                background: p.highlight ? 'rgba(14,116,144,0.08)' : surfaceSoft,
                border: `1px solid ${p.highlight ? 'rgba(14,116,144,0.4)' : border}`,
                borderRadius: '16px', padding: '24px',
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{p.name}</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', color: p.highlight ? accentFg : text }}>
                  {p.price}<span style={{ fontSize: '0.875rem', fontWeight: 400, color: muted }}>/Mo</span>
                </div>
                <div style={{ color: muted, fontSize: '0.8rem', marginTop: '6px' }}>{p.note}</div>
              </div>
            ))}
          </div>
          <Link href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: accentFg, fontSize: '0.9rem', fontWeight: 700, textDecoration: 'none' }}>
            Alle Leistungen vergleichen <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ maxWidth: '720px', margin: '0 auto', padding: '80px 24px' }}>
        <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '32px', textAlign: 'center' }}>
          Häufige Fragen
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {faqs.map(f => (
            <details key={f.q} style={{ background: surface, border: `1px solid ${border}`, borderRadius: '12px', padding: '16px 18px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', listStyle: 'none' }}>{f.q}</summary>
              <p style={{ color: muted, fontSize: '0.9rem', lineHeight: 1.65, marginTop: '10px' }}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{
          maxWidth: '640px', margin: '0 auto',
          background: 'rgba(14,116,144,0.08)', border: '1px solid rgba(14,116,144,0.2)',
          borderRadius: '24px', padding: '56px 32px',
        }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.3rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '12px' }}>
            Bereit loszulegen?
          </h2>
          <p style={{ color: muted, marginBottom: '28px', fontSize: '1rem' }}>
            Keine Kreditkarte, keine Mindestlaufzeit. In wenigen Minuten eingerichtet.
          </p>
          <Link href="/register" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: accent, color: '#fff', borderRadius: '12px',
            padding: '15px 32px', fontWeight: 700, fontSize: '1rem', textDecoration: 'none',
          }}>
            14 Tage kostenlos starten <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <LegalFooter />
    </main>
  )
}
