import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPlatformSettings } from '@/lib/platform-config'

export async function GET(request: NextRequest) {
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

  // --- Query params ---
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('task_id')

  if (!taskId) {
    return NextResponse.json({ success: false, error: 'task_id is required' }, { status: 400 })
  }

  const platformSettings = await getPlatformSettings()
  if (!platformSettings.kling_api_key) {
    return NextResponse.json({ success: false, error: 'Video generation not configured' }, { status: 503 })
  }

  // --- Poll Kling AI for task status ---
  try {
    const klingResponse = await fetch(`https://api.klingai.com/v1/videos/image2video/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${platformSettings.kling_api_key}`,
      },
    })

    if (!klingResponse.ok) {
      console.error('[generate-video/status] Kling AI error', klingResponse.status, await klingResponse.text())
      return NextResponse.json({ success: false, error: 'Failed to fetch video status' }, { status: 500 })
    }

    const klingData = await klingResponse.json()
    const taskData = klingData.data

    // Map Kling task_status to our simplified status
    // Kling statuses: submitted, processing, succeed, failed
    let status: 'processing' | 'completed' | 'failed' = 'processing'
    let videoUrl: string | undefined

    if (taskData?.task_status === 'succeed') {
      status = 'completed'
      videoUrl = taskData?.task_result?.videos?.[0]?.url
    } else if (taskData?.task_status === 'failed') {
      status = 'failed'
    }

    return NextResponse.json({
      success: true,
      status,
      videoUrl,
      taskId,
    })
  } catch (err) {
    console.error('[generate-video/status] unexpected error', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch video status' }, { status: 500 })
  }
}
