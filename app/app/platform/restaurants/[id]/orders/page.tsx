import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const STATUS_CONF: Record<string, { label: string; color: string; bg: string }> = {
  new:             { label: 'Neu',         color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
  cooking:         { label: 'In Zubereitung', color: '#818cf8', bg: 'rgba(129,140,248,0.1)' },
  served:          { label: 'Serviert',    color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  cancelled:       { label: 'Storniert',   color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  pending_payment: { label: 'Zahlung',     color: '#22d3ee', bg: 'rgba(34,211,238,0.08)' },
}

export default async function RestaurantOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requirePlatformAccess()
  const admin = createSupabaseAdmin()

  const d90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: restaurant }, { data: allOrders }] = await Promise.all([
    admin.from('restaurants').select('id, name, slug, plan').eq('id', id).single(),
    (admin as any).from('orders')
      .select('id, table_number, total, status, created_at, updated_at')
      .eq('restaurant_id', id)
      .gte('created_at', d90)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  if (!restaurant) notFound()

  const orders: { id: string; table_number: string; total: number; status: string; created_at: string; updated_at: string }[] = allOrders ?? []

  // Stats
  const served = orders.filter(o => o.status === 'served')
  const cancelled = orders.filter(o => o.status === 'cancelled')
  const gmv = served.reduce((s, o) => s + (o.total ?? 0), 0)
  const avgOrder = served.length > 0 ? gmv / served.length : 0

  // Status counts
  const statusCounts: Record<string, number> = {}
  for (const o of orders) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1

  // Hourly distribution
  const hourly = Array.from({ length: 24 }, (_, h) => ({
    h, count: orders.filter(o => new Date(o.created_at).getHours() === h).length,
  }))
  const maxHour = Math.max(...hourly.map(h => h.count), 1)

  // Daily last 30 days
  const now = Date.now()
  const daily = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * 24 * 60 * 60 * 1000)
    const ds = d.toISOString().slice(0, 10)
    const dayOrders = orders.filter(o => o.created_at.slice(0, 10) === ds)
    return { date: ds, label: d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }), count: dayOrders.length, gmv: dayOrders.filter(o => o.status === 'served').reduce((s, o) => s + (o.total ?? 0), 0) }
  })
  const maxDay = Math.max(...daily.map(d => d.count), 1)

  // Table distribution
  const byTable: Record<string, number> = {}
  for (const o of orders) {
    const t = o.table_number ?? 'unbekannt'
    byTable[t] = (byTable[t] ?? 0) + 1
  }
  const topTables = Object.entries(byTable).sort((a, b) => b[1] - a[1]).slice(0, 10)

  return (
    <div style={{ padding: '32px 28px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '28px' }}>
        {[
          { label: 'Übersicht',   href: `/platform/restaurants/${id}` },
          { label: 'Analytics',  href: `/platform/restaurants/${id}/analytics` },
          { label: 'Orders',     href: `/platform/restaurants/${id}/orders`, active: true },
          { label: 'Speisekarte', href: `/platform/restaurants/${id}/menu` },
          { label: 'Tische',     href: `/platform/restaurants/${id}/tables` },
        ].map(n => (
          <Link key={n.href} href={n.href} style={{
            padding: '5px 14px', borderRadius: '20px', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600,
            background: n.active ? 'rgba(124,58,237,0.2)' : 'transparent',
            border: `1px solid ${n.active ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
            color: n.active ? '#c4b5fd' : 'rgba(255,255,255,0.35)',
          }}>{n.label}</Link>
        ))}
      </div>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Orders — {restaurant.name}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.82rem' }}>Letzte 90 Tage · {orders.length} Bestellungen</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Gesamt Orders', value: String(orders.length), color: '#c4b5fd' },
          { label: 'Serviert', value: String(served.length), color: '#34d399' },
          { label: 'Storniert', value: `${cancelled.length} (${orders.length > 0 ? Math.round(cancelled.length / orders.length * 100) : 0}%)`, color: '#f87171' },
          { label: 'GMV (served)', value: `€${gmv.toFixed(2)}`, color: '#fbbf24' },
          { label: 'Ø Bestellwert', value: `€${avgOrder.toFixed(2)}`, color: '#60a5fa' },
        ].map(k => (
          <div key={k.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>{k.label}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Daily + hourly charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {/* Daily */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '14px' }}>Bestellungen pro Tag (30d)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '70px' }}>
            {daily.map((d, i) => (
              <div key={i} title={`${d.label}: ${d.count} Orders · €${d.gmv.toFixed(0)}`} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', height: `${Math.max(2, Math.round((d.count / maxDay) * 66))}px`, background: d.count > 0 ? 'rgba(124,58,237,0.55)' : 'rgba(255,255,255,0.04)', borderRadius: '2px 2px 0 0' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Hourly */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '14px' }}>Stunden-Verteilung</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1px', height: '60px' }}>
            {hourly.map(h => (
              <div key={h.h} title={`${h.h}:00 — ${h.count} Orders`} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', height: `${Math.max(1, Math.round((h.count / maxHour) * 56))}px`, background: h.count > 0 ? (h.h >= 11 && h.h <= 22 ? 'rgba(251,191,36,0.55)' : 'rgba(96,165,250,0.3)') : 'rgba(255,255,255,0.04)', borderRadius: '1px 1px 0 0' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.55rem' }}>0h</span>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.55rem' }}>12h</span>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.55rem' }}>23h</span>
          </div>
        </div>
      </div>

      {/* Status + Table dist */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {/* Status breakdown */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '14px' }}>Status-Verteilung</div>
          {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
            const c = STATUS_CONF[status] ?? { label: status, color: '#888', bg: 'rgba(255,255,255,0.05)' }
            const pct = orders.length > 0 ? (count / orders.length) * 100 : 0
            return (
              <div key={status} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: c.color, fontWeight: 700, fontSize: '0.78rem' }}>{c.label}</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>{count} ({pct.toFixed(0)}%)</span>
                </div>
                <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: c.color, borderRadius: '3px' }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Top tables */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '14px' }}>Top Tische</div>
          {topTables.map(([table, count], i) => (
            <div key={table} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem', minWidth: '16px' }}>{i + 1}.</span>
              <span style={{ background: 'rgba(124,58,237,0.15)', color: '#c4b5fd', padding: '2px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, minWidth: '60px', textAlign: 'center' }}>
                Tisch {table}
              </span>
              <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                <div style={{ height: '100%', width: `${(count / (topTables[0]?.[1] ?? 1)) * 100}%`, background: 'rgba(124,58,237,0.5)', borderRadius: '2px' }} />
              </div>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', minWidth: '30px', textAlign: 'right' }}>{count}×</span>
            </div>
          ))}
        </div>
      </div>

      {/* Order list */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.85rem' }}>Bestellungen (letzte 500)</div>
          <a href={`/api/platform/export?type=orders&days=90`} style={{ padding: '5px 11px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.07)', background: 'transparent', color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem', textDecoration: 'none' }}>↓ CSV</a>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Zeit', 'Tisch', 'Status', 'Betrag', 'ID'].map(h => (
                  <th key={h} style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.2)', fontWeight: 700, fontSize: '0.62rem', textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 100).map(o => {
                const sc = STATUS_CONF[o.status] ?? { label: o.status, color: '#888', bg: 'rgba(255,255,255,0.05)' }
                return (
                  <tr key={o.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px 14px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                      {new Date(o.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <span style={{ background: 'rgba(124,58,237,0.12)', color: '#c4b5fd', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700 }}>
                        {o.table_number ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <span style={{ background: sc.bg, color: sc.color, padding: '2px 8px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: 700 }}>{sc.label}</span>
                    </td>
                    <td style={{ padding: '8px 14px', color: 'rgba(255,255,255,0.65)', fontWeight: 700 }}>
                      {o.total != null ? `€${Number(o.total).toFixed(2)}` : '—'}
                    </td>
                    <td style={{ padding: '8px 14px', color: 'rgba(255,255,255,0.15)', fontFamily: 'monospace', fontSize: '0.65rem' }}>
                      {o.id.slice(0, 8)}…
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {orders.length > 100 && (
          <div style={{ padding: '12px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.18)', fontSize: '0.72rem', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            Zeige 100 von {orders.length} Bestellungen · CSV für alle exportieren
          </div>
        )}
      </div>
    </div>
  )
}
