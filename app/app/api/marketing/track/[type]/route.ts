import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

const PIXEL_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function pixelResponse() {
  const pixelBytes = Buffer.from(PIXEL_B64, 'base64')
  return new Response(pixelBytes, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
  })
}

function today() {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

// ----------------------------------------------------------------
// GET  /api/marketing/track/open?pid=<tracking_pixel_id>
// GET  /api/marketing/track/click?pid=<tracking_pixel_id>&url=<url>
// ----------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params
  const { searchParams } = request.nextUrl

  // ── open ──────────────────────────────────────────────────────
  if (type === 'open') {
    const pid = searchParams.get('pid')

    if (pid) {
      // Fire and forget — pixel response must never be blocked by DB errors
      void (async () => {
        try {
          const supabase = createSupabaseAdmin()

          const { data: campaign } = await supabase
            .from('marketing_campaigns')
            .select('id')
            .eq('tracking_pixel_id', pid)
            .limit(1)
            .single()

          if (campaign) {
            const campaign_id: string = campaign.id

            // One aggregated row per campaign+type+day (ON CONFLICT DO NOTHING)
            const { data: insertedOpen } = await supabase.from('campaign_events').upsert(
              {
                campaign_id,
                event_type: 'open',
                tracked_at: today(),
                count: 1,
                revenue: 0,
              },
              { onConflict: 'campaign_id,event_type,tracked_at', ignoreDuplicates: true }
            )

            // Atomic increment via DB function — only when a new row was inserted (not a duplicate).
            // Supabase returns null data on ignoreDuplicates conflict; non-null means a row was inserted.
            if (insertedOpen !== null) {
              await supabase.rpc('increment_campaign_open', { campaign_id_arg: campaign_id })
            }
          }
        } catch {
          // Silently ignore — pixel must always be returned
        }
      })()
    }

    return pixelResponse()
  }

  // ── click ─────────────────────────────────────────────────────
  if (type === 'click') {
    const pid = searchParams.get('pid')
    const url = searchParams.get('url')

    // Security: only allow relative paths or same-origin URLs (prevent open redirect)
    if (!url) {
      return NextResponse.json({ error: 'Invalid or missing url parameter' }, { status: 400 })
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const isRelative = url.startsWith('/')
    const isSameOrigin = appUrl && url.startsWith(appUrl)
    if (!isRelative && !isSameOrigin) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 })
    }

    if (pid) {
      // Fire and forget — redirect must never be blocked by DB errors
      void (async () => {
        try {
          const supabase = createSupabaseAdmin()

          const { data: campaign } = await supabase
            .from('marketing_campaigns')
            .select('id')
            .eq('tracking_pixel_id', pid)
            .limit(1)
            .single()

          if (campaign) {
            const campaign_id: string = campaign.id

            const { data: insertedClick } = await supabase.from('campaign_events').upsert(
              {
                campaign_id,
                event_type: 'click',
                tracked_at: today(),
                count: 1,
                revenue: 0,
              },
              { onConflict: 'campaign_id,event_type,tracked_at', ignoreDuplicates: true }
            )

            // Only increment if a new row was inserted (not a duplicate).
            // Supabase returns null data on ignoreDuplicates conflict; non-null means a row was inserted.
            if (insertedClick !== null) {
              await supabase.rpc('increment_campaign_click', { campaign_id_arg: campaign_id })
            }
          }
        } catch {
          // Silently ignore — redirect must always happen
        }
      })()
    }

    return NextResponse.redirect(url, { status: 302 })
  }

  return NextResponse.json({ error: 'Unknown tracking type' }, { status: 400 })
}

// ----------------------------------------------------------------
// POST /api/marketing/track/conversion
// Body: { campaign_id, order_id, revenue }
// Header: X-Tracking-Secret
// ----------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params

  if (type !== 'conversion') {
    return NextResponse.json({ error: 'Unknown tracking type' }, { status: 400 })
  }

  // Parse body
  let body: { campaign_id?: string; order_id?: string; revenue?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { campaign_id, order_id, revenue } = body

  // Validate all fields
  if (!campaign_id || !order_id || typeof revenue !== 'number' || revenue <= 0) {
    return NextResponse.json({ error: 'campaign_id, order_id, and positive revenue required' }, { status: 400 })
  }

  // Verify shared secret
  const secret = process.env.MARKETING_TRACKING_SECRET ?? process.env.PUSH_WEBHOOK_SECRET
  const providedSecret = request.headers.get('X-Tracking-Secret')
  if (!secret || providedSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseAdmin()

  // Verify campaign exists
  const { data: campaign, error: campaignError } = await supabase
    .from('marketing_campaigns')
    .select('id')
    .eq('id', campaign_id)
    .limit(1)
    .single()

  if (campaignError || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  // Record conversion event — one aggregated row per campaign+type+day
  await supabase.from('campaign_events').upsert(
    {
      campaign_id,
      event_type: 'conversion',
      tracked_at: today(),
      count: 1,
      revenue,
    },
    { onConflict: 'campaign_id,event_type,tracked_at', ignoreDuplicates: true }
  )

  // Atomic increment of conversion_revenue
  await supabase.rpc('increment_campaign_revenue', {
    campaign_id_arg: campaign_id,
    revenue_arg: revenue,
  })

  return NextResponse.json({ success: true })
}
