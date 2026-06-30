import type { LandingPageContent } from './landing-content'
import { sanitizeLandingContent } from './landing-content-validate'
import { getDesignPackage } from './design-packages'
import type { Restaurant } from '@/types/database'

export interface DraftBrand {
  design_package: string
  layout_variant: string
  font_pair: string
  primary_color: string | null
  bg_color: string | null
  header_color: string | null
  card_color: string | null
  button_color: string | null
  text_color: string | null
  design_config: Record<string, unknown> | null
  logo_url: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  description: string | null
}

export interface DraftConfig {
  brand: DraftBrand
  landing_content: LandingPageContent
  draft_updated_at: string
}

/** Gibt es ungespeicherte (= nicht veröffentlichte) Änderungen? */
export function hasUnpublishedChanges(
  draftUpdatedAt: string | null | undefined,
  lastPublishedAt: string | null | undefined,
): boolean {
  if (!draftUpdatedAt) return false
  if (!lastPublishedAt) return true
  return new Date(draftUpdatedAt).getTime() > new Date(lastPublishedAt).getTime()
}

/** Befüllt einen frischen Entwurf aus dem aktuellen Live-Stand (für Restaurants ohne draft_config). */
export function initDraftFromLive(
  restaurant: Partial<Restaurant>,
  landingContent: LandingPageContent | Record<string, unknown> | null | undefined,
): DraftConfig {
  return {
    brand: {
      design_package: restaurant.design_package ?? 'modern-classic',
      layout_variant: (restaurant.layout_variant as string | null) ?? 'cards',
      font_pair: restaurant.font_pair ?? 'syne-dmsans',
      primary_color: restaurant.primary_color ?? null,
      bg_color: restaurant.bg_color ?? null,
      header_color: restaurant.header_color ?? null,
      card_color: restaurant.card_color ?? null,
      button_color: restaurant.button_color ?? null,
      text_color: restaurant.text_color ?? null,
      design_config: (restaurant.design_config ?? null) as Record<string, unknown> | null,
      logo_url: restaurant.logo_url ?? null,
      contact_email: restaurant.contact_email ?? null,
      contact_phone: restaurant.contact_phone ?? null,
      contact_address: restaurant.contact_address ?? null,
      description: restaurant.description ?? null,
    },
    landing_content: sanitizeLandingContent(landingContent),
    draft_updated_at: new Date().toISOString(),
  }
}

/** Bildet den Entwurf auf die Live-Schreibziele ab (restaurants-Spalten + landing_pages.content). */
export function promoteDraft(draft: DraftConfig): {
  restaurantUpdate: Record<string, unknown>
  landingContent: LandingPageContent
} {
  const b = draft.brand
  const pkg = getDesignPackage(b.design_package)
  return {
    restaurantUpdate: {
      design_package: b.design_package,
      layout_variant: b.layout_variant,
      font_pair: b.font_pair,
      primary_color: b.primary_color,
      surface_color: b.primary_color ? null : pkg.preview.surfaceColor,
      bg_color: b.bg_color,
      header_color: b.header_color,
      card_color: b.card_color,
      button_color: b.button_color,
      text_color: b.text_color,
      design_config: b.design_config,
      logo_url: b.logo_url,
      contact_email: b.contact_email,
      contact_phone: b.contact_phone,
      contact_address: b.contact_address,
      description: b.description,
    },
    landingContent: sanitizeLandingContent(draft.landing_content),
  }
}
