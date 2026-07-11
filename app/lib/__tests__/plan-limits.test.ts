import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getPlanLimits,
  isTrialExpired,
  getTrialDaysLeft,
  isRestaurantActive,
  PLAN_DISPLAY_NAMES,
} from '@/lib/plan-limits'

describe('getPlanLimits', () => {
  it('gibt für starter die beschränkten Limits zurück', () => {
    const l = getPlanLimits('starter')
    expect(l.maxTables).toBe(15)
    expect(l.maxStaff).toBe(3)
    expect(l.hasKiChat).toBe(false)
    expect(l.hasReservations).toBe(false)
    expect(l.analyticsRangeDays).toBe(7)
  })

  it('gibt für pro volle Features mit 365-Tage-Analytics zurück', () => {
    const l = getPlanLimits('pro')
    expect(l.maxTables).toBe(Infinity)
    expect(l.hasKiChat).toBe(true)
    expect(l.hasBranding).toBe(true)
    expect(l.hasFullAnalytics).toBe(true)
    expect(l.analyticsRangeDays).toBe(365)
    // pro darf NICHT Multi-Location / POS haben — nur enterprise
    expect(l.hasMultiLocation).toBe(false)
    expect(l.hasPosIntegration).toBe(false)
  })

  it('nur enterprise hat Multi-Location + POS-Integration', () => {
    const l = getPlanLimits('enterprise')
    expect(l.hasMultiLocation).toBe(true)
    expect(l.hasPosIntegration).toBe(true)
  })

  it('trial hat volle Features aber nur 30-Tage-Analytics', () => {
    const l = getPlanLimits('trial')
    expect(l.hasKiChat).toBe(true)
    expect(l.hasFullAnalytics).toBe(true)
    expect(l.analyticsRangeDays).toBe(30)
    expect(l.hasMultiLocation).toBe(false)
  })

  it('expired sperrt alles (0 Tische, keine Features)', () => {
    const l = getPlanLimits('expired')
    expect(l.maxTables).toBe(0)
    expect(l.maxStaff).toBe(0)
    expect(l.hasKiChat).toBe(false)
    expect(l.hasReservations).toBe(false)
    expect(l.hasFullAnalytics).toBe(false)
    expect(l.analyticsRangeDays).toBe(0)
  })

  it('fällt bei unbekanntem Plan sicher auf expired zurück', () => {
    // Absicherung gegen fehlerhafte DB-Werte — darf niemals Features freischalten
    const l = getPlanLimits('gibtsnicht' as never)
    expect(l).toEqual(getPlanLimits('expired'))
  })
})

describe('isTrialExpired', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-12T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('null (kein Trial-Ende) gilt als NICHT abgelaufen', () => {
    expect(isTrialExpired(null)).toBe(false)
  })

  it('ein Datum in der Vergangenheit ist abgelaufen', () => {
    expect(isTrialExpired('2026-07-11T12:00:00Z')).toBe(true)
  })

  it('ein Datum in der Zukunft ist nicht abgelaufen', () => {
    expect(isTrialExpired('2026-07-13T12:00:00Z')).toBe(false)
  })
})

describe('getTrialDaysLeft', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-12T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('null ergibt 0 verbleibende Tage', () => {
    expect(getTrialDaysLeft(null)).toBe(0)
  })

  it('rundet angebrochene Tage auf (ceil)', () => {
    // exakt 3 Tage + 1h in der Zukunft → 4 (aufgerundet)
    expect(getTrialDaysLeft('2026-07-15T13:00:00Z')).toBe(4)
  })

  it('exakt volle Tage werden nicht aufgerundet', () => {
    expect(getTrialDaysLeft('2026-07-15T12:00:00Z')).toBe(3)
  })

  it('vergangene Trials ergeben nie negative Tage (min 0)', () => {
    expect(getTrialDaysLeft('2026-07-01T12:00:00Z')).toBe(0)
  })
})

describe('isRestaurantActive', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-12T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('expired ist immer inaktiv, auch mit Trial-Datum', () => {
    expect(isRestaurantActive('expired', '2099-01-01T00:00:00Z')).toBe(false)
  })

  it('trial ist aktiv solange nicht abgelaufen', () => {
    expect(isRestaurantActive('trial', '2026-07-20T12:00:00Z')).toBe(true)
  })

  it('trial ist inaktiv wenn abgelaufen', () => {
    expect(isRestaurantActive('trial', '2026-07-01T12:00:00Z')).toBe(false)
  })

  it('bezahlte Pläne (starter/pro/enterprise) sind aktiv unabhängig vom Trial-Datum', () => {
    expect(isRestaurantActive('starter', null)).toBe(true)
    expect(isRestaurantActive('pro', null)).toBe(true)
    expect(isRestaurantActive('enterprise', null)).toBe(true)
  })
})

describe('PLAN_DISPLAY_NAMES', () => {
  it('hat für jeden Plan einen Anzeigenamen', () => {
    expect(PLAN_DISPLAY_NAMES.trial).toBe('Testphase')
    expect(PLAN_DISPLAY_NAMES.starter).toBe('Starter')
    expect(PLAN_DISPLAY_NAMES.pro).toBe('Professional')
    expect(PLAN_DISPLAY_NAMES.enterprise).toBe('Enterprise')
    expect(PLAN_DISPLAY_NAMES.expired).toBe('Abgelaufen')
  })
})
