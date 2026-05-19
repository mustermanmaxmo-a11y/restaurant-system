import { createClient } from '@supabase/supabase-js'

export interface PlatformSettings {
  anthropic_api_key: string | null
  fal_api_key: string | null
  kling_api_key: string | null
  marketing_automation_secret: string | null
  unsubscribe_secret: string | null
}

let _cache: { data: PlatformSettings; ts: number } | null = null
const CACHE_TTL_MS = 60_000 // 1 minute cache

export async function getPlatformSettings(): Promise<PlatformSettings> {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) return _cache.data

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await supabase
    .from('platform_settings')
    .select('anthropic_api_key, fal_api_key, kling_api_key, marketing_automation_secret, unsubscribe_secret')
    .single()

  const result: PlatformSettings = {
    anthropic_api_key: data?.anthropic_api_key ?? process.env.ANTHROPIC_API_KEY ?? null,
    fal_api_key: data?.fal_api_key ?? process.env.FAL_API_KEY ?? null,
    kling_api_key: data?.kling_api_key ?? process.env.KLING_API_KEY ?? null,
    marketing_automation_secret: data?.marketing_automation_secret ?? process.env.MARKETING_AUTOMATION_SECRET ?? null,
    unsubscribe_secret: data?.unsubscribe_secret ?? process.env.UNSUBSCRIBE_SECRET ?? null,
  }

  _cache = { data: result, ts: Date.now() }
  return result
}
