'use client'

import { useState, useMemo } from 'react'

interface Subscriber {
  id: string
  email: string
  name: string | null
  opted_in_at: string | null
  last_order_at: string | null
  order_type_preference: 'dine-in' | 'delivery' | 'pickup' | null
  source: string | null
}

interface Props {
  subscribers: Subscriber[]
  totalCount: number
  loyaltyCount: number
  restaurantId: string
}

type Segment = 'all' | 'loyalty' | 'inactive' | 'delivery' | 'dine-in'

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'loyalty', label: 'Loyalty' },
  { key: 'inactive', label: 'Inaktiv 30d' },
  { key: 'delivery', label: 'Nur Delivery' },
  { key: 'dine-in', label: 'Nur Dine-in' },
]

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function isInactive(sub: Subscriber): boolean {
  if (!sub.last_order_at) return true
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  return new Date(sub.last_order_at) < cutoff
}

export function SubscriberList({ subscribers, totalCount, loyaltyCount }: Props) {
  const [segment, setSegment] = useState<Segment>('all')

  const inactiveCount = useMemo(
    () => subscribers.filter(isInactive).length,
    [subscribers]
  )

  const filtered = useMemo(() => {
    switch (segment) {
      case 'inactive':
        return subscribers.filter(isInactive)
      case 'delivery':
        return subscribers.filter((s) => s.order_type_preference === 'delivery')
      case 'dine-in':
        return subscribers.filter((s) => s.order_type_preference === 'dine-in')
      // 'loyalty' and 'all' shown from full list (loyalty has no direct flag on subscriber)
      default:
        return subscribers
    }
  }, [subscribers, segment])

  function exportCsv() {
    const headers = ['Email', 'Name', 'Seit', 'Letzte Bestellung', 'Quelle']
    const rows = filtered.map((s) => [
      s.email,
      s.name ?? '',
      formatDate(s.opted_in_at),
      formatDate(s.last_order_at),
      s.source ?? '',
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'abonnenten.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1100px' }}>
      {/* Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <StatBox label="Abonnenten gesamt" value={totalCount.toLocaleString('de-DE')} />
        <StatBox label="Loyalitätsmitglieder" value={loyaltyCount.toLocaleString('de-DE')} accent />
        <StatBox label="Inaktiv (30+ Tage)" value={inactiveCount.toLocaleString('de-DE')} />
      </div>

      {/* Segment tabs + Export */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {SEGMENTS.map((seg) => (
            <button
              key={seg.key}
              onClick={() => setSegment(seg.key)}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background:
                  segment === seg.key ? '#f97316' : 'rgba(255,255,255,0.07)',
                color: segment === seg.key ? '#fff' : '#9ca3af',
                transition: 'all 0.15s',
              }}
            >
              {seg.label}
            </button>
          ))}
        </div>

        <button
          onClick={exportCsv}
          style={{
            padding: '7px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            border: '1px solid rgba(249,115,22,0.4)',
            background: 'transparent',
            color: '#f97316',
            cursor: 'pointer',
          }}
        >
          CSV Export
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            color: '#6b7280',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <p style={{ fontSize: '15px', color: '#9ca3af' }}>
            Keine Abonnenten in diesem Segment.
          </p>
        </div>
      ) : (
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                  {['Email', 'Name', 'Seit', 'Letzte Bestellung', 'Quelle'].map((h) => (
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
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr
                    key={s.id}
                    style={{
                      borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <td style={{ padding: '12px 16px', color: '#f3f4f6', fontWeight: 500 }}>
                      {s.email}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#d1d5db' }}>
                      {s.name ?? '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {formatDate(s.opted_in_at)}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {formatDate(s.last_order_at)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <SourceBadge source={s.source} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
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

const SOURCE_COLORS: Record<string, string> = {
  order: '#3b82f6',
  manual: '#6b7280',
  import: '#a855f7',
  loyalty: '#f97316',
  qr: '#22c55e',
}

function SourceBadge({ source }: { source: string | null }) {
  const key = source ?? 'manual'
  const color = SOURCE_COLORS[key] ?? '#6b7280'
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
      }}
    >
      {key}
    </span>
  )
}
