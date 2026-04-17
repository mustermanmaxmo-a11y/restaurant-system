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

// POST — Mitglied hinzufügen { email, role }
export async function POST(req: Request) {
  const { user, error } = await requireOwner()
  if (error || !user) return NextResponse.json({ error }, { status: error === 'unauthenticated' ? 401 : 403 })

  const body = await req.json().catch(() => ({}))
  const email = (body.email ?? '').trim().toLowerCase()
  const role = body.role ?? ''

  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })
  if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: 'invalid role' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { data: usersRes } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const target = usersRes?.users?.find(u => u.email?.toLowerCase() === email)

  if (!target) {
    return NextResponse.json(
      { error: 'Kein Account mit dieser E-Mail gefunden. Die Person muss sich zuerst registrieren.' },
      { status: 404 }
    )
  }

  const { data, error: insertErr } = await admin
    .from('platform_team')
    .upsert(
      { user_id: target.id, role, invited_by: user.id },
      { onConflict: 'user_id' }
    )
    .select('id')
    .single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: data.id, email: target.email, user_id: target.id })
}

// PATCH — Rolle ändern { id, role }
export async function PATCH(req: Request) {
  const { error } = await requireOwner()
  if (error) return NextResponse.json({ error }, { status: error === 'unauthenticated' ? 401 : 403 })

  const body = await req.json().catch(() => ({}))
  const { id, role } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: 'invalid role' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { error: updateErr } = await admin
    .from('platform_team')
    .update({ role })
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — Mitglied entfernen { id }
export async function DELETE(req: Request) {
  const { error } = await requireOwner()
  if (error) return NextResponse.json({ error }, { status: error === 'unauthenticated' ? 401 : 403 })

  const body = await req.json().catch(() => ({}))
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { error: delErr } = await admin
    .from('platform_team')
    .delete()
    .eq('id', id)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
