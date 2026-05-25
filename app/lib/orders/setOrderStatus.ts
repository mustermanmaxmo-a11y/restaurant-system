import { supabase } from '@/lib/supabase'

export interface SetOrderStatusOptions {
  /** Optional extra fields to update alongside status (e.g. claimed_by, claimed_at). */
  extra?: Record<string, unknown>
}

/**
 * Updates an order's status. When transitioning to 'served', also schedules
 * the rating-email QStash job (fire-and-forget — failures are logged but
 * never block the status update).
 *
 * @client-only — uses the browser supabase singleton and a relative fetch URL.
 * Server-side callers should use scheduleRatingEmail() directly with an
 * absolute URL.
 */
export async function setOrderStatus(
  orderId: string,
  newStatus: string,
  options: SetOrderStatusOptions = {}
): Promise<{ error: string | null }> {
  const update: Record<string, unknown> = { status: newStatus, ...options.extra }
  const { error } = await supabase.from('orders').update(update).eq('id', orderId)
  if (error) return { error: error.message }

  // Schedule rating email when transitioning to 'served' (fire-and-forget).
  if (newStatus === 'served') {
    fetch('/api/jobs/schedule-rating-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    }).catch(e => console.warn('[setOrderStatus] schedule failed:', e))
  }

  return { error: null }
}
