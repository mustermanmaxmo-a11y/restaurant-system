import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { getPlatformSettings } from '@/lib/platform-config'

export const dynamic = 'force-dynamic'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getSecret(): Promise<string> {
  const settings = await getPlatformSettings()
  return settings.unsubscribe_secret ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'fallback'
}

function computeToken(orderId: string, stars: number, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${orderId}:${stars}`).digest('hex').slice(0, 32)
}

function verifyToken(orderId: string, stars: number, token: string, secret: string): boolean {
  const expected = computeToken(orderId, stars, secret)
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(token, 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/** Token used by /feedback page to authorize the follow-up POST.
 *  Uses the same secret but binds only to order_id (any stars value the user lands on). */
function computeOrderToken(orderId: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`order:${orderId}`).digest('hex').slice(0, 32)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const orderId = searchParams.get('o')
  const starsRaw = searchParams.get('s')
  const token = searchParams.get('t')
  const origin = new URL(request.url).origin

  if (!orderId || !starsRaw || !token) {
    return NextResponse.redirect(`${origin}/feedback/error?reason=missing_params`)
  }
  const stars = parseInt(starsRaw, 10)
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return NextResponse.redirect(`${origin}/feedback/error?reason=invalid_stars`)
  }

  const secret = await getSecret()
  if (!verifyToken(orderId, stars, token, secret)) {
    return NextResponse.redirect(`${origin}/feedback/error?reason=invalid_token`)
  }

  const supabase = getAdminClient()
  const { data: order } = await supabase
    .from('orders')
    .select('id, restaurant_id')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) {
    return NextResponse.redirect(`${origin}/feedback/error?reason=order_not_found`)
  }

  // Upsert rating (UNIQUE on order_id allows onConflict)
  await supabase.from('order_ratings').upsert({
    order_id: orderId,
    restaurant_id: order.restaurant_id,
    stars,
    feedback: null,
  }, { onConflict: 'order_id' })

  // Forward to follow-up page with an order-scoped token for the optional feedback POST
  const followUpToken = computeOrderToken(orderId, secret)
  return NextResponse.redirect(`${origin}/feedback/${orderId}?stars=${stars}&t=${followUpToken}`)
}

export async function POST(request: NextRequest) {
  let body: { orderId?: string; stars?: number; token?: string; feedback?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { orderId, stars, token, feedback } = body
  if (!orderId || !token || stars == null) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const secret = await getSecret()
  if (token !== computeOrderToken(orderId, secret)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const supabase = getAdminClient()
  const trimmedFeedback = typeof feedback === 'string' ? feedback.trim().slice(0, 2000) : null

  const { error } = await supabase
    .from('order_ratings')
    .update({ feedback: trimmedFeedback || null, stars })
    .eq('order_id', orderId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
