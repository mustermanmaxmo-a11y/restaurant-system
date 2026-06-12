import { buildColorsFromRestaurant, readCfgString, type ColorSet } from './color-utils'
import { getDesignPackage } from './design-packages'
import { FONT_PAIRS, type FontPair } from './font-pairs'
import type { Restaurant } from '@/types/database'

export type BrandSurface = 'order' | 'online' | 'landing'

/** Felder, die zum gesperrten Brand-Kern gehören — Overrides hierfür werden verworfen. */
export const LOCKED_BRAND_KEYS = [
  'primary_color', 'bg_color', 'surface_color', 'header_color',
  'button_color', 'card_color', 'text_color', 'font_pair',
] as const

export interface BrandOverrides {
  hero_image_url?: string
  headline?: string
  subheadline?: string
  lp_layout?: string
  gallery?: string[]
  feature_badges?: string[]
  cta_text?: string
  cta_url?: string
  layout_variant?: string
  cover_image_url?: string
  greeting?: string
  [key: string]: unknown
}

export interface ResolvedBrand {
  surface: BrandSurface
  colors: ColorSet
  font: FontPair
  fontPairKey: string
  layoutVariant: string
  borderRadius: string
  hoverEffect: string
  animationStyle: string
  cardStyle: string
  name?: string
  logoUrl?: string
  overrides: BrandOverrides
}

/**
 * Einzige Art, wie Gast-Flächen ihr Design lesen.
 * Kern aus restaurants.design_config; Pro-Fläche-Overrides obendrauf (B-Modell);
 * gesperrte Kern-Felder in Overrides werden aktiv verworfen.
 */
export function resolveBrand(
  restaurant: Partial<Restaurant>,
  surface: BrandSurface,
  overrides: BrandOverrides = {},
): ResolvedBrand {
  const cfg = (restaurant.design_config ?? {}) as Record<string, unknown>

  const safeOverrides: BrandOverrides = { ...overrides }
  for (const k of LOCKED_BRAND_KEYS) delete safeOverrides[k]

  const colors = buildColorsFromRestaurant(restaurant)

  const fontPairKey =
    readCfgString(cfg, 'font_pair') ??
    restaurant.font_pair ??
    getDesignPackage(restaurant.design_package ?? undefined).fontPair
  const font = FONT_PAIRS[fontPairKey] ?? FONT_PAIRS['syne-dmsans']

  const overrideLayout =
    surface === 'landing'
      ? (typeof safeOverrides.lp_layout === 'string' ? safeOverrides.lp_layout : undefined)
      : (typeof safeOverrides.layout_variant === 'string' ? safeOverrides.layout_variant : undefined)

  const layoutVariant =
    overrideLayout ??
    readCfgString(cfg, 'layout_variant') ??
    restaurant.layout_variant ??
    'cards'

  return {
    surface,
    colors,
    font,
    fontPairKey,
    layoutVariant,
    borderRadius: readCfgString(cfg, 'border_radius') ?? 'rounded',
    hoverEffect: readCfgString(cfg, 'hover_effect') ?? 'scale',
    animationStyle: readCfgString(cfg, 'animation_style') ?? 'fade',
    cardStyle: readCfgString(cfg, 'card_style') ?? 'elevated',
    name: restaurant.name ?? undefined,
    logoUrl: restaurant.logo_url ?? undefined,
    overrides: safeOverrides,
  }
}
