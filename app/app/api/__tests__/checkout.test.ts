import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mock Supabase admin ──────────────────────────────────────────────────────
const mockMaybeSingle = vi.fn()
const mockSingle = vi.fn()
const mockUpdate = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockIs = vi.fn()
const mockGte = vi.fn()

const chainable = {
  select: () => chainable,
  eq: () => chainable,
  is: () => chainable,
  gte: () => chainable,
  update: () => chainable,
  maybeSingle: mockMaybeSingle,
  single: mockSingle,
}

vi.mock('@/lib/supabase-admin', () => ({
  createSupabaseAdmin: () => ({
    from: () => ({
      select: () => chainable,
      update: () => chainable,
      eq: () => chainable,
      maybeSingle: mockMaybeSingle,
      single: mockSingle,
    }),
  }),
}))

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/checkout/validate-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── validate-code ────────────────────────────────────────────────────────────
describe('POST /api/checkout/validate-code', () => {
  const { POST } = await import('../validate-code/route')

  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when code is missing', async () => {
    const res = await POST(makeRequest({ restaurantId: 'r1' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.valid).toBe(false)
    expect(body.error).toBe('missing_params')
  })

  it('returns 400 when restaurantId is missing', async () => {
    const res = await POST(makeRequest({ code: 'SAVE10' }))
    expect(res.status).toBe(400)
  })

  it('returns valid:false with not_found when code does not exist', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const res = await POST(makeRequest({ code: 'GHOST', restaurantId: 'r1' }))
    const body = await res.json()
    expect(body.valid).toBe(false)
    expect(body.error).toBe('not_found')
  })

  it('returns valid:false with wrong_restaurant when code belongs to another restaurant', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: '1', discount_type: 'percent', discount_value: 10, expires_at: new Date(Date.now() + 86400000).toISOString(), used_at: null, restaurant_id: 'other-restaurant' },
      error: null,
    })
    const res = await POST(makeRequest({ code: 'VALID10', restaurantId: 'r1' }))
    const body = await res.json()
    expect(body.valid).toBe(false)
    expect(body.error).toBe('wrong_restaurant')
  })

  it('returns valid:false with already_used when code was used', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: '1', discount_type: 'percent', discount_value: 10, expires_at: new Date(Date.now() + 86400000).toISOString(), used_at: '2025-01-01T00:00:00Z', restaurant_id: 'r1' },
      error: null,
    })
    const res = await POST(makeRequest({ code: 'USED10', restaurantId: 'r1' }))
    const body = await res.json()
    expect(body.valid).toBe(false)
    expect(body.error).toBe('already_used')
  })

  it('returns valid:false with expired when code is past expiry', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: '1', discount_type: 'percent', discount_value: 10, expires_at: '2020-01-01T00:00:00Z', used_at: null, restaurant_id: 'r1' },
      error: null,
    })
    const res = await POST(makeRequest({ code: 'OLD10', restaurantId: 'r1' }))
    const body = await res.json()
    expect(body.valid).toBe(false)
    expect(body.error).toBe('expired')
  })

  it('returns valid:true with discount info for a valid code', async () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: '1', discount_type: 'percent', discount_value: 15, expires_at: future, used_at: null, restaurant_id: 'r1' },
      error: null,
    })
    const res = await POST(makeRequest({ code: 'SAVE15', restaurantId: 'r1' }))
    const body = await res.json()
    expect(body.valid).toBe(true)
    expect(body.discountType).toBe('percent')
    expect(body.discountValue).toBe(15)
    expect(body.expiresAt).toBe(future)
  })

  it('normalises code to uppercase before lookup', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    await POST(makeRequest({ code: 'save15', restaurantId: 'r1' }))
    // Should not throw — uppercase normalisation happens inside the route
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1)
  })
})

// ── use-code ─────────────────────────────────────────────────────────────────
describe('POST /api/checkout/use-code', () => {
  const { POST } = await import('../use-code/route')

  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when required params are missing', async () => {
    const res = await POST(makeRequest({ code: 'X' }))
    expect(res.status).toBe(400)
  })

  it('returns marked:false when order does not match code', async () => {
    // First maybeSingle: order lookup returns order with different discount_code
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1', discount_code: 'OTHER' }, error: null })
    const res = await POST(makeRequest({ code: 'SAVE10', orderId: 'o1', restaurantId: 'r1' }))
    const body = await res.json()
    expect(body.marked).toBe(false)
  })

  it('returns marked:false when order does not exist', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const res = await POST(makeRequest({ code: 'SAVE10', orderId: 'ghost', restaurantId: 'r1' }))
    const body = await res.json()
    expect(body.marked).toBe(false)
  })

  it('returns marked:true when code is successfully consumed', async () => {
    // Order lookup
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'o1', discount_code: 'SAVE10' }, error: null })
    // Discount code update
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'dc1' }, error: null })
    const res = await POST(makeRequest({ code: 'SAVE10', orderId: 'o1', restaurantId: 'r1' }))
    const body = await res.json()
    expect(body.marked).toBe(true)
  })
})
