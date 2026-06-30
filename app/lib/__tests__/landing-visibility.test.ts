import { describe, it, expect } from 'vitest'
import { isSectionVisible } from '@/lib/landing-visibility'
import type { LandingPageContent } from '@/lib/landing-content'

describe('isSectionVisible', () => {
  it('ist sichtbar wenn keine section_visibility gesetzt ist', () => {
    expect(isSectionVisible('team', {})).toBe(true)
  })

  it('ist sichtbar wenn der Key fehlt obwohl andere gesetzt sind', () => {
    const content: LandingPageContent = { section_visibility: { story: false } }
    expect(isSectionVisible('team', content)).toBe(true)
  })

  it('ist unsichtbar wenn explizit auf false', () => {
    const content: LandingPageContent = { section_visibility: { team: false } }
    expect(isSectionVisible('team', content)).toBe(false)
  })

  it('ist sichtbar wenn explizit auf true', () => {
    const content: LandingPageContent = { section_visibility: { team: true } }
    expect(isSectionVisible('team', content)).toBe(true)
  })
})
