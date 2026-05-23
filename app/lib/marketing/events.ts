import { createSupabaseAdmin } from '@/lib/supabase-admin';

export type MarketingEventType =
  | 'viewed_menu'
  | 'added_to_cart'
  | 'abandoned_cart'
  | 'opened_email'
  | 'clicked_email'
  | 'unsubscribed'
  | 'used_qr_code'
  | 'scanned_loyalty'
  | 'redeemed_reward'
  | 'signed_up'
  | 'verified_email'
  | 'gave_rating'
  | 'referred_friend';

export interface LogEventInput {
  restaurantId: string;
  eventType: MarketingEventType | (string & {});
  subscriberId?: string | null;
  props?: Record<string, unknown>;
  occurredAt?: Date;
}

export async function logEvent(input: LogEventInput): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from('marketing_events').insert({
    restaurant_id: input.restaurantId,
    subscriber_id: input.subscriberId ?? null,
    event_type: input.eventType,
    props: input.props ?? {},
    occurred_at: (input.occurredAt ?? new Date()).toISOString(),
  });
  if (error) {
    // Non-fatal: marketing telemetry failure must not break the calling request.
    console.warn('[marketing/events] logEvent failed:', error.message);
  }
}
