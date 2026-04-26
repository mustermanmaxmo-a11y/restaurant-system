import { createClient } from '@supabase/supabase-js'

/**
 * Resolves the Anthropic API key for a restaurant:
 * 1. BYOK: restaurant's own key (if set) — takes priority
 * 2. Platform key: stored in platform_settings (managed by platform admin)
 * 3. Env var fallback: ANTHROPIC_API_KEY (local dev / legacy)
 * Plans without AI access (starter): always returns null.
 *
 * SECURITY: Uses service role — server-side only. Never expose to client.
 */
export async function resolveAiKey(restaurantId: string): Promise<string | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('plan, anthropic_api_key')
    .eq('id', restaurantId)
    .single()

  if (!restaurant) return null

  const aiPlans = ['enterprise', 'pro', 'trial']
  if (!aiPlans.includes(restaurant.plan)) return null

  // BYOK: restaurant's own key takes priority
  if (restaurant.anthropic_api_key) return restaurant.anthropic_api_key

  // Platform key from DB (set by platform admin in /platform/settings)
  const { data: settings } = await supabase
    .from('platform_settings')
    .select('anthropic_api_key')
    .single()

  if (settings?.anthropic_api_key) return settings.anthropic_api_key

  // Env var fallback (local dev)
  return process.env.ANTHROPIC_API_KEY ?? null
}
