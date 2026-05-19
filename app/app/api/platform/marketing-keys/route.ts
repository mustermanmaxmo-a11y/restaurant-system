import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function verifyAuth(request: NextRequest): Promise<boolean> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return false
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: { user } } = await anon.auth.getUser(token)
  if (!user) return false
  const { data } = await adminClient().rpc('is_platform_owner', { user_id: user.id })
  return !!data
}

// GET: check which keys are set (never returns actual values)
export async function GET(request: NextRequest) {
  if (!await verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = adminClient()
  const { data } = await admin
    .from('platform_settings')
    .select('fal_api_key, kling_api_key, marketing_automation_secret, unsubscribe_secret')
    .single()

  return NextResponse.json({
    fal_api_key: !!data?.fal_api_key,
    kling_api_key: !!data?.kling_api_key,
    marketing_automation_secret: !!data?.marketing_automation_secret,
    unsubscribe_secret: !!data?.unsubscribe_secret,
  })
}

// POST: save one or more marketing keys
export async function POST(request: NextRequest) {
  if (!await verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const allowed = ['fal_api_key', 'kling_api_key', 'marketing_automation_secret', 'unsubscribe_secret']
  const updates: Record<string, string> = {}

  for (const key of allowed) {
    if (typeof body[key] === 'string' && body[key].trim()) {
      updates[key] = body[key].trim()
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid keys provided' }, { status: 400 })
  }

  const admin = adminClient()
  const { data: row } = await admin.from('platform_settings').select('id').single()

  if (!row) {
    const { error } = await admin.from('platform_settings').insert(updates)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await admin
      .from('platform_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
