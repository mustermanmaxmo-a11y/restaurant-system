import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

// GET: aktuelle Benachrichtigungs-E-Mail laden
export async function GET(request: NextRequest) {
  if (!await verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = adminClient()
  const { data } = await admin
    .from('platform_settings')
    .select('notification_email')
    .single()
  return NextResponse.json({ email: data?.notification_email ?? '' })
}

// POST: Benachrichtigungs-E-Mail speichern
export async function POST(request: NextRequest) {
  if (!await verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { email } = await request.json()
  if (!email?.trim() || !EMAIL_REGEX.test(email.trim())) {
    return NextResponse.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400 })
  }
  const admin = adminClient()
  const { error } = await admin
    .from('platform_settings')
    .update({ notification_email: email.trim(), updated_at: new Date().toISOString() })
    .eq('id', '00000000-0000-0000-0000-000000000001')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
