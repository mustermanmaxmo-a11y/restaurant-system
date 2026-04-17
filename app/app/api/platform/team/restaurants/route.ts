import { NextResponse } from 'next/server'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

async function requireOwner() {
  const supabase = await createSupabaseServerSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' }
  const { data: isOwner } = await supabase.rpc('is_platform_owner')
  if (isOwner !== true) return { error: 'forbidden' }
  return { error: null }
}

// POST — Restaurant zuweisen { team_member_id, restaurant_id }
export async function POST(req: Request) {
  const { error } = await requireOwner()
  if (error) return NextResponse.json({ error }, { status: error === 'unauthenticated' ? 401 : 403 })

  const body = await req.json().catch(() => ({}))
  const { team_member_id, restaurant_id } = body
  if (!team_member_id || !restaurant_id) {
    return NextResponse.json({ error: 'team_member_id and restaurant_id required' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { error: insertErr } = await admin
    .from('platform_team_restaurants')
    .upsert({ team_member_id, restaurant_id }, { onConflict: 'team_member_id,restaurant_id' })

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — Restaurant-Zugriff entfernen { team_member_id, restaurant_id }
export async function DELETE(req: Request) {
  const { error } = await requireOwner()
  if (error) return NextResponse.json({ error }, { status: error === 'unauthenticated' ? 401 : 403 })

  const body = await req.json().catch(() => ({}))
  const { team_member_id, restaurant_id } = body
  if (!team_member_id || !restaurant_id) {
    return NextResponse.json({ error: 'team_member_id and restaurant_id required' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { error: delErr } = await admin
    .from('platform_team_restaurants')
    .delete()
    .eq('team_member_id', team_member_id)
    .eq('restaurant_id', restaurant_id)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
