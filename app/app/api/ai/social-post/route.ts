import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { resolveAiKey } from '@/lib/ai-key'
import { rateLimit } from '@/lib/rate-limit'

const TONE_DESCRIPTIONS = {
  warm: 'warm, einladend und persönlich',
  professional: 'professionell und seriös',
  fun: 'humorvoll, locker und jung',
  luxury: 'luxuriös, exklusiv und elegant',
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { restaurantId, itemId, tone = 'warm', language = 'de' } = body

  if (!restaurantId || !itemId) {
    return NextResponse.json({ error: 'restaurantId and itemId required' }, { status: 400 })
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

  if (!await rateLimit(`social-post:${restaurantId}`, 20, 3_600_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen.' }, { status: 429 })
  }

  const [{ data: restaurant }, { data: item }] = await Promise.all([
    supabase.from('restaurants').select('name, plan').eq('id', restaurantId).eq('owner_id', user.id).single(),
    supabase.from('menu_items').select('name, description, price, allergens, tags').eq('id', itemId).eq('restaurant_id', restaurantId).single(),
  ])

  if (!restaurant || !item) {
    return NextResponse.json({ error: 'Nicht gefunden.' }, { status: 404 })
  }

  const aiKey = await resolveAiKey(restaurantId)
  if (!aiKey) {
    return NextResponse.json({ error: 'KI nicht verfügbar. Bitte API-Key in den Einstellungen hinterlegen.' }, { status: 402 })
  }

  const anthropic = new Anthropic({ apiKey: aiKey })

  const langMap: Record<string, string> = { de: 'Deutsch', en: 'Englisch', it: 'Italienisch', fr: 'Französisch', es: 'Spanisch' }
  const langName = langMap[language] ?? 'Deutsch'
  const toneDesc = TONE_DESCRIPTIONS[tone as keyof typeof TONE_DESCRIPTIONS] ?? TONE_DESCRIPTIONS.warm

  const prompt = `Du bist ein Social-Media-Texter für das Restaurant "${restaurant.name}".

Erstelle einen Instagram/Facebook-Post für folgendes Gericht:
- Name: ${item.name}
- Beschreibung: ${item.description || '(keine)'}
- Preis: ${item.price.toFixed(2)} €
- Allergene: ${item.allergens?.join(', ') || 'keine'}
- Tags: ${item.tags?.join(', ') || 'keine'}

Anforderungen:
- Tonalität: ${toneDesc}
- Sprache: ${langName}
- Länge: 80–150 Wörter für die Caption
- 10–15 passende Hashtags am Ende
- Kein "Caption:" oder "Hashtags:" als Label — einfach direkt ausgeben

Antworte NUR mit dem fertigen Post-Text inklusive Hashtags. Kein weiterer Kommentar.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return NextResponse.json({ post: text })
}
