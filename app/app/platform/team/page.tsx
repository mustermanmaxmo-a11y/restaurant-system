import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformOwner } from '@/lib/platform-auth'
import { Users } from 'lucide-react'
import { TeamManager } from '@/components/TeamManager'

export const dynamic = 'force-dynamic'

export default async function PlatformTeam() {
  const { user: currentUser } = await requirePlatformOwner()
  const admin = createSupabaseAdmin()

  // Alle platform_owner laden
  const { data: roles } = await admin
    .from('user_roles')
    .select('user_id, created_at')
    .eq('role', 'platform_owner')
    .order('created_at', { ascending: true })

  // E-Mails per Service-Role holen
  const { data: usersRes } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailById: Record<string, string> = {}
  for (const u of usersRes?.users ?? []) {
    if (u.id) emailById[u.id] = u.email ?? '—'
  }

  const members = (roles ?? []).map(r => ({
    user_id: r.user_id,
    email: emailById[r.user_id] ?? '—',
    created_at: r.created_at as string,
    isYou: r.user_id === currentUser.id,
  }))

  return (
    <div style={{ padding: '32px 24px', maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <Users size={20} color="#ef4444" />
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>Team</h1>
        </div>
        <p style={{ color: '#888', fontSize: '0.85rem' }}>
          Personen mit Zugang zum Platform-Admin. Neue Mitarbeiter müssen zuerst einen Account erstellen.
        </p>
      </div>

      <TeamManager members={members} />
    </div>
  )
}
