import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cn, timeAgo } from '@/lib/utils'

describe('cn', () => {
  it('führt Klassen zusammen', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('lässt konditionale/falsy Werte weg', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('dedupliziert konfligierende Tailwind-Klassen (letzte gewinnt)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
})

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-12T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('zeigt Sekunden unter 1 Minute', () => {
    expect(timeAgo('2026-07-12T11:59:30Z')).toBe('30s')
  })

  it('zeigt Minuten unter 1 Stunde (abgerundet)', () => {
    expect(timeAgo('2026-07-12T11:58:30Z')).toBe('1m') // 90s → 1m
  })

  it('zeigt Stunden ab 1 Stunde', () => {
    expect(timeAgo('2026-07-12T10:00:00Z')).toBe('2h')
  })

  it('behandelt den Grenzwert exakt 60s als 1m', () => {
    expect(timeAgo('2026-07-12T11:59:00Z')).toBe('1m')
  })
})
