import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { randomUUID } from 'crypto'

const PERSON_COLORS = ['#6c63ff', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6']

export const runtime = 'nodejs'

const BodySchema = z.object({
  group_id: z.string().uuid(),
  member_name: z.string().min(1).max(100),
  method: z.enum(['cash', 'terminal']),
})

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers)
  if (!await rateLimit(`group-offline:${ip}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte warte kurz.' }, { status: 429 })
  }

  const body = await request.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }
  const { group_id, member_name, method } = parsed.data

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Gruppe validieren
  const { data: group } = await supabase
    .from('order_groups')
    .select('id, status, restaurant_id, table_id')
    .eq('id', group_id)
    .eq('status', 'submitted')
    .single()

  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  // Nur wenn noch 'pending'
  const { data: payment } = await supabase
    .from('group_payments')
    .select('status')
    .eq('group_id', group_id)
    .eq('member_name', member_name)
    .single()

  if (!payment || payment.status !== 'pending') {
    return NextResponse.json({ error: 'Payment not found or already committed' }, { status: 409 })
  }

  // Status auf 'cash' oder 'terminal' setzen
  const { error: updateError } = await supabase
    .from('group_payments')
    .update({ status: method })
    .eq('group_id', group_id)
    .eq('member_name', member_name)

  if (updateError) {
    console.error('group_payments update failed:', updateError)
    return NextResponse.json({ error: 'Failed to update payment status' }, { status: 500 })
  }

  // Check if all members committed
  const { data: allPayments } = await supabase
    .from('group_payments')
    .select('status')
    .eq('group_id', group_id)

  const allCommitted = allPayments?.every(p => p.status !== 'pending')

  if (allCommitted) {
    // Atomic transition: only one concurrent request wins this update
    const { count } = await supabase
      .from('order_groups')
      .update({ status: 'ordering' }, { count: 'exact' })
      .eq('id', group_id)
      .eq('status', 'submitted')  // Only succeeds if still 'submitted'

    if (count === 1) {
      // We won the race — create the order
      const orderResult = await createOrderForGroup(supabase, group)
      if (!orderResult.ok) {
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
      }
      return NextResponse.json({ ok: true, split_token: orderResult.split_token ?? null })
    }
    // If count = 0, another request already won — that's fine, skip silently
  }

  return NextResponse.json({ ok: true })
}

async function createOrderForGroup(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  group: { id: string; restaurant_id: string; table_id: string | null }
): Promise<{ ok: boolean; split_token?: string }> {
  const { data: groupItems } = await supabase
    .from('group_items')
    .select('item_id, name, price, qty, added_by')
    .eq('group_id', group.id)

  if (!groupItems || groupItems.length === 0) return { ok: false }

  const aggregated: Record<string, { item_id: string; name: string; price: number; qty: number }> = {}
  const byPerson: Record<string, string[]> = {}
  // Track per-item how many units each person ordered (preserves insertion order)
  const itemPersonQty: Record<string, Array<{ person: string; qty: number }>> = {}

  groupItems.forEach(gi => {
    if (aggregated[gi.item_id]) {
      aggregated[gi.item_id].qty += gi.qty
    } else {
      aggregated[gi.item_id] = { item_id: gi.item_id, name: gi.name, price: gi.price, qty: gi.qty }
    }
    if (!byPerson[gi.added_by]) byPerson[gi.added_by] = []
    byPerson[gi.added_by].push(`${gi.qty}× ${gi.name}`)
    if (!itemPersonQty[gi.item_id]) itemPersonQty[gi.item_id] = []
    itemPersonQty[gi.item_id].push({ person: gi.added_by, qty: gi.qty })
  })

  const groupNote = Object.entries(byPerson)
    .map(([name, items]) => `${name}: ${items.join(', ')}`)
    .join(' | ')

  const aggregatedList = Object.values(aggregated)
  const total = groupItems.reduce((s, i) => s + i.price * i.qty, 0)

  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .insert({
      restaurant_id: group.restaurant_id,
      order_type: 'dine_in',
      table_id: group.table_id,
      status: 'new',
      items: aggregatedList,
      note: `[Gruppenbestellung] ${groupNote}`,
      total: Math.round(total * 100) / 100,
      group_id: group.id,
    })
    .select('id')
    .single()

  if (orderError || !orderRow) {
    console.error('Failed to create order for group:', orderError)
    return { ok: false }
  }

  // Build item_assignments: expand aggregated items by qty, assign to ordered persons
  const item_assignments: Record<string, string[]> = {}
  let expandedIdx = 0
  for (const aggItem of aggregatedList) {
    for (const { person, qty: pQty } of (itemPersonQty[aggItem.item_id] ?? [])) {
      for (let i = 0; i < pQty; i++) {
        item_assignments[String(expandedIdx)] = [person]
        expandedIdx++
      }
    }
  }

  // Build persons list with stable colors
  const uniquePersons = [...new Set(groupItems.map(gi => gi.added_by))]
  const persons = uniquePersons.map((name, i) => ({
    name,
    color: PERSON_COLORS[i % PERSON_COLORS.length],
  }))

  const shareToken = randomUUID()

  const { error: splitError } = await supabase.from('bill_splits').insert({
    order_id: orderRow.id,
    group_id: group.id,
    share_token: shareToken,
    persons,
    item_assignments,
    payment_statuses: {},
  })

  if (splitError) {
    console.error('Failed to create bill_split:', splitError)
    // Order was created, return ok but no split_token
    return { ok: true }
  }

  return { ok: true, split_token: shareToken }
}
