import { NextRequest, NextResponse } from 'next/server'
import { scheduleRatingEmail } from '@/lib/marketing/scheduleRatingEmail'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { orderId } = await request.json()
    if (typeof orderId !== 'string' || !orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 })
    }
    const result = await scheduleRatingEmail(orderId)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 }
    )
  }
}
