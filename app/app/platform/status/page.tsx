import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

const CHECK_ICONS: Record<string, string> = {
  ok:      '✓',
  warn:    '⚠',
  error:   '✗',
  unknown: '?',
}
const CHECK_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  ok:      { text: '#34d399', bg: 'rgba(52,211,153,0.07)',   border: 'rgba(52,211,153,0.2)' },
  warn:    { text: '#fbbf24', bg: 'rgba(251,191,36,0.07)',   border: 'rgba(251,191,36,0.2)' },
  error:   { text: '#f87171', bg: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.2)' },
  unknown: { text: '#888',    bg: 'rgba(255,255,255,0.03)',  border: 'rgba(255,255,255,0.08)' },
}

type CheckResult = { name: string; status: 'ok' | 'warn' | 'error' | 'unknown'; detail: string; ms?: number }

export default async function StatusPage() {
  await requirePlatformAccess()
  const admin = createSupabaseAdmin()

  const checks: CheckResult[] = []

  // ── 1. Database connectivity ──────────────────────────────────────────────
  const t0 = Date.now()
  try {
    const { error } = await admin.from('restaurants').select('id', { head: true, count: 'exact' })
    const ms = Date.now() - t0
    if (error) {
      checks.push({ name: 'Supabase DB', status: 'error', detail: error.message, ms })
    } else if (ms > 2000) {
      checks.push({ name: 'Supabase DB', status: 'warn', detail: `Langsam (${ms}ms)`, ms })
    } else {
      checks.push({ name: 'Supabase DB', status: 'ok', detail: `${ms}ms`, ms })
    }
  } catch (e) {
    checks.push({ name: 'Supabase DB', status: 'error', detail: String(e), ms: Date.now() - t0 })
  }

  // ── 2. Auth system ────────────────────────────────────────────────────────
  const t1 = Date.now()
  try {
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1 })
    const ms = Date.now() - t1
    if (error) {
      checks.push({ name: 'Auth System', status: 'error', detail: error.message, ms })
    } else {
      checks.push({ name: 'Auth System', status: 'ok', detail: `${ms}ms · ${data?.users?.length ?? 0} User geprüft`, ms })
    }
  } catch (e) {
    checks.push({ name: 'Auth System', status: 'error', detail: String(e), ms: Date.now() - t1 })
  }

  // ── 3. Orders table ───────────────────────────────────────────────────────
  const t2 = Date.now()
  try {
    const { count, error } = await admin.from('orders').select('*', { head: true, count: 'exact' })
    const ms = Date.now() - t2
    if (error) {
      checks.push({ name: 'Orders Table', status: 'error', detail: error.message, ms })
    } else {
      checks.push({ name: 'Orders Table', status: 'ok', detail: `${count?.toLocaleString('de') ?? '?'} Einträge · ${ms}ms`, ms })
    }
  } catch (e) {
    checks.push({ name: 'Orders Table', status: 'error', detail: String(e) })
  }

  // ── 4. Menu items ─────────────────────────────────────────────────────────
  const t3 = Date.now()
  try {
    const { count, error } = await admin.from('menu_items').select('*', { head: true, count: 'exact' })
    const ms = Date.now() - t3
    if (error) {
      checks.push({ name: 'Menu Items', status: 'error', detail: error.message, ms })
    } else {
      checks.push({ name: 'Menu Items', status: 'ok', detail: `${count?.toLocaleString('de') ?? '?'} Einträge · ${ms}ms`, ms })
    }
  } catch (e) {
    checks.push({ name: 'Menu Items', status: 'error', detail: String(e) })
  }

  // ── 5. Audit log table ────────────────────────────────────────────────────
  const t4 = Date.now()
  try {
    const { count, error } = await admin.from('platform_audit_log').select('*', { head: true, count: 'exact' })
    const ms = Date.now() - t4
    if (error) {
      checks.push({ name: 'Audit Log', status: 'warn', detail: 'Tabelle nicht gefunden — Migration ausstehend?', ms })
    } else {
      checks.push({ name: 'Audit Log', status: 'ok', detail: `${count?.toLocaleString('de') ?? '?'} Einträge · ${ms}ms`, ms })
    }
  } catch {
    checks.push({ name: 'Audit Log', status: 'warn', detail: 'Nicht erreichbar' })
  }

  // ── 6. Stale orders (stuck in "cooking" or "new" > 2h) ───────────────────
  const staleThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const { data: staleOrders } = await admin.from('orders')
    .select('id')
    .in('status', ['new', 'cooking'])
    .lt('created_at', staleThreshold)
  const staleCount = staleOrders?.length ?? 0
  checks.push({
    name: 'Stale Orders',
    status: staleCount > 10 ? 'warn' : 'ok',
    detail: staleCount === 0 ? 'Keine veralteten Orders' : `${staleCount} Orders seit >2h in new/cooking`,
  })

  // ── 7. Restaurants without menu ──────────────────────────────────────────
  const { data: allRests } = await admin.from('restaurants').select('id').eq('active', true)
  const { data: restsWithMenu } = await admin.from('menu_items').select('restaurant_id').not('restaurant_id', 'is', null)
  const withMenuSet = new Set((restsWithMenu ?? []).map(r => r.restaurant_id))
  const noMenu = (allRests ?? []).filter(r => !withMenuSet.has(r.id)).length
  checks.push({
    name: 'Aktive Restaurants ohne Menü',
    status: noMenu > 5 ? 'warn' : 'ok',
    detail: noMenu === 0 ? 'Alle aktiven Restaurants haben ein Menü' : `${noMenu} aktive Restaurants ohne Menüpunkte`,
  })

  // ── 8. Trial restaurants expired but plan still = trial ──────────────────
  const { data: expiredTrials } = await admin.from('restaurants')
    .select('id').eq('plan', 'trial').lt('trial_ends_at', new Date().toISOString())
  const expiredStuck = expiredTrials?.length ?? 0
  checks.push({
    name: 'Abgelaufene Trials',
    status: expiredStuck > 0 ? 'warn' : 'ok',
    detail: expiredStuck === 0 ? 'Keine abgelaufenen Trial-Accounts' : `${expiredStuck} Trials abgelaufen, Plan noch "trial"`,
  })

  // ── Recent order volume ───────────────────────────────────────────────────
  const now = Date.now()
  const { data: recentOrders } = await admin.from('orders')
    .select('created_at, total, status')
    .gte('created_at', new Date(now - 24 * 60 * 60 * 1000).toISOString())
  const recent24h = recentOrders ?? []
  const recent1h = recent24h.filter(o => new Date(o.created_at).getTime() > now - 60 * 60 * 1000)

  // ── Platform summary numbers ──────────────────────────────────────────────
  const { data: summary } = await admin.from('restaurants').select('plan, active')
  const totalRests = summary?.length ?? 0
  const activeRests = summary?.filter(r => r.active).length ?? 0
  const paidRests = summary?.filter(r => !['trial', 'expired'].includes(r.plan)).length ?? 0

  const overallStatus = checks.some(c => c.status === 'error') ? 'error'
    : checks.some(c => c.status === 'warn') ? 'warn' : 'ok'

  const overallConf = CHECK_COLORS[overallStatus]

  return (
    <div style={{ padding: '32px 28px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ color: 'rgba(52,211,153,0.7)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>System</div>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.03em', marginBottom: '6px' }}>Platform Status</h1>
        <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.85rem' }}>Live-Systemcheck · generiert {new Date().toLocaleTimeString('de-DE')}</p>
      </div>

      {/* Overall status banner */}
      <div style={{ background: overallConf.bg, border: `1px solid ${overallConf.border}`, borderRadius: '16px', padding: '20px 24px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: `${overallConf.text}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
          {CHECK_ICONS[overallStatus]}
        </div>
        <div>
          <div style={{ color: overallConf.text, fontWeight: 800, fontSize: '1rem' }}>
            {overallStatus === 'ok' ? 'Alle Systeme betriebsbereit' : overallStatus === 'warn' ? 'Einige Warnungen aktiv' : 'Systemfehler erkannt'}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', marginTop: '2px' }}>
            {checks.filter(c => c.status === 'ok').length}/{checks.length} Checks bestanden
          </div>
        </div>
        {overallStatus === 'ok' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '5px', alignItems: 'center' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', animation: 'pulse 2s infinite' }} />
            <span style={{ color: '#34d399', fontSize: '0.72rem', fontWeight: 700 }}>Operational</span>
          </div>
        )}
      </div>

      {/* Service checks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '28px' }}>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px', paddingLeft: '2px' }}>Service Checks</div>
        {checks.map(c => {
          const conf = CHECK_COLORS[c.status]
          return (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 18px', background: conf.bg, border: `1px solid ${conf.border}`, borderRadius: '10px' }}>
              <span style={{ color: conf.text, fontWeight: 800, fontSize: '0.9rem', width: '16px', textAlign: 'center', flexShrink: 0 }}>{CHECK_ICONS[c.status]}</span>
              <span style={{ flex: 1, color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '0.83rem' }}>{c.name}</span>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem', textAlign: 'right' }}>{c.detail}</span>
              {c.ms !== undefined && (
                <span style={{ color: c.ms > 1000 ? '#fbbf24' : 'rgba(255,255,255,0.15)', fontSize: '0.65rem', minWidth: '48px', textAlign: 'right' }}>
                  {c.ms}ms
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Live activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '28px' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px' }}>Live Aktivität</div>
          {[
            { label: 'Orders (letzte 1h)', value: recent1h.length, color: '#34d399' },
            { label: 'Orders (letzte 24h)', value: recent24h.length, color: '#60a5fa' },
            { label: 'GMV (letzte 24h)', value: `€${recent24h.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total ?? 0), 0).toFixed(0)}`, color: '#fbbf24' },
            { label: 'Storno (24h)', value: recent24h.filter(o => o.status === 'cancelled').length, color: '#f87171' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem' }}>{item.label}</span>
              <span style={{ color: item.color, fontWeight: 700, fontSize: '0.88rem' }}>{item.value}</span>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px' }}>Platform Zahlen</div>
          {[
            { label: 'Restaurants gesamt', value: totalRests, color: '#c4b5fd' },
            { label: 'Aktiv', value: activeRests, color: '#34d399' },
            { label: 'Paid', value: paidRests, color: '#fbbf24' },
            { label: 'Stale Orders (>2h)', value: staleCount, color: staleCount > 0 ? '#fbbf24' : '#34d399' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem' }}>{item.label}</span>
              <span style={{ color: item.color, fontWeight: 700, fontSize: '0.88rem' }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reload hint */}
      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.1)', fontSize: '0.72rem' }}>
        Seite neu laden für aktuelle Werte · Checks laufen serverseitig on-demand
      </div>
    </div>
  )
}
