import { NextResponse } from 'next/server'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

async function requireOwner() {
  const supabase = await createSupabaseServerSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: 'unauthenticated' }
  const { data: isOwner } = await supabase.rpc('is_platform_owner')
  if (isOwner !== true) return { user: null, error: 'forbidden' }
  return { user, error: null }
}

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function POST(req: Request) {
  const { user, error } = await requireOwner()
  if (error || !user) return NextResponse.json({ error }, { status: error === 'unauthenticated' ? 401 : 403 })

  const body = await req.json().catch(() => ({}))
  const name = (body.name ?? '').trim()
  const slug = (body.slug ?? '').trim().toLowerCase()
  const ownerEmail = (body.ownerEmail ?? '').trim().toLowerCase()
  const plan = ['trial', 'starter', 'pro', 'enterprise'].includes(body.plan) ? body.plan : 'trial'
  const trialDays = Number(body.trialDays) > 0 ? Number(body.trialDays) : 14

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })
  if (!ownerEmail) return NextResponse.json({ error: 'ownerEmail required' }, { status: 400 })

  const admin = createSupabaseAdmin()

  // Slug-Uniqueness prüfen
  const { data: existing } = await admin
    .from('restaurants')
    .select('id')
    .eq('slug', slug)
    .limit(1)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'slug_taken' }, { status: 409 })
  }

  // Auth-User anlegen
  const tempPassword = generatePassword()
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: tempPassword,
    email_confirm: true,
  })

  if (createError) {
    const msg = createError.message?.toLowerCase() ?? ''
    if (msg.includes('already') || msg.includes('exists')) {
      return NextResponse.json({ error: 'email_taken' }, { status: 409 })
    }
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  // Restaurant anlegen
  const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
  const { data: restaurant, error: insertError } = await admin
    .from('restaurants')
    .insert({
      owner_id: newUser.user.id,
      name,
      slug,
      plan,
      trial_ends_at: plan === 'trial' ? trialEndsAt : null,
      active: true,
    })
    .select('id, name, slug, plan, active, trial_ends_at, created_at')
    .single()

  if (insertError) {
    // Rollback: User wieder löschen
    await admin.auth.admin.deleteUser(newUser.user.id)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ restaurant, tempPassword })
}
