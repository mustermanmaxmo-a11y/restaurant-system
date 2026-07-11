import Link from 'next/link'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { SearchBox } from './SearchBox'

export const dynamic = 'force-dynamic'

const PLAN_COLORS: Record<string, { bg: string; fg: string }> = {
  trial:      { bg: '#1e3a8a', fg: '#93c5fd' },
  starter:    { bg: '#065f46', fg: '#6ee7b7' },
  pro:        { bg: '#92400e', fg: '#fcd34d' },
  enterprise: { bg: '#581c87', fg: '#e9d5ff' },
  expired:    { bg: '#450a0a', fg: '#fca5a5' },
}

export default async function PlatformSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; plan?: string }>
}) {
  await requirePlatformAccess()
  const { q, plan } = await searchParams

  const admin = createSupabaseAdmin()

  let results: Array<{
    id: string; name: string; slug: string; plan: string;
    active: boolean; trial_ends_at: string | null; created_at: string; owner_id: string
  }> = []

  const hasQuery = (q && q.trim().length > 0) || (plan && plan !== 'all')

  if (hasQuery) {
    let query = admin
      .from('restaurants')
      .select('id, name, slug, plan, active, trial_ends_at, created_at, owner_id')
      .order('name')
      .limit(50)

    if (q && q.trim()) {
      query = query.or(`name.ilike.%${q.trim()}%,slug.ilike.%${q.trim()}%`)
    }
    if (plan && plan !== 'all') {
      query = query.eq('plan', plan)
    }

    const { data } = await query
    results = data ?? []
  }

  // email lookup
  const emailByUserId: Record<string, string> = {}
  if (results.length > 0) {
    const { data: usersRes } = await admin.auth.admin.listUsers({ perPage: 1000 })
    for (const u of usersRes?.users ?? []) {
      emailByUserId[u.id] = u.email ?? '—'
    }
  }

  return (
    <div style={{ padding: '32px 24px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>Suche</h1>
        <p style={{ color: '#888', fontSize: '0.85rem' }}>Restaurants nach Name, Slug oder Plan filtern</p>
      </div>

      <SearchBox initialQ={q ?? ''} initialPlan={plan ?? 'all'} />

      {hasQuery && (
        <div style={{ marginTop: '24px' }}>
          <p style={{ color: '#555', fontSize: '0.78rem', marginBottom: '12px' }}>
            {results.length} Treffer{q ? ` für „${q}"` : ''}{plan && plan !== 'all' ? ` · Plan: ${plan}` : ''}
          </p>

          {results.length === 0 ? (
            <div style={{ color: '#666', fontSize: '0.85rem', padding: '40px', textAlign: 'center', background: '#242438', borderRadius: '14px', border: '1px solid #2a2a3e' }}>
              Keine Treffer.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {results.map(r => {
                const pc = PLAN_COLORS[r.plan] ?? { bg: '#333', fg: '#ccc' }
                return (
                  <Link
                    key={r.id}
                    href={`/platform/restaurants/${r.id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      background: '#242438', border: '1px solid #2a2a3e',
                      borderRadius: '12px', padding: '14px 18px',
                      cursor: 'pointer', transition: 'border-color 0.15s',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>{r.name}</div>
                        <div style={{ color: '#555', fontSize: '0.75rem', fontFamily: 'ui-monospace, monospace' }}>
                          /{r.slug} · {emailByUserId[r.owner_id] ?? '—'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                        <span style={{ padding: '3px 10px', borderRadius: '10px', background: pc.bg, color: pc.fg, fontSize: '0.7rem', fontWeight: 700 }}>{r.plan}</span>
                        <span style={{ padding: '3px 10px', borderRadius: '10px', background: r.active ? '#065f46' : '#450a0a', color: r.active ? '#6ee7b7' : '#fca5a5', fontSize: '0.7rem', fontWeight: 700 }}>
                          {r.active ? 'aktiv' : 'inaktiv'}
                        </span>
                        <span style={{ color: '#555', fontSize: '0.72rem' }}>
                          {new Date(r.created_at).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {!hasQuery && (
        <div style={{ marginTop: '40px', color: '#666', fontSize: '0.85rem', textAlign: 'center' }}>
          Gib einen Suchbegriff ein oder wähle einen Plan-Filter.
        </div>
      )}
    </div>
  )
}
