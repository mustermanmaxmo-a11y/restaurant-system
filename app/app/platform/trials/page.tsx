import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const PLAN_MRR: Record<string, number> = { starter: 29, pro: 79, enterprise: 199 }

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function urgencyConf(days: number | null) {
  if (days === null) return { label: 'Kein Enddatum', color: '#888', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)' }
  if (days < 0)   return { label: 'Abgelaufen',     color: '#f87171', bg: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.2)' }
  if (days <= 2)  return { label: `${days}d`,        color: '#f87171', bg: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.2)' }
  if (days <= 7)  return { label: `${days}d`,        color: '#fbbf24', bg: 'rgba(251,191,36,0.07)',  border: 'rgba(251,191,36,0.2)' }
  if (days <= 14) return { label: `${days}d`,        color: '#60a5fa', bg: 'rgba(96,165,250,0.06)',  border: 'rgba(96,165,250,0.15)' }
  return                 { label: `${days}d`,        color: '#34d399', bg: 'rgba(52,211,153,0.05)',  border: 'rgba(52,211,153,0.12)' }
}

export default async function TrialsPage() {
  const { role } = await requirePlatformAccess()
  const admin = createSupabaseAdmin()

  const now = Date.now()
  const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: trials }, { data: recentOrders }, { data: usersRes }, { data: converted }] = await Promise.all([
    admin.from('restaurants')
      .select('id, name, slug, plan, active, trial_ends_at, created_at, owner_id, stripe_subscription_id')
      .eq('plan', 'trial')
      .order('trial_ends_at', { ascending: true }),
    admin.from('orders')
      .select('restaurant_id, total, created_at, status')
      .gte('created_at', d30)
      .neq('status', 'cancelled'),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('restaurants')
      .select('id, plan, created_at')
      .neq('plan', 'trial')
      .neq('plan', 'expired')
      .gte('created_at', new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  const trialList = trials ?? []
  const orders = recentOrders ?? []
  const emailMap: Record<string, string> = {}
  for (const u of usersRes?.users ?? []) emailMap[u.id] = u.email ?? ''

  // Enrich each trial
  type TrialRow = {
    id: string; name: string; slug: string; active: boolean
    trial_ends_at: string | null; created_at: string; owner_id: string
    email: string; days: number | null; orders30: number; gmv30: number
    hasStripe: boolean; signupDaysAgo: number
    conversionProbability: number
  }

  const rows: TrialRow[] = trialList.map(r => {
    const ro = orders.filter(o => o.restaurant_id === r.id)
    const gmv30 = ro.reduce((s, o) => s + (o.total ?? 0), 0)
    const days = daysUntil(r.trial_ends_at)
    const signupDaysAgo = Math.floor((now - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24))

    // Simple conversion probability score (0-100)
    let prob = 30 // base
    if (ro.length >= 10) prob += 30
    else if (ro.length >= 3) prob += 15
    if (gmv30 > 200) prob += 20
    else if (gmv30 > 50) prob += 10
    if (r.active) prob += 10
    if (days !== null && days > 0 && days <= 7) prob += 5 // urgency increases likelihood
    if (days !== null && days < 0) prob -= 20 // expired trial = bad sign
    if (!r.active) prob -= 20

    return {
      id: r.id, name: r.name, slug: r.slug, active: r.active,
      trial_ends_at: r.trial_ends_at, created_at: r.created_at, owner_id: r.owner_id,
      email: emailMap[r.owner_id] ?? '—',
      days, orders30: ro.length, gmv30,
      hasStripe: !!r.stripe_subscription_id,
      signupDaysAgo,
      conversionProbability: Math.min(Math.max(prob, 0), 100),
    }
  })

  // Sort by urgency (fewest days first)
  const sortedRows = [...rows].sort((a, b) => {
    if (a.days === null) return 1
    if (b.days === null) return -1
    return a.days - b.days
  })

  // Buckets
  const expired = sortedRows.filter(r => r.days !== null && r.days < 0)
  const urgent = sortedRows.filter(r => r.days !== null && r.days >= 0 && r.days <= 7)
  const soon = sortedRows.filter(r => r.days !== null && r.days > 7 && r.days <= 14)
  const healthy = sortedRows.filter(r => r.days === null || r.days > 14)

  const totalMrrPotential = rows.reduce((s, _) => s + 29, 0) // min: starter
  const highProbCount = rows.filter(r => r.conversionProbability >= 60).length
  const convRate90d = converted ? Math.round((converted.length / Math.max(converted.length + rows.length, 1)) * 100) : 0

  const canEmail = role === 'owner' || role === 'co_founder'

  function emailSubject(name: string) { return `Dein Restaurant ${name} — letzte Chance mit deinem Trial` }
  function emailBody(name: string, days: number | null) {
    return `Hallo,\n\ndein Test-Zugang für ${name} läuft ${days !== null && days > 0 ? `in ${days} Tag${days === 1 ? '' : 'en'}` : 'bald'} ab.\n\nJetzt upgraden unter: https://app.yourplatform.com/settings/billing\n\nBei Fragen einfach antworten.\n\nBeste Grüße`
  }

  return (
    <div style={{ padding: '32px 28px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ color: 'rgba(96,165,250,0.7)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Retention</div>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.03em', marginBottom: '6px' }}>Trial Pipeline</h1>
        <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.85rem' }}>
          {rows.length} aktive Trials · MRR-Potenzial €{totalMrrPotential}/mo · {highProbCount} mit hoher Conversion-Wahrscheinlichkeit
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '32px' }}>
        {[
          { label: 'Aktive Trials', value: String(rows.length), sub: 'gesamt', color: '#60a5fa' },
          { label: 'Läuft ab ≤7d', value: String(urgent.length + expired.length), sub: `davon ${expired.length} abgelaufen`, color: '#f87171' },
          { label: 'Conversion-Kandidaten', value: String(highProbCount), sub: 'Wahrsch. ≥60%', color: '#34d399' },
          { label: 'Konversion (90d)', value: `${convRate90d}%`, sub: `${converted?.length ?? 0} zu Paid gewechselt`, color: '#35c0db' },
        ].map(k => (
          <div key={k.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '18px 20px' }}>
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>{k.label}</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: k.color, lineHeight: 1, marginBottom: '4px' }}>{k.value}</div>
            <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.68rem' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Conversion probability distribution */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px 22px', marginBottom: '28px' }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '14px' }}>Conversion-Wahrscheinlichkeit Verteilung</div>
        <div style={{ display: 'flex', gap: '4px', height: '40px', alignItems: 'flex-end' }}>
          {Array.from({ length: 10 }, (_, i) => {
            const lo = i * 10, hi = lo + 10
            const cnt = rows.filter(r => r.conversionProbability >= lo && r.conversionProbability < hi).length
            const maxCnt = Math.max(...Array.from({ length: 10 }, (_, j) => rows.filter(r => r.conversionProbability >= j * 10 && r.conversionProbability < j * 10 + 10).length), 1)
            const color = lo >= 60 ? '#34d399' : lo >= 30 ? '#fbbf24' : '#f87171'
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: '3px' }}>
                {cnt > 0 && <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)' }}>{cnt}</div>}
                <div style={{ width: '100%', height: `${Math.max(3, Math.round((cnt / maxCnt) * 34))}px`, background: color, borderRadius: '2px 2px 0 0', opacity: cnt === 0 ? 0.15 : 0.7 }} />
                <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.2)' }}>{lo}%</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pipeline sections */}
      {[
        { title: 'Abgelaufen', dot: '#ef4444', list: expired, hint: 'Trial abgelaufen — sofort upgraden oder verlieren' },
        { title: 'Läuft ≤7 Tage ab', dot: '#fbbf24', list: urgent, hint: 'Kritisches Fenster — jetzt kontaktieren' },
        { title: 'Läuft 8–14 Tage ab', dot: '#35c0db', list: soon, hint: 'Ideal für proaktive Outreach-Kampagne' },
        { title: 'Noch >14 Tage', dot: '#34d399', list: healthy, hint: 'Genug Zeit — auf Aktivierung fokussieren' },
      ].filter(s => s.list.length > 0).map(section => (
        <div key={section.title} style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '12px' }}>
            <h2 style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: section.dot, flexShrink: 0 }} />
              {section.title} <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>({section.list.length})</span>
            </h2>
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.7rem' }}>{section.hint}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {section.list.map(r => {
              const uc = urgencyConf(r.days)
              const probColor = r.conversionProbability >= 60 ? '#34d399' : r.conversionProbability >= 30 ? '#fbbf24' : '#f87171'
              return (
                <div key={r.id} style={{ background: uc.bg, border: `1px solid ${uc.border}`, borderRadius: '12px', padding: '13px 18px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  {/* Days badge */}
                  <div style={{ padding: '4px 10px', borderRadius: '20px', background: `${uc.color}18`, border: `1px solid ${uc.color}35`, color: uc.color, fontSize: '0.75rem', fontWeight: 800, minWidth: '52px', textAlign: 'center', flexShrink: 0 }}>
                    {uc.label}
                  </div>

                  {/* Name */}
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <Link href={`/platform/restaurants/${r.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: '0.85rem' }}>{r.name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.68rem' }}>{r.email} · /{r.slug}</div>
                    </Link>
                  </div>

                  {/* Orders & GMV */}
                  <div style={{ textAlign: 'center', minWidth: '70px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Orders 30d</div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: '0.82rem' }}>{r.orders30}</div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '70px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>GMV 30d</div>
                    <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.82rem' }}>€{r.gmv30.toFixed(0)}</div>
                  </div>

                  {/* Probability */}
                  <div style={{ textAlign: 'center', minWidth: '64px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Conv.-W.</div>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', marginBottom: '2px' }}>
                      <div style={{ height: '100%', width: `${r.conversionProbability}%`, background: probColor }} />
                    </div>
                    <div style={{ color: probColor, fontWeight: 700, fontSize: '0.72rem' }}>{r.conversionProbability}%</div>
                  </div>

                  {/* Signup age */}
                  <div style={{ textAlign: 'center', minWidth: '60px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Signup</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>{r.signupDaysAgo}d</div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {canEmail && (
                      <a href={`mailto:${r.email}?subject=${encodeURIComponent(emailSubject(r.name))}&body=${encodeURIComponent(emailBody(r.name, r.days))}`}
                        style={{ padding: '5px 11px', borderRadius: '7px', border: `1px solid ${uc.border}`, background: `${uc.color}10`, color: uc.color, fontSize: '0.68rem', fontWeight: 700, textDecoration: 'none' }}>
                        E-Mail
                      </a>
                    )}
                    <Link href={`/platform/restaurants/${r.id}`}
                      style={{ padding: '5px 11px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem', textDecoration: 'none' }}>
                      Detail →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {rows.length === 0 && (
        <div style={{ padding: '64px', textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: '0.9rem' }}>
          Keine aktiven Trials
        </div>
      )}
    </div>
  )
}
