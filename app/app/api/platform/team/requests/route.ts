import { NextResponse } from 'next/server'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const VALID_ROLES = ['co_founder', 'developer', 'billing', 'support']

async function requireOwner() {
  const supabase = await createSupabaseServerSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: 'unauthenticated' }
  const { data: isOwner } = await supabase.rpc('is_platform_owner')
  if (isOwner !== true) return { user: null, error: 'forbidden' }
  return { user, error: null }
}

// POST — Anfrage annehmen oder ablehnen
// { id, action: 'approve', role } | { id, action: 'reject' }
export async function POST(req: Request) {
  const { user, error } = await requireOwner()
  if (error || !user) return NextResponse.json({ error }, { status: error === 'unauthenticated' ? 401 : 403 })

  const body = await req.json().catch(() => ({}))
  const { id, action, role } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (!['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'invalid action' }, { status: 400 })

  const admin = createSupabaseAdmin()

  // Request laden
  const { data: request } = await admin
    .from('team_registration_requests')
    .select('user_id, email')
    .eq('id', id)
    .single()

  if (!request) return NextResponse.json({ error: 'Request nicht gefunden.' }, { status: 404 })

  if (action === 'reject') {
    await admin
      .from('team_registration_requests')
      .update({ status: 'rejected' })
      .eq('id', id)
    return NextResponse.json({ ok: true, action: 'rejected' })
  }

  // Approve: Rolle pflicht
  if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: 'invalid role' }, { status: 400 })

  // In platform_team aufnehmen
  const { data: member, error: insertErr } = await admin
    .from('platform_team')
    .upsert({ user_id: request.user_id, role, invited_by: user.id }, { onConflict: 'user_id' })
    .select('id')
    .single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // Request als approved markieren
  await admin
    .from('team_registration_requests')
    .update({ status: 'approved' })
    .eq('id', id)

  return NextResponse.json({ ok: true, action: 'approved', id: member.id, email: request.email })
}
