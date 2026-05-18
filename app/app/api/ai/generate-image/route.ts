import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'

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
  const { prompt, style, restaurantName, brandColor, restaurantId } = body

  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return NextResponse.json({ success: false, error: 'prompt is required' }, { status: 400 })
  }
  if (!restaurantId) {
    return NextResponse.json({ success: false, error: 'restaurantId is required' }, { status: 400 })
  }

  // --- API key check ---
  if (!process.env.FAL_API_KEY) {
    return NextResponse.json({ success: false, error: 'Image generation not configured' }, { status: 503 })
  }

  // --- Restaurant lookup (verify ownership + plan) ---
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, plan')
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .single()

  if (!restaurant) {
    return NextResponse.json({ success: false, error: 'Restaurant nicht gefunden.' }, { status: 404 })
  }

  // --- Rate limiting: 10/hour per restaurant ---
  if (!await rateLimit(`generate-image:${restaurant.id}`, 10, 3_600_000)) {
    return NextResponse.json({ success: false, error: 'Zu viele Anfragen. Bitte warte eine Stunde.' }, { status: 429 })
  }

  // --- Build enhanced prompt ---
  const resolvedRestaurantName = restaurantName ?? restaurant.name
  const enhancedPrompt = [
    prompt,
    resolvedRestaurantName ? `for restaurant "${resolvedRestaurantName}"` : '',
    'professional food photography style',
    'high quality marketing image',
    style ? `style: ${style}` : 'appetizing and vibrant',
    brandColor ? `color palette inspired by ${brandColor}` : '',
  ].filter(Boolean).join(', ')

  // --- Plan-based model selection ---
  const model = restaurant.plan === 'pro' ? 'fal-ai/flux-pro' : 'fal-ai/flux/schnell'

  // --- Call fal.ai via direct fetch (SDK not installed) ---
  try {
    const falResponse = await fetch(`https://fal.run/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: enhancedPrompt,
        image_size: 'landscape_4_3',
        num_images: 1,
        enable_safety_checker: true,
      }),
    })

    if (!falResponse.ok) {
      console.error('[generate-image] fal.ai error', falResponse.status, await falResponse.text())
      return NextResponse.json({ success: false, error: 'Image generation failed' }, { status: 500 })
    }

    const data = await falResponse.json()
    const imageUrl = data.images?.[0]?.url

    return NextResponse.json({
      success: true,
      imageUrl,
      provider: 'fal.ai',
      model,
    })
  } catch (err) {
    console.error('[generate-image] unexpected error', err)
    return NextResponse.json({ success: false, error: 'Image generation failed' }, { status: 500 })
  }
}
