const VALID_FONT_PAIRS = ['syne-dmsans', 'playfair-lato', 'inter-inter', 'space-dmsans', 'merriweather-source', 'noto-noto'] as const
const VALID_LAYOUTS = ['cards', 'list', 'grid', 'large-cards'] as const
const VALID_BORDER_RADIUS = ['sharp', 'rounded', 'pill'] as const
const VALID_HOVER_EFFECTS = ['scale', 'glow', 'underline', 'color-shift', 'none'] as const
const VALID_ANIMATION_STYLES = ['fade', 'slide', 'none'] as const
const VALID_CARD_STYLES = ['elevated', 'flat', 'outlined', 'ghost'] as const

type FontPair = (typeof VALID_FONT_PAIRS)[number]
type LayoutVariant = (typeof VALID_LAYOUTS)[number]
type BorderRadius = (typeof VALID_BORDER_RADIUS)[number]
type HoverEffect = (typeof VALID_HOVER_EFFECTS)[number]
type AnimationStyle = (typeof VALID_ANIMATION_STYLES)[number]
type CardStyle = (typeof VALID_CARD_STYLES)[number]

export interface ValidatedDesignConfig {
  primary_color?: string
  bg_color?: string
  surface_color?: string
  header_color?: string
  button_color?: string
  card_color?: string
  text_color?: string
  font_pair?: FontPair
  layout_variant?: LayoutVariant
  border_radius?: BorderRadius
  hover_effect?: HoverEffect
  animation_style?: AnimationStyle
  card_style?: CardStyle
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

function validHex(v: unknown): string | undefined {
  return typeof v === 'string' && HEX_RE.test(v) ? v : undefined
}

function validEnum<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return (allowed as readonly string[]).includes(v as string) ? (v as T) : undefined
}

/**
 * Validates and sanitizes a design_config object from untrusted input.
 * Returns only valid fields — invalid or unknown fields are dropped.
 * Used by both design-extract (AI output) and design-config PATCH (user input).
 */
export function validateDesignConfig(raw: Record<string, unknown>): ValidatedDesignConfig {
  const out: ValidatedDesignConfig = {}

  const pc = validHex(raw.primary_color); if (pc) out.primary_color = pc
  const bg = validHex(raw.bg_color); if (bg) out.bg_color = bg
  const sc = validHex(raw.surface_color); if (sc) out.surface_color = sc
  const hc = validHex(raw.header_color); if (hc) out.header_color = hc
  const bc = validHex(raw.button_color); if (bc) out.button_color = bc
  const cc = validHex(raw.card_color); if (cc) out.card_color = cc
  const tc = validHex(raw.text_color); if (tc) out.text_color = tc

  const fp = validEnum(raw.font_pair, VALID_FONT_PAIRS); if (fp) out.font_pair = fp
  const lv = validEnum(raw.layout_variant, VALID_LAYOUTS); if (lv) out.layout_variant = lv
  const br = validEnum(raw.border_radius, VALID_BORDER_RADIUS); if (br) out.border_radius = br
  const he = validEnum(raw.hover_effect, VALID_HOVER_EFFECTS); if (he) out.hover_effect = he
  const as_ = validEnum(raw.animation_style, VALID_ANIMATION_STYLES); if (as_) out.animation_style = as_
  const cs = validEnum(raw.card_style, VALID_CARD_STYLES); if (cs) out.card_style = cs

  return out
}

/**
 * Like validateDesignConfig but fills in defaults for all missing fields.
 * Used by design-extract (AI must return a complete config).
 */
export function validateDesignConfigWithDefaults(raw: Record<string, unknown>): {
  config: Required<ValidatedDesignConfig>
  confidence: number
} {
  const DEFAULTS: Required<ValidatedDesignConfig> = {
    primary_color: '#e85d26',
    bg_color: '#0a0a0a',
    surface_color: '#1a1a1a',
    header_color: '#111111',
    button_color: '#e85d26',
    card_color: '#1e1e1e',
    text_color: '#ffffff',
    font_pair: 'syne-dmsans',
    layout_variant: 'cards',
    border_radius: 'rounded',
    hover_effect: 'scale',
    animation_style: 'fade',
    card_style: 'elevated',
  }

  const partial = validateDesignConfig(raw)
  const config: Required<ValidatedDesignConfig> = { ...DEFAULTS, ...partial }

  const rawConfidence = typeof raw.confidence === 'number'
    ? raw.confidence
    : parseFloat(String(raw.confidence ?? '0'))
  const confidence = Math.min(1, Math.max(0, isNaN(rawConfidence) ? 0 : rawConfidence))

  return { config, confidence }
}
