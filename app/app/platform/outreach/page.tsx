import Link from 'next/link'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000

function emailHref(to: string, subject: string, body: string) {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

type RestaurantRow = {
  id: string; name: string; slug: string; plan: string;
  active: boolean; trial_ends_at: string | null; created_at: string; owner_id: string
}

export default async function PlatformOutreachPage() {
  const { role } = await requirePlatformAccess()
  if (role === 'support' || role === 'billing' || role === 'developer') redirect('/platform')

  const admin = createSupabaseAdmin()
  const now = Date.now()

  const [{ data: restaurants }, { data: usersRes }, { data: recentOrders }] = await Promise.all([
    admin.from('restaurants').select('id, name, slug, plan, active, trial_ends_at, created_at, owner_id').order('name'),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('orders').select('restaurant_id, created_at')
      .gte('created_at', new Date(now - 30 * DAY).toISOString())
      .neq('status', 'cancelled'),
  ])

  const emailById: Record<string, string> = {}
  for (const u of usersRes?.users ?? []) emailById[u.id] = u.email ?? ''

  const list: RestaurantRow[] = restaurants ?? []

  const orderCount30: Record<string, number> = {}
  const lastOrderAt: Record<string, number> = {}
  for (const o of recentOrders ?? []) {
    orderCount30[o.restaurant_id] = (orderCount30[o.restaurant_id] ?? 0) + 1
    const t = new Date(o.created_at).getTime()
    if (!lastOrderAt[o.restaurant_id] || t > lastOrderAt[o.restaurant_id]) lastOrderAt[o.restaurant_id] = t
  }

  // ── Segments ─────────────────────────────────────────────────────────────

  // 1. Expiring trials (trial_ends_at within 7 days, still valid)
  const expiringTrials = list.filter(r =>
    r.plan === 'trial' && r.trial_ends_at &&
    new Date(r.trial_ends_at).getTime() > now &&
    new Date(r.trial_ends_at).getTime() < now + 7 * DAY
  )

  // 2. Stale trials: trial > 14 days old, 0 orders
  const staleTrials = list.filter(r =>
    r.plan === 'trial' &&
    new Date(r.created_at).getTime() < now - 14 * DAY &&
    (orderCount30[r.id] ?? 0) === 0
  )

  // 3. Hot leads: trials with ≥5 orders in 30d → push to convert
  const hotLeads = list
    .filter(r => r.plan === 'trial' && (orderCount30[r.id] ?? 0) >= 5)
    .sort((a, b) => (orderCount30[b.id] ?? 0) - (orderCount30[a.id] ?? 0))

  // 4. Churn risk: active paid, 0 orders in 14d
  const churnRisk = list.filter(r =>
    r.active && (r.plan === 'starter' || r.plan === 'pro' || r.plan === 'enterprise') &&
    (lastOrderAt[r.id] === undefined || now - lastOrderAt[r.id] > 14 * DAY)
  )

  // 5. Win-Back: expired < 30 days ago AND had orders before
  const winBack = list.filter(r =>
    r.plan === 'expired' &&
    now - new Date(r.created_at).getTime() < 60 * DAY &&
    (orderCount30[r.id] ?? 0) > 0
  )

  const segments = [
    {
      id: 'hot-leads',
      title: '🚀 Hot Leads — Trials mit starker Aktivität',
      desc: 'Restaurants im Trial mit ≥5 Bestellungen. Höchste Conversion-Wahrscheinlichkeit.',
      color: '#6366f1',
      border: 'rgba(99,102,241,0.3)',
      bg: 'rgba(99,102,241,0.06)',
      rows: hotLeads,
      emailTemplate: (r: RestaurantRow) => ({
        subject: `OrderOS – Ihr Trial läuft noch: Jetzt zum bezahlten Abo wechseln`,
        body: `Hallo ${r.name}-Team,\n\nwir sehen, dass Sie OrderOS aktiv nutzen – toll! Um Ihren Betrieb weiter reibungslos zu unterstützen, empfehlen wir jetzt den Wechsel zum Starter-Plan.\n\nSie behalten alle Funktionen und zahlen nur ${29} € pro Monat.\n\nSoll ich kurz einen Upgrade-Link schicken oder haben Sie Fragen?\n\nBeste Grüße\nOrderOS Team`,
      }),
      stat: (r: RestaurantRow) => `${orderCount30[r.id] ?? 0} Bestellungen in 30 Tagen`,
    },
    {
      id: 'expiring',
      title: '⚠️ Trial-Ablauf in 7 Tagen',
      desc: 'Trials, die bald ablaufen. Jetzt aktiv werden, um Churn zu verhindern.',
      color: '#f59e0b',
      border: 'rgba(245,158,11,0.3)',
      bg: 'rgba(245,158,11,0.05)',
      rows: expiringTrials,
      emailTemplate: (r: RestaurantRow) => ({
        subject: `Wichtig: Ihr OrderOS-Trial läuft am ${r.trial_ends_at ? new Date(r.trial_ends_at).toLocaleDateString('de-DE') : '—'} ab`,
        body: `Hallo ${r.name}-Team,\n\nIhr kostenloses Testkonto bei OrderOS läuft bald ab. Damit Sie Ihren Betrieb ohne Unterbrechung weiterführen können, empfehlen wir rechtzeitig auf einen bezahlten Plan zu wechseln.\n\nStarter: 29 €/Monat · Pro: 79 €/Monat\n\nBei Fragen stehen wir gerne zur Verfügung.\n\nBeste Grüße\nOrderOS Team`,
      }),
      stat: (r: RestaurantRow) => r.trial_ends_at ? `Läuft ab: ${new Date(r.trial_ends_at).toLocaleDateString('de-DE')}` : '',
    },
    {
      id: 'stale',
      title: '😴 Stale Trials — keine Aktivität',
      desc: 'Über 14 Tage im Trial, aber 0 Bestellungen. Möglicherweise Onboarding-Blockade.',
      color: '#888',
      border: '#2a2a3e',
      bg: 'transparent',
      rows: staleTrials,
      emailTemplate: (r: RestaurantRow) => ({
        subject: `Brauchen Sie Hilfe beim Einstieg in OrderOS?`,
        body: `Hallo ${r.name}-Team,\n\nwir haben gesehen, dass Sie sich bei OrderOS registriert haben, aber noch keine Bestellungen erhalten haben. Darf ich Ihnen beim Einrichten des Systems helfen?\n\nMögliche nächste Schritte:\n1. Menü anlegen\n2. QR-Codes für Tische ausdrucken\n3. Erste Testbestellung durchführen\n\nIch helfe gerne – einfach antworten!\n\nBeste Grüße\nOrderOS Team`,
      }),
      stat: (r: RestaurantRow) => `${Math.floor((now - new Date(r.created_at).getTime()) / DAY)} Tage seit Anmeldung`,
    },
    {
      id: 'churn',
      title: '🔴 Churn-Risiko — aktive Abos ohne Aktivität',
      desc: 'Bezahlende Kunden mit 0 Bestellungen in 14 Tagen. Sofort nachfassen.',
      color: '#ef4444',
      border: 'rgba(239,68,68,0.3)',
      bg: 'rgba(239,68,68,0.04)',
      rows: churnRisk,
      emailTemplate: (r: RestaurantRow) => ({
        subject: `Alles ok bei ${r.name}? Wir sind für Sie da.`,
        body: `Hallo ${r.name}-Team,\n\nwir haben bemerkt, dass Ihr OrderOS-Account in den letzten Wochen weniger aktiv war. Gibt es etwas, womit wir Ihnen helfen können?\n\nFalls Sie technische Fragen haben, einen Feature-Wunsch oder Feedback – wir freuen uns von Ihnen zu hören.\n\nBeste Grüße\nOrderOS Team`,
      }),
      stat: (r: RestaurantRow) => lastOrderAt[r.id]
        ? `Letzte Order: ${Math.floor((now - lastOrderAt[r.id]) / DAY)} Tage her`
        : 'Noch keine Bestellungen',
    },
    {
      id: 'winback',
      title: '🔄 Win-Back — kürzlich abgelaufen mit Aktivität',
      desc: 'Abgelaufene Accounts, die vorher aktiv waren. Gute Reaktivierungs-Chancen.',
      color: '#10b981',
      border: 'rgba(16,185,129,0.25)',
      bg: 'rgba(16,185,129,0.04)',
      rows: winBack,
      emailTemplate: (r: RestaurantRow) => ({
        subject: `Willkommen zurück bei OrderOS! Sonderangebot für ${r.name}`,
        body: `Hallo ${r.name}-Team,\n\nwir vermissen Sie! Ihr OrderOS-Konto ist abgelaufen, aber wir würden uns freuen Sie zurückzugewinnen.\n\nAls Dankeschön für Ihre bisherige Treue bieten wir Ihnen den ersten Monat für die Hälfte an.\n\nInteresse? Einfach antworten und wir richten alles für Sie ein.\n\nBeste Grüße\nOrderOS Team`,
      }),
      stat: (r: RestaurantRow) => `${orderCount30[r.id] ?? 0} Orders vor Ablauf`,
    },
  ]

  const totalActionable = expiringTrials.length + hotLeads.length + churnRisk.length + winBack.length

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>Outreach</h1>
        <p style={{ color: '#888', fontSize: '0.85rem' }}>
          Automatisch berechnete Sales-Segmente · {totalActionable} Restaurants zum Nachfassen
        </p>
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '32px' }}>
        {segments.map(s => (
          <a key={s.id} href={`#${s.id}`} style={{ textDecoration: 'none' }}>
            <div style={{ background: '#242438', border: `1px solid ${s.border}`, borderRadius: '12px', padding: '14px 16px', cursor: 'pointer' }}>
              <div style={{ color: s.color, fontSize: '1.5rem', fontWeight: 800, lineHeight: 1, marginBottom: '4px' }}>{s.rows.length}</div>
              <div style={{ color: '#888', fontSize: '0.7rem', fontWeight: 600 }}>{s.title.replace(/^[^\s]+\s/, '')}</div>
            </div>
          </a>
        ))}
      </div>

      {/* Segments */}
      {segments.map(seg => (
        <div key={seg.id} id={seg.id} style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <h2 style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>{seg.title}</h2>
            <span style={{ color: seg.color, fontWeight: 700, fontSize: '0.8rem' }}>({seg.rows.length})</span>
          </div>
          <p style={{ color: '#666', fontSize: '0.78rem', marginBottom: '14px' }}>{seg.desc}</p>

          {seg.rows.length === 0 ? (
            <div style={{ padding: '20px', background: '#1a1a2e', borderRadius: '10px', color: '#555', fontSize: '0.82rem', textAlign: 'center' }}>
              Kein Restaurant in diesem Segment.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {seg.rows.map(r => {
                const email = emailById[r.owner_id] ?? ''
                const { subject, body } = seg.emailTemplate(r)
                return (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', borderRadius: '10px',
                    background: seg.bg, border: `1px solid ${seg.border}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem' }}>{r.name}</span>
                        <span style={{ color: '#555', fontSize: '0.72rem', fontFamily: 'ui-monospace, monospace' }}>/{r.slug}</span>
                        <span style={{ color: '#555', fontSize: '0.72rem' }}>· {email || '—'}</span>
                      </div>
                      <div style={{ color: seg.color, fontSize: '0.72rem', fontWeight: 600, marginTop: '2px' }}>
                        {seg.stat(r)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <Link href={`/platform/restaurants/${r.id}`} style={{
                        padding: '6px 10px', borderRadius: '6px', border: '1px solid #2a2a3e',
                        color: '#888', fontSize: '0.72rem', textDecoration: 'none', fontWeight: 600,
                      }}>
                        Detail
                      </Link>
                      {email && (
                        <a href={emailHref(email, subject, body)} style={{
                          padding: '6px 12px', borderRadius: '6px', border: 'none',
                          background: seg.color, color: '#fff', fontSize: '0.72rem',
                          textDecoration: 'none', fontWeight: 700,
                        }}>
                          E-Mail
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
