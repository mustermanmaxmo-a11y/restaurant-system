// app/lib/lp-layouts.ts
import type { LandingPageContent, LpLayoutSlug } from './landing-content'
export type { LandingPageContent, LpLayoutSlug, OpeningHours, OpeningHoursDay, ReviewQuote } from './landing-content'

export const LP_LAYOUT_SLUGS = ['classic-hero', 'split-hero', 'minimal', 'bold-fullscreen'] as const

export interface LpLayout {
  slug: LpLayoutSlug
  label: string
  desc: string
}

export const LP_LAYOUTS: LpLayout[] = [
  { slug: 'classic-hero',    label: 'Classic Hero',    desc: 'Full-width Hero, Sektionen darunter' },
  { slug: 'split-hero',      label: 'Split Hero',      desc: 'Bild links, Text rechts' },
  { slug: 'minimal',         label: 'Minimal',         desc: 'Clean & minimalistisch' },
  { slug: 'bold-fullscreen', label: 'Bold Fullscreen', desc: 'Vollbild-Hero mit Overlay' },
]

export interface LandingPageRow {
  id: string
  restaurant_id: string
  template_slug: string
  content: LandingPageContent
  is_published: boolean
  custom_domain: string | null
  created_at: string
  updated_at: string
}
