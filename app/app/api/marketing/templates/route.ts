import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getBaseTemplateForTrigger, DISCOUNT_BLOCK, buildLogoBlock, resolveEmailStyle, type EmailStyle } from '@/lib/email-base-templates'
import { renderEmailTemplate } from '@/lib/email-template-renderer'

async function getRestaurant(request: NextRequest) {
  const supabase = await createSupabaseServerSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 }
  const admin = createSupabaseAdmin()
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, name, logo_url, primary_color, design_package, email_style_override')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!restaurant) return { error: 'Restaurant not found', status: 403 }
  return {
    restaurantId: restaurant.id,
    restaurantName: restaurant.name as string,
    logoUrl: restaurant.logo_url as string | null,
    primaryColor: (restaurant.primary_color as string | null) ?? '#ea580c',
    designPackage: restaurant.design_package as string | null,
    emailStyleOverride: restaurant.email_style_override as string | null,
  }
}

// Placeholder rating block for previews (non-clickable demo stars)
const PREVIEW_RATING_BLOCK = `
  <tr><td style="padding:8px 48px 16px;">
    <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;padding:24px 20px;text-align:center;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:0.12em;">Wie war dein Erlebnis?</p>
      <div style="margin:0 0 8px;">
        ${[1,2,3,4,5].map(() => `<span style="display:inline-block;padding:6px 8px;font-size:32px;line-height:1;color:#d4d4d8;">&#9733;</span>`).join('')}
      </div>
      <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">Ein Klick reicht — danach kannst du optional Feedback hinzufügen.</p>
    </div>
  </td></tr>`

const PREVIEW_ORDER_ITEMS_BLOCK = `
  <tr><td style="padding:8px 48px 16px;">
    <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:0.12em;">Deine letzte Bestellung</p>
    <table style="width:100%;border-collapse:collapse;font-size:16px;">
      <tr><td style="padding:10px 0;border-bottom:1px solid #e4e4e7;"><span style="display:inline-block;min-width:30px;color:#71717a;font-weight:600;">2×</span><span style="color:#0a0a0a;font-weight:500;">Pizza Margherita</span></td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e4e4e7;"><span style="display:inline-block;min-width:30px;color:#71717a;font-weight:600;">1×</span><span style="color:#0a0a0a;font-weight:500;">Tiramisu</span></td></tr>
    </table>
  </td></tr>`

export async function GET(request: NextRequest) {
  const result = await getRestaurant(request)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  const { searchParams } = new URL(request.url)
  const triggerType = searchParams.get('trigger_type')
  const previewId = searchParams.get('preview')
  const previewStyle = searchParams.get('style') as EmailStyle | null

  const admin = createSupabaseAdmin()

  // Preview mode: render a specific template with sample data
  if (previewId) {
    const { data: tpl } = await admin
      .from('email_templates')
      .select('id, name, trigger_type, subject_template, body_html, style, uses_style')
      .eq('id', previewId)
      .eq('restaurant_id', result.restaurantId)
      .maybeSingle()
    if (!tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    const style = resolveEmailStyle({
      designPackage: result.designPackage,
      emailStyleOverride: result.emailStyleOverride,
      templateStyle: previewStyle ?? tpl.style,
    })
    const logoBlockHtml = buildLogoBlock(result.logoUrl, result.restaurantName)
    const discountBlock = DISCOUNT_BLOCK(result.primaryColor)
      .replace('{{discount_code}}', 'WELCOME10')
      .replace('{{discount_percent}}', '10')

    const html = renderEmailTemplate(getBaseTemplateForTrigger(tpl.trigger_type, result.primaryColor, style), {
      restaurant_name: result.restaurantName,
      customer_name: 'Max',
      logo_url: result.logoUrl ?? '',
      logo_block: logoBlockHtml,
      hero_text: tpl.subject_template?.replace(/\[restaurant\.name\]/g, result.restaurantName) ?? tpl.name,
      body_text: 'Dies ist eine Vorschau deines Templates. So sieht die Email für deine Gäste aus.',
      cta_text: 'Jetzt bestellen',
      cta_url: '#preview',
      discount_block: tpl.trigger_type !== 'post_order' && tpl.trigger_type !== 'loyalty' ? discountBlock : '',
      discount_code: 'WELCOME10',
      discount_percent: '10',
      rating_block: tpl.trigger_type === 'post_order' ? PREVIEW_RATING_BLOCK : '',
      order_items_block: tpl.trigger_type === 'post_order' ? PREVIEW_ORDER_ITEMS_BLOCK : '',
      unsubscribe_url: '#preview',
      primary_color: result.primaryColor,
    })

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
  }

  let query = admin
    .from('email_templates')
    .select('id, name, trigger_type, subject_template, body_html, style, uses_style, is_active, created_by_ai, created_at')
    .eq('restaurant_id', result.restaurantId)
    .order('created_at', { ascending: false })

  if (triggerType) query = query.eq('trigger_type', triggerType)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data ?? [] })
}

export async function POST(request: NextRequest) {
  const result = await getRestaurant(request)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const {
    name, trigger_type, subject_template, created_by_ai,
    // style picker (override auto-resolve from brand)
    style: requestedStyle,
    // fields for server-side HTML generation
    base_template, hero_text, body_text, cta_text,
    discount_code, discount_percent, primary_color,
    // or pre-built html
    body_html: rawBodyHtml,
  } = body

  if (!name || !subject_template) {
    return NextResponse.json({ error: 'name and subject_template are required' }, { status: 400 })
  }

  // Resolve final style: explicit request > brand override > brand default
  const resolvedStyle = resolveEmailStyle({
    designPackage: result.designPackage,
    emailStyleOverride: result.emailStyleOverride,
    templateStyle: typeof requestedStyle === 'string' ? requestedStyle : null,
  })
  let usesStyle = true

  // Build full HTML on server if base_template provided, otherwise use raw body_html
  let finalHtml: string
  if (base_template && typeof base_template === 'string') {
    const color = typeof primary_color === 'string' ? primary_color : result.primaryColor
    const shell = getBaseTemplateForTrigger(
      typeof trigger_type === 'string' ? trigger_type : base_template,
      color,
      resolvedStyle,
    )
    // Build discount block: keep as placeholder vars if no code provided yet
    const hasCode = typeof discount_code === 'string' && discount_code.trim()
    const hasPct = typeof discount_percent === 'string' && discount_percent.trim()
    const discountBlockHtml = (hasCode || hasPct)
      ? DISCOUNT_BLOCK(color)
          .replace('{{discount_code}}', hasCode ? String(discount_code) : '{{discount_code}}')
          .replace('{{discount_percent}}', hasPct ? String(discount_percent) : '{{discount_percent}}')
      : ''
    const logoBlockHtml = buildLogoBlock(result.logoUrl, result.restaurantName)
    finalHtml = renderEmailTemplate(shell, {
      restaurant_name: result.restaurantName,
      customer_name: '{{customer_name}}',
      logo_url: result.logoUrl ?? '',
      logo_block: logoBlockHtml,
      hero_text: typeof hero_text === 'string' ? hero_text : String(name),
      body_text: typeof body_text === 'string' ? body_text : '',
      cta_text: typeof cta_text === 'string' ? cta_text : 'Jetzt bestellen',
      cta_url: '{{cta_url}}',
      discount_block: discountBlockHtml,
      discount_code: typeof discount_code === 'string' ? discount_code : '{{discount_code}}',
      discount_percent: typeof discount_percent === 'string' ? discount_percent : '{{discount_percent}}',
      unsubscribe_url: '{{unsubscribe_url}}',
      primary_color: color,
    })
  } else if (rawBodyHtml && typeof rawBodyHtml === 'string') {
    finalHtml = rawBodyHtml
    usesStyle = false // custom HTML — style won't be applied at send time
  } else {
    return NextResponse.json({ error: 'Either base_template or body_html is required' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('email_templates')
    .insert({
      restaurant_id: result.restaurantId,
      name,
      trigger_type: trigger_type ?? 'manual',
      subject_template,
      body_html: finalHtml,
      style: usesStyle ? resolvedStyle : null,
      uses_style: usesStyle,
      created_by_ai: created_by_ai === true,
    })
    .select('id, name, trigger_type, style')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, template: data })
}

export async function PATCH(request: NextRequest) {
  const result = await getRestaurant(request)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const allowed = ['name', 'trigger_type', 'subject_template', 'body_html', 'is_active', 'style', 'uses_style']
  const sanitized: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in updates) sanitized[key] = updates[key]
  }

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('email_templates')
    .update(sanitized)
    .eq('id', id)
    .eq('restaurant_id', result.restaurantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const result = await getRestaurant(request)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('email_templates')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', result.restaurantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
