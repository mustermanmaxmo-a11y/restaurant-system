import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformOwner } from '@/lib/platform-auth'
import { Users } from 'lucide-react'
import { TeamManagerFull } from '@/components/TeamManagerFull'

export const dynamic = 'force-dynamic'

export default async function PlatformTeam() {
  const { user: currentUser } = await requirePlatformOwner()
  const admin = createSupabaseAdmin()

  // Alle platform_team Mitglieder laden
  const { data: teamRows } = await admin
    .from('platform_team')
    .select('id, user_id, role, created_at')
    .order('created_at', { ascending: true })

  // Restaurant-Zuweisungen für Support laden
  const { data: assignments } = await admin
    .from('platform_team_restaurants')
    .select('team_member_id, restaurant_id')

  // Ausstehende Registrierungsanfragen
  const { data: pendingRequests } = await admin
    .from('team_registration_requests')
    .select('id, email, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  // Alle Restaurants laden (für das Assignment-UI)
  const { data: restaurants } = await admin
    .from('restaurants')
    .select('id, name, slug')
    .order('name')

  // E-Mails per Service-Role holen
  const { data: usersRes } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailById: Record<string, string> = {}
  for (const u of usersRes?.users ?? []) {
    if (u.id) emailById[u.id] = u.email ?? '—'
  }

  const members = (teamRows ?? []).map(r => ({
    id: r.id,
    user_id: r.user_id,
    email: emailById[r.user_id] ?? '—',
    role: r.role as string,
    created_at: r.created_at as string,
    restaurant_ids: (assignments ?? [])
      .filter(a => a.team_member_id === r.id)
      .map(a => a.restaurant_id),
  }))

  return (
    <div style={{ padding: '32px 24px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <Users size={20} color="#ef4444" />
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>Team</h1>
        </div>
        <p style={{ color: '#888', fontSize: '0.85rem' }}>
          Interne Team-Mitglieder mit Zugang zum Platform-Admin. Nur du kannst neue Mitglieder hinzufügen.
        </p>
      </div>

      <TeamManagerFull
        currentUserId={currentUser.id}
        currentUserEmail={currentUser.email ?? '—'}
        members={members}
        pendingRequests={pendingRequests ?? []}
        restaurants={restaurants ?? []}
      />
    </div>
  )
}
