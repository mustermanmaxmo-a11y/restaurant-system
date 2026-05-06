import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers)
  if (!await rateLimit(`split-checkout:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen.' }, { status: 429 })
  }

  const { splitToken, personNames }: { splitToken: string; personNames: string[] } = await request.json()
  if (!splitToken || !personNames?.length) {
    return NextResponse.json({ error: 'splitToken und personNames required' }, { status: 400 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: split } = await adminClient
    .from('bill_splits')
    .select('id, order_id, persons, item_assignments, payment_statuses')
    .eq('share_token', splitToken)
    .single()

  if (!split) return NextResponse.json({ error: 'Split nicht gefunden' }, { status: 404 })

  const { data: order } = await adminClient
    .from('orders')
    .select('items, total, restaurant_id')
    .eq('id', split.order_id)
    .single()

  if (!order) return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 })

  const { data: resto } = await adminClient
    .from('restaurants')
    .select('name, online_payments_enabled, stripe_connect_account_id')
    .eq('id', order.restaurant_id)
    .single()

  if (!resto?.online_payments_enabled || !resto?.stripe_connect_account_id) {
    return NextResponse.json({ error: 'Online-Zahlung nicht verfügbar' }, { status: 400 })
  }

  // Filter to only unpaid persons in the request
  const paymentStatuses: Record<string, string> = split.payment_statuses ?? {}
  const unpaidPersons = personNames.filter(n => paymentStatuses[n] !== 'paid')
  if (unpaidPersons.length === 0) {
    return NextResponse.json({ error: 'Alle ausgewählten Personen haben bereits bezahlt' }, { status: 400 })
  }

  // Expand order items by qty → [{name, price, itemIndex}]
  const expandedItems: { name: string; price: number; itemIndex: number }[] = []
  const items: { name: string; price: number; qty: number }[] = order.items ?? []
  items.forEach(item => {
    for (let i = 0; i < item.qty; i++) {
      expandedItems.push({ name: item.name, price: item.price, itemIndex: expandedItems.length })
    }
  })

  // Calculate total for the selected persons
  const assignments: Record<string, string[]> = split.item_assignments ?? {}
  let totalCents = 0

  for (const [idxStr, assignedTo] of Object.entries(assignments)) {
    const idx = parseInt(idxStr)
    const item = expandedItems[idx]
    if (!item) continue

    const assignees = (assignedTo as string[]).filter(n => unpaidPersons.includes(n))
    if (assignees.length === 0) continue

    const totalAssignees = (assignedTo as string[]).length
    const share = (item.price / totalAssignees) * assignees.length
    totalCents += Math.round(share * 100)
  }

  if (totalCents <= 0) {
    return NextResponse.json({ error: 'Kein Betrag für die ausgewählten Personen' }, { status: 400 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: totalCents,
        product_data: {
          name: `Rechnung: ${unpaidPersons.join(', ')}`,
          description: resto.name,
        },
      },
    }],
    payment_intent_data: {
      transfer_data: { destination: resto.stripe_connect_account_id },
      metadata: {
        split_token: splitToken,
        person_names: JSON.stringify(unpaidPersons),
        restaurant_id: order.restaurant_id,
      },
    },
    metadata: {
      split_token: splitToken,
      person_names: JSON.stringify(unpaidPersons),
    },
    success_url: `${appUrl}/split/${splitToken}?paid=1`,
    cancel_url: `${appUrl}/split/${splitToken}`,
  })

  return NextResponse.json({ url: session.url, amount_cents: totalCents })
}
