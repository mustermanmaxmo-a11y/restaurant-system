import Link from 'next/link'
import type { Metadata } from 'next'
import { LegalFooter } from '@/components/LegalFooter'

export const metadata: Metadata = {
  title: 'OrderIQ — Digitales Bestellsystem für Restaurants',
  description: 'QR-Bestellung, Live-Orders, KI-Marketing und Google Reviews Automation. Das modernste Restaurant-System — ab 29 € im Monat.',
}

const features = [
  {
    icon: '📱',
    title: 'QR-Code Bestellung',
    desc: 'Gäste scannen, bestellen, zahlen — ohne App. Tisch-Bestellung und Online-Bestellung in einem System.',
  },
  {
    icon: '⚡',
    title: 'Live-Orders in Echtzeit',
    desc: 'Bestellungen erscheinen sofort in der Küche. Status-Updates per Realtime — kein Polling, kein Refresh.',
  },
  {
    icon: '🤖',
    title: 'KI-Marketing Berater',
    desc: 'Dein persönlicher Marketing-Berater kennt deine Daten und erstellt Kampagnen die wirklich funktionieren.',
  },
  {
    icon: '⭐',
    title: 'Google Reviews Automation',
    desc: 'Nach jeder Bestellung automatisch nach Bewertungen fragen. Positiv → direkt zu Google. Negativ → internes Feedback.',
  },
  {
    icon: '🎁',
    title: 'Loyalty & Referral',
    desc: 'Stempelkarte, Punkte-System und Referral-Programm. Stammgäste belohnen — neue Gäste gewinnen.',
  },
  {
    icon: '📧',
    title: 'Email-Marketing & Drip',
    desc: 'Geburtstags-Emails, Win-Back Sequenzen, Kampagnen. Alles automatisch — du machst nichts manuell.',
  },
]

const steps = [
  { n: '1', title: 'Restaurant anlegen', desc: 'Menü, Tische, Branding — in 5 Minuten fertig. Keine IT nötig.' },
  { n: '2', title: 'QR-Codes ausdrucken', desc: 'Jeder Tisch bekommt einen eindeutigen QR-Code. Einfach hinlegen.' },
  { n: '3', title: 'Bestellungen empfangen', desc: 'Gäste bestellen direkt vom Handy. Du siehst alles live im Dashboard.' },
]

const comparison = [
  { feature: 'QR-Bestellung am Tisch', orderiq: true, flipdish: true, mryum: true, toast: false },
  { feature: 'Online-Bestellung (Take-away)', orderiq: true, flipdish: true, mryum: true, toast: true },
  { feature: 'KI-Marketing Berater', orderiq: true, flipdish: false, mryum: false, toast: false },
  { feature: 'Google Reviews Automation', orderiq: true, flipdish: false, mryum: false, toast: false },
  { feature: 'Win-Back Email Drip', orderiq: true, flipdish: false, mryum: false, toast: false },
  { feature: 'Referral-Programm', orderiq: true, flipdish: false, mryum: false, toast: false },
  { feature: 'Loyalty & Stempelkarte', orderiq: true, flipdish: true, mryum: true, toast: true },
  { feature: 'Realtime-Updates (kein Polling)', orderiq: true, flipdish: false, mryum: false, toast: false },
  { feature: 'DSGVO-konform (EU-Hosting)', orderiq: true, flipdish: true, mryum: false, toast: false },
  { feature: 'Preis ab (monatlich)', orderiq: '29 €', flipdish: '149 €', mryum: '99 €', toast: '110 €' },
]

const accent = '#EA580C'
const bg = '#0A0A0F'
const surface = '#111118'
const border = 'rgba(255,255,255,0.08)'
const text = '#F5F5F7'
const muted = 'rgba(255,255,255,0.45)'

export default function HomePage() {
  return (
    <main style={{ minHeight: '100vh', background: bg, color: text, fontFamily: 'var(--font-geist), system-ui, sans-serif' }}>

      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${border}`,
        padding: '0 32px', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em' }}>
          Order<span style={{ color: accent }}>IQ</span>
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Link href="/roi-rechner" style={{ color: muted, fontSize: '0.875rem', textDecoration: 'none', padding: '8px 14px' }}>
            ROI-Rechner
          </Link>
          <Link href="/pricing" style={{ color: muted, fontSize: '0.875rem', textDecoration: 'none', padding: '8px 14px' }}>
            Preise
          </Link>
          <Link href="/owner-login" style={{ color: muted, fontSize: '0.875rem', textDecoration: 'none', padding: '8px 14px' }}>
            Einloggen
          </Link>
          <Link href="/register" style={{
            background: accent, color: '#fff',
            padding: '9px 20px', borderRadius: '9px',
            fontSize: '0.875rem', fontWeight: 700, textDecoration: 'none',
          }}>
            Kostenlos testen
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ textAlign: 'center', padding: 'clamp(64px, 10vw, 120px) 24px 80px' }}>
        <div style={{
          display: 'inline-block',
          background: 'rgba(234,88,12,0.12)', border: '1px solid rgba(234,88,12,0.25)',
          color: accent, borderRadius: '20px', padding: '5px 16px',
          fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', marginBottom: '24px',
        }}>
          Das modernste Restaurant-System
        </div>
        <h1 style={{
          fontSize: 'clamp(2.4rem, 6vw, 4.5rem)',
          fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05,
          maxWidth: '820px', margin: '0 auto 20px',
        }}>
          Mehr Bestellungen.<br />
          <span style={{ color: accent }}>Weniger Aufwand.</span>
        </h1>
        <p style={{ color: muted, fontSize: 'clamp(1rem, 2vw, 1.2rem)', maxWidth: '520px', margin: '0 auto 40px', lineHeight: 1.7 }}>
          QR-Bestellung, Live-Kitchen-View, KI-Marketing und automatische Google Reviews — alles in einem System.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register" style={{
            background: `linear-gradient(135deg, ${accent}, #F97316)`,
            color: '#fff', padding: '16px 36px', borderRadius: '13px',
            fontSize: '1rem', fontWeight: 800, textDecoration: 'none',
            boxShadow: '0 8px 32px rgba(234,88,12,0.35)',
          }}>
            14 Tage kostenlos testen →
          </Link>
          <Link href="/pricing" style={{
            background: surface, color: text, padding: '16px 28px', borderRadius: '13px',
            fontSize: '1rem', fontWeight: 600, textDecoration: 'none',
            border: `1px solid ${border}`,
          }}>
            Preise ansehen
          </Link>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.8rem', marginTop: '14px' }}>
          Keine Kreditkarte · Kündigung jederzeit · DSGVO-konform
        </p>
      </section>

      {/* ── Stats bar ── */}
      <section style={{
        borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`,
        padding: '28px 24px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '24px', textAlign: 'center', maxWidth: '900px', margin: '0 auto',
      }}>
        {[
          { val: '< 5 Min', label: 'Setup-Zeit' },
          { val: '3 Apps', label: 'Tisch + Online + Staff' },
          { val: '29 €', label: 'Ab pro Monat' },
          { val: '14 Tage', label: 'Gratis testen' },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: text, letterSpacing: '-0.03em' }}>{s.val}</div>
            <div style={{ color: muted, fontSize: '0.8rem', marginTop: '4px', fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── Features ── */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '12px' }}>
            Alles was ein modernes Restaurant braucht
          </h2>
          <p style={{ color: muted, fontSize: '1rem', maxWidth: '440px', margin: '0 auto' }}>
            Von der Bestellung bis zum Marketing — ein System, keine Insellösungen.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {features.map(f => (
            <div key={f.title} style={{
              background: surface, border: `1px solid ${border}`,
              borderRadius: '16px', padding: '24px',
            }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '12px' }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '8px' }}>{f.title}</div>
              <div style={{ color: muted, fontSize: '0.875rem', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ background: surface, borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`, padding: '72px 24px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '48px' }}>
            In 3 Schritten live
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '32px' }}>
            {steps.map(s => (
              <div key={s.n}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '14px',
                  background: `linear-gradient(135deg, ${accent}, #F97316)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.2rem', fontWeight: 800, margin: '0 auto 16px',
                }}>
                  {s.n}
                </div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '8px' }}>{s.title}</div>
                <div style={{ color: muted, fontSize: '0.875rem', lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison table ── */}
      <section style={{ maxWidth: '1000px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '12px' }}>
            Warum OrderIQ?
          </h2>
          <p style={{ color: muted, fontSize: '1rem' }}>Vergleich mit den bekannten Alternativen</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: muted, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${border}` }}>
                  Feature
                </th>
                {[
                  { name: 'OrderIQ', highlight: true },
                  { name: 'Flipdish', highlight: false },
                  { name: 'Mr. Yum', highlight: false },
                  { name: 'Toast', highlight: false },
                ].map(col => (
                  <th key={col.name} style={{
                    textAlign: 'center', padding: '12px 16px',
                    fontSize: '0.875rem', fontWeight: 800,
                    color: col.highlight ? accent : muted,
                    borderBottom: `1px solid ${border}`,
                    background: col.highlight ? 'rgba(234,88,12,0.06)' : 'transparent',
                    borderRadius: col.highlight ? '8px 8px 0 0' : undefined,
                  }}>
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                  <td style={{ padding: '13px 16px', fontSize: '0.875rem', color: i === comparison.length - 1 ? text : 'rgba(255,255,255,0.7)', fontWeight: i === comparison.length - 1 ? 700 : 400 }}>
                    {row.feature}
                  </td>
                  {[
                    { val: row.orderiq, highlight: true },
                    { val: row.flipdish, highlight: false },
                    { val: row.mryum, highlight: false },
                    { val: row.toast, highlight: false },
                  ].map((cell, j) => (
                    <td key={j} style={{
                      textAlign: 'center', padding: '13px 16px',
                      background: cell.highlight ? 'rgba(234,88,12,0.04)' : 'transparent',
                    }}>
                      {typeof cell.val === 'boolean' ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: '22px', height: '22px', borderRadius: '50%',
                          background: cell.val
                            ? (cell.highlight ? 'rgba(234,88,12,0.2)' : 'rgba(34,197,94,0.15)')
                            : 'rgba(255,255,255,0.05)',
                          fontSize: '0.7rem',
                          color: cell.val ? (cell.highlight ? accent : '#4ade80') : 'rgba(255,255,255,0.2)',
                        }}>
                          {cell.val ? '✓' : '✕'}
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '0.875rem', fontWeight: 800,
                          color: cell.highlight ? accent : muted,
                        }}>
                          {cell.val}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem', marginTop: '16px' }}>
          Preisvergleich basiert auf öffentlichen Listenpreisen (Stand 2026). Alle Angaben ohne Gewähr.
        </p>
      </section>

      {/* ── Pricing teaser ── */}
      <section style={{ background: surface, borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`, padding: '72px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' }}>
            Einfache Preise
          </h2>
          <p style={{ color: muted, marginBottom: '40px' }}>14 Tage gratis — danach ab 29 € im Monat.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            {[
              { name: 'Starter', price: '29 €', note: 'Bis 15 Tische', highlight: false },
              { name: 'Pro', price: '59 €', note: 'Unbegrenzt + KI', highlight: true },
              { name: 'Enterprise', price: '99 €', note: 'Multi-Location + POS', highlight: false },
            ].map(p => (
              <div key={p.name} style={{
                background: p.highlight ? 'rgba(234,88,12,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${p.highlight ? 'rgba(234,88,12,0.4)' : border}`,
                borderRadius: '16px', padding: '24px',
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{p.name}</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', color: p.highlight ? accent : text }}>{p.price}<span style={{ fontSize: '0.875rem', fontWeight: 400, color: muted }}>/Mo</span></div>
                <div style={{ color: muted, fontSize: '0.8rem', marginTop: '6px' }}>{p.note}</div>
              </div>
            ))}
          </div>
          <Link href="/pricing" style={{
            color: accent, fontSize: '0.9rem', fontWeight: 700, textDecoration: 'none',
          }}>
            Alle Features vergleichen →
          </Link>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{
          maxWidth: '640px', margin: '0 auto',
          background: `linear-gradient(135deg, rgba(234,88,12,0.12), rgba(249,115,22,0.06))`,
          border: '1px solid rgba(234,88,12,0.2)',
          borderRadius: '24px', padding: '60px 32px',
        }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '12px' }}>
            Bereit loszulegen?
          </h2>
          <p style={{ color: muted, marginBottom: '28px', fontSize: '1rem' }}>
            Keine Kreditkarte. Keine Verpflichtung. Einfach ausprobieren.
          </p>
          <Link href="/register" style={{
            display: 'inline-block',
            background: `linear-gradient(135deg, ${accent}, #F97316)`,
            color: '#fff', borderRadius: '13px',
            padding: '16px 36px', fontWeight: 800, fontSize: '1rem',
            textDecoration: 'none',
            boxShadow: '0 8px 32px rgba(234,88,12,0.3)',
          }}>
            14 Tage kostenlos starten →
          </Link>
        </div>
      </section>

      <LegalFooter />
    </main>
  )
}
