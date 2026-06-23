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

export type HeroLayout = 'classic-overlay' | 'bold-statement' | 'split' | 'centered-minimal' | 'gradient-glow'

export interface ResolvedBrand {
  surface: BrandSurface
  colors: ColorSet
  font: FontPair
  fontPairKey: string
  layoutVariant: string
  heroLayout: HeroLayout
  borderRadius: 'sharp' | 'rounded' | 'pill'
  hoverEffect: 'scale' | 'glow' | 'underline' | 'color-shift' | 'none'
  animationStyle: 'fade' | 'slide' | 'none'
  cardStyle: 'elevated' | 'flat' | 'outlined' | 'ghost'
  name?: string
  logoUrl?: string
  overrides: BrandOverrides
}

function pickEnum<T extends string>(
  v: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return (allowed as readonly string[]).includes(v ?? '') ? (v as T) : fallback
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
  const font: FontPair = (FONT_PAIRS[fontPairKey] as FontPair | undefined) ?? FONT_PAIRS['syne-dmsans']

  const overrideLayout =
    surface === 'landing'
      ? (typeof safeOverrides.lp_layout === 'string' ? safeOverrides.lp_layout : undefined)
      : (typeof safeOverrides.layout_variant === 'string' ? safeOverrides.layout_variant : undefined)

  const layoutVariant =
    overrideLayout ??
    readCfgString(cfg, 'layout_variant') ??
    restaurant.layout_variant ??
    'cards'

  if (surface === 'landing') delete safeOverrides.layout_variant

  const heroLayout = pickEnum(
    readCfgString(cfg, 'hero_layout'),
    ['classic-overlay', 'bold-statement', 'split', 'centered-minimal', 'gradient-glow'] as const,
    'classic-overlay',
  )

  return {
    surface,
    colors,
    font,
    fontPairKey,
    layoutVariant,
    heroLayout,
    borderRadius: pickEnum(readCfgString(cfg, 'border_radius'), ['sharp', 'rounded', 'pill'] as const, 'rounded'),
    hoverEffect: pickEnum(readCfgString(cfg, 'hover_effect'), ['scale', 'glow', 'underline', 'color-shift', 'none'] as const, 'scale'),
    animationStyle: pickEnum(readCfgString(cfg, 'animation_style'), ['fade', 'slide', 'none'] as const, 'fade'),
    cardStyle: pickEnum(readCfgString(cfg, 'card_style'), ['elevated', 'flat', 'outlined', 'ghost'] as const, 'elevated'),
    name: restaurant.name,
    logoUrl: restaurant.logo_url ?? undefined,
    overrides: safeOverrides,
  }
}
