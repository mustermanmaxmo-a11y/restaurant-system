import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { resolveAiKey } from '@/lib/ai-key'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { restaurantId } = body

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId required' }, { status: 400 })
  }

  // Auth: validate Bearer token
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!await rateLimit(`weekly-report:${restaurantId}`, 10, 3_600_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte später erneut versuchen.' }, { status: 429 })
  }

  // AI key (Pro/Enterprise only)
  const apiKey = await resolveAiKey(restaurantId)
  if (!apiKey) {
    return NextResponse.json(
      { error: 'KI nicht verfügbar. Bitte Pro-Plan buchen und API Key eintragen.' },
      { status: 403 }
    )
  }

  // Service role for data
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const prevSince = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: orders, error: ordersErr }, { data: prevOrders, error: prevErr }] = await Promise.all([
    admin
      .from('orders')
      .select('total, items, order_type')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', since)
      .neq('status', 'cancelled'),
    admin
      .from('orders')
      .select('total')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', prevSince)
      .lt('created_at', since)
      .neq('status', 'cancelled'),
  ])
  if (ordersErr || prevErr) {
    return NextResponse.json({ error: 'Datenabruf fehlgeschlagen' }, { status: 500 })
  }

  const totalRevenue = (orders ?? []).reduce((s, o) => s + (o.total ?? 0), 0)
  const prevRevenue = (prevOrders ?? []).reduce((s, o) => s + (o.total ?? 0), 0)
  const revenueChangePct =
    prevRevenue > 0
      ? ((totalRevenue - prevRevenue) / prevRevenue * 100).toFixed(1)
      : null

  // Count items sold
  const itemCounts: Record<string, { name: string; count: number }> = {}
  ;(orders ?? []).forEach(order => {
    const items = Array.isArray(order.items) ? (order.items as { name: string; qty: number }[]) : []
    items.forEach(item => {
      if (!item?.name || typeof item.qty !== 'number') return
      if (!itemCounts[item.name]) itemCounts[item.name] = { name: item.name, count: 0 }
      itemCounts[item.name].count += item.qty
    })
  })
  const sorted = Object.values(itemCounts).sort((a, b) => b.count - a.count)
  const top5 = sorted.slice(0, 5)
  const bottom5 = sorted.length > 5 ? sorted.slice(-5) : []

  const anthropic = new Anthropic({ apiKey })

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system:
        'Du bist ein Restaurant-Betriebsberater. Antworte ausschließlich mit validem JSON. Kein Text davor oder danach.',
      messages: [
        {
          role: 'user',
          content: `Analysiere diese Wochendaten und gib 2-3 konkrete, umsetzbare Empfehlungen auf Deutsch:

Umsatz diese Woche: €${totalRevenue.toFixed(2)}
Umsatz letzte Woche: €${prevRevenue.toFixed(2)}
Veränderung: ${revenueChangePct != null ? revenueChangePct + '%' : 'Keine Vergleichsdaten'}
Bestellungen: ${(orders ?? []).length}
Top-Gerichte: ${top5.map(i => `${i.name} (${i.count}x)`).join(', ') || 'Keine Daten'}
Schwächste Gerichte: ${bottom5.map(i => `${i.name} (${i.count}x)`).join(', ') || 'Keine Daten'}

Antworte als JSON: { "recommendations": ["...", "...", "..."] }`,
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    let recommendations: string[] = []
    if (match) {
      try {
        recommendations = JSON.parse(match[0]).recommendations ?? []
      } catch { /* ignore */ }
    }

    return NextResponse.json({
      totalRevenue,
      prevRevenue,
      revenueChangePct,
      orderCount: (orders ?? []).length,
      top5,
      bottom5,
      recommendations,
      generatedAt: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'Analyse momentan nicht verfügbar' }, { status: 500 })
  }
}
