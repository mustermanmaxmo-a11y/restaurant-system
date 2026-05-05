import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { resolveAiKey } from '@/lib/ai-key'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { restaurantId, menuItemId, imageBase64, mimeType } = body

  if (!restaurantId || !menuItemId || !imageBase64) {
    return NextResponse.json({ error: 'restaurantId, menuItemId, imageBase64 required' }, { status: 400 })
  }

  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!await rateLimit(`recipe-extract:${restaurantId}`, 20, 3_600_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen.' }, { status: 429 })
  }

  // Verify ownership
  const { data: item } = await supabase
    .from('menu_items')
    .select('id, restaurant_id')
    .eq('id', menuItemId)
    .single()

  if (!item) return NextResponse.json({ error: 'Item nicht gefunden' }, { status: 404 })

  const { data: resto } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', item.restaurant_id)
    .eq('owner_id', user.id)
    .single()

  if (!resto) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const apiKey = await resolveAiKey(restaurantId)
  if (!apiKey) return NextResponse.json({ error: 'Kein AI-Key konfiguriert.' }, { status: 503 })

  const anthropic = new Anthropic({ apiKey })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: (mimeType ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: imageBase64,
          },
        },
        {
          type: 'text',
          text: `Analysiere dieses Rezeptbild und extrahiere alle Zutaten mit Mengen. Antworte NUR mit diesem JSON (keine Markdown-Blöcke):
{
  "ingredients": [
    {"name": "Zutatname", "quantity": 200, "unit": "g", "uncertain": false},
    {"name": "Zutatname", "quantity": 2, "unit": "Stk", "uncertain": true}
  ],
  "preparation_text": "Kurze Zubereitung in 2-3 Sätzen"
}
uncertain ist true wenn die Menge auf dem Bild nicht eindeutig lesbar ist.`,
        },
      ],
    }],
  })

  const raw = (message.content[0] as { type: string; text: string }).text.trim()
  let extracted
  try {
    extracted = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'KI-Antwort konnte nicht verarbeitet werden.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...extracted })
}
