import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: members } = await supabase
    .from('loyalty_members')
    .select('restaurant_id, stamp_count, points, dietary_preferences, favorite_item_ids, created_at')
    .eq('user_id', user.id)

  const exportData = {
    user: { id: user.id, email: user.email, created_at: user.created_at },
    loyalty_memberships: members ?? [],
    exported_at: new Date().toISOString(),
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="meine-daten-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
