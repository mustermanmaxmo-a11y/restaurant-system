import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export type DesignVersion = 'v1' | 'v2'
export type DesignScope = 'platform' | 'admin' | 'guest'

const DEFAULT_VERSION: DesignVersion = 'v1'

function coerceVersion(value: unknown): DesignVersion | null {
  return value === 'v1' || value === 'v2' ? value : null
}

/**
 * Resolved die aktive Design-Version für einen Scope.
 *
 * Fallback-Chain:
 * - platform: platform_settings.platform_design_version → 'v1'
 * - admin:    restaurants.admin_design_version → platform_settings.restaurants_default_version → 'v1'
 * - guest:    restaurants.guest_design_version → platform_settings.restaurants_default_version → 'v1'
 *
 * @param scope  Welcher Bereich der App fragt
 * @param restaurantId  Nur bei scope='admin' oder 'guest' — sonst ignoriert
 */
export async function resolveDesignVersion(
  scope: DesignScope,
  restaurantId?: string | null
): Promise<DesignVersion> {
  try {
    // Guest-Seiten dürfen anonym zugreifen → admin-client ohne RLS
    // Admin/Platform-Seiten haben authentifizierten SSR-Client
    const supabase = scope === 'guest'
      ? createSupabaseAdmin()
      : await createSupabaseServerSSR()

    const { data: settings } = await supabase
      .from('platform_settings')
      .select('platform_design_version, restaurants_default_version')
      .eq('id', 1)
      .maybeSingle()

    if (scope === 'platform') {
      return coerceVersion(settings?.platform_design_version) ?? DEFAULT_VERSION
    }

    const defaultVersion =
      coerceVersion(settings?.restaurants_default_version) ?? DEFAULT_VERSION

    if (!restaurantId) return defaultVersion

    const column = scope === 'admin' ? 'admin_design_version' : 'guest_design_version'
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select(column)
      .eq('id', restaurantId)
      .maybeSingle()

    const override = coerceVersion(
      (restaurant as Record<string, unknown> | null)?.[column]
    )
    return override ?? defaultVersion
  } catch {
    // Bei jedem Fehler auf V1 fallbacken (bewusst silent für Rendering-Stabilität;
    // Sentry erfasst DB-Fehler automatisch über Supabase-Client)
    return DEFAULT_VERSION
  }
}
