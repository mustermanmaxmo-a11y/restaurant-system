import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function RestaurantTablesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requirePlatformAccess()
  const admin = createSupabaseAdmin()

  const d90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: restaurant }, { data: tables }, { data: allOrders }] = await Promise.all([
    admin.from('restaurants').select('id, name, slug').eq('id', id).single(),
    admin.from('tables').select('id, table_number, qr_code_url, created_at').eq('restaurant_id', id).order('table_number'),
    admin.from('orders')
      .select('id, table_number, total, status, created_at')
      .eq('restaurant_id', id)
      .gte('created_at', d90)
      .neq('status', 'cancelled'),
  ])

  if (!restaurant) notFound()

  const orders: { id: string; table_number: string; total: number; status: string; created_at: string }[] = allOrders ?? []
  const tableList: { id: string; table_number: string; qr_code_url: string | null; created_at: string }[] = tables ?? []

  // Per-table analytics
  const tableNumbers = [...new Set([
    ...tableList.map(t => String(t.table_number)),
    ...orders.map(o => String(o.table_number)).filter(Boolean),
  ])].sort((a, b) => {
    const na = parseInt(a), nb = parseInt(b)
    return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb
  })

  const now = Date.now()
  const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  type TableStat = {
    number: string; hasQr: boolean; qrUrl: string | null
    orders90: number; orders30: number; orders7: number
    gmv90: number; gmv30: number; avgOrder: number
    lastOrderDate: string | null; lastOrderDaysAgo: number | null
    peakHour: number; served: number; hourlyDist: number[]
  }

  const stats: TableStat[] = tableNumbers.map(tn => {
    const to = orders.filter(o => String(o.table_number) === tn)
    const to30 = to.filter(o => o.created_at >= d30)
    const to7  = to.filter(o => o.created_at >= d7)
    const served = to.filter(o => o.status === 'served')
    const tableRow = tableList.find(t => String(t.table_number) === tn)

    const lastOrder = to.sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    const lastDaysAgo = lastOrder ? Math.floor((now - new Date(lastOrder.created_at).getTime()) / (1000 * 60 * 60 * 24)) : null

    const hourly = Array(24).fill(0)
    for (const o of to) hourly[new Date(o.created_at).getHours()]++
    const peakHour = hourly.indexOf(Math.max(...hourly))

    return {
      number: tn,
      hasQr: !!tableRow?.qr_code_url,
      qrUrl: tableRow?.qr_code_url ?? null,
      orders90: to.length,
      orders30: to30.length,
      orders7: to7.length,
      gmv90: to.reduce((s, o) => s + (o.total ?? 0), 0),
      gmv30: to30.reduce((s, o) => s + (o.total ?? 0), 0),
      avgOrder: served.length > 0 ? served.reduce((s, o) => s + (o.total ?? 0), 0) / served.length : 0,
      lastOrderDate: lastOrder?.created_at ?? null,
      lastOrderDaysAgo: lastDaysAgo,
      served: served.length,
      peakHour,
      hourlyDist: hourly,
    }
  }).sort((a, b) => b.orders90 - a.orders90)

  const totalOrders = orders.length
  const topTable = stats[0]
  const coldTables = stats.filter(t => t.orders7 === 0 && t.orders90 > 0)
  const noOrderTables = stats.filter(t => t.orders90 === 0)

  return (
    <div style={{ padding: '32px 28px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '28px', flexWrap: 'wrap' }}>
        {[
          { label: 'Übersicht',   href: `/platform/restaurants/${id}` },
          { label: 'Analytics',  href: `/platform/restaurants/${id}/analytics` },
          { label: 'Orders',     href: `/platform/restaurants/${id}/orders` },
          { label: 'Speisekarte', href: `/platform/restaurants/${id}/menu` },
          { label: 'Tische',     href: `/platform/restaurants/${id}/tables`, active: true },
        ].map(n => (
          <Link key={n.href} href={n.href} style={{
            padding: '5px 14px', borderRadius: '20px', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600,
            background: n.active ? 'rgba(14,116,144,0.2)' : 'transparent',
            border: `1px solid ${n.active ? 'rgba(14,116,144,0.4)' : 'rgba(255,255,255,0.08)'}`,
            color: n.active ? '#7dd3e8' : 'rgba(255,255,255,0.35)',
          }}>{n.label}</Link>
        ))}
      </div>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Tisch-Analyse — {restaurant.name}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.82rem' }}>{tableNumbers.length} Tische · {totalOrders} Bestellungen (90d)</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Tische gesamt', value: String(tableNumbers.length), color: '#7dd3e8' },
          { label: 'Aktivster Tisch', value: topTable ? `Tisch ${topTable.number}` : '—', color: '#fbbf24', sub: topTable ? `${topTable.orders90} Orders` : '' },
          { label: 'Kalt (7d inaktiv)', value: String(coldTables.length), color: '#f87171' },
          { label: 'Ohne QR', value: String(tableList.filter(t => !t.qr_code_url).length), color: '#60a5fa' },
        ].map(k => (
          <div key={k.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>{k.label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
            {k.sub && <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem', marginTop: '3px' }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Visual table grid */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '22px', marginBottom: '20px' }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>Tisch-Übersicht (Aktivität 90d)</div>
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.68rem', marginBottom: '16px' }}>Größe = Bestellvolumen · Farbe = Aktivität</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {stats.map(t => {
            const maxOrders = stats[0]?.orders90 ?? 1
            const intensity = maxOrders > 0 ? t.orders90 / maxOrders : 0
            const size = 44 + Math.round(intensity * 32)
            const bg = t.orders7 > 0 ? `rgba(52,211,153,${0.15 + intensity * 0.5})`
              : t.orders90 > 0 ? `rgba(251,191,36,${0.1 + intensity * 0.3})`
              : 'rgba(255,255,255,0.04)'
            const border = t.orders7 > 0 ? 'rgba(52,211,153,0.3)'
              : t.orders90 > 0 ? 'rgba(251,191,36,0.25)'
              : 'rgba(255,255,255,0.07)'
            const textColor = t.orders7 > 0 ? '#34d399' : t.orders90 > 0 ? '#fbbf24' : 'rgba(255,255,255,0.2)'
            return (
              <div key={t.number}
                title={`Tisch ${t.number}: ${t.orders90} Orders (90d) · €${t.gmv90.toFixed(0)} · ${t.orders7 > 0 ? 'aktiv' : t.orders90 > 0 ? 'kalt' : 'nie'}`}
                style={{
                  width: `${size}px`, height: `${size}px`, borderRadius: '10px',
                  background: bg, border: `1px solid ${border}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'default',
                }}>
                <div style={{ color: textColor, fontWeight: 800, fontSize: '0.72rem' }}>{t.number}</div>
                {t.orders90 > 0 && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.52rem' }}>{t.orders90}</div>}
                {t.hasQr && <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#35c0db', marginTop: '2px' }} />}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: '14px', marginTop: '14px', flexWrap: 'wrap' }}>
          {[
            { color: 'rgba(52,211,153,0.5)', label: 'Aktiv (7d)' },
            { color: 'rgba(251,191,36,0.4)', label: 'Kalt (>7d)' },
            { color: 'rgba(255,255,255,0.08)', label: 'Nie bestellt' },
            { color: '#35c0db', label: '● QR vorhanden', dot: true },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: l.dot ? '6px' : '10px', height: l.dot ? '6px' : '10px', borderRadius: l.dot ? '50%' : '3px', background: l.color, flexShrink: 0 }} />
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.65rem' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed table table */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.85rem' }}>Tisch-Details (sortiert nach Aktivität)</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Tisch', 'Orders 7d', 'Orders 30d', 'Orders 90d', 'GMV 90d', 'Ø/Order', 'Peak-Stunde', 'Letzter Order', 'QR'].map(h => (
                  <th key={h} style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.2)', fontWeight: 700, fontSize: '0.62rem', textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map((t, i) => {
                const isHot = t.orders7 > 0
                const isCold = !isHot && t.orders90 > 0
                return (
                  <tr key={t.number} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: i === 0 ? 'rgba(251,191,36,0.03)' : undefined }}>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(14,116,144,0.12)', color: '#7dd3e8', padding: '3px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>
                        
                        Tisch {t.number}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', color: t.orders7 > 0 ? '#34d399' : 'rgba(255,255,255,0.18)', fontWeight: t.orders7 > 0 ? 700 : 400 }}>{t.orders7 || '—'}</td>
                    <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.5)' }}>{t.orders30 || '—'}</td>
                    <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{t.orders90 || '—'}</td>
                    <td style={{ padding: '9px 14px', color: '#fbbf24', fontWeight: 700 }}>{t.gmv90 > 0 ? `€${t.gmv90.toFixed(0)}` : '—'}</td>
                    <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.4)' }}>{t.avgOrder > 0 ? `€${t.avgOrder.toFixed(2)}` : '—'}</td>
                    <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.4)' }}>{t.orders90 > 0 ? `${String(t.peakHour).padStart(2,'0')}:00` : '—'}</td>
                    <td style={{ padding: '9px 14px', color: isCold ? '#fbbf24' : isHot ? '#34d399' : 'rgba(255,255,255,0.15)', fontSize: '0.72rem' }}>
                      {t.lastOrderDaysAgo === null ? '—' : t.lastOrderDaysAgo === 0 ? 'heute' : `${t.lastOrderDaysAgo}d`}
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      {t.hasQr
                        ? <span style={{ color: '#35c0db', fontWeight: 700, fontSize: '0.7rem' }}>✓</span>
                        : <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: '0.7rem' }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {noOrderTables.length > 0 && (
        <div style={{ marginTop: '16px', background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: '12px', padding: '14px 18px' }}>
          <div style={{ color: '#f87171', fontWeight: 700, fontSize: '0.78rem', marginBottom: '4px' }}>
            ⚠ {noOrderTables.length} Tische ohne Bestellungen (90d)
          </div>
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>
            {noOrderTables.map(t => `Tisch ${t.number}`).join(' · ')}
          </div>
        </div>
      )}
    </div>
  )
}
