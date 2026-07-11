import { describe, it, expect } from 'vitest'
import {
  hexToRgb,
  darken,
  lighten,
  isLightColor,
  readCfgString,
  buildColorsFromRestaurant,
  buildColors,
} from '@/lib/color-utils'

describe('hexToRgb', () => {
  it('zerlegt Weiß und Schwarz korrekt', () => {
    expect(hexToRgb('#ffffff')).toEqual([255, 255, 255])
    expect(hexToRgb('#000000')).toEqual([0, 0, 0])
  })

  it('zerlegt eine gemischte Farbe', () => {
    expect(hexToRgb('#ff8800')).toEqual([255, 136, 0])
  })

  it('funktioniert auch ohne führendes #', () => {
    expect(hexToRgb('00ff00')).toEqual([0, 255, 0])
  })
})

describe('darken', () => {
  it('reduziert jeden Kanal um den Betrag', () => {
    expect(darken('#808080', 8)).toBe('#787878')
  })

  it('klemmt bei 0 (kein Unterlauf)', () => {
    expect(darken('#000000', 20)).toBe('#000000')
  })

  it('füllt einstellige Hex-Werte mit führender 0 auf', () => {
    expect(darken('#0a0a0a', 5)).toBe('#050505')
  })
})

describe('lighten', () => {
  it('erhöht jeden Kanal um den Betrag', () => {
    expect(lighten('#808080', 8)).toBe('#888888')
  })

  it('klemmt bei 255 (kein Überlauf)', () => {
    expect(lighten('#ffffff', 20)).toBe('#ffffff')
  })
})

describe('isLightColor', () => {
  it('Weiß ist hell', () => {
    expect(isLightColor('#ffffff')).toBe(true)
  })
  it('Schwarz ist nicht hell', () => {
    expect(isLightColor('#000000')).toBe(false)
  })
  it('nutzt wahrgenommene Luminanz (reines Blau gilt als dunkel)', () => {
    // 0.114 * 255 / 255 ≈ 0.114 < 0.5
    expect(isLightColor('#0000ff')).toBe(false)
  })
})

describe('readCfgString', () => {
  it('gibt String-Werte zurück', () => {
    expect(readCfgString({ a: 'hallo' }, 'a')).toBe('hallo')
  })
  it('gibt undefined für Nicht-Strings zurück', () => {
    expect(readCfgString({ a: 42 }, 'a')).toBeUndefined()
    expect(readCfgString({ a: null }, 'a')).toBeUndefined()
  })
  it('gibt undefined für fehlende Keys zurück', () => {
    expect(readCfgString({}, 'fehlt')).toBeUndefined()
  })
})

describe('buildColorsFromRestaurant', () => {
  it('bevorzugt Overrides aus design_config vor Spalten', () => {
    const colors = buildColorsFromRestaurant({
      design_config: { primary_color: '#ff0000' },
      primary_color: '#00ff00', // sollte ignoriert werden, da design_config Vorrang hat
    })
    expect(colors.accent).toBe('#ff0000')
  })

  it('leitet accentDim/accentGlow als Alpha-Suffix vom Akzent ab', () => {
    const colors = buildColorsFromRestaurant({ design_config: { primary_color: '#123456' } })
    expect(colors.accentDim).toBe('#1234561f')
    expect(colors.accentGlow).toBe('#12345647')
  })

  it('wählt lesbaren Header-Text je nach Header-Helligkeit', () => {
    const dark = buildColorsFromRestaurant({ design_config: { header_color: '#000000' } })
    expect(dark.headerText).toBe('#ffffff')
    const light = buildColorsFromRestaurant({ design_config: { header_color: '#ffffff' } })
    expect(light.headerText).toBe('#111111')
  })

  it('fällt auf Einzelspalten zurück wenn design_config fehlt', () => {
    const colors = buildColorsFromRestaurant({ primary_color: '#abcdef' })
    expect(colors.accent).toBe('#abcdef')
  })
})

describe('buildColors (Legacy-Signatur)', () => {
  it('delegiert an buildColorsFromRestaurant', () => {
    const colors = buildColors('#ff0000', '#222222')
    expect(colors.accent).toBe('#ff0000')
    expect(colors.surface).toBe('#222222')
  })
})
