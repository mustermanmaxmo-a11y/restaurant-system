import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { resolveAiKey } from '@/lib/ai-key'

// Security: Only menu data (no customer PII) is sent to the Claude API.
// Specifically: item names, descriptions, prices, allergens, tags, cart item names.
// No customer names, addresses, payment data, or personal information.

const FALLBACK_REPLY = 'Der Assistent ist momentan nicht verfügbar. Unser Personal hilft dir gerne weiter!'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { restaurantSlug, message, history } = body as {
    restaurantSlug: string
    message: string
    history?: { role: 'user' | 'assistant'; content: string }[]
    cart?: { name: string; qty: number }[]
  }

  if (!restaurantSlug || !message?.trim()) {
    return NextResponse.json({ reply: FALLBACK_REPLY })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch restaurant + menu in parallel
  const [{ data: restaurant }, { data: categories }, { data: items }, { data: specialsData }] = await Promise.all([
    supabase.from('restaurants').select('id, name, plan, anthropic_api_key').eq('slug', restaurantSlug).single(),
    supabase.from('menu_categories').select('id, name').eq('active', true),
    supabase.from('menu_items').select('id, name, description, price, allergens, tags, category_id').eq('available', true),
    supabase.from('daily_specials').select('menu_item_id, label, special_price, note').eq('active', true),
  ])

  if (!restaurant) {
    return NextResponse.json({ reply: FALLBACK_REPLY })
  }

  // Resolve API key based on plan
  const apiKey = await resolveAiKey(restaurant.id)
  if (!apiKey) {
    return NextResponse.json({ reply: FALLBACK_REPLY })
  }

  // Build menu context — no PII
  const catMap = Object.fromEntries((categories || []).map(c => [c.id, c.name]))
  const specialsMap = Object.fromEntries((specialsData || []).map(s => [s.menu_item_id, s]))

  const menuText = (items || []).map(item => {
    const cat = catMap[item.category_id] || ''
    const allergens = item.allergens?.length ? `Allergene: ${item.allergens.join(', ')}` : 'Keine bekannten Allergene'
    const tags = item.tags?.length ? `(${item.tags.join(', ')})` : ''
    const desc = item.description ? ` — ${item.description}` : ''
    const sp = specialsMap[item.id]
    const specialStr = sp
      ? ` [TAGESANGEBOT: "${sp.label}"${sp.special_price != null ? `, ${Number(sp.special_price).toFixed(2)}€ statt ${Number(item.price).toFixed(2)}€` : ''}${sp.note ? `, Hinweis: ${sp.note}` : ''}]`
      : ''
    return `• [${cat}] ${item.name}${desc} | ${Number(item.price).toFixed(2)}€ ${tags} | ${allergens} | item_id:${item.id}${specialStr}`
  }).join('\n')

  const cartText = body.cart?.length
    ? '\nAktueller Warenkorb des Gastes:\n' + body.cart.map(i => `• ${i.name} x${i.qty}`).join('\n')
    : ''

  const systemPrompt = `Du bist der freundliche Menü-Assistent von "${restaurant.name}".

Du hilfst Gästen bei:
- Empfehlungen basierend auf ihren Wünschen und Vorlieben
- Allergen-Abfragen: Antworte IMMER klar und deutlich — nenne alle betroffenen Gerichte
- Gericht-Beschreibungen und Preisvergleichen
- Diät-Fragen (vegetarisch, vegan, glutenfrei etc.)

Tagesangebote (markiert als [TAGESANGEBOT] im Menü):
- Erwähne Tagesangebote proaktiv wenn sie zum Gespräch passen (z.B. bei Empfehlungsfragen)
- Weise auf den Sonderpreis hin wenn vorhanden

Upselling (nur wenn Warenkorb nicht leer ist):
- Schlage EINMALIG pro Gespräch eine passende Ergänzung vor — Getränk, Beilage oder Dessert die zum Warenkorb-Inhalt passen
- Nur wenn es natürlich in die Antwort passt — nie bei Allergen-Fragen, Beschwerden oder unpassenden Themen
- Maximal 1 Vorschlag, kurz und unaufdringlich (z.B. "Dazu passt übrigens gut unser X")

Antworte IMMER als valides JSON in diesem Format:
{"reply": "Deine Antwort hier", "cartSuggestion": {"item_id": "uuid", "name": "Gerichtname", "qty": 1}, "serviceCall": "waiter"}

Regeln für cartSuggestion:
- NUR einfügen wenn der Gast EXPLIZIT ein Gericht bestellen will (z.B. "Ich nehme...", "Ich möchte X", "Gib mir X", "Bestell X")
- Bei Empfehlungen, Fragen, Allergenen oder unklaren Wünschen: cartSuggestion WEGLASSEN
- item_id: exakt die item_id aus dem Menü unten
- qty: die genannte Menge, sonst 1
- Nur EIN Gericht pro cartSuggestion (das zuerst genannte)

Regeln für serviceCall:
- "waiter": wenn Gast nach Kellner/Hilfe ruft ("Kellner bitte", "Hilfe", "Entschuldigung", "kann mir jemand helfen")
- "bill": wenn Gast die Rechnung möchte ("Rechnung bitte", "ich möchte zahlen", "bezahlen")
- Weglassen wenn kein Service-Wunsch erkennbar
- Bei serviceCall: in reply kurz bestätigen dass das Personal informiert wird (z.B. "Ich habe das Personal für dich benachrichtigt!")

Weitere Regeln:
- reply: kurz (max 3-4 Sätze), freundlich, in der Sprache des Gastes
- Bei Allergen-Fragen: Sei explizit — lieber zu detailliert als zu vage
- Wenn du eine Frage nicht beantworten kannst, verweise auf das Personal

Aktuelles Menü:
${menuText}${cartText}`

  // Build message history (max last 6 exchanges)
  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...(history || []).slice(-6),
    { role: 'user', content: message.trim() },
  ]

  try {
    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: systemPrompt,
      messages,
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    if (!rawText) return NextResponse.json({ reply: FALLBACK_REPLY })

    // Parse JSON response from KI
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        const reply = parsed.reply || FALLBACK_REPLY
        const cs = parsed.cartSuggestion
        const sc = parsed.serviceCall === 'waiter' || parsed.serviceCall === 'bill' ? parsed.serviceCall : null
        const result: Record<string, unknown> = { reply }
        if (cs?.item_id && cs?.name) result.cartSuggestion = { itemId: cs.item_id, name: cs.name, qty: cs.qty || 1 }
        if (sc) result.serviceCall = sc
        return NextResponse.json(result)
      }
    } catch { /* fall through to plain text */ }

    return NextResponse.json({ reply: rawText })
  } catch {
    return NextResponse.json({ reply: FALLBACK_REPLY })
  }
}
