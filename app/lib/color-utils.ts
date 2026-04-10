import { getDesignPackage } from './design-packages'
import type { Restaurant } from '@/types/database'

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  const clamp = (v: number) => Math.max(0, Math.min(255, v))
  return `#${[r, g, b].map(c => clamp(c - amount).toString(16).padStart(2, '0')).join('')}`
}

export function lighten(hex: string, amount: number): string {
  return darken(hex, -amount)
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

export function isLightColor(hex: string): boolean {
  return luminance(hex) > 0.5
}

export interface ColorSet {
  bg: string
  surface: string
  surface2: string
  border: string
  borderHover: string
  accent: string
  accentDim: string
  accentGlow: string
  text: string
  muted: string
  muted2: string
  headerBg: string
  headerText: string
  buttonBg: string
  buttonText: string
  cardBg: string
}

// New signature: accepts restaurant object, resolves package defaults + individual overrides
export function buildColorsFromRestaurant(restaurant: Partial<Restaurant>): ColorSet {
  const pkg = getDesignPackage(restaurant.design_package)

  const accent = restaurant.primary_color ?? pkg.preview.primaryColor
  const bg = restaurant.bg_color ?? pkg.preview.bgColor
  const surface = restaurant.surface_color ?? pkg.preview.surfaceColor
  const cardBg = restaurant.card_color ?? pkg.preview.cardColor
  const headerBg = restaurant.header_color ?? pkg.preview.headerColor
  const buttonBg = restaurant.button_color ?? pkg.preview.buttonColor
  const text = restaurant.text_color ?? pkg.preview.textColor

  const bgIsLight = isLightColor(bg)
  const surface2 = bgIsLight ? darken(surface, 8) : lighten(surface, 10)
  const border = bgIsLight ? darken(bg, 20) : lighten(bg, 25)
  const borderHover = bgIsLight ? darken(bg, 35) : lighten(bg, 40)
  const muted = bgIsLight ? '#888888' : '#5a5650'
  const muted2 = bgIsLight ? '#bbbbbb' : '#3a3632'
  const headerText = isLightColor(headerBg) ? '#111111' : '#ffffff'
  const buttonText = isLightColor(buttonBg) ? '#111111' : '#ffffff'

  return {
    bg,
    surface,
    surface2,
    border,
    borderHover,
    accent,
    accentDim: `${accent}1f`,
    accentGlow: `${accent}47`,
    text,
    muted,
    muted2,
    headerBg,
    headerText,
    buttonBg,
    buttonText,
    cardBg,
  }
}

// Legacy signature — kept for backward compatibility with existing code
export function buildColors(primaryColor?: string | null, surfaceColor?: string | null): ColorSet {
  return buildColorsFromRestaurant({
    primary_color: primaryColor,
    surface_color: surfaceColor,
  })
}
