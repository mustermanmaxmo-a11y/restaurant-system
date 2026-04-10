import { createClient } from '@supabase/supabase-js'

/**
 * Resolves the correct Anthropic API key for a restaurant based on their plan:
 * - enterprise → platform key (ANTHROPIC_API_KEY in .env)
 * - pro        → restaurant's own key (BYOK, stored in restaurants.anthropic_api_key)
 * - starter/other → null (AI not available)
 *
 * SECURITY: Uses service role to read the key server-side only.
 * Never expose this function or its result to the client.
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

  if (restaurant.plan === 'enterprise') {
    return process.env.ANTHROPIC_API_KEY ?? null
  }

  if (restaurant.plan === 'pro') {
    return restaurant.anthropic_api_key ?? null
  }

  return null
}
