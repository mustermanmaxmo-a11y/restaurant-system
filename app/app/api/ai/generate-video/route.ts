import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'
import { getPlatformSettings } from '@/lib/platform-config'

export async function POST(request: NextRequest) {
  // --- Auth ---
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  // --- Body ---
  const body = await request.json()
  const { imageUrl, prompt, duration } = body

  if (!imageUrl || typeof imageUrl !== 'string') {
    return NextResponse.json({ success: false, error: 'imageUrl is required' }, { status: 400 })
  }

  // --- Restaurant lookup (resolve from session) ---
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, plan')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 403 })

  // --- API key check ---
  const platformSettings = await getPlatformSettings()
  if (!platformSettings.kling_api_key) {
    return NextResponse.json({ success: false, error: 'Video generation not configured' }, { status: 503 })
  }

  // --- Pro plan only ---
  if (restaurant.plan !== 'pro') {
    return NextResponse.json(
      { success: false, error: 'Video generation is only available on the Pro plan.' },
      { status: 403 }
    )
  }

  // --- Rate limiting: 3/hour per restaurant ---
  if (!await rateLimit(`generate-video:${restaurant.id}`, 3, 3_600_000)) {
    return NextResponse.json({ success: false, error: 'Zu viele Anfragen. Bitte warte eine Stunde.' }, { status: 429 })
  }

  // --- Call Kling AI ---
  try {
    const klingResponse = await fetch('https://api.klingai.com/v1/videos/image2video', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${platformSettings.kling_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_name: 'kling-v1',
        image_url: imageUrl,
        prompt: prompt ?? 'cinematic food video, smooth camera movement, appetizing',
        duration: duration ?? 5,
        mode: 'std',
      }),
    })

    if (!klingResponse.ok) {
      console.error('[generate-video] Kling AI error', klingResponse.status, await klingResponse.text())
      return NextResponse.json({ success: false, error: 'Video generation failed' }, { status: 500 })
    }

    const klingData = await klingResponse.json()

    return NextResponse.json({
      success: true,
      taskId: klingData.data?.task_id,
      status: 'processing',
      provider: 'kling-ai',
      message: 'Video wird generiert (ca. 2-3 Minuten)...',
    })
  } catch (err) {
    console.error('[generate-video] unexpected error', err)
    return NextResponse.json({ success: false, error: 'Video generation failed' }, { status: 500 })
  }
}
