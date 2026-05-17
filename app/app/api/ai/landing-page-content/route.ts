import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveAiKey } from '@/lib/ai-key'
import { rateLimit } from '@/lib/rate-limit'

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

interface AiGeneratedContent {
  headline: string
  subheadline: string
  about_text: string
  cta_text: string
  feature_badges?: string[]
}

// POST — generate AI landing page copy
export async function POST(req: NextRequest) {
  let body: {
    restaurant_id?: string
    template_style?: string
    language?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { restaurant_id, language } = body

  if (typeof restaurant_id !== 'string' || !restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id erforderlich' }, { status: 400 })
  }

  const { user } = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const isOwner = await checkOwnership(user.id, restaurant_id)
  if (!isOwner) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const allowed = await rateLimit(`landing-page-content:${restaurant_id}`, 5, 3_600_000)
  if (!allowed) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte später erneut versuchen.' }, { status: 429 })
  }

  const apiKey = await resolveAiKey(restaurant_id)
  if (!apiKey) {
    return NextResponse.json(
      { error: 'KI nicht verfügbar. Bitte Pro-Plan buchen und API Key eintragen.' },
      { status: 403 }
    )
  }

  // Fetch restaurant info
  const admin = createSupabaseAdmin()
  const { data: restaurant, error: restoErr } = await admin
    .from('restaurants')
    .select('name, restaurant_category, description')
    .eq('id', restaurant_id)
    .single()

  if (restoErr || !restaurant) {
    return NextResponse.json({ error: 'Restaurant nicht gefunden' }, { status: 404 })
  }

  const name = restaurant.name as string
  const category = (restaurant.restaurant_category as string | null) ?? 'Restaurant'
  const description = (restaurant.description as string | null) ?? 'none'
  const lang = (typeof language === 'string' && language) ? language : 'de'

  const anthropic = new Anthropic({ apiKey })

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: 'You are a copywriter for restaurant websites. Respond ONLY with valid JSON.',
      messages: [
        {
          role: 'user',
          content: `Write landing page copy for a restaurant named "${name}". Category: ${category}. Description: ${description}. Language: ${lang}.\n\nAvailable feature badges: Vegetarisch, Vegan, Glutenfrei, Halal, Lieferung, Reservierung, Takeaway, Catering, Wifi, Terrasse, Parkplatz.\n\nReturn JSON: { "headline": "...", "subheadline": "...", "about_text": "...", "cta_text": "...", "feature_badges": ["badge1", "badge2"] }\nSelect 2-4 relevant badges based on the restaurant category.`,
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      return NextResponse.json({ error: 'KI-Antwort konnte nicht verarbeitet werden' }, { status: 500 })
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(match[0])
    } catch {
      return NextResponse.json({ error: 'KI-Antwort konnte nicht verarbeitet werden' }, { status: 500 })
    }

    const { headline, subheadline, about_text, cta_text, feature_badges } = parsed

    if (
      typeof headline !== 'string' || !headline.trim() ||
      typeof subheadline !== 'string' || !subheadline.trim() ||
      typeof about_text !== 'string' || !about_text.trim() ||
      typeof cta_text !== 'string' || !cta_text.trim()
    ) {
      return NextResponse.json({ error: 'Unvollständige KI-Antwort' }, { status: 500 })
    }

    const result: AiGeneratedContent = {
      headline: headline.trim(),
      subheadline: subheadline.trim(),
      about_text: about_text.trim(),
      cta_text: cta_text.trim(),
      feature_badges: Array.isArray(feature_badges)
        ? feature_badges.filter((b): b is string => typeof b === 'string').slice(0, 4)
        : undefined,
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'KI momentan nicht verfügbar' }, { status: 500 })
  }
}
