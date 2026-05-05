import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function DELETE(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Delete loyalty member records (cascades to related data)
  await supabase.from('loyalty_members').delete().eq('user_id', user.id)

  // Delete marketing subscriber entries
  await supabase.from('marketing_subscribers').delete().eq('email', user.email ?? '')

  // Sign out and delete auth user via service role
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  await adminClient.auth.admin.deleteUser(user.id)

  return NextResponse.json({ ok: true })
}
