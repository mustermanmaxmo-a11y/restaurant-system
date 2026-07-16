'use client'

interface Campaign {
  id: string
  subject: string
  status: string
  recipient_count: number | null
  open_count: number | null
  click_count: number | null
  conversion_revenue: number | null
  sent_at: string | null
  template_type: string | null
}

interface Props {
  campaigns: Campaign[]
  restaurantId: string
}

const INDUSTRY_OPEN_RATE = 21
const INDUSTRY_CLICK_RATE = 3

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatEur(value: number | null): string {
  if (!value || value === 0) return '—'
  return `€${value.toFixed(2)}`
}

function openRate(c: Campaign): number | null {
  if (!c.recipient_count || c.recipient_count === 0) return null
  return ((c.open_count ?? 0) / c.recipient_count) * 100
}

function clickRate(c: Campaign): number | null {
  if (!c.recipient_count || c.recipient_count === 0) return null
  return ((c.click_count ?? 0) / c.recipient_count) * 100
}

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  discount: { label: 'Rabatt', color: '#f97316' },
  event: { label: 'Event', color: '#3b82f6' },
  seasonal: { label: 'Saisonal', color: '#22c55e' },
  loyalty: { label: 'Loyalty', color: '#0e7490' },
}

function TypeBadge({ type }: { type: string | null }) {
  const badge = type ? TYPE_BADGES[type] : null
  const color = badge?.color ?? '#6b7280'
  const label = badge?.label ?? (type ?? 'Allgemein')
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 600,
        color: '#fff',
        backgroundColor: color,
        letterSpacing: '0.02em',
      }}
    >
      {label}
    </span>
  )
}

export function MarketingAnalytics({ campaigns }: Props) {
  // Summary stats
  const totalSent = campaigns.reduce((sum, c) => sum + (c.recipient_count ?? 0), 0)

  const openRates = campaigns
    .map(openRate)
    .filter((r): r is number => r !== null)
  const avgOpenRate =
    openRates.length > 0 ? openRates.reduce((a, b) => a + b, 0) / openRates.length : null

  const clickRates = campaigns
    .map(clickRate)
    .filter((r): r is number => r !== null)
  const avgClickRate =
    clickRates.length > 0 ? clickRates.reduce((a, b) => a + b, 0) / clickRates.length : null

  const totalRevenue = campaigns.reduce((sum, c) => sum + (c.conversion_revenue ?? 0), 0)

  if (campaigns.length === 0) {
    return (
      <div
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          color: '#9ca3af',
          maxWidth: '560px',
          margin: '0 auto',
        }}
      >
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>📊</div>
        <p style={{ fontSize: '16px', fontWeight: 600, color: '#d1d5db', marginBottom: '8px' }}>
          Noch keine gesendeten Kampagnen
        </p>
        <p style={{ fontSize: '14px' }}>
          Erstelle deine erste Kampagne im KI-Berater.
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1100px' }}>
      {/* Summary stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <StatBox label="Gesamt gesendet" value={totalSent.toLocaleString('de-DE')} />
        <StatBox
          label="Ø Öffnungsrate"
          value={avgOpenRate !== null ? `${avgOpenRate.toFixed(1)}%` : '—'}
        />
        <StatBox
          label="Ø Klickrate"
          value={avgClickRate !== null ? `${avgClickRate.toFixed(1)}%` : '—'}
        />
        <StatBox
          label="Generierter Umsatz"
          value={totalRevenue > 0 ? `€${totalRevenue.toFixed(2)}` : '—'}
          accent
        />
      </div>

      {/* DSGVO notice */}
      <p
        style={{
          fontSize: '12px',
          color: '#6b7280',
          marginBottom: '24px',
          padding: '10px 14px',
          background: 'rgba(107,114,128,0.08)',
          borderRadius: '8px',
          display: 'inline-block',
        }}
      >
        📋 Nur aggregierte Daten — kein persönliches Tracking. DSGVO-konform.
      </p>

      {/* Campaigns table */}
      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          overflow: 'hidden',
          marginBottom: '24px',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                {['Kampagne', 'Gesendet am', 'Empfänger', 'Öffnungsrate', 'Klicks', 'Umsatz', 'Typ'].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#9ca3af',
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => {
                const or = openRate(c)
                const cr = clickRate(c)
                return (
                  <tr
                    key={c.id}
                    style={{
                      borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <td style={{ padding: '12px 16px', color: '#f3f4f6', fontWeight: 500 }}>
                      {c.subject.length > 40 ? c.subject.slice(0, 40) + '…' : c.subject}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {formatDate(c.sent_at)}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#d1d5db' }}>
                      {(c.recipient_count ?? 0).toLocaleString('de-DE')}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#d1d5db' }}>
                      {or !== null ? `${or.toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#d1d5db' }}>
                      {c.click_count ?? 0}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#d1d5db' }}>
                      {formatEur(c.conversion_revenue)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <TypeBadge type={c.template_type} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Benchmark box */}
      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '20px 24px',
        }}
      >
        <p
          style={{
            fontWeight: 700,
            color: '#f3f4f6',
            marginBottom: '16px',
            fontSize: '15px',
          }}
        >
          Ihr Durchschnitt vs. Branche (Gastronomie DE)
        </p>
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          <BenchmarkRow
            label="Öffnungsrate"
            yours={avgOpenRate}
            industry={INDUSTRY_OPEN_RATE}
            unit="%"
          />
          <BenchmarkRow
            label="Klickrate"
            yours={avgClickRate}
            industry={INDUSTRY_CLICK_RATE}
            unit="%"
          />
        </div>
      </div>
    </div>
  )
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${accent ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '12px',
        padding: '20px',
      }}
    >
      <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: 500 }}>
        {label}
      </p>
      <p
        style={{
          fontSize: '28px',
          fontWeight: 800,
          color: accent ? '#f97316' : '#f3f4f6',
          lineHeight: 1,
        }}
      >
        {value}
      </p>
    </div>
  )
}

function BenchmarkRow({
  label,
  yours,
  industry,
  unit,
}: {
  label: string
  yours: number | null
  industry: number
  unit: string
}) {
  const isAbove = yours !== null && yours >= industry
  const color = yours === null ? '#6b7280' : isAbove ? '#22c55e' : '#ef4444'

  return (
    <div>
      <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ fontSize: '22px', fontWeight: 700, color }}>
          {yours !== null ? `${yours.toFixed(1)}${unit}` : '—'}
        </span>
        <span style={{ fontSize: '13px', color: '#6b7280' }}>
          vs. {industry}
          {unit} (Branche)
        </span>
        {yours !== null && (
          <span style={{ fontSize: '12px', color, fontWeight: 600 }}>
            {isAbove ? '▲ darüber' : '▼ darunter'}
          </span>
        )}
      </div>
    </div>
  )
}
