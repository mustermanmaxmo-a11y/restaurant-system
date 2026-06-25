// app/lib/landing-content.ts

export type LpLayoutSlug = 'classic-hero' | 'split-hero' | 'minimal' | 'bold-fullscreen'

export interface ReviewQuote {
  text: string
  author: string
  stars?: number
}

export interface OpeningHoursDay {
  open: boolean
  from?: string
  to?: string
}

export type OpeningHours = {
  mo?: OpeningHoursDay
  di?: OpeningHoursDay
  mi?: OpeningHoursDay
  do?: OpeningHoursDay
  fr?: OpeningHoursDay
  sa?: OpeningHoursDay
  so?: OpeningHoursDay
}

export interface LandingPageContent {
  // Hero
  logo_url?: string
  hero_image_url?: string
  headline?: string
  subheadline?: string
  about_text?: string
  cta_text?: string
  cta_url?: string
  lp_design_package?: string
  lp_layout?: LpLayoutSlug

  // Kontakt
  address?: string
  maps_url?: string
  phone?: string
  email?: string
  instagram?: string
  facebook?: string

  // Galerie
  gallery?: string[]

  // Features
  feature_badges?: string[]

  // Bewertungen
  review_url?: string
  google_rating?: number
  google_review_count?: number
  google_maps_url?: string
  review_quotes?: ReviewQuote[]

  // Öffnungszeiten
  opening_hours?: OpeningHours
}
