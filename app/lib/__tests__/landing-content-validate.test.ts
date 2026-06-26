import { describe, it, expect } from 'vitest'
import { sanitizeLandingContent } from '@/lib/landing-content-validate'

describe('sanitizeLandingContent', () => {
  it('übernimmt bekannte String-Felder', () => {
    const out = sanitizeLandingContent({ headline: 'Hallo', about_text: 'Text' })
    expect(out.headline).toBe('Hallo')
    expect(out.about_text).toBe('Text')
  })

  it('verwirft unbekannte Keys', () => {
    const out = sanitizeLandingContent({ headline: 'Hi', evil: 'x', __proto__pollute: 1 }) as Record<string, unknown>
    expect(out.headline).toBe('Hi')
    expect(out.evil).toBeUndefined()
  })

  it('behält Galerie + Ambiente als String-Arrays und filtert Nicht-Strings', () => {
    const out = sanitizeLandingContent({ gallery: ['a', 2, 'b'], ambiance_gallery: ['x'] })
    expect(out.gallery).toEqual(['a', 'b'])
    expect(out.ambiance_gallery).toEqual(['x'])
  })

  it('behält Zahlen für google_rating', () => {
    const out = sanitizeLandingContent({ google_rating: 4.5, google_review_count: 120 })
    expect(out.google_rating).toBe(4.5)
    expect(out.google_review_count).toBe(120)
  })

  it('validiert team: nur Objekte mit name+role, photo_url optional', () => {
    const out = sanitizeLandingContent({
      team: [
        { name: 'Marco', role: 'Chefkoch', photo_url: 'u' },
        { name: 'Ohne Rolle' },
        'garbage',
      ],
    })
    expect(out.team).toEqual([{ name: 'Marco', role: 'Chefkoch', photo_url: 'u' }])
  })

  it('validiert awards: title pflicht, subtitle/logo_url optional', () => {
    const out = sanitizeLandingContent({
      awards: [{ title: 'Stern', subtitle: '2024' }, { subtitle: 'kein Titel' }],
    })
    expect(out.awards).toEqual([{ title: 'Stern', subtitle: '2024' }])
  })

  it('übernimmt section_visibility nur als Booleans bekannter Keys', () => {
    const out = sanitizeLandingContent({
      section_visibility: { team: false, story: true, bogus: false, contact: 'no' },
    })
    expect(out.section_visibility).toEqual({ team: false, story: true })
  })

  it('liefert {} bei Nicht-Objekt-Eingabe', () => {
    expect(sanitizeLandingContent(null)).toEqual({})
    expect(sanitizeLandingContent('x')).toEqual({})
    expect(sanitizeLandingContent([1, 2])).toEqual({})
  })

  it('behält opening_hours mit gültigen Tagen', () => {
    const out = sanitizeLandingContent({
      opening_hours: { mo: { open: true, from: '10:00', to: '22:00' }, di: { open: false }, xx: { open: true } },
    })
    expect(out.opening_hours).toEqual({ mo: { open: true, from: '10:00', to: '22:00' }, di: { open: false } })
  })

  it('verwirft NaN/Infinity bei review_quotes.stars', () => {
    const out = sanitizeLandingContent({
      review_quotes: [
        { text: 'super', author: 'A', stars: Number.NaN },
        { text: 'top', author: 'B', stars: 5 },
      ],
    })
    expect(out.review_quotes).toEqual([
      { text: 'super', author: 'A' },
      { text: 'top', author: 'B', stars: 5 },
    ])
  })

  it('übernimmt lp_layout nur bei gültigem Slug', () => {
    expect(sanitizeLandingContent({ lp_layout: 'split-hero' }).lp_layout).toBe('split-hero')
    expect(sanitizeLandingContent({ lp_layout: 'bogus-layout' }).lp_layout).toBeUndefined()
  })
})
