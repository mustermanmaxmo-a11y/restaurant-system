import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const PLAN_COLOR: Record<string, string> = {
  trial: '#60a5fa', starter: '#34d399', pro: '#fbbf24', enterprise: '#35c0db', expired: '#f87171',
}
const PLAN_MRR: Record<string, number> = { starter: 29, pro: 79, enterprise: 199, trial: 0, expired: 0 }

function spark(vals: number[]): string {
  if (vals.length === 0) return ''
  const max = Math.max(...vals, 1)
  const h = 28
  const w = vals.length * 6
  const pts = vals.map((v, i) => `${i * 6 + 3},${h - Math.round((v / max) * (h - 4)) - 2}`).join(' ')
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="rgba(14,116,144,0.6)" stroke-width="1.5" stroke-linejoin="round" /></svg>`
}

export default async function LeaderboardPage() {
  await requirePlatformAccess()
  const admin = createSupabaseAdmin()

  const now = Date.now()
  const d90 = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString()
  const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
  const d60 = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: restaurants }, { data: allOrders }] = await Promise.all([
    admin.from('restaurants').select('id, name, slug, plan, active, created_at'),
    admin.from('orders')
      .select('restaurant_id, total, created_at, status')
      .gte('created_at', d90)
      .neq('status', 'cancelled'),
  ])

  const rests = restaurants ?? []
  const orders = allOrders ?? []

  // Per-restaurant stats
  type RankRow = {
    id: string; name: string; slug: string; plan: string; active: boolean
    gmv90: number; gmv30: number; gmvPrev30: number; orderCount90: number; orderCount30: number
    avgOrder: number; growth: number; mrr: number; weeklyGmv: number[]
  }

  const rows: RankRow[] = rests.map(r => {
    const ro = orders.filter(o => o.restaurant_id === r.id)
    const ro30 = ro.filter(o => o.created_at >= d30)
    const roP30 = ro.filter(o => o.created_at >= d60 && o.created_at < d30)

    const gmv90 = ro.reduce((s, o) => s + (o.total ?? 0), 0)
    const gmv30 = ro30.reduce((s, o) => s + (o.total ?? 0), 0)
    const gmvPrev = roP30.reduce((s, o) => s + (o.total ?? 0), 0)
    const growth = gmvPrev > 0 ? ((gmv30 - gmvPrev) / gmvPrev) * 100 : gmv30 > 0 ? 100 : 0

    // Weekly GMV last 12 weeks
    const weeklyGmv: number[] = []
    for (let i = 11; i >= 0; i--) {
      const ws = new Date(now - (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString()
      const we = new Date(now - i * 7 * 24 * 60 * 60 * 1000).toISOString()
      weeklyGmv.push(ro.filter(o => o.created_at >= ws && o.created_at < we).reduce((s, o) => s + (o.total ?? 0), 0))
    }

    return {
      id: r.id, name: r.name, slug: r.slug, plan: r.plan, active: r.active,
      gmv90, gmv30, gmvPrev30: gmvPrev, orderCount90: ro.length, orderCount30: ro30.length,
      avgOrder: ro30.length > 0 ? gmv30 / ro30.length : 0,
      growth, mrr: PLAN_MRR[r.plan] ?? 0, weeklyGmv,
    }
  })

  // Sort by GMV 90d desc
  const byGmv = [...rows].sort((a, b) => b.gmv90 - a.gmv90).filter(r => r.gmv90 > 0)
  const byOrders = [...rows].sort((a, b) => b.orderCount30 - a.orderCount30).filter(r => r.orderCount30 > 0)
  const byGrowth = [...rows].sort((a, b) => b.growth - a.growth).filter(r => r.orderCount30 >= 5)
  const byAvg = [...rows].sort((a, b) => b.avgOrder - a.avgOrder).filter(r => r.orderCount30 >= 3)

  const totalGmv90 = rows.reduce((s, r) => s + r.gmv90, 0)
  const totalOrders90 = rows.reduce((s, r) => s + r.orderCount90, 0)
  const top5Share = byGmv.slice(0, 5).reduce((s, r) => s + r.gmv90, 0)
  const top5Pct = totalGmv90 > 0 ? Math.round((top5Share / totalGmv90) * 100) : 0

  function medal(rank: number) {
    if (rank === 0) return '🥇'
    if (rank === 1) return '🥈'
    if (rank === 2) return '🥉'
    return `${rank + 1}.`
  }

  function fmt(n: number) { return `€${n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n.toFixed(0)}` }

  return (
    <div style={{ padding: '32px 28px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ color: 'rgba(196,181,253,0.6)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Wachstum</div>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.03em', marginBottom: '6px' }}>Leaderboard</h1>
        <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.85rem' }}>Top-Restaurants nach GMV, Bestellungen, Wachstum & Ø-Bestellwert · letzte 90 Tage</p>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '32px' }}>
        {[
          { label: 'Plattform GMV (90d)', value: fmt(totalGmv90), color: '#34d399' },
          { label: 'Bestellungen (90d)', value: totalOrders90.toLocaleString('de'), color: '#60a5fa' },
          { label: 'Ranked Restaurants', value: String(byGmv.length), color: '#7dd3e8' },
          { label: 'Top-5 GMV-Anteil', value: `${top5Pct}%`, color: '#fbbf24' },
        ].map(k => (
          <div key={k.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '18px 20px' }}>
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>{k.label}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* 4-column leaderboard grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>

        {/* By GMV */}
        <RankTable title="Top GMV (90d)" sub="Gesamtumsatz der letzten 90 Tage" rows={byGmv.slice(0, 10).map((r, i) => ({
          rank: medal(i), name: r.name, slug: r.slug, id: r.id, plan: r.plan,
          main: fmt(r.gmv90),
          sub2: `${r.orderCount90} Bestellungen`,
          bar: totalGmv90 > 0 ? (r.gmv90 / totalGmv90) * 100 : 0,
          barColor: '#34d399', sparkVals: r.weeklyGmv,
        }))} />

        {/* By Orders */}
        <RankTable title="Top Bestellungen (30d)" sub="Höchstes Bestellvolumen letzter Monat" rows={byOrders.slice(0, 10).map((r, i) => ({
          rank: medal(i), name: r.name, slug: r.slug, id: r.id, plan: r.plan,
          main: `${r.orderCount30}`,
          sub2: `Ø €${r.avgOrder.toFixed(2)}`,
          bar: byOrders[0]?.orderCount30 > 0 ? (r.orderCount30 / byOrders[0].orderCount30) * 100 : 0,
          barColor: '#60a5fa', sparkVals: r.weeklyGmv,
        }))} />

        {/* By Growth */}
        <RankTable title="Schnellstes Wachstum" sub="GMV-Wachstum 30d vs. Vormonat (min. 5 Orders)" rows={byGrowth.slice(0, 10).map((r, i) => ({
          rank: medal(i), name: r.name, slug: r.slug, id: r.id, plan: r.plan,
          main: `+${r.growth.toFixed(0)}%`,
          sub2: `${fmt(r.gmvPrev30)} → ${fmt(r.gmv30)}`,
          bar: byGrowth[0]?.growth > 0 ? Math.min((r.growth / byGrowth[0].growth) * 100, 100) : 0,
          barColor: '#f59e0b', sparkVals: r.weeklyGmv,
          highlight: r.growth > 100,
        }))} />

        {/* By Avg order */}
        <RankTable title="Höchster Ø-Bestellwert" sub="Durchschnittliche Bestellgröße (30d, min. 3)" rows={byAvg.slice(0, 10).map((r, i) => ({
          rank: medal(i), name: r.name, slug: r.slug, id: r.id, plan: r.plan,
          main: `€${r.avgOrder.toFixed(2)}`,
          sub2: `${r.orderCount30} Orders`,
          bar: byAvg[0]?.avgOrder > 0 ? (r.avgOrder / byAvg[0].avgOrder) * 100 : 0,
          barColor: '#35c0db', sparkVals: r.weeklyGmv,
        }))} />
      </div>
    </div>
  )
}

type RankTableRow = {
  rank: string; name: string; slug: string; id: string; plan: string
  main: string; sub2: string; bar: number; barColor: string; sparkVals: number[]
  highlight?: boolean
}

function RankTable({ title, sub, rows }: { title: string; sub: string; rows: RankTableRow[] }) {
  const pc = (plan: string) => PLAN_COLOR[plan] ?? '#888'
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700, fontSize: '0.88rem' }}>{title}</div>
        <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.7rem', marginTop: '2px' }}>{sub}</div>
      </div>
      {rows.length === 0 && (
        <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.12)', fontSize: '0.8rem' }}>Keine Daten</div>
      )}
      {rows.map((r, i) => (
        <Link key={r.id} href={`/platform/restaurants/${r.id}`} style={{ textDecoration: 'none', display: 'block' }}>
          <div style={{ padding: '10px 20px', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined, transition: 'background 0.1s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
              <span style={{ fontSize: '0.8rem', minWidth: '24px', color: i < 3 ? '#fbbf24' : 'rgba(255,255,255,0.25)', fontWeight: 700 }}>{r.rank}</span>
              <span style={{ flex: 1, color: 'rgba(255,255,255,0.75)', fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              <span style={{ fontSize: '0.62rem', padding: '2px 7px', borderRadius: '10px', background: `${pc(r.plan)}18`, color: pc(r.plan), fontWeight: 700 }}>{r.plan}</span>
              <span style={{ color: r.highlight ? '#34d399' : 'rgba(255,255,255,0.7)', fontWeight: 800, fontSize: '0.85rem', minWidth: '60px', textAlign: 'right' }}>{r.main}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.65rem', minWidth: '24px' }} />
              <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max(r.bar, 0)}%`, background: r.barColor, borderRadius: '2px', transition: 'width 0.3s' }} />
              </div>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.62rem', minWidth: '80px', textAlign: 'right' }}>{r.sub2}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
