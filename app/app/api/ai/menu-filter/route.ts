import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { resolveAiKey } from '@/lib/ai-key'

interface MenuItem {
  id: string
  name: string
  description: string | null
  allergens: string[] | null
  tags: string[] | null
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { restaurantId, query, items } = body as {
    restaurantId: string
    query: string
    items: MenuItem[]
  }

  if (!restaurantId || !query || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'restaurantId, query, and items required' }, { status: 400 })
  }

  // Sanitize query input
  const sanitizedQuery = query.slice(0, 200)

  // AI key (Pro/Enterprise only) — graceful fallback for non-Pro
  const apiKey = await resolveAiKey(restaurantId)
  if (!apiKey) {
    return NextResponse.json({
      suitable: items.map(i => i.id),
      unsuitable: [],
    })
  }

  const itemList = items.map(i =>
    `ID:${i.id} | ${i.name}${i.description ? ' — ' + i.description : ''}${i.allergens?.length ? ' | Allergene: ' + i.allergens.join(', ') : ''}${i.tags?.length ? ' | Tags: ' + i.tags.join(', ') : ''}`
  ).join('\n')

  const anthropic = new Anthropic({ apiKey })

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system:
        'Du bist ein Menü-Assistent. Antworte ausschließlich mit validem JSON. Kein Text davor oder danach.',
      messages: [
        {
          role: 'user',
          content: `Gästepräferenz: "${sanitizedQuery}"

Menü-Gerichte:
${itemList}

Welche Gerichte passen zu den Präferenzen des Gastes, welche nicht?
Antworte als JSON:
{
  "suitable": ["id1", "id2"],
  "unsuitable": [{"id": "id3", "reason": "Kurzer Grund auf Deutsch"}]
}

Regeln:
- Wenn ein Gericht unklar ist, zähle es als suitable
- Reason maximal 8 Wörter
- Berücksichtige Allergene, Tags und Beschreibung`,
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      return NextResponse.json({ suitable: items.map(i => i.id), unsuitable: [] })
    }

    const result = JSON.parse(match[0])
    return NextResponse.json({
      suitable: Array.isArray(result.suitable) ? result.suitable : items.map(i => i.id),
      unsuitable: Array.isArray(result.unsuitable) ? result.unsuitable : [],
    })
  } catch {
    // On any error: show all items rather than blocking the guest
    return NextResponse.json({ suitable: items.map(i => i.id), unsuitable: [] })
  }
}
