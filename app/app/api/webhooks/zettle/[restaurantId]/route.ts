import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params
  const body = await request.text()

  // Zettle Signatur-Validierung
  const signature = request.headers.get('x-izettle-signature')
  const webhookSecret = process.env.ZETTLE_WEBHOOK_SECRET
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const expected = createHmac('sha256', webhookSecret).update(body).digest('base64')
  if (signature !== expected) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: {
    eventType: string
    payload?: {
      purchaseUUID: string
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

  if (event.eventType !== 'PurchaseCreated' || !event.payload) {
    return NextResponse.json({ received: true })
  }

  const { purchaseUUID, amount, currency, timestamp } = event.payload

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: conn } = await supabase
    .from('pos_connections')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('provider', 'zettle')
    .single()

  if (!conn) {
    return NextResponse.json({ error: 'Not connected' }, { status: 403 })
  }

  const { error } = await supabase.from('external_transactions').insert({
    restaurant_id: restaurantId,
    source: 'zettle',
    external_id: purchaseUUID,
    amount: amount / 100,
    currency: currency || 'EUR',
    paid_at: timestamp,
  })

  if (error && !error.message.includes('unique')) {
    console.error('Zettle webhook insert error:', error)
  }

  return NextResponse.json({ received: true })
}
