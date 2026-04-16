import { NextResponse } from 'next/server'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

async function getPlatformUser() {
  const supabase = await createSupabaseServerSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase, error: 'unauthenticated' }
  const { data: isOwner } = await supabase.rpc('is_platform_owner')
  if (isOwner !== true) return { user: null, supabase, error: 'forbidden' }
  return { user, supabase, error: null }
}

// POST — Mitarbeiter hinzufügen { email }
export async function POST(req: Request) {
  const { user, error } = await getPlatformUser()
  if (error || !user) return NextResponse.json({ error }, { status: error === 'unauthenticated' ? 401 : 403 })

  const body = await req.json().catch(() => ({}))
  const email = (body.email ?? '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const admin = createSupabaseAdmin()

  // User-ID per E-Mail suchen
  const { data: usersRes } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const target = usersRes?.users?.find(u => u.email?.toLowerCase() === email)

  if (!target) {
    return NextResponse.json(
      { error: 'Kein Account mit dieser E-Mail gefunden. Der User muss sich zuerst registrieren.' },
      { status: 404 }
    )
  }

  const { error: insertErr } = await admin
    .from('user_roles')
    .upsert({ user_id: target.id, role: 'platform_owner' }, { onConflict: 'user_id' })

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, email: target.email, user_id: target.id })
}

// DELETE — Mitarbeiter entfernen { user_id }
export async function DELETE(req: Request) {
  const { user, error } = await getPlatformUser()
  if (error || !user) return NextResponse.json({ error }, { status: error === 'unauthenticated' ? 401 : 403 })

  const body = await req.json().catch(() => ({}))
  const { user_id } = body
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  // Verhindere dass man sich selbst entfernt
  if (user_id === user.id) {
    return NextResponse.json({ error: 'Du kannst deinen eigenen Zugang nicht entfernen.' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { error: delErr } = await admin
    .from('user_roles')
    .delete()
    .eq('user_id', user_id)
    .eq('role', 'platform_owner')

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
