// app/lib/lp-layouts.ts

export const LP_LAYOUT_SLUGS = ['classic-hero', 'split-hero', 'minimal', 'bold-fullscreen'] as const
export type LpLayoutSlug = typeof LP_LAYOUT_SLUGS[number]

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

export interface OpeningHours {
  mo?: { open: boolean; from: string; to: string }
  di?: { open: boolean; from: string; to: string }
  mi?: { open: boolean; from: string; to: string }
  do?: { open: boolean; from: string; to: string }
  fr?: { open: boolean; from: string; to: string }
  sa?: { open: boolean; from: string; to: string }
  so?: { open: boolean; from: string; to: string }
}

export interface LandingPageContent {
  // Existing fields
  logo_url?: string
  hero_image_url?: string
  headline?: string
  subheadline?: string
  about_text?: string
  cta_text?: string
  cta_url?: string
  // Design
  lp_design_package?: string
  lp_layout?: LpLayoutSlug
  // Contact
  address?: string
  maps_url?: string
  phone?: string
  email?: string
  instagram?: string
  facebook?: string
  // Gallery
  gallery?: string[]
  // Features
  feature_badges?: string[]
  // Reviews
  review_url?: string
  // Opening hours
  opening_hours?: OpeningHours
}

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
