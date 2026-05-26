import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { publishDelayedJob } from './qstash'

export interface ScheduleResult {
  scheduled: boolean
  reason?: 'feature_disabled' | 'order_not_found' | 'qstash_failed' | 'no_app_url'
  messageId?: string
  error?: string
}

export async function scheduleRatingEmail(orderId: string): Promise<ScheduleResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) return { scheduled: false, reason: 'no_app_url' }

  const supabase = createSupabaseAdmin()
  const { data: order } = await supabase
    .from('orders')
    .select('id, restaurant_id, restaurants!inner(rating_email_enabled, rating_email_delay_hours)')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return { scheduled: false, reason: 'order_not_found' }

  const restaurant = (order.restaurants as unknown) as {
    rating_email_enabled: boolean | null
    rating_email_delay_hours: number | null
  }
  if (!restaurant?.rating_email_enabled) {
    return { scheduled: false, reason: 'feature_disabled' }
  }

  const delayHours = restaurant.rating_email_delay_hours ?? 4
  const delaySeconds = Math.max(60, Math.min(72 * 3600, delayHours * 3600))

  const result = await publishDelayedJob({
    url: `${appUrl}/api/jobs/send-rating-email`,
    body: { orderId },
    delaySeconds,
    dedupeId: `rating-email-${orderId}`,
  })

  if (!result.success) {
    return { scheduled: false, reason: 'qstash_failed', error: result.error }
  }
  return { scheduled: true, messageId: result.messageId }
}
