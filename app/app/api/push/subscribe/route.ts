import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { endpoint, p256dh, auth, app_context, restaurant_id, user_id, staff_role } = body

  if (!endpoint || !p256dh || !auth || !app_context) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const VALID_CONTEXTS = ['dashboard', 'admin', 'platform'] as const
  if (!VALID_CONTEXTS.includes(app_context)) {
    return NextResponse.json({ error: 'Invalid app_context' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { error } = await admin.from('push_subscriptions').upsert(
    {
      endpoint,
      p256dh,
      auth_key: auth,
      app_context,
      restaurant_id: restaurant_id || null,
      user_id: user_id || null,
      staff_role: staff_role || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { endpoint } = await req.json()
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })

  const admin = createSupabaseAdmin()
  await admin.from('push_subscriptions').delete().eq('endpoint', endpoint)
  return NextResponse.json({ ok: true })
}
