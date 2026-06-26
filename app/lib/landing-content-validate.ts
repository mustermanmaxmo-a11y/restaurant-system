import type {
  LandingPageContent, OpeningHours, OpeningHoursDay, ReviewQuote,
  TeamMember, Award, SectionKey,
} from './landing-content'

const SECTION_KEYS: SectionKey[] = [
  'gallery', 'featured_menu', 'about', 'team', 'story', 'ambiance',
  'awards', 'opening_hours', 'reviews', 'reservation_cta', 'contact', 'instagram',
]
const DAY_KEYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'] as const
const LP_LAYOUTS = new Set<string>(['classic-hero', 'split-hero', 'minimal', 'bold-fullscreen'])

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}
function asStringArray(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined
}
function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}
function asOpeningDay(v: unknown): OpeningHoursDay | undefined {
  if (typeof v !== 'object' || v === null) return undefined
  const o = v as Record<string, unknown>
  if (typeof o.open !== 'boolean') return undefined
  const day: OpeningHoursDay = { open: o.open }
  if (typeof o.from === 'string') day.from = o.from
  if (typeof o.to === 'string') day.to = o.to
  return day
}
function asOpeningHours(v: unknown): OpeningHours | undefined {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined
  const o = v as Record<string, unknown>
  const result: OpeningHours = {}
  for (const d of DAY_KEYS) {
    const day = asOpeningDay(o[d])
    if (day) result[d] = day
  }
  return result
}
function asTeam(v: unknown): TeamMember[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v
    .map((m): TeamMember | null => {
      if (typeof m !== 'object' || m === null) return null
      const o = m as Record<string, unknown>
      if (typeof o.name !== 'string' || typeof o.role !== 'string') return null
      const member: TeamMember = { name: o.name, role: o.role }
      if (typeof o.photo_url === 'string') member.photo_url = o.photo_url
      return member
    })
    .filter((m): m is TeamMember => m !== null)
}
function asAwards(v: unknown): Award[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v
    .map((a): Award | null => {
      if (typeof a !== 'object' || a === null) return null
      const o = a as Record<string, unknown>
      if (typeof o.title !== 'string') return null
      const award: Award = { title: o.title }
      if (typeof o.subtitle === 'string') award.subtitle = o.subtitle
      if (typeof o.logo_url === 'string') award.logo_url = o.logo_url
      return award
    })
    .filter((a): a is Award => a !== null)
}
function asReviewQuotes(v: unknown): ReviewQuote[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v
    .map((q): ReviewQuote | null => {
      if (typeof q !== 'object' || q === null) return null
      const o = q as Record<string, unknown>
      if (typeof o.text !== 'string' || typeof o.author !== 'string') return null
      const quote: ReviewQuote = { text: o.text, author: o.author }
      const stars = asNumber(o.stars)
      if (stars !== undefined) quote.stars = stars
      return quote
    })
    .filter((q): q is ReviewQuote => q !== null)
}
function asSectionVisibility(v: unknown): Partial<Record<SectionKey, boolean>> | undefined {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined
  const o = v as Record<string, unknown>
  const result: Partial<Record<SectionKey, boolean>> = {}
  for (const k of SECTION_KEYS) {
    if (typeof o[k] === 'boolean') result[k] = o[k] as boolean
  }
  return result
}

/**
 * Server-seitige Validierung des Landing-Content-JSON.
 * Übernimmt NUR bekannte Felder mit korrektem Typ (Allowlist).
 * Unbekannte Keys werden verworfen — schützt die DB-Zeile vor Müll.
 */
export function sanitizeLandingContent(raw: unknown): LandingPageContent {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const o = raw as Record<string, unknown>
  const c: LandingPageContent = {}

  const stringKeys = [
    'logo_url', 'hero_image_url', 'headline', 'subheadline', 'about_text', 'cta_text', 'cta_url',
    'lp_design_package', 'address', 'maps_url', 'phone', 'email', 'instagram', 'facebook',
    'review_url', 'google_maps_url', 'story_text', 'story_image_url', 'founded_year',
  ] as const
  for (const k of stringKeys) {
    const s = asString(o[k])
    if (s !== undefined) (c as Record<string, unknown>)[k] = s
  }

  const gallery = asStringArray(o.gallery); if (gallery) c.gallery = gallery
  const badges = asStringArray(o.feature_badges); if (badges) c.feature_badges = badges
  const ambiance = asStringArray(o.ambiance_gallery); if (ambiance) c.ambiance_gallery = ambiance

  const rating = asNumber(o.google_rating); if (rating !== undefined) c.google_rating = rating
  const count = asNumber(o.google_review_count); if (count !== undefined) c.google_review_count = count

  const oh = asOpeningHours(o.opening_hours); if (oh) c.opening_hours = oh
  const team = asTeam(o.team); if (team) c.team = team
  const awards = asAwards(o.awards); if (awards) c.awards = awards
  const quotes = asReviewQuotes(o.review_quotes); if (quotes) c.review_quotes = quotes
  const vis = asSectionVisibility(o.section_visibility); if (vis) c.section_visibility = vis

  const layout = asString(o.lp_layout)
  if (layout !== undefined && LP_LAYOUTS.has(layout)) {
    c.lp_layout = layout as LandingPageContent['lp_layout']
  }

  return c
}
