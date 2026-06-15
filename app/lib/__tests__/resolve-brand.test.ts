import { describe, it, expect } from 'vitest'
import { resolveBrand, LOCKED_BRAND_KEYS } from '@/lib/resolve-brand'

const baseRestaurant: Partial<import('@/types/database').Restaurant> = {
  name: 'Test Bistro',
  logo_url: 'https://example.com/logo.png',
  design_config: {
    primary_color: '#FF6B2C',
    bg_color: '#080808',
    font_pair: 'syne-dmsans',
    layout_variant: 'cards',
    border_radius: 'pill',
  } as Record<string, unknown>,
}

describe('resolveBrand', () => {
  it('liest Farben + Font aus dem Kern (design_config)', () => {
    const b = resolveBrand(baseRestaurant, 'order')
    expect(b.colors.accent).toBe('#FF6B2C')
    expect(b.colors.bg).toBe('#080808')
    expect(b.fontPairKey).toBe('syne-dmsans')
    expect(b.font.heading).toBe('var(--font-syne)')
    expect(b.borderRadius).toBe('pill')
    expect(b.surface).toBe('order')
  })

  it('übernimmt Master-Daten', () => {
    const b = resolveBrand(baseRestaurant, 'landing')
    expect(b.name).toBe('Test Bistro')
    expect(b.logoUrl).toBe('https://example.com/logo.png')
  })

  it('erlaubt Pro-Fläche-Overrides (Landing-Layout, Hero)', () => {
    const b = resolveBrand(baseRestaurant, 'landing', {
      lp_layout: 'split-hero',
      hero_image_url: 'https://example.com/hero.jpg',
    })
    expect(b.layoutVariant).toBe('split-hero')
    expect(b.overrides.hero_image_url).toBe('https://example.com/hero.jpg')
  })

  it('IGNORIERT gesperrte Felder in Overrides (Kern gewinnt aktiv)', () => {
    const b = resolveBrand(baseRestaurant, 'landing', {
      primary_color: '#00FF00',
      font_pair: 'playfair-lato',
    } as Record<string, unknown>)
    expect(b.colors.accent).toBe('#FF6B2C')
    expect(b.fontPairKey).toBe('syne-dmsans')
    expect(b.overrides.primary_color).toBeUndefined()
    expect(LOCKED_BRAND_KEYS).toContain('primary_color')
  })

  it('fällt bei leerem design_config auf Default-Look zurück (kein Crash)', () => {
    const b = resolveBrand({}, 'online')
    expect(b.colors.accent).toBeTruthy()
    expect(b.font).toBeTruthy()
    expect(b.layoutVariant).toBe('cards')
  })

  it('Menü-Layout-Override gilt nur für order/online, nicht landing', () => {
    const order = resolveBrand(baseRestaurant, 'order', { layout_variant: 'grid' })
    expect(order.layoutVariant).toBe('grid')
    const landing = resolveBrand(baseRestaurant, 'landing', { layout_variant: 'grid' })
    expect(landing.layoutVariant).toBe('cards')
    expect((landing.overrides as Record<string, unknown>).layout_variant).toBeUndefined()
  })

  it('fällt auf design_package zurück, wenn design_config leer ist', () => {
    const b = resolveBrand({ design_package: 'elegant-gold' }, 'order')
    expect(b.fontPairKey).toBe('playfair-lato')
    expect(b.colors.accent).toBe('#C9A84C')
  })
})
