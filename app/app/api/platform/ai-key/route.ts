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
  return !!user
}

// GET: check if platform API key is set (never returns the actual key)
export async function GET(request: NextRequest) {
  if (!await verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = adminClient()
  const { data } = await admin.from('platform_settings').select('anthropic_api_key').single()
  return NextResponse.json({ isSet: !!data?.anthropic_api_key })
}

// POST: save platform API key
export async function POST(request: NextRequest) {
  if (!await verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { apiKey } = await request.json()
  if (!apiKey?.trim()) {
    return NextResponse.json({ error: 'apiKey required' }, { status: 400 })
  }
  const admin = adminClient()
  const { data: row } = await admin.from('platform_settings').select('id').single()
  if (!row) {
    return NextResponse.json({ error: 'Platform settings not initialized' }, { status: 500 })
  }
  const { error } = await admin
    .from('platform_settings')
    .update({ anthropic_api_key: apiKey.trim(), updated_at: new Date().toISOString() })
    .eq('id', row.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
