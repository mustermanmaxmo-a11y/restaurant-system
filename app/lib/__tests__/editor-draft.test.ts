import { describe, it, expect } from 'vitest'
import {
  hasUnpublishedChanges,
  initDraftFromLive,
  promoteDraft,
  type DraftConfig,
} from '@/lib/editor-draft'

describe('hasUnpublishedChanges', () => {
  it('false, wenn noch kein Entwurf-Zeitstempel existiert', () => {
    expect(hasUnpublishedChanges(null, null)).toBe(false)
    expect(hasUnpublishedChanges(undefined, '2026-06-30T10:00:00.000Z')).toBe(false)
  })

  it('true, wenn Entwurf existiert aber noch nie veröffentlicht wurde', () => {
    expect(hasUnpublishedChanges('2026-06-30T10:00:00.000Z', null)).toBe(true)
  })

  it('true, wenn Entwurf neuer als letzte Veröffentlichung', () => {
    expect(hasUnpublishedChanges('2026-06-30T12:00:00.000Z', '2026-06-30T10:00:00.000Z')).toBe(true)
  })

  it('false, wenn Entwurf älter/gleich der letzten Veröffentlichung', () => {
    expect(hasUnpublishedChanges('2026-06-30T10:00:00.000Z', '2026-06-30T12:00:00.000Z')).toBe(false)
    expect(hasUnpublishedChanges('2026-06-30T10:00:00.000Z', '2026-06-30T10:00:00.000Z')).toBe(false)
  })
})

describe('initDraftFromLive', () => {
  it('übernimmt Marke-Felder aus dem Restaurant und füllt Fallbacks', () => {
    const draft = initDraftFromLive(
      {
        design_package: null, layout_variant: null, font_pair: null,
        primary_color: '#abc123', bg_color: null, header_color: null,
        card_color: null, button_color: null, text_color: null,
        design_config: { foo: 'bar' }, logo_url: 'https://x/logo.png',
        contact_email: 'a@b.de', contact_phone: null, contact_address: null,
        description: 'Beste Pasta',
      },
      { headline: 'Hallo' },
    )
    expect(draft.brand.design_package).toBe('modern-classic') // Fallback
    expect(draft.brand.layout_variant).toBe('cards')          // Fallback
    expect(draft.brand.font_pair).toBe('syne-dmsans')         // Fallback
    expect(draft.brand.primary_color).toBe('#abc123')
    expect(draft.brand.design_config).toEqual({ foo: 'bar' })
    expect(draft.brand.logo_url).toBe('https://x/logo.png')
    expect(draft.brand.description).toBe('Beste Pasta')
    expect(draft.landing_content.headline).toBe('Hallo')
    expect(typeof draft.draft_updated_at).toBe('string')
  })

  it('sanitisiert den Landing-Inhalt (verwirft Müll-Keys)', () => {
    const draft = initDraftFromLive(
      { primary_color: null },
      { headline: 'Hi', evil: 'x' } as Record<string, unknown>,
    )
    expect(draft.landing_content.headline).toBe('Hi')
    expect((draft.landing_content as Record<string, unknown>).evil).toBeUndefined()
  })
})

function makeDraft(overrides: Partial<DraftConfig['brand']> = {}): DraftConfig {
  return {
    brand: {
      design_package: 'modern-classic', layout_variant: 'cards', font_pair: 'syne-dmsans',
      primary_color: null, bg_color: null, header_color: null, card_color: null,
      button_color: null, text_color: null, design_config: null, logo_url: null,
      contact_email: null, contact_phone: null, contact_address: null, description: null,
      ...overrides,
    },
    landing_content: { headline: 'Hallo', evil: 'x' } as Record<string, unknown>,
    draft_updated_at: '2026-06-30T12:00:00.000Z',
  }
}

describe('promoteDraft', () => {
  it('mappt Marke-Felder + sanitisiert den Landing-Inhalt', () => {
    const { restaurantUpdate, landingContent } = promoteDraft(makeDraft({ primary_color: '#ff0000', description: 'X' }))
    expect(restaurantUpdate.primary_color).toBe('#ff0000')
    expect(restaurantUpdate.font_pair).toBe('syne-dmsans')
    expect(restaurantUpdate.description).toBe('X')
    expect(landingContent.headline).toBe('Hallo')
    expect((landingContent as Record<string, unknown>).evil).toBeUndefined()
  })

  it('setzt surface_color = null, wenn primary_color gesetzt ist', () => {
    const { restaurantUpdate } = promoteDraft(makeDraft({ primary_color: '#123456' }))
    expect(restaurantUpdate.surface_color).toBeNull()
  })

  it('leitet surface_color aus dem Paket ab, wenn primary_color null ist', () => {
    const { restaurantUpdate } = promoteDraft(makeDraft({ primary_color: null }))
    expect(typeof restaurantUpdate.surface_color).toBe('string')
  })
})
