import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { initDraftFromLive, hasUnpublishedChanges, type DraftConfig } from '@/lib/editor-draft'
import { sanitizeLandingContent } from '@/lib/landing-content-validate'
import type { LandingPageContent } from '@/lib/landing-content'

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

async function loadOwnedRestaurant(userId: string, restaurantId: string) {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('restaurants')
    .select('*')
    .eq('id', restaurantId)
    .eq('owner_id', userId)
    .maybeSingle()
  return data
}

// GET — Entwurf laden (falls keiner existiert: aus Live-Stand initialisieren, NICHT persistieren)
export async function GET(req: NextRequest) {
  const { user } = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id erforderlich' }, { status: 400 })

  const resto = await loadOwnedRestaurant(user.id, restaurantId)
  if (!resto) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const admin = createSupabaseAdmin()
  const { data: lp } = await admin
    .from('landing_pages')
    .select('content')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  const existing = (resto as { draft_config?: DraftConfig | null }).draft_config ?? null
  const lastPublishedAt = (resto as { last_published_at?: string | null }).last_published_at ?? null
  const draft = existing ?? initDraftFromLive(resto, (lp?.content ?? {}) as LandingPageContent)

  return NextResponse.json({
    draft,
    last_published_at: lastPublishedAt,
    has_unpublished_changes: hasUnpublishedChanges(draft.draft_updated_at, lastPublishedAt),
  })
}

// PATCH — Entwurf auto-speichern (ganzer Entwurf wird ersetzt)
export async function PATCH(req: NextRequest) {
  const { user } = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  let body: { restaurant_id?: string; draft?: DraftConfig }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { restaurant_id, draft } = body
  if (typeof restaurant_id !== 'string' || !restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id erforderlich' }, { status: 400 })
  }
  if (!draft || typeof draft !== 'object' || !draft.brand || typeof draft.brand !== 'object') {
    return NextResponse.json({ error: 'draft (mit brand) erforderlich' }, { status: 400 })
  }

  const resto = await loadOwnedRestaurant(user.id, restaurant_id)
  if (!resto) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const safeDraft: DraftConfig = {
    brand: draft.brand,
    landing_content: sanitizeLandingContent(draft.landing_content),
    draft_updated_at: new Date().toISOString(),
  }

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('restaurants')
    .update({ draft_config: safeDraft })
    .eq('id', restaurant_id)

  if (error) {
    console.error('editor-draft PATCH error:', error)
    return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
  }

  const lastPublishedAt = (resto as { last_published_at?: string | null }).last_published_at ?? null
  return NextResponse.json({
    draft: safeDraft,
    has_unpublished_changes: hasUnpublishedChanges(safeDraft.draft_updated_at, lastPublishedAt),
  })
}
