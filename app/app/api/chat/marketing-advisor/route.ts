import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { resolveAiKey } from '@/lib/ai-key'
import { rateLimit } from '@/lib/rate-limit'
import { buildMarketingContext } from '@/lib/marketing-context'
import { buildMarketingSystemPrompt } from '@/lib/marketing-system-prompt'

// Security: Only aggregated business/marketing data (no customer PII) is sent to the Claude API.

const FALLBACK_MESSAGE =
  'Der Marketing-Berater ist momentan nicht verfügbar. Bitte versuche es später erneut.'

export async function POST(request: NextRequest) {
  // 1. Auth
  const supabaseSSR = await createSupabaseServerSSR()
  const {
    data: { user },
  } = await supabaseSSR.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { message, history } = body as {
    message: string
    history?: { role: 'user' | 'assistant'; content: string }[]
  }

  // 3. Validate
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }

  // 4. Get restaurant via service role client
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

  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 403 })

  // 5. Resolve AI key
  const apiKey = await resolveAiKey(restaurant.id)

  // 6. No API key → plan gate message
  if (!apiKey) {
    return NextResponse.json({ error: 'KI-Feature requires Pro plan.' }, { status: 402 })
  }

  // 7. Rate limiting: 30 requests per hour
  const allowed = await rateLimit(`marketing-advisor:${restaurant.id}`, 30, 60 * 60 * 1000)
  if (!allowed) {
    return NextResponse.json(
      { reply: 'Zu viele Anfragen. Bitte warte eine Stunde und versuche es erneut.' },
      { status: 429 }
    )
  }

  // 8. Build context
  const ctx = await buildMarketingContext(restaurant.id, message)

  // 9. Build system prompt
  const systemPrompt = buildMarketingSystemPrompt(ctx)

  // 10 & 11. Call Claude streaming and return ReadableStream
  if (Array.isArray(history) && history.length > 50) {
    return NextResponse.json({ error: 'History too long' }, { status: 400 })
  }

  const priorMessages: { role: 'user' | 'assistant'; content: string }[] = (history ?? []).slice(-10)

  const encoder = new TextEncoder()

  const anthropic = new Anthropic({ apiKey })
  const anthropicStream = anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [...priorMessages, { role: 'user', content: message.trim() }],
  })

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of anthropicStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        controller.close()
      } catch {
        controller.enqueue(encoder.encode(FALLBACK_MESSAGE))
        controller.close()
      }
    },
    cancel() {
      anthropicStream.abort()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
