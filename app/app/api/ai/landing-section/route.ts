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

const FIELD_PROMPTS: Record<'about' | 'story', string> = {
  about: 'Schreibe einen einladenden "Über uns"-Text (3-4 Sätze) für die Website dieses Restaurants. Persönlich, einladend, ohne Floskeln.',
  story: 'Schreibe eine kurze Gründungs-/Geschichte (3-5 Sätze) für die Website dieses Restaurants. Erzähle von Ursprung, Werten und Leidenschaft. Persönlich und glaubwürdig.',
}

// POST — generate text for a single landing section field
export async function POST(req: NextRequest) {
  let body: { restaurant_id?: string; field?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { restaurant_id, field } = body

  if (typeof restaurant_id !== 'string' || !restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id erforderlich' }, { status: 400 })
  }
  if (field !== 'about' && field !== 'story') {
    return NextResponse.json({ error: 'Ungültiges Feld' }, { status: 400 })
  }

  const { user } = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const isOwner = await checkOwnership(user.id, restaurant_id)
  if (!isOwner) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const allowed = await rateLimit(`landing-section:${restaurant_id}`, 10, 3_600_000)
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

  const anthropic = new Anthropic({ apiKey })

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: 'Du bist Werbetexter für Restaurant-Websites. Antworte NUR mit dem reinen Text — ohne Anführungszeichen, ohne Vorrede, ohne Überschrift.',
      messages: [
        {
          role: 'user',
          content: `${FIELD_PROMPTS[field]}\n\nRestaurant: "${name}". Kategorie: ${category}. Beschreibung: ${description}. Sprache: Deutsch.`,
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    if (!text) {
      return NextResponse.json({ error: 'Leere KI-Antwort' }, { status: 500 })
    }
    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ error: 'KI momentan nicht verfügbar' }, { status: 500 })
  }
}
