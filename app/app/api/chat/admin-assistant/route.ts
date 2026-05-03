import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { resolveAiKey } from '@/lib/ai-key'

// Security: Only aggregated business data (no customer PII) is sent to the Claude API.
// No customer names, contact info, payment data, or personal information is included.

const FALLBACK = 'Der Assistent ist momentan nicht verfügbar. Bitte versuche es später erneut.'

export async function POST(request: NextRequest) {
  const supabaseSSR = await createSupabaseServerSSR()
  const { data: { user } } = await supabaseSSR.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { message, history } = body as {
    message: string
    history?: { role: 'user' | 'assistant'; content: string }[]
  }

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, plan')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!restaurant) return NextResponse.json({ reply: FALLBACK })

  const apiKey = await resolveAiKey(restaurant.id)
  if (!apiKey) {
    return NextResponse.json({
      reply: 'Der KI-Assistent ist für deinen aktuellen Plan nicht verfügbar. Upgrade auf Pro, um Zugang zu erhalten.',
    })
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const todayDateStr = todayStart.split('T')[0]
  const todayEndDateStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toLocaleDateString('sv-SE')

  const [
    { data: ordersToday },
    { data: ordersWeek },
    { data: inventoryAlerts },
    { data: reservationsToday },
    { count: menuCount },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('status, total_price')
      .eq('restaurant_id', restaurant.id)
      .gte('created_at', todayStart)
      .lt('created_at', todayEnd),
    supabase
      .from('orders')
      .select('total_price, created_at')
      .eq('restaurant_id', restaurant.id)
      .gte('created_at', sevenDaysAgo),
    supabase
      .from('ingredients')
      .select('name, current_stock, min_stock, unit')
      .eq('restaurant_id', restaurant.id)
      .filter('current_stock', 'lte', 'min_stock'),
    supabase
      .from('reservations')
      .select('guests, status')
      .eq('restaurant_id', restaurant.id)
      .gte('date', todayDateStr)
      .lte('date', todayEndDateStr),
    supabase
      .from('menu_items')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurant.id)
      .eq('available', true),
  ])

  const todayOrders = ordersToday || []
  const weekOrders = ordersWeek || []

  const todayRevenue = todayOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0)
  const weekRevenue = weekOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0)

  const statusBreakdown = todayOrders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const ordersPerDay: Record<string, number> = {}
  for (const o of weekOrders) {
    const day = new Date(o.created_at).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' })
    ordersPerDay[day] = (ordersPerDay[day] || 0) + 1
  }

  const context = {
    restaurant: restaurant.name,
    heute: {
      datum: now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      uhrzeit: now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      bestellungen: todayOrders.length,
      umsatz: `${todayRevenue.toFixed(2)}€`,
      status: statusBreakdown,
    },
    letzte_7_tage: {
      bestellungen: weekOrders.length,
      umsatz: `${weekRevenue.toFixed(2)}€`,
      durchschnitt_pro_tag: `${(weekRevenue / 7).toFixed(2)}€`,
      bestellungen_pro_tag: ordersPerDay,
    },
    inventar_warnungen: (inventoryAlerts || []).map(i => ({
      artikel: i.name,
      bestand: `${i.current_stock} ${i.unit || ''}`.trim(),
      mindestbestand: `${i.min_stock} ${i.unit || ''}`.trim(),
    })),
    reservierungen_heute: {
      anzahl: (reservationsToday || []).length,
      gaeste: (reservationsToday || []).reduce((s, r) => s + (r.guests || 0), 0),
    },
    speisekarte_aktive_gerichte: menuCount ?? 0,
  }

  const systemPrompt = `Du bist der KI-Assistent für das Restaurant "${restaurant.name}".
Du hilfst dem Besitzer mit Einblicken in sein Geschäft — Umsatz, Bestellungen, Inventar, Reservierungen.
Antworte präzise, datenbasiert und auf Deutsch. Maximal 4 Sätze. Keine Kundendaten vorhanden.

Aktuelle Daten:
${JSON.stringify(context, null, 2)}`

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...(history || []).slice(-8),
    { role: 'user', content: message.trim() },
  ]

  try {
    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: systemPrompt,
      messages,
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ reply: text || FALLBACK })
  } catch {
    return NextResponse.json({ reply: FALLBACK })
  }
}
