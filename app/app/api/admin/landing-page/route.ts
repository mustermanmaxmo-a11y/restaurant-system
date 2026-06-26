import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { sanitizeLandingContent } from '@/lib/landing-content-validate'
import type { LandingPageContent } from '@/lib/landing-content'

export const dynamic = 'force-dynamic'

interface LandingPageRow {
  id: string
  restaurant_id: string
  template_slug: string
  content: LandingPageContent
  is_published: boolean
  custom_domain: string | null
  created_at: string
  updated_at: string
}

const VALID_SLUGS = [
  'minimal-dark',
  'warm-rustic',
  'bold-modern',
  'elegant-white',
  'street-energy',
] as const


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

async function checkOwnership(userId: string, restaurantId: string): Promise<boolean> {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', userId)
    .maybeSingle()
  return !!data
}

// GET — load or create landing page
export async function GET(req: NextRequest) {
  const { user } = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id erforderlich' }, { status: 400 })

  const isOwner = await checkOwnership(user.id, restaurantId)
  if (!isOwner) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const admin = createSupabaseAdmin()
  const { data: existing, error } = await admin
    .from('landing_pages')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (error) {
    console.error('landing-page GET error:', error)
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  if (existing) {
    return NextResponse.json({ data: existing as LandingPageRow })
  }

  // Create default row
  const { data: created, error: insertErr } = await admin
    .from('landing_pages')
    .insert({
      restaurant_id: restaurantId,
      template_slug: 'minimal-dark',
      content: {},
      is_published: false,
    })
    .select()
    .single()

  if (insertErr) {
    console.error('landing-page INSERT error:', insertErr)
    return NextResponse.json({ error: 'Konnte Landing Page nicht erstellen' }, { status: 500 })
  }

  return NextResponse.json({ data: created as LandingPageRow })
}

// PATCH — save changes
export async function PATCH(req: NextRequest) {
  const { user } = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  let body: {
    restaurant_id?: string
    template_slug?: string
    content?: Record<string, unknown>
    is_published?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { restaurant_id, template_slug, content, is_published } = body

  if (typeof restaurant_id !== 'string' || !restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id erforderlich' }, { status: 400 })
  }

  // Validate template_slug
  if (template_slug !== undefined) {
    if (!(VALID_SLUGS as readonly string[]).includes(template_slug)) {
      return NextResponse.json({ error: `Ungültiges template_slug. Erlaubt: ${VALID_SLUGS.join(', ')}` }, { status: 400 })
    }
  }

  // Validate content fields (typbewusst: behält alle bekannten Felder, verwirft Müll)
  let safeContent: LandingPageContent | undefined
  if (content !== undefined) {
    if (typeof content !== 'object' || content === null || Array.isArray(content)) {
      return NextResponse.json({ error: 'content muss ein Objekt sein' }, { status: 400 })
    }
    safeContent = sanitizeLandingContent(content)
  }

  const isOwner = await checkOwnership(user.id, restaurant_id)
  if (!isOwner) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (template_slug !== undefined) update.template_slug = template_slug
  if (safeContent !== undefined) update.content = safeContent
  if (typeof is_published === 'boolean') update.is_published = is_published

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('landing_pages')
    .upsert({ restaurant_id, ...update }, { onConflict: 'restaurant_id' })
    .select()
    .single()

  if (error) {
    console.error('landing-page PATCH error:', error)
    return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json({ data: data as LandingPageRow })
}
