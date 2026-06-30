import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { promoteDraft, type DraftConfig } from '@/lib/editor-draft'

export const dynamic = 'force-dynamic'

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const token = auth?.replace('Bearer ', '').trim()
  if (!token) return { user: null }
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { data: { user } } = await client.auth.getUser(token)
  return { user }
}

export async function POST(req: NextRequest) {
  const { user } = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  let body: { restaurant_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }
  const { restaurant_id } = body
  if (typeof restaurant_id !== 'string' || !restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id erforderlich' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { data: resto } = await admin
    .from('restaurants')
    .select('id, draft_config')
    .eq('id', restaurant_id)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!resto) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const draft = (resto as { draft_config?: DraftConfig | null }).draft_config
  if (!draft || !draft.brand) {
    return NextResponse.json({ error: 'Kein Entwurf zum Veröffentlichen' }, { status: 400 })
  }

  const { restaurantUpdate, landingContent } = promoteDraft(draft)
  const publishedAt = new Date().toISOString()

  const { error: restoErr } = await admin
    .from('restaurants')
    .update({ ...restaurantUpdate, last_published_at: publishedAt })
    .eq('id', restaurant_id)
  if (restoErr) {
    console.error('editor-publish restaurants error:', restoErr)
    return NextResponse.json({ error: 'Veröffentlichen fehlgeschlagen (Marke)' }, { status: 500 })
  }

  const { error: lpErr } = await admin
    .from('landing_pages')
    .upsert(
      { restaurant_id, content: landingContent, is_published: true, updated_at: publishedAt },
      { onConflict: 'restaurant_id' },
    )
  if (lpErr) {
    console.error('editor-publish landing_pages error:', lpErr)
    return NextResponse.json({ error: 'Veröffentlichen fehlgeschlagen (Inhalt)' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, last_published_at: publishedAt })
}
