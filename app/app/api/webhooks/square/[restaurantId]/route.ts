import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params
  const body = await request.text()

  // Square Signatur-Validierung (HMAC-SHA256 über URL + Body)
  const signature = request.headers.get('x-square-hmacsha256-signature')
  const webhookSecret = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/square/${restaurantId}`
  const expected = createHmac('sha256', webhookSecret)
    .update(webhookUrl + body)
    .digest('base64')
  if (signature !== expected) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: {
    type: string
    data?: {
      object?: {
        payment?: {
          id: string
          amount_money?: { amount: number; currency: string }
          created_at: string
          status: string
        }
      }
    }
  }
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const payment = event.data?.object?.payment
  if (event.type !== 'payment.completed' || !payment) {
    return NextResponse.json({ received: true })
  }

  if (payment.status !== 'COMPLETED') {
    return NextResponse.json({ received: true })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: conn } = await supabase
    .from('pos_connections')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('provider', 'square')
    .single()

  if (!conn) {
    return NextResponse.json({ error: 'Not connected' }, { status: 403 })
  }

  const amountMoney = payment.amount_money
  const { error } = await supabase.from('external_transactions').insert({
    restaurant_id: restaurantId,
    source: 'square',
    external_id: payment.id,
    amount: amountMoney ? amountMoney.amount / 100 : 0,
    currency: amountMoney?.currency || 'EUR',
    paid_at: payment.created_at,
  })

  if (error && !error.message.includes('unique')) {
    console.error('Square webhook insert error:', error)
  }

  return NextResponse.json({ received: true })
}
