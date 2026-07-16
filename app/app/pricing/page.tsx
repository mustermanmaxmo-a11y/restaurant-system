import Link from 'next/link'
import type { Metadata } from 'next'
import { ShieldCheck, Zap, CreditCard, CalendarClock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Preise — OrderIQ',
  description: 'Transparente Preise für digitale Restaurantsysteme. QR-Bestellung, Live-Orders, KI-Marketing — ab 29 € im Monat.',
}

const plans = [
  {
    name: 'Starter',
    price: 29,
    description: 'Perfekt für kleine Restaurants und den Einstieg.',
    highlight: false,
    badge: null,
    features: [
      { text: 'QR-Code Bestellung pro Tisch', included: true },
      { text: 'Live-Bestellungen & Status-Updates', included: true },
      { text: 'Bis zu 15 Tische', included: true },
      { text: 'Bis zu 3 Personal-Accounts', included: true },
      { text: '7 Tage Analytics', included: true },
      { text: 'Online-Bestellung (Take-away & Lieferung)', included: true },
      { text: 'Reservierungen', included: false },
      { text: 'KI-Marketing Berater', included: false },
      { text: 'Eigenes Branding & Farben', included: false },
      { text: 'Email-Marketing & Automationen', included: false },
      { text: 'Loyalty-Programm & Referral', included: false },
    ],
    cta: 'Kostenlos testen',
    ctaHref: '/register',
  },
  {
    name: 'Pro',
    price: 59,
    description: 'Alles was du brauchst um dein Restaurant zu skalieren.',
    highlight: true,
    badge: 'Beliebteste Wahl',
    features: [
      { text: 'QR-Code Bestellung pro Tisch', included: true },
      { text: 'Live-Bestellungen & Status-Updates', included: true },
      { text: 'Unbegrenzte Tische & Personal', included: true },
      { text: '365 Tage Analytics & Reports', included: true },
      { text: 'Online-Bestellung (Take-away & Lieferung)', included: true },
      { text: 'Reservierungen', included: true },
      { text: 'KI-Marketing Berater', included: true },
      { text: 'Eigenes Branding & Farben', included: true },
      { text: 'Email-Marketing & Automationen', included: true },
      { text: 'Loyalty-Programm & Referral', included: true },
      { text: 'Multi-Location Dashboard', included: false },
    ],
    cta: 'Kostenlos testen',
    ctaHref: '/register',
  },
  {
    name: 'Enterprise',
    price: 99,
    description: 'Für Ketten und Restaurants mit mehreren Standorten.',
    highlight: false,
    badge: null,
    features: [
      { text: 'Alles aus Pro', included: true },
      { text: 'Multi-Location Dashboard', included: true },
      { text: 'POS-Integration (SumUp, Zettle, Square)', included: true },
      { text: 'White-Label Branding', included: true },
      { text: 'Dedizierter Onboarding-Support', included: true },
      { text: 'Custom Integrationen auf Anfrage', included: true },
      { text: 'SLA & Priority Support', included: true },
      { text: 'Eigene Domain pro Restaurant', included: true },
      { text: 'API-Zugang', included: true },
      { text: 'Agentur-Portal', included: true },
      { text: 'Individuelle Verträge', included: true },
    ],
    cta: 'Demo buchen',
    ctaHref: 'mailto:hallo@getorderiq.de?subject=Enterprise Demo',
  },
]

const faqs = [
  {
    q: 'Brauche ich eine Kreditkarte für die Testphase?',
    a: 'Nein. Du kannst OrderIQ 14 Tage lang vollständig kostenlos testen — ohne Kreditkarte, ohne Verpflichtung.',
  },
  {
    q: 'Kann ich den Plan später wechseln?',
    a: 'Ja, jederzeit. Du kannst upgraden oder downgraden. Die Abrechnung wird anteilig angepasst.',
  },
  {
    q: 'Gibt es einen Jahresrabatt?',
    a: 'Ja — bei jährlicher Zahlung sparst du 2 Monate. Kontaktiere uns für ein individuelles Angebot.',
  },
  {
    q: 'Was passiert nach den 14 Tagen?',
    a: 'Du wirst gefragt ob du einen Plan auswählen möchtest. Ohne Auswahl wird der Account pausiert — deine Daten bleiben erhalten.',
  },
  {
    q: 'Gibt es Setup-Kosten?',
    a: 'Nein. Du richtest alles selbst in wenigen Minuten ein. Bei Enterprise-Kunden bieten wir optionales Onboarding an.',
  },
]

export default function PricingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A0A0F',
      color: '#F5F5F7',
      fontFamily: 'var(--font-geist), system-ui, sans-serif',
    }}>
      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(10,10,15,0.85)',
        backdropFilter: 'blur(12px)',
        padding: '0 24px',
        height: '60px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: '1200px', margin: '0 auto',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff', letterSpacing: '-0.02em' }}>
            Order<span style={{ color: '#35C0DB' }}>IQ</span>
          </span>
        </Link>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link href="/roi-rechner" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', textDecoration: 'none' }}>
            ROI-Rechner
          </Link>
          <Link href="/login" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', textDecoration: 'none' }}>
            Einloggen
          </Link>
          <Link href="/register" style={{
            background: '#0E7490', color: '#fff', padding: '8px 16px',
            borderRadius: '8px', fontSize: '0.875rem', fontWeight: 700,
            textDecoration: 'none',
          }}>
            Kostenlos testen
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', padding: '80px 0 64px' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(234,88,12,0.15)',
            border: '1px solid rgba(234,88,12,0.3)',
            color: '#35C0DB',
            borderRadius: '20px', padding: '6px 16px',
            fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', marginBottom: '20px',
          }}>
            Einfache, transparente Preise
          </div>
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 800, letterSpacing: '-0.03em',
            lineHeight: 1.1, marginBottom: '16px',
          }}>
            Kein Schnickschnack.<br />
            <span style={{ color: '#35C0DB' }}>Nur was du brauchst.</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto 12px' }}>
            14 Tage gratis testen — keine Kreditkarte, keine Verpflichtung.
          </p>
        </div>

        {/* Plans */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
          marginBottom: '80px',
        }}>
          {plans.map(plan => (
            <div
              key={plan.name}
              style={{
                background: plan.highlight ? 'rgba(234,88,12,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${plan.highlight ? 'rgba(234,88,12,0.5)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '20px',
                padding: '32px 28px',
                position: 'relative',
                display: 'flex', flexDirection: 'column',
              }}
            >
              {plan.badge && (
                <div style={{
                  position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)',
                  background: '#0E7490',
                  color: '#fff', borderRadius: '20px', padding: '4px 16px',
                  fontSize: '0.7rem', fontWeight: 800, whiteSpace: 'nowrap',
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                }}>
                  {plan.badge}
                </div>
              )}

              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                  {plan.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>
                    {plan.price}€
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', paddingBottom: '8px' }}>/Monat</span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', lineHeight: 1.5 }}>
                  {plan.description}
                </p>
              </div>

              <Link
                href={plan.ctaHref}
                style={{
                  display: 'block', textAlign: 'center',
                  background: plan.highlight
                    ? '#0E7490'
                    : 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  borderRadius: '12px', padding: '13px',
                  fontWeight: 700, fontSize: '0.9rem',
                  textDecoration: 'none', marginBottom: '28px',
                  border: plan.highlight ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  transition: 'opacity 0.2s',
                }}
              >
                {plan.cta} →
              </Link>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                {plan.features.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{
                      flexShrink: 0, width: '18px', height: '18px',
                      borderRadius: '50%',
                      background: f.included ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.65rem', marginTop: '1px',
                    }}>
                      {f.included ? '✓' : '–'}
                    </span>
                    <span style={{
                      fontSize: '0.85rem',
                      color: f.included ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)',
                    }}>
                      {f.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Trust bar */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          padding: '28px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          textAlign: 'center',
          marginBottom: '80px',
        }}>
          {[
            { icon: ShieldCheck, text: 'DSGVO-konform', sub: 'Daten bleiben in der EU' },
            { icon: Zap, text: 'Schnell eingerichtet', sub: 'Keine IT nötig' },
            { icon: CreditCard, text: 'Keine Kreditkarte', sub: 'Für die Testphase' },
            { icon: CalendarClock, text: 'Monatlich kündbar', sub: 'Ohne Mindestlaufzeit' },
          ].map((item, i) => {
            const Icon = item.icon
            return (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px', color: '#35C0DB' }}><Icon size={22} /></div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>{item.text}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>{item.sub}</div>
              </div>
            )
          })}
        </div>

        {/* FAQ */}
        <div style={{ marginBottom: '80px' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center', marginBottom: '40px' }}>
            Häufige Fragen
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '720px', margin: '0 auto' }}>
            {faqs.map((faq, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '14px', padding: '20px 24px',
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '8px' }}>{faq.q}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', lineHeight: 1.6 }}>{faq.a}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(234,88,12,0.15), rgba(249,115,22,0.08))',
          border: '1px solid rgba(234,88,12,0.2)',
          borderRadius: '24px',
          padding: '60px 24px',
          marginBottom: '80px',
        }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '12px' }}>
            Bereit loszulegen?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '28px', fontSize: '1rem' }}>
            14 Tage kostenlos — kein Risiko, keine Kreditkarte.
          </p>
          <Link href="/register" style={{
            display: 'inline-block',
            background: '#0E7490',
            color: '#fff', borderRadius: '14px',
            padding: '16px 36px', fontWeight: 800, fontSize: '1rem',
            textDecoration: 'none', letterSpacing: '-0.01em',
          }}>
            Jetzt kostenlos starten →
          </Link>
        </div>

      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '24px',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.3)',
        fontSize: '0.8rem',
      }}>
        © 2026 OrderIQ · <Link href="/impressum" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>Impressum</Link> · <Link href="/datenschutz" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>Datenschutz</Link>
      </div>
    </div>
  )
}
