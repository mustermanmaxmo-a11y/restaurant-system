import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { resolveAiKey } from '@/lib/ai-key'

// Security: No customer PII sent to Claude API.
// Only aggregated order stats, service call counts, and staff notes.

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { restaurantId, shiftDate, shiftType, rawNotes } = body as {
    restaurantId: string
    shiftDate: string
    shiftType: 'morning' | 'evening' | 'full'
    rawNotes: string
  }

  if (!restaurantId || !shiftDate || !shiftType) {
    return NextResponse.json({ error: 'restaurantId, shiftDate und shiftType sind erforderlich' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('id', restaurantId)
    .single()

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant nicht gefunden' }, { status: 404 })
  }

  const apiKey = await resolveAiKey(restaurantId)
  if (!apiKey) {
    return NextResponse.json({ error: 'KI nicht verfügbar. Bitte Pro-Plan buchen und API Key eintragen.' }, { status: 503 })
  }

  const dayStart = `${shiftDate}T00:00:00.000Z`
  const dayEnd   = `${shiftDate}T23:59:59.999Z`

  const [
    { data: orders },
    { data: serviceCalls },
    { data: lastHandovers },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id, total, items, status, created_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd)
      .neq('status', 'cancelled'),
    supabase
      .from('service_calls')
      .select('type')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd),
    supabase
      .from('shift_handovers')
      .select('shift_date, shift_type, ai_report')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const totalOrders = (orders || []).length
  const totalRevenue = (orders || []).reduce((s, o) => s + (o.total || 0), 0)

  const itemCounts: Record<string, number> = {}
  ;(orders || []).forEach(o => {
    ;(o.items as { name: string; qty: number }[] || []).forEach(i => {
      itemCounts[i.name] = (itemCounts[i.name] || 0) + i.qty
    })
  })
  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => `${name} (${qty}x)`)

  const waiterCalls = (serviceCalls || []).filter(c => c.type === 'waiter').length
  const billCalls   = (serviceCalls || []).filter(c => c.type === 'bill').length

  const shiftTypeLabel = { morning: 'Frühschicht', evening: 'Abendschicht', full: 'Ganztag' }[shiftType]
  const date = new Date(shiftDate)
  const days = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag']

  const historyText = (lastHandovers || []).map(h => {
    const report = h.ai_report as { highlights?: string[]; issues?: string[] } | null
    if (!report) return `[${h.shift_date} ${h.shift_type}] Keine Daten`
    const hl = report.highlights?.[0] || ''
    const iss = report.issues?.[0] || ''
    return `[${h.shift_date} ${h.shift_type}] Highlight: ${hl} | Problem: ${iss}`
  }).join('\n')

  const prompt = `Restaurant: "${restaurant.name}" | ${shiftTypeLabel} | ${days[date.getDay()]}, ${date.toLocaleDateString('de-DE')}

SCHICHT-STATISTIKEN:
- Bestellungen gesamt: ${totalOrders}
- Umsatz: ${totalRevenue.toFixed(2)}€
- Meistbestellte Gerichte: ${topItems.length ? topItems.join(', ') : 'keine Daten'}
- Service Calls: ${waiterCalls}x Kellner, ${billCalls}x Rechnung

PERSONAL-NOTIZEN:
${rawNotes?.trim() || '(keine Notizen eingetragen)'}

LETZTE ÜBERGABEN (Kontext für Muster):
${historyText || '(keine früheren Übergaben)'}

Erstelle einen strukturierten Schichtübergabe-Bericht als JSON (kein anderer Text):
{
  "highlights": ["positives Ereignis oder Ergebnis"],
  "issues": ["Problem oder Beschwerde die aufgetreten ist"],
  "open_items": ["offener Punkt für nächste Schicht"],
  "recommendation": "Eine konkrete Empfehlung für die nächste Schicht"
}

Regeln:
- highlights: 1-3 Punkte, leer wenn nichts Positives
- issues: 1-3 Punkte, leer wenn keine Probleme
- open_items: 1-3 Punkte, nur echte offene Aufgaben
- recommendation: ein konkreter Satz, kein Allgemeinplatz
- Alles auf Deutsch`

  const anthropic = new Anthropic({ apiKey })

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: 'Du bist ein Restaurant-Manager-Assistent. Antworte ausschließlich mit validem JSON. Kein Text davor oder danach.',
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'KI-Analyse momentan nicht verfügbar' }, { status: 500 })

    const aiReport = JSON.parse(jsonMatch[0])

    const ordersSummary = { totalOrders, totalRevenue: parseFloat(totalRevenue.toFixed(2)), topItems, waiterCalls, billCalls }
    await supabase.from('shift_handovers').insert({
      restaurant_id: restaurantId,
      shift_date: shiftDate,
      shift_type: shiftType,
      raw_notes: rawNotes || null,
      orders_summary: ordersSummary,
      ai_report: aiReport,
    })

    return NextResponse.json({ report: aiReport, summary: ordersSummary })
  } catch {
    return NextResponse.json({ error: 'KI-Analyse momentan nicht verfügbar' }, { status: 500 })
  }
}
