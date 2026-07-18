import { redirect } from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

type AuditEntry = {
  id: string
  actor_email: string
  action: string
  target_type: string | null
  target_id: string | null
  target_name: string | null
  details: Record<string, unknown> | null
  created_at: string
}

const ACTION_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  plan_change:       { color: '#35c0db', bg: 'rgba(53,192,219,0.08)', label: 'Plan' },
  bulk_action:       { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  label: 'Bulk' },
  note_created:      { color: '#6ee7b7', bg: 'rgba(110,231,183,0.07)', label: 'Notiz' },
  note_deleted:      { color: '#fca5a5', bg: 'rgba(252,165,165,0.07)', label: 'Notiz' },
  note_pinned:       { color: '#fcd34d', bg: 'rgba(252,211,77,0.07)',  label: 'Notiz' },
  restaurant_created:{ color: '#818cf8', bg: 'rgba(129,140,248,0.08)', label: 'Restaurant' },
}

function style(action: string) {
  return ACTION_STYLES[action] ?? { color: '#888', bg: 'rgba(136,136,136,0.06)', label: action }
}

function timeLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default async function PlatformAuditPage() {
  const { role } = await requirePlatformAccess()
  if (!['owner', 'co_founder', 'developer'].includes(role)) redirect('/platform')

  const admin = createSupabaseAdmin()
  const { data } = await admin.from('platform_audit_log')
    .select('id, actor_email, action, target_type, target_id, target_name, details, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  const entries: AuditEntry[] = data ?? []

  // Group by date
  const byDate: Record<string, AuditEntry[]> = {}
  for (const e of entries) {
    const d = new Date(e.created_at).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
    byDate[d] = byDate[d] ?? []
    byDate[d].push(e)
  }

  // Actor frequency
  const actorCount: Record<string, number> = {}
  for (const e of entries) actorCount[e.actor_email] = (actorCount[e.actor_email] ?? 0) + 1
  const topActors = Object.entries(actorCount).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // Action frequency
  const actionCount: Record<string, number> = {}
  for (const e of entries) actionCount[e.action] = (actionCount[e.action] ?? 0) + 1

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0f0f8', letterSpacing: '-0.025em', marginBottom: '4px' }}>
            Audit Log
          </h1>
          <p style={{ color: '#44445a', fontSize: '0.82rem' }}>
            Alle Admin-Aktionen des Platform-Teams · {entries.length} Einträge
          </p>
        </div>
        <a href="/api/platform/export?type=audit" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 13px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)', fontSize: '0.73rem', textDecoration: 'none', fontWeight: 600 }}>
          ↓ Audit Log CSV
        </a>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: '#111120', border: '1px solid #1e1e30', borderRadius: '12px', padding: '16px' }}>
          <div style={{ color: '#2e2e48', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
            Top Akteure
          </div>
          {topActors.length === 0 ? (
            <div style={{ color: '#2e2e48', fontSize: '0.78rem' }}>Noch keine Einträge.</div>
          ) : topActors.map(([email, cnt]) => (
            <div key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #0e0e18' }}>
              <span style={{ color: '#8888a8', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{email}</span>
              <span style={{ color: '#35c0db', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>{cnt}</span>
            </div>
          ))}
        </div>
        <div style={{ background: '#111120', border: '1px solid #1e1e30', borderRadius: '12px', padding: '16px' }}>
          <div style={{ color: '#2e2e48', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
            Aktionen
          </div>
          {Object.entries(actionCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([action, cnt]) => {
            const s = style(action)
            return (
              <div key={action} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #0e0e18' }}>
                <span style={{ color: s.color, fontSize: '0.72rem', fontWeight: 600 }}>{s.label}: {action.replace(/_/g, ' ')}</span>
                <span style={{ color: '#44445a', fontSize: '0.7rem', fontWeight: 700 }}>{cnt}×</span>
              </div>
            )
          })}
        </div>
      </div>

      {entries.length === 0 ? (
        <div style={{ background: '#111120', border: '1px solid #1e1e30', borderRadius: '14px', padding: '60px', textAlign: 'center', color: '#2e2e48', fontSize: '0.85rem' }}>
          Noch keine Audit-Einträge.
          <br />
          <span style={{ fontSize: '0.72rem', marginTop: '8px', display: 'block' }}>
            Führe zuerst die Supabase-Migration aus:<br />
            <code style={{ color: '#44445a', fontFamily: 'ui-monospace, monospace' }}>supabase/migrations/20260621_001_audit_log.sql</code>
          </span>
        </div>
      ) : (
        Object.entries(byDate).map(([date, es]) => (
          <div key={date} style={{ marginBottom: '24px' }}>
            <div style={{ color: '#2e2e48', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
              {date}
            </div>
            <div style={{ background: '#0e0e1c', border: '1px solid #1a1a2e', borderRadius: '12px', overflow: 'hidden' }}>
              {es.map((e, i) => {
                const s = style(e.action)
                return (
                  <div key={e.id} style={{
                    display: 'grid', gridTemplateColumns: '60px 120px 100px 1fr auto', alignItems: 'center',
                    gap: '12px', padding: '10px 16px',
                    borderBottom: i < es.length - 1 ? '1px solid #0a0a14' : undefined,
                  }}>
                    <span style={{ color: '#2e2e48', fontSize: '0.68rem', fontFamily: 'ui-monospace, monospace' }}>
                      {timeLabel(e.created_at)}
                    </span>
                    <span style={{ color: '#5a5a78', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.actor_email.split('@')[0]}
                    </span>
                    <span style={{ padding: '2px 7px', borderRadius: '6px', background: s.bg, color: s.color, fontSize: '0.65rem', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {e.action.replace(/_/g, ' ')}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      {e.target_name && (
                        <span style={{ color: '#a0a0c0', fontSize: '0.75rem', fontWeight: 600 }}>{e.target_name}</span>
                      )}
                      {e.details && Object.keys(e.details).length > 0 && (
                        <span style={{ color: '#2e2e48', fontSize: '0.68rem', marginLeft: '8px', fontFamily: 'ui-monospace, monospace' }}>
                          {Object.entries(e.details).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}
                        </span>
                      )}
                    </div>
                    <span style={{ color: '#1e1e30', fontSize: '0.6rem', fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>
                      {e.id.slice(0, 6)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
