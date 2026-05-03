import webpush from 'web-push'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export type PushPayload = {
  title: string
  body: string
  url: string
  tag?: string
  requireInteraction?: boolean
}

type Subscription = {
  endpoint: string
  p256dh: string
  auth_key: string
}

export async function sendPushToSubscription(sub: Subscription, payload: PushPayload) {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth_key },
      },
      JSON.stringify(payload)
    )
  } catch (err: any) {
    // 410 Gone = subscription expired, clean it up
    if (err.statusCode === 410) {
      const admin = createSupabaseAdmin()
      await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    }
  }
}

export async function sendPushToRestaurant(
  restaurantId: string,
  contexts: ('dashboard' | 'admin')[],
  payload: PushPayload
) {
  const admin = createSupabaseAdmin()
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')
    .eq('restaurant_id', restaurantId)
    .in('app_context', contexts)

  if (!subs) return
  await Promise.allSettled(subs.map((s) => sendPushToSubscription(s, payload)))
}

export async function sendPushToPlatform(payload: PushPayload) {
  const admin = createSupabaseAdmin()
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')
    .eq('app_context', 'platform')

  if (!subs) return
  await Promise.allSettled(subs.map((s) => sendPushToSubscription(s, payload)))
}
