import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function DELETE() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Delete restaurant and all related data (cascades via FK)
  const { data: restaurant } = await adminClient
    .from('restaurants')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (restaurant) {
    await adminClient.from('restaurants').delete().eq('id', restaurant.id)
  }

  // Delete the auth user (this removes the account permanently)
  const { error } = await adminClient.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('Account deletion error:', error)
    return NextResponse.json({ error: 'Konto konnte nicht gelöscht werden.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Konto und alle Daten wurden gelöscht.' })
}
