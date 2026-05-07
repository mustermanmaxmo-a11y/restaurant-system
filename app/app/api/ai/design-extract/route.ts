import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveAiKey } from '@/lib/ai-key'
import { rateLimit } from '@/lib/rate-limit'
import { validateDesignConfigWithDefaults } from '@/lib/design-config-validate'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8 MB
const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
type AllowedImage = (typeof ALLOWED_IMAGE)[number]

const IMAGE_PROMPT = `Analyze this restaurant website screenshot and extract the design configuration.
Return ONLY valid JSON (no markdown) with these exact fields:
{
  "primary_color": "#hex",
  "bg_color": "#hex",
  "surface_color": "#hex",
  "header_color": "#hex",
  "button_color": "#hex",
  "card_color": "#hex",
  "text_color": "#hex",
  "font_pair": "syne-dmsans",
  "layout_variant": "cards",
  "border_radius": "rounded",
  "hover_effect": "scale",
  "animation_style": "fade",
  "card_style": "elevated",
  "confidence": 0.85
}
Font pairs: syne-dmsans (modern/geometric), playfair-lato (elegant/fine-dining), inter-inter (clean/minimal), space-dmsans (bold/street-food), merriweather-source (warm/traditional), noto-noto (Asian restaurants)
Layout: cards, list, grid, large-cards
Border radius: sharp (luxury/angular), rounded (friendly/standard), pill (playful)
Hover: scale, glow, underline, color-shift, none
Animation: fade, slide, none
Card style: elevated, flat, outlined, ghost`

const URL_PROMPT = `Analyze this restaurant website HTML/CSS and extract the design. Look for colors in CSS, font families, border-radius. Be less confident (0.5-0.7).
Return ONLY valid JSON (no markdown) with these exact fields:
{
  "primary_color": "#hex",
  "bg_color": "#hex",
  "surface_color": "#hex",
  "header_color": "#hex",
  "button_color": "#hex",
  "card_color": "#hex",
  "text_color": "#hex",
  "font_pair": "syne-dmsans",
  "layout_variant": "cards",
  "border_radius": "rounded",
  "hover_effect": "scale",
  "animation_style": "fade",
  "card_style": "elevated",
  "confidence": 0.6
}
Font pairs: syne-dmsans (modern/geometric), playfair-lato (elegant/fine-dining), inter-inter (clean/minimal), space-dmsans (bold/street-food), merriweather-source (warm/traditional), noto-noto (Asian restaurants)
Layout: cards, list, grid, large-cards
Border radius: sharp (luxury/angular), rounded (friendly/standard), pill (playful)
Hover: scale, glow, underline, color-shift, none
Animation: fade, slide, none
Card style: elevated, flat, outlined, ghost`

export async function POST(request: NextRequest) {
  // Auth via Bearer token
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  // Parse FormData
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const restaurantId = form.get('restaurant_id')
  const imageFile = form.get('image')
  const url = form.get('url')

  if (typeof restaurantId !== 'string' || !restaurantId) {
    return NextResponse.json({ error: 'restaurant_id erforderlich' }, { status: 400 })
  }

  const hasImage = imageFile instanceof File && imageFile.size > 0
  const hasUrl = typeof url === 'string' && url.trim().length > 0

  if (!hasImage && !hasUrl) {
    return NextResponse.json({ error: 'image oder url erforderlich' }, { status: 400 })
  }

  // Image validation
  if (hasImage && imageFile instanceof File) {
    if (imageFile.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Bild zu groß (max. 8 MB)' }, { status: 400 })
    }
    if (!(ALLOWED_IMAGE as readonly string[]).includes(imageFile.type)) {
      return NextResponse.json({ error: 'Nur JPEG, PNG, WebP oder GIF erlaubt' }, { status: 400 })
    }
  }

  // Ownership check via admin client
  const supabaseAdmin = createSupabaseAdmin()
  const { data: restaurant } = await supabaseAdmin
    .from('restaurants')
    .select('id, owner_id')
    .eq('id', restaurantId)
    .single()
  if (!restaurant || restaurant.owner_id !== user.id) {
    return NextResponse.json({ error: 'Restaurant nicht gefunden' }, { status: 404 })
  }

  // Rate limit: 10 per hour
  if (!await rateLimit(`design-extract:${restaurantId}`, 10, 3_600_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte in einer Stunde erneut versuchen.' }, { status: 429 })
  }

  // Resolve AI key
  const apiKey = await resolveAiKey(restaurantId)
  if (!apiKey) {
    return NextResponse.json({
      error: 'KI-Design-Extraktion ist nur im Pro- oder Enterprise-Plan verfügbar. Bitte Plan upgraden und Anthropic API-Key eintragen.',
    }, { status: 403 })
  }

  const anthropic = new Anthropic({ apiKey })

  try {
    let responseText: string

    if (hasImage && imageFile instanceof File) {
      // Vision: send image as base64
      const base64 = Buffer.from(await imageFile.arrayBuffer()).toString('base64')
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: 'You are a design extraction assistant. Respond ONLY with valid JSON. No markdown fences, no explanations.',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: imageFile.type as AllowedImage, data: base64 },
              },
              { type: 'text', text: IMAGE_PROMPT },
            ],
          },
        ],
      })
      responseText = message.content[0]?.type === 'text' ? message.content[0].text : ''
    } else {
      // SSRF protection: only allow http/https and block private/loopback ranges
      let parsedUrl: URL
      try {
        parsedUrl = new URL(url as string)
      } catch {
        return NextResponse.json({ error: 'Ungültige URL' }, { status: 400 })
      }
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return NextResponse.json({ error: 'Nur HTTP/HTTPS URLs erlaubt' }, { status: 400 })
      }
      const host = parsedUrl.hostname.toLowerCase()
      const BLOCKED = [
        /^localhost$/,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2\d|3[01])\./,
        /^192\.168\./,
        /^::1$/,
        /^0\.0\.0\.0$/,
        /^169\.254\./,
        /\.internal$/,
        /\.local$/,
      ]
      if (BLOCKED.some(re => re.test(host))) {
        return NextResponse.json({ error: 'Diese URL ist nicht erlaubt' }, { status: 400 })
      }

      // URL: fetch HTML and send as text
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8_000)
      let html: string
      try {
        const res = await fetch(parsedUrl.toString(), { signal: controller.signal })
        const raw = await res.text()
        html = raw.slice(0, 12_000)
      } catch {
        return NextResponse.json({ error: 'URL konnte nicht geladen werden' }, { status: 400 })
      } finally {
        clearTimeout(timeout)
      }

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: 'You are a design extraction assistant. Respond ONLY with valid JSON. No markdown fences, no explanations.',
        messages: [
          {
            role: 'user',
            content: `${URL_PROMPT}\n\nHTML:\n${html}`,
          },
        ],
      })
      responseText = message.content[0]?.type === 'text' ? message.content[0].text : ''
    }

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Design konnte nicht extrahiert werden' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0]) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return NextResponse.json({ error: 'Ungültige Antwort vom KI-Modell' }, { status: 500 })
    }

    const { config: design_config, confidence } = validateDesignConfigWithDefaults(parsed as Record<string, unknown>)

    return NextResponse.json({ design_config, confidence })
  } catch (err) {
    console.error('Design extraction failed:', err)
    return NextResponse.json({ error: 'Design-Extraktion momentan nicht verfügbar' }, { status: 500 })
  }
}
