import { NextRequest, NextResponse } from 'next/server'
import { scheduleRatingEmail } from '@/lib/marketing/scheduleRatingEmail'

export const dynamic = 'force-dynamic'

// TODO(A2-followup): add session check — only authenticated staff should
// be able to schedule rating emails. Currently relies on the dedupeId
// to prevent abuse (one message per order regardless of caller).
export async function POST(request: NextRequest) {
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
