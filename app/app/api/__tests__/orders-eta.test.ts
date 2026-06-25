import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mock Supabase ─────────────────────────────────────────────────────────────
const mockPresence = vi.fn()
const mockMenuItems = vi.fn()
const mockOpenOrders = vi.fn()
const mockRestaurant = vi.fn()
const mockDeliveries = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        in: () => chain,
        gte: () => chain,
        single: async () => {
          if (table === 'restaurants') return mockRestaurant()
          return { data: null, error: null }
        },
        then: (resolve: Function) => {
          if (table === 'staff_presence') return Promise.resolve(mockPresence()).then(resolve)
          if (table === 'menu_items') return Promise.resolve(mockMenuItems()).then(resolve)
          if (table === 'orders') {
            const callCount = (mockOpenOrders as any)._callCount ?? 0;
            (mockOpenOrders as any)._callCount = callCount + 1
            if (callCount === 0) return Promise.resolve(mockOpenOrders()).then(resolve)
            return Promise.resolve(mockDeliveries()).then(resolve)
          }
          return Promise.resolve({ data: [], error: null }).then(resolve)
        },
      }
      return chain
    },
  }),
}))

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/orders/calculate-eta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/orders/calculate-eta', () => {
  const { POST } = await import('../calculate-eta/route')

  beforeEach(() => {
    vi.clearAllMocks()
    ;(mockOpenOrders as any)._callCount = 0
  })

  it('returns 400 when restaurantId is missing', async () => {
    const res = await POST(makeRequest({ orderItems: [{ item_id: 'i1', qty: 1 }], orderType: 'dine_in' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when orderItems is empty', async () => {
    const res = await POST(makeRequest({ restaurantId: 'r1', orderItems: [], orderType: 'dine_in' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when orderType is missing', async () => {
    const res = await POST(makeRequest({ restaurantId: 'r1', orderItems: [{ item_id: 'i1', qty: 1 }] }))
    expect(res.status).toBe(400)
  })

  it('returns etaMinutes for dine_in order with no queue', async () => {
    mockPresence.mockResolvedValueOnce({ data: [{ id: 's1' }], error: null })
    mockMenuItems.mockResolvedValueOnce({ data: [{ id: 'i1', prep_time: 10 }], error: null })
    mockOpenOrders.mockResolvedValueOnce({ data: [], error: null })

    const res = await POST(makeRequest({ restaurantId: 'r1', orderItems: [{ item_id: 'i1', qty: 2 }], orderType: 'dine_in' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    // 2 items × 10 min / 1 staff = 20 min
    expect(body.etaMinutes).toBe(20)
  })

  it('uses default prep time (15min) when menu item has no prep_time', async () => {
    mockPresence.mockResolvedValueOnce({ data: [], error: null })
    mockMenuItems.mockResolvedValueOnce({ data: [{ id: 'i1', prep_time: null }], error: null })
    mockOpenOrders.mockResolvedValueOnce({ data: [], error: null })

    const res = await POST(makeRequest({ restaurantId: 'r1', orderItems: [{ item_id: 'i1', qty: 1 }], orderType: 'pickup' }))
    const body = await res.json()
    expect(body.etaMinutes).toBe(15)
  })

  it('divides eta by active kitchen staff count', async () => {
    mockPresence.mockResolvedValueOnce({ data: [{ id: 's1' }, { id: 's2' }], error: null })
    mockMenuItems.mockResolvedValueOnce({ data: [{ id: 'i1', prep_time: 20 }], error: null })
    mockOpenOrders.mockResolvedValueOnce({ data: [], error: null })

    const res = await POST(makeRequest({ restaurantId: 'r1', orderItems: [{ item_id: 'i1', qty: 2 }], orderType: 'dine_in' }))
    const body = await res.json()
    // 2 × 20 = 40 / 2 staff = 20
    expect(body.etaMinutes).toBe(20)
  })
})
