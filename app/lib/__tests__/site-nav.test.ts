import { describe, it, expect } from 'vitest'
import { buildSiteNav } from '@/lib/site-nav'

describe('buildSiteNav', () => {
  it('baut die vier Navi-Links mit dem slug', () => {
    const nav = buildSiteNav('pizzaroma')
    expect(nav.map(n => n.key)).toEqual(['start', 'speisekarte', 'reservieren', 'kontakt'])
    expect(nav.find(n => n.key === 'start')!.href).toBe('/pizzaroma/info')
    expect(nav.find(n => n.key === 'speisekarte')!.href).toBe('/bestellen/pizzaroma')
    expect(nav.find(n => n.key === 'reservieren')!.href).toBe('/bestellen/pizzaroma?tab=reserve')
    expect(nav.find(n => n.key === 'kontakt')!.href).toBe('/pizzaroma/info#kontakt')
  })

  it('markiert den aktiven Link', () => {
    const nav = buildSiteNav('x', 'speisekarte')
    expect(nav.find(n => n.key === 'speisekarte')!.active).toBe(true)
    expect(nav.find(n => n.key === 'start')!.active).toBe(false)
  })

  it('ohne active-Argument ist nichts aktiv', () => {
    const nav = buildSiteNav('x')
    expect(nav.every(n => n.active === false)).toBe(true)
  })
})
