import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { resolveAiKey } from '@/lib/ai-key'
import { rateLimit } from '@/lib/rate-limit'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET: load latest handover for a restaurant (no plan gate — read-only)
export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId required' }, { status: 400 })
  }

  const admin = adminClient()
  const { data } = await admin
    .from('shift_handovers')
    .select('staff_name, summary, created_at')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ handover: data ?? null })
}

// POST: generate KI summary + save handover
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { restaurantId, staffId, staffName, notes } = body as {
    restaurantId: string
    staffId: string
    staffName: string
    notes: string
  }

  if (!restaurantId || !staffId || !staffName || !notes?.trim()) {
    return NextResponse.json({ error: 'restaurantId, staffId, staffName und notes erforderlich' }, { status: 400 })
  }

  const admin = adminClient()

  // Verify staff belongs to restaurant
  const { data: staff } = await admin
    .from('staff')
    .select('id, active')
    .eq('id', staffId)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!staff?.active) {
    return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 })
  }

  if (!await rateLimit(`shift-handover:${restaurantId}`, 20, 3_600_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte später erneut versuchen.' }, { status: 429 })
  }

  const apiKey = await resolveAiKey(restaurantId)
  if (!apiKey) {
    return NextResponse.json(
      { error: 'KI nicht verfügbar. Bitte Pro-Plan buchen und API Key eintragen.' },
      { status: 403 }
    )
  }

  const anthropic = new Anthropic({ apiKey })

  let summary: string
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: 'Du bist ein Restaurant-Assistent. Fasse Schichtnotizen strukturiert zusammen. Antworte ausschließlich mit einer kompakten Aufzählung auf Deutsch. Kein Fließtext, keine Begrüßung, keine Erklärung.',
      messages: [
        {
          role: 'user',
          content: `Fasse diese Schichtnotizen für die nächste Schicht zusammen. Maximal 5 kurze Punkte als Aufzählung (• Punkt). Fokus: offene Aufgaben, besondere Vorkommnisse, wichtige Hinweise.\n\nNotizen: ${notes.trim()}`,
        },
      ],
    })
    summary = message.content[0].type === 'text' ? message.content[0].text.trim() : notes.trim()
  } catch {
    return NextResponse.json({ error: 'KI-Zusammenfassung momentan nicht verfügbar' }, { status: 500 })
  }

  const { error } = await admin.from('shift_handovers').insert({
    restaurant_id: restaurantId,
    staff_id: staffId,
    staff_name: staffName,
    raw_notes: notes.trim(),
    summary,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ summary })
}
