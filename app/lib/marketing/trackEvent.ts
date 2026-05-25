import { supabase } from '@/lib/supabase'

export type MarketingEventType =
  | 'google_review_clicked'
  | 'rating_email_sent'
  | 'loyalty_credited'
  | 'redeemed_reward'

/**
 * Fire-and-forget client-side event logger. Inserts into `marketing_events`
 * via the anon Supabase client (table has INSERT granted to anon per
 * migration 047/055).
 *
 * NOTE: When called from an onClick that immediately navigates (e.g. an
 * external <a target="_blank">), the in-flight Supabase fetch may be
 * cancelled by the browser. For target="_blank" navigations this is
 * usually fine because the current page stays alive. Future improvement:
 * use navigator.sendBeacon() or `fetch(..., { keepalive: true })`.
 */
export async function trackEvent(args: {
  restaurantId: string
  eventType: MarketingEventType
  subscriberId?: string | null
  props?: Record<string, unknown>
}): Promise<void> {
  try {
    await supabase.from('marketing_events').insert({
      restaurant_id: args.restaurantId,
      subscriber_id: args.subscriberId ?? null,
      event_type: args.eventType,
      props: args.props ?? {},
    })
  } catch (e) {
    console.warn('[trackEvent] failed:', e)
  }
}
