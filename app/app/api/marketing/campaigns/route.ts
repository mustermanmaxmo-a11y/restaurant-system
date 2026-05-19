import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { rateLimit } from '@/lib/rate-limit'

// POST — save draft campaign
export async function POST(request: NextRequest) {
  const supabaseSSR = await createSupabaseServerSSR()
  const {
    data: { user },
  } = await supabaseSSR.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { restaurantId, subject, previewText, bodyHtml, discountCode, templateType } = body as {
    restaurantId: string
    subject: string
    previewText?: string
    bodyHtml?: string
    discountCode?: string | null
    templateType?: string
  }

  if (!restaurantId || !subject) {
    return NextResponse.json({ error: 'restaurantId and subject required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verify ownership
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!await rateLimit(`marketing-campaigns:${restaurantId}`, 30, 3_600_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen.' }, { status: 429 })
  }

  const { data: campaign, error } = await supabase
    .from('marketing_campaigns')
    .insert({
      restaurant_id: restaurantId,
      subject,
      preview_text: previewText ?? null,
      body: bodyHtml ?? '',
      discount_code: discountCode ?? null,
      template_type: templateType ?? 'custom',
      status: 'draft',
      generated_by_ai: true,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: campaign.id })
}

// DELETE — delete a campaign
export async function DELETE(request: NextRequest) {
  const supabaseSSR = await createSupabaseServerSSR()
  const {
    data: { user },
  } = await supabaseSSR.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const campaignId = searchParams.get('id')
  const restaurantId = searchParams.get('restaurantId')

  if (!campaignId || !restaurantId) {
    return NextResponse.json({ error: 'id and restaurantId required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verify ownership via restaurant
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('marketing_campaigns')
    .delete()
    .eq('id', campaignId)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'draft') // only allow deleting drafts

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
