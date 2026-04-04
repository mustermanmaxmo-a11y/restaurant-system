import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params
  const body = await request.text()

  // Signatur-Validierung (HMAC-SHA256)
  const signature = request.headers.get('x-payload-signature')
  const webhookSecret = process.env.SUMUP_WEBHOOK_SECRET
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const expected = createHmac('sha256', webhookSecret).update(body).digest('hex')
  if (signature !== expected) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: {
    id: string
    type: string
    payload?: {
      id: string
      amount: number
      currency: string
      timestamp: string
    }
  }
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (event.type !== 'PAYMENT_SUCCESSFUL' || !event.payload) {
    return NextResponse.json({ received: true })
  }

  const { id, amount, currency, timestamp } = event.payload

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Sicherstellen, dass dieses Restaurant eine aktive SumUp-Verbindung hat
  const { data: conn } = await supabase
    .from('pos_connections')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('provider', 'sumup')
    .single()

  if (!conn) {
    return NextResponse.json({ error: 'Not connected' }, { status: 403 })
  }

  const { error } = await supabase.from('external_transactions').insert({
    restaurant_id: restaurantId,
    source: 'sumup',
    external_id: id,
    amount: amount / 100,
    currency: currency || 'EUR',
    paid_at: timestamp,
  })

  if (error && !error.message.includes('unique')) {
    console.error('SumUp webhook insert error:', error)
  }

  return NextResponse.json({ received: true })
}
