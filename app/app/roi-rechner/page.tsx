'use client'

import { useState } from 'react'
import Link from 'next/link'

const accent = '#EA580C'
const bg = '#0A0A0F'
const surface = '#111118'
const border = 'rgba(255,255,255,0.08)'
const text = '#F5F5F7'
const muted = 'rgba(255,255,255,0.45)'

function Slider({
  label, value, min, max, step = 1, unit = '', format,
  onChange,
}: {
  label: string; value: number; min: number; max: number
  step?: number; unit?: string; format?: (v: number) => string
  onChange: (v: number) => void
}) {
  const display = format ? format(value) : `${value}${unit}`
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
        <span style={{ fontSize: '0.875rem', color: muted, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: text }}>{display}</span>
      </div>
      <div style={{ position: 'relative', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${pct}%`, borderRadius: '3px',
          background: `linear-gradient(90deg, ${accent}, #F97316)`,
          pointerEvents: 'none',
        }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            position: 'absolute', inset: '-8px 0',
            width: '100%', opacity: 0, cursor: 'pointer', height: '22px',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)' }}>
          {format ? format(min) : `${min}${unit}`}
        </span>
        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)' }}>
          {format ? format(max) : `${max}${unit}`}
        </span>
      </div>
    </div>
  )
}

function ResultCard({ label, value, sub, highlight = false }: {
  label: string; value: string; sub?: string; highlight?: boolean
}) {
  return (
    <div style={{
      background: highlight ? 'rgba(234,88,12,0.1)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${highlight ? 'rgba(234,88,12,0.35)' : border}`,
      borderRadius: '16px', padding: '20px 24px',
    }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontSize: highlight ? '2rem' : '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', color: highlight ? accent : text }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '0.78rem', color: muted, marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

export default function RoiRechner() {
  const [tables, setTables]         = useState(20)
  const [avgOrder, setAvgOrder]     = useState(28)
  const [ordersDay, setOrdersDay]   = useState(60)
  const [daysMonth, setDaysMonth]   = useState(25)

  // ── Berechnungen ──────────────────────────────────────────────
  // 1. Personal-Ersparnis: jede Bestellung spart ~2.5 Min Kellner-Zeit
  const timeSavedHours = (ordersDay * 2.5 * daysMonth) / 60
  const timeSavedValue = Math.round(timeSavedHours * 12) // 12€/h Mindestlohn

  // 2. Mehr-Umsatz durch digitales Upselling (digitale Menüs +10% Bon)
  const upsellRevenue = Math.round(ordersDay * avgOrder * 0.10 * daysMonth)

  // 3. Marketing-Rückgewinnung (Loyalty + Win-Back + Referral → ~5% mehr Wiederkäufer)
  const marketingRevenue = Math.round(ordersDay * avgOrder * 0.05 * daysMonth)

  const totalPotential = timeSavedValue + upsellRevenue + marketingRevenue
  const monthlyCost = 59 // Pro Plan
  const netGain = totalPotential - monthlyCost
  const roi = Math.round((netGain / monthlyCost) * 100)

  const fmt = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')} T€` : `${n} €`

  return (
    <div style={{ minHeight: '100vh', background: bg, color: text, fontFamily: 'var(--font-geist), system-ui, sans-serif' }}>

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${border}`,
        padding: '0 32px', height: '60px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', textDecoration: 'none', color: text }}>
          Order<span style={{ color: accent }}>IQ</span>
        </Link>
        <Link href="/register" style={{
          background: accent, color: '#fff',
          padding: '8px 18px', borderRadius: '8px',
          fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none',
        }}>
          Kostenlos testen
        </Link>
      </nav>

      <div style={{ maxWidth: '980px', margin: '0 auto', padding: '60px 24px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(234,88,12,0.12)', border: '1px solid rgba(234,88,12,0.25)',
            color: accent, borderRadius: '20px', padding: '5px 16px',
            fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: '20px',
          }}>
            ROI-Rechner
          </div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '12px' }}>
            Was bringt OrderIQ<br />
            <span style={{ color: accent }}>deinem Restaurant konkret?</span>
          </h1>
          <p style={{ color: muted, fontSize: '1rem', maxWidth: '460px', margin: '0 auto' }}>
            Passe die Werte an dein Restaurant an — und sieh sofort deinen monatlichen Mehrwert.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '32px', alignItems: 'start' }}>

          {/* Inputs */}
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: '20px', padding: '32px' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '28px' }}>
              Dein Restaurant
            </p>

            <Slider
              label="Anzahl Tische"
              value={tables} min={5} max={100}
              unit=" Tische"
              onChange={setTables}
            />
            <Slider
              label="Durchschnittlicher Bon"
              value={avgOrder} min={8} max={120}
              format={v => `${v} €`}
              onChange={setAvgOrder}
            />
            <Slider
              label="Bestellungen pro Tag"
              value={ordersDay} min={10} max={400}
              unit=" Bestellungen"
              onChange={setOrdersDay}
            />
            <Slider
              label="Öffnungstage pro Monat"
              value={daysMonth} min={10} max={31}
              unit=" Tage"
              onChange={setDaysMonth}
            />

            <div style={{
              marginTop: '8px', padding: '14px 16px',
              background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
              border: `1px solid ${border}`,
            }}>
              <div style={{ fontSize: '0.78rem', color: muted, lineHeight: 1.6 }}>
                Monatsumsatz deines Restaurants (geschätzt):
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '2px' }}>
                {fmt(ordersDay * avgOrder * daysMonth)}
              </div>
            </div>
          </div>

          {/* Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            <ResultCard
              label="Netto-Mehrgewinn pro Monat"
              value={`+${fmt(netGain)}`}
              sub={`nach Abzug der OrderIQ Pro Lizenz (${monthlyCost} €/Mo)`}
              highlight
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <ResultCard
                label="Personal-Ersparnis"
                value={`${fmt(timeSavedValue)}`}
                sub={`${Math.round(timeSavedHours)} Std./Mo weniger Bestellaufnahme`}
              />
              <ResultCard
                label="Mehr-Umsatz (Upselling)"
                value={`+${fmt(upsellRevenue)}`}
                sub="~10% höherer Bon durch digitale Menüs"
              />
              <ResultCard
                label="Marketing-Automatisierung"
                value={`+${fmt(marketingRevenue)}`}
                sub="Loyalty, Referral & Win-Back Mails"
              />
              <ResultCard
                label="ROI"
                value={`${roi.toLocaleString('de')} %`}
                sub={`bei ${monthlyCost} € Kosten/Monat`}
              />
            </div>

            {/* Breakdown */}
            <div style={{
              background: 'rgba(255,255,255,0.02)', border: `1px solid ${border}`,
              borderRadius: '14px', padding: '16px 20px',
            }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
                Woher kommt das?
              </p>
              {[
                { label: 'Bestellungen spart Kellner-Zeit', val: fmt(timeSavedValue), pct: Math.round((timeSavedValue / totalPotential) * 100) },
                { label: 'Höherer Bon durch Digitalmenü', val: `+${fmt(upsellRevenue)}`, pct: Math.round((upsellRevenue / totalPotential) * 100) },
                { label: 'Mehr Gäste durch Marketing', val: `+${fmt(marketingRevenue)}`, pct: Math.round((marketingRevenue / totalPotential) * 100) },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.8rem', color: muted }}>{row.label}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: text }}>{row.val}</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                    <div style={{ height: '100%', width: `${row.pct}%`, background: accent, borderRadius: '2px' }} />
                  </div>
                </div>
              ))}
            </div>

            <Link href="/register" style={{
              display: 'block', textAlign: 'center',
              background: `linear-gradient(135deg, ${accent}, #F97316)`,
              color: '#fff', borderRadius: '13px', padding: '16px',
              fontWeight: 800, fontSize: '1rem', textDecoration: 'none',
              boxShadow: '0 8px 32px rgba(234,88,12,0.3)',
            }}>
              Jetzt 14 Tage kostenlos testen →
            </Link>
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>
              Keine Kreditkarte · Kündigung jederzeit
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: '0.75rem', marginTop: '40px', lineHeight: 1.6 }}>
          * Berechnungen basieren auf Branchendurchschnittswerten. Personal-Ersparnis bei 12 €/Std. (Mindestlohn 2026).
          Upselling-Effekt basiert auf Studien zu digitalen Menüsystemen (+8–15% Bon). Tatsächliche Ergebnisse können variieren.
        </p>
      </div>
    </div>
  )
}
