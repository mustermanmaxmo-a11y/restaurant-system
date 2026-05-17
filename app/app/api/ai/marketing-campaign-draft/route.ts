import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { resolveAiKey } from '@/lib/ai-key'
import { rateLimit } from '@/lib/rate-limit'
import { buildMarketingContext } from '@/lib/marketing-context'

// Security: Only menu/branding data (no customer PII) is sent to the Claude API.

export async function POST(request: NextRequest) {
  // 1. Auth
  const supabaseSSR = await createSupabaseServerSSR()
  const {
    data: { user },
  } = await supabaseSSR.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Parse body
  const body = await request.json()
  const { prompt, restaurantId, templateType } = body as {
    prompt: string
    restaurantId: string
    templateType?: string
  }

  // 3. Validate
  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'Prompt required' }, { status: 400 })
  }
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId required' }, { status: 400 })
  }

  // 4. Get restaurant and verify ownership — include design_config
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, plan, design_config')
    .eq('owner_id', user.id)
    .eq('id', restaurantId)
    .maybeSingle()

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found or access denied' }, { status: 403 })
  }

  // 5. Resolve AI key
  const apiKey = await resolveAiKey(restaurant.id)
  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'Der KI-Marketing-Berater ist für deinen aktuellen Plan nicht verfügbar. Upgrade auf Pro.',
    })
  }

  // 6. Rate limiting: 20 per hour
  const allowed = await rateLimit(`marketing-draft:${restaurant.id}`, 20, 60 * 60 * 1000)
  if (!allowed) {
    return NextResponse.json({ success: false, error: 'Zu viele Anfragen. Bitte warte eine Stunde.' }, { status: 429 })
  }

  // 7. Build context
  const ctx = await buildMarketingContext(restaurantId, prompt)

  // 8. Build system prompt and call Claude (non-streaming)
  const design_config = restaurant.design_config as Record<string, string> | null

  const systemPrompt = `Du bist ein Email-Marketing-Experte für Restaurants. Erstelle einen vollständigen Email-Kampagnen-Entwurf.

Restaurant: ${restaurant.name}
Branding-Farben: primary=${design_config?.primary_color ?? '#e85d26'}, bg=${design_config?.bg_color ?? '#000000'}
Top-Gerichte: ${ctx.topMenuItems.map((i) => i.name).join(', ')}
Aktuelle Saison: ${ctx.seasonalContext.season}

Erstelle einen Entwurf basierend auf: ${prompt}
Template-Typ: ${templateType ?? 'discount'}

Antworte NUR mit einem JSON-Objekt (kein Markdown, kein Text davor oder danach):
{
  "subject": "Email-Betreffzeile (max 50 Zeichen)",
  "previewText": "Vorschautext (max 90 Zeichen)",
  "bodyHtml": "Vollständiges HTML der Email (inline CSS, verwendet Branding-Farben, professionell)",
  "ctaText": "Call-to-Action Button Text",
  "ctaUrl": "{{RESTAURANT_URL}}",
  "discountCode": "AKTIONSCODE2026 oder null wenn kein Rabatt",
  "templateType": "${templateType ?? 'discount'}"
}

bodyHtml requirements:
- Vollständiges HTML mit inline CSS
- Verwende primary_color: ${design_config?.primary_color ?? '#e85d26'} für Buttons/Akzente
- Mobile-responsive (max-width: 600px)
- Enthält Placeholder {{RESTAURANT_NAME}}, {{UNSUBSCRIBE_URL}}
- Professionelles Restaurant-Email-Design
- Wenn discountCode vorhanden: zeige ihn prominent mit gestricheltem Border`

  try {
    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt.trim() }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

    // 9. Parse Claude's JSON response
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON block found')
      const draft = JSON.parse(jsonMatch[0])

      // 10. Return success
      return NextResponse.json({
        success: true,
        draft: {
          subject: draft.subject ?? '',
          previewText: draft.previewText ?? '',
          bodyHtml: draft.bodyHtml ?? '',
          ctaText: draft.ctaText ?? '',
          ctaUrl: draft.ctaUrl ?? '{{RESTAURANT_URL}}',
          discountCode: draft.discountCode ?? null,
          templateType: draft.templateType ?? templateType ?? 'discount',
        },
      })
    } catch {
      // 11. Parse error fallback
      return NextResponse.json({ success: false, error: 'Kampagnen-Generierung fehlgeschlagen' })
    }
  } catch {
    return NextResponse.json({ success: false, error: 'Kampagnen-Generierung fehlgeschlagen' })
  }
}
