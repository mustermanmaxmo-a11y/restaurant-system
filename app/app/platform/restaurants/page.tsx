import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import type { Restaurant } from '@/types/database'
import CreateRestaurantModal from '@/components/platform/CreateRestaurantModal'

export const dynamic = 'force-dynamic'

const PLAN_COLORS: Record<string, { bg: string; fg: string }> = {
  trial:      { bg: '#1e3a8a', fg: '#93c5fd' },
  starter:    { bg: '#065f46', fg: '#6ee7b7' },
  pro:        { bg: '#92400e', fg: '#fcd34d' },
  enterprise: { bg: '#581c87', fg: '#e9d5ff' },
  expired:    { bg: '#450a0a', fg: '#fca5a5' },
}

type Row = Pick<Restaurant,
  'id' | 'name' | 'slug' | 'plan' | 'active' | 'trial_ends_at' | 'created_at' | 'owner_id' | 'stripe_customer_id' | 'stripe_subscription_id'
> & { owner_email: string }

export default async function PlatformRestaurants() {
  const { user, role } = await requirePlatformAccess()
  const admin = createSupabaseAdmin()

  // Support-User sieht nur zugewiesene Restaurants
  let allowedRestaurantIds: string[] | null = null
  if (role === 'support') {
    const { data: member } = await admin
      .from('platform_team')
      .select('id')
      .eq('user_id', user!.id)
      .single()

    if (member) {
      const { data: assignments } = await admin
        .from('platform_team_restaurants')
        .select('restaurant_id')
        .eq('team_member_id', member.id)
      allowedRestaurantIds = (assignments ?? []).map(a => a.restaurant_id)
    } else {
      allowedRestaurantIds = []
    }
  }

  let query = admin
    .from('restaurants')
    .select('id, name, slug, plan, active, trial_ends_at, created_at, owner_id, stripe_customer_id, stripe_subscription_id')
    .order('created_at', { ascending: false })

  if (allowedRestaurantIds !== null) {
    query = query.in('id', allowedRestaurantIds.length > 0 ? allowedRestaurantIds : ['00000000-0000-0000-0000-000000000000'])
  }

  const [{ data: restaurants }, { data: usersRes }] = await Promise.all([
    query,
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const emailByUserId: Record<string, string> = {}
  for (const u of usersRes?.users ?? []) {
    if (u.id) emailByUserId[u.id] = u.email ?? '—'
  }

  const rows: Row[] = (restaurants ?? []).map(r => ({
    ...(r as unknown as Row),
    owner_email: emailByUserId[r.owner_id] ?? '—',
  }))

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>Restaurants</h1>
          <p style={{ color: '#888', fontSize: '0.85rem' }}>{rows.length} insgesamt · sortiert nach Anmeldedatum</p>
        </div>
        <CreateRestaurantModal role={role} />
      </div>

      <div style={{ background: '#242438', border: '1px solid #2a2a3e', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#1f1f30', textAlign: 'left' }}>
                <Th>Restaurant</Th>
                <Th>Owner E-Mail</Th>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th>Trial-Ende</Th>
                <Th>Angelegt</Th>
                <Th>Stripe</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                    Noch keine Restaurants angelegt.
                  </td>
                </tr>
              )}
              {rows.map(r => {
                const planStyle = PLAN_COLORS[r.plan] ?? { bg: '#333', fg: '#ccc' }
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid #2a2a3e' }}>
                    <Td>
                      <div style={{ color: '#fff', fontWeight: 600 }}>{r.name}</div>
                      <div style={{ color: '#666', fontSize: '0.7rem' }}>/{r.slug}</div>
                    </Td>
                    <Td mono>{r.owner_email}</Td>
                    <Td>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: '10px',
                        background: planStyle.bg, color: planStyle.fg, fontSize: '0.7rem', fontWeight: 700,
                      }}>{r.plan}</span>
                    </Td>
                    <Td>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: '10px',
                        background: r.active ? '#065f46' : '#450a0a',
                        color: r.active ? '#6ee7b7' : '#fca5a5',
                        fontSize: '0.7rem', fontWeight: 700,
                      }}>{r.active ? 'aktiv' : 'inaktiv'}</span>
                    </Td>
                    <Td>{formatDate(r.trial_ends_at)}</Td>
                    <Td>{formatDate(r.created_at)}</Td>
                    <Td mono>
                      {r.stripe_subscription_id ? r.stripe_subscription_id.slice(0, 14) + '…' : <span style={{ color: '#555' }}>—</span>}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '12px 14px', color: '#888', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</th>
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td style={{ padding: '12px 14px', color: '#ccc', fontFamily: mono ? 'ui-monospace, monospace' : undefined }}>{children}</td>
}

function formatDate(d: string | null) {
  if (!d) return <span style={{ color: '#555' }}>—</span>
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
