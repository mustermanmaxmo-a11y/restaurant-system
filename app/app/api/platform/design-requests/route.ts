import { NextResponse } from 'next/server'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// POST — Restaurant-Admin legt neue Anfrage an
export async function POST(req: Request) {
  const supabase = await createSupabaseServerSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { message, restaurant_id } = body

  if (!message || typeof message !== 'string' || message.trim().length < 10) {
    return NextResponse.json({ error: 'Beschreibung zu kurz (min. 10 Zeichen).' }, { status: 400 })
  }
  if (!restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id fehlt.' }, { status: 400 })
  }

  // Sicherstellen dass Restaurant dem User gehört
  const { data: resto } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurant_id)
    .eq('owner_id', user.id)
    .single()

  if (!resto) return NextResponse.json({ error: 'Kein Zugriff auf dieses Restaurant.' }, { status: 403 })

  // Prüfen ob bereits eine offene Anfrage existiert
  const { data: existing } = await supabase
    .from('design_requests')
    .select('id, status')
    .eq('restaurant_id', restaurant_id)
    .in('status', ['pending', 'in_progress'])
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Es existiert bereits eine offene Anfrage.', existing }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('design_requests')
    .insert({ restaurant_id, user_id: user.id, message: message.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}

// PATCH — Platform Owner aktualisiert Status einer Anfrage
export async function PATCH(req: Request) {
  const supabase = await createSupabaseServerSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data: isOwner } = await supabase.rpc('is_platform_owner')
  if (isOwner !== true) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { id, status, admin_note } = body

  if (!id) return NextResponse.json({ error: 'id fehlt.' }, { status: 400 })
  if (!['pending', 'in_progress', 'done'].includes(status)) {
    return NextResponse.json({ error: 'Ungültiger Status.' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('design_requests')
    .update({ status, admin_note: admin_note ?? null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}
