import { supabase } from '@/lib/supabase'

export interface LoyaltyProgram {
  id: string
  restaurant_id: string
  enabled: boolean
  mechanic: 'stamps' | 'points'
  goal: number
  points_per_euro: number
  reward_text: string
  reward_value_cents: number
  show_banner: boolean
  email_link_enabled: boolean
}

export interface LoyaltyMember {
  id: string
  subscriber_id: string | null
  user_id: string | null
  restaurant_id: string
  stamp_count: number
  points: number
  total_redeemed: number
  dietary_preferences?: string[] | null
  favorite_item_ids?: string[] | null
}

export interface LoyaltyStatus {
  program: LoyaltyProgram | null
  member: LoyaltyMember | null
  subscriber_id: string | null
}

export async function fetchLoyaltyStatus(args: {
  restaurantId: string
  subscriberId?: string | null
  email?: string | null
}): Promise<LoyaltyStatus | null> {
  const { data, error } = await supabase.rpc('get_loyalty_status', {
    p_restaurant_id: args.restaurantId,
    p_subscriber_id: args.subscriberId ?? null,
    p_email: args.email ?? null,
  })
  if (error || !data) return null
  return data as LoyaltyStatus
}

type RedeemFailureReason = 'no_program' | 'no_member' | 'insufficient_balance' | 'unknown'

export type RedeemResult =
  | { success: true; reward_text: string; value_cents: number }
  | { success: false; reason: RedeemFailureReason }

export async function redeemLoyaltyReward(args: {
  subscriberId: string
  restaurantId: string
  orderId: string
}): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc('redeem_loyalty_reward', {
    p_subscriber_id: args.subscriberId,
    p_restaurant_id: args.restaurantId,
    p_order_id: args.orderId,
  })
  if (error) {
    const msg = error.message ?? ''
    const reason: RedeemFailureReason =
      msg.includes('no_program') ? 'no_program' :
      msg.includes('no_member') ? 'no_member' :
      msg.includes('insufficient_balance') ? 'insufficient_balance' : 'unknown'
    return { success: false, reason }
  }
  return data as RedeemResult
}
