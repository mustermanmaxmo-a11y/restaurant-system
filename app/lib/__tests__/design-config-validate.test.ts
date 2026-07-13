import { describe, it, expect } from 'vitest'
import {
  validateDesignConfig,
  validateDesignConfigWithDefaults,
} from '@/lib/design-config-validate'

describe('validateDesignConfig', () => {
  it('übernimmt gültige 6-stellige Hex-Farben', () => {
    const out = validateDesignConfig({ primary_color: '#e85d26', bg_color: '#0A0A0A' })
    expect(out.primary_color).toBe('#e85d26')
    expect(out.bg_color).toBe('#0A0A0A')
  })

  it('verwirft ungültige Hex-Werte (Sicherheit: kein untrusted CSS)', () => {
    const out = validateDesignConfig({
      primary_color: '#fff',          // zu kurz
      bg_color: 'red',                // Farbwort, kein Hex
      surface_color: '#gggggg',       // keine Hex-Ziffern
      header_color: 'e85d26',         // fehlendes #
      button_color: '#e85d260',       // zu lang
    })
    expect(out).toEqual({})
  })

  it('blockiert Injection-artige Strings in Farbfeldern', () => {
    const out = validateDesignConfig({ primary_color: 'red; background:url(x)' })
    expect(out.primary_color).toBeUndefined()
  })

  it('übernimmt gültige Enum-Werte und verwirft ungültige', () => {
    const out = validateDesignConfig({
      font_pair: 'inter-inter',
      layout_variant: 'grid',
      border_radius: 'pill',
      hover_effect: 'kaputt',         // ungültig → verworfen
      card_style: 'Elevated',         // case-sensitiv → verworfen
    })
    expect(out.font_pair).toBe('inter-inter')
    expect(out.layout_variant).toBe('grid')
    expect(out.border_radius).toBe('pill')
    expect(out.hover_effect).toBeUndefined()
    expect(out.card_style).toBeUndefined()
  })

  it('verwirft unbekannte Felder komplett (nur Whitelist übernommen)', () => {
    const out = validateDesignConfig({ evil: 'x', script: '<img>', primary_color: '#123456' })
    expect(out).toEqual({ primary_color: '#123456' })
    expect('evil' in out).toBe(false)
  })

  it('leeres Objekt ergibt leeres Ergebnis', () => {
    expect(validateDesignConfig({})).toEqual({})
  })
})

describe('validateDesignConfigWithDefaults', () => {
  it('füllt alle Defaults bei leerem Input', () => {
    const { config } = validateDesignConfigWithDefaults({})
    expect(config.primary_color).toBe('#e85d26')
    expect(config.font_pair).toBe('syne-dmsans')
    expect(config.layout_variant).toBe('cards')
    expect(config.card_style).toBe('elevated')
    // Vollständigkeit: kein Feld undefined
    expect(Object.values(config).every(v => v !== undefined)).toBe(true)
  })

  it('gültige Werte überschreiben Defaults, ungültige fallen auf Default zurück', () => {
    const { config } = validateDesignConfigWithDefaults({
      primary_color: '#000000',   // gültig → übernommen
      bg_color: 'nope',           // ungültig → Default
      layout_variant: 'grid',     // gültig → übernommen
    })
    expect(config.primary_color).toBe('#000000')
    expect(config.bg_color).toBe('#0a0a0a') // Default
    expect(config.layout_variant).toBe('grid')
  })

  it('klemmt confidence in [0,1]', () => {
    expect(validateDesignConfigWithDefaults({ confidence: 1.7 }).confidence).toBe(1)
    expect(validateDesignConfigWithDefaults({ confidence: -0.4 }).confidence).toBe(0)
    expect(validateDesignConfigWithDefaults({ confidence: 0.42 }).confidence).toBe(0.42)
  })

  it('parst confidence aus String und behandelt Unsinn als 0', () => {
    expect(validateDesignConfigWithDefaults({ confidence: '0.8' }).confidence).toBe(0.8)
    expect(validateDesignConfigWithDefaults({ confidence: 'abc' }).confidence).toBe(0)
    expect(validateDesignConfigWithDefaults({}).confidence).toBe(0)
  })
})
