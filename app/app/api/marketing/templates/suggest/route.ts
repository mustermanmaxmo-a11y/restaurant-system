import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { resolveAiKey } from '@/lib/ai-key'
import { rateLimit } from '@/lib/rate-limit'
import {
  getBaseTemplateForTrigger,
  DISCOUNT_BLOCK,
  buildLogoBlock,
  resolveEmailStyle,
  AVAILABLE_STYLES,
  type EmailStyle,
} from '@/lib/email-base-templates'
import { renderEmailTemplate } from '@/lib/email-template-renderer'

export const dynamic = 'force-dynamic'

const VALID_TRIGGERS = ['birthday', 'inactivity_14d', 'seasonal', 'post_order', 'manual', 'scheduled'] as const
type Trigger = typeof VALID_TRIGGERS[number]

const TRIGGER_BRIEFS: Record<Trigger, string> = {
  birthday: 'Geburtstags-Email — herzliche Glückwünsche + Gutscheincode als Geschenk. Tonfall: persönlich, warm.',
  inactivity_14d: 'Comeback-Email für Gäste, die seit 14+ Tagen nicht mehr bestellt haben. Tonfall: einladend, „Wir vermissen dich".',
  seasonal: 'Saisonale Email (Weihnachten, Valentinstag, Ostern). Tonfall: festlich, themenbezogen.',
  post_order: 'Dankeschön-Email nach Bestellung. KEIN Rabattcode (Bewertungs-Block wird automatisch ergänzt). Tonfall: dankbar, kurz.',
  manual: 'Allgemeine Marketing-Mail mit optionalem Rabatt. Tonfall: handlungsorientiert.',
  scheduled: 'Geplante wöchentliche Mail (z.B. Freitag-Special). Tonfall: aufmerksamkeitsstark.',
}

const STYLE_TONE: Record<string, string> = {
  'modern-classic': 'modern, direkt, freundlich — clean ohne Schnörkel.',
  'elegant-gold': 'edel, leicht formell, etwas verspielt-vornehm. Kein Emoji-Overkill, hochwertige Sprache.',
  'warm-trattoria': 'herzlich, italienisch-charmant. Streue gerne ein italienisches Wort ein (Grazie, Buon appetito).',
  'minimalist-light': 'minimalistisch, sehr kurz, kein Schmuck.',
  'bold-street': 'fett, jung, streetwear-vibes. Emojis OK, energisch.',
  'zen-garden': 'ruhig, achtsam, sehr knapp.',
  'biergarten-fresh': 'bayrisch-leger, „Servus", festlich.',
  'neon-nights': 'cyberpunk, dunkel, mysteriös-cool.',
}

interface SuggestPayload {
  name: string
  subjectTemplate: string
  heroText: string
  bodyText: string
  ctaText: string
  discountCode?: string
  discountPercent?: number
}

function extractJson(raw: string): SuggestPayload | null {
  // strip code fences
  const cleaned = raw.replace(/```json\s*|```/g, '').trim()
  // find first { ... } block
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as SuggestPayload
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const supabaseSSR = await createSupabaseServerSSR()
  const { data: { user } } = await supabaseSSR.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { trigger_type?: string; style?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const trigger = body.trigger_type as Trigger | undefined
  if (!trigger || !VALID_TRIGGERS.includes(trigger)) {
    return NextResponse.json({ error: `trigger_type must be one of: ${VALID_TRIGGERS.join(' | ')}` }, { status: 400 })
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, name, logo_url, primary_color, design_package, email_style_override, restaurant_category')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 403 })

  if (!await rateLimit(`tpl-suggest:${restaurant.id}`, 20, 3_600_000)) {
    return NextResponse.json({ error: 'Zu viele Vorschläge — bitte später erneut.' }, { status: 429 })
  }

  const apiKey = await resolveAiKey(restaurant.id)
  if (!apiKey) return NextResponse.json({ error: 'KI nicht verfügbar (Pro-Plan)' }, { status: 402 })

  // Resolve style (override > brand)
  const style = resolveEmailStyle({
    designPackage: restaurant.design_package,
    emailStyleOverride: restaurant.email_style_override,
    templateStyle: typeof body.style === 'string' ? body.style : null,
  })
  const styleLabel = AVAILABLE_STYLES.find(s => s.id === style)?.label ?? style
  const tone = STYLE_TONE[style] ?? STYLE_TONE['modern-classic']

  const cuisine = restaurant.restaurant_category ?? 'Restaurant'
  const primaryColor = restaurant.primary_color ?? '#ea580c'

  const userPrompt = `Generiere eine professionelle Email für ${restaurant.name} (${cuisine}).

Trigger: ${trigger}
Brief: ${TRIGGER_BRIEFS[trigger]}
Email-Style: ${styleLabel} — ${tone}

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt in genau diesem Format (kein Begleittext, kein Markdown):

{
  "name": "Template-Name (max 6 Wörter)",
  "subjectTemplate": "Betreff (max 50 Zeichen, darf {{customer_name}} und [restaurant.name] enthalten)",
  "heroText": "Hauptüberschrift (max 12 Wörter)",
  "bodyText": "2-3 Sätze (max 60 Wörter), persönlich, mit konkretem Mehrwert",
  "ctaText": "Button-Text (max 4 Wörter, handlungsorientiert)"${trigger !== 'post_order' ? `,
  "discountCode": "Optional: kurzer Code, z.B. WELCOME15",
  "discountPercent": 10` : ''}
}

Wichtig: Schreibe KEIN HTML. Nur die Felder oben.`

  const anthropic = new Anthropic({ apiKey })
  let raw: string
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const block = resp.content[0]
    raw = block && block.type === 'text' ? block.text : ''
  } catch {
    return NextResponse.json({ error: 'KI-Aufruf fehlgeschlagen' }, { status: 502 })
  }

  const parsed = extractJson(raw)
  if (!parsed || !parsed.name || !parsed.subjectTemplate || !parsed.heroText || !parsed.bodyText || !parsed.ctaText) {
    return NextResponse.json({ error: 'KI-Antwort konnte nicht geparst werden', raw: raw.slice(0, 400) }, { status: 502 })
  }

  // Build HTML with the resolved style
  const shell = getBaseTemplateForTrigger(trigger, primaryColor, style)
  const logoBlockHtml = buildLogoBlock(restaurant.logo_url, restaurant.name)
  const hasDiscount = !!parsed.discountCode && trigger !== 'post_order'
  const discountBlockHtml = hasDiscount
    ? DISCOUNT_BLOCK(primaryColor)
        .replace('{{discount_code}}', String(parsed.discountCode))
        .replace('{{discount_percent}}', String(parsed.discountPercent ?? 10))
    : ''

  const finalHtml = renderEmailTemplate(shell, {
    restaurant_name: restaurant.name,
    customer_name: '{{customer_name}}',
    logo_url: restaurant.logo_url ?? '',
    logo_block: logoBlockHtml,
    hero_text: parsed.heroText,
    body_text: parsed.bodyText,
    cta_text: parsed.ctaText,
    cta_url: '{{cta_url}}',
    discount_block: discountBlockHtml,
    discount_code: parsed.discountCode ?? '{{discount_code}}',
    discount_percent: parsed.discountPercent != null ? String(parsed.discountPercent) : '{{discount_percent}}',
    unsubscribe_url: '{{unsubscribe_url}}',
    primary_color: primaryColor,
  })

  const { data: saved, error: dbError } = await admin
    .from('email_templates')
    .insert({
      restaurant_id: restaurant.id,
      name: parsed.name,
      trigger_type: trigger,
      subject_template: parsed.subjectTemplate,
      body_html: finalHtml,
      style: style as EmailStyle,
      uses_style: true,
      created_by_ai: true,
      is_active: true,
    })
    .select('id, name, trigger_type, subject_template, body_html, style, uses_style, is_active, created_by_ai, created_at')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ template: saved, suggestion: parsed })
}
