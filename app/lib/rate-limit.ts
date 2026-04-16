import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Rate limiter backed by Upstash Redis.
 * Works correctly on Vercel serverless (shared state across all instances).
 * Requires UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN env vars.
 *
 * Falls back to allowing the request if Redis is not configured (dev mode).
 */

let redis: Redis | null = null
const limiters = new Map<string, Ratelimit>()

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return redis
}

function getLimiter(limit: number, windowMs: number): Ratelimit | null {
  const r = getRedis()
  if (!r) return null

  const cacheKey = `${limit}:${windowMs}`
  if (!limiters.has(cacheKey)) {
    limiters.set(cacheKey, new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      analytics: false,
    }))
  }
  return limiters.get(cacheKey)!
}

/**
 * Returns true if the request is allowed, false if rate-limited.
 * @param key     Unique key (e.g. IP address or "ip:route")
 * @param limit   Max requests per window
 * @param windowMs Window size in milliseconds
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const limiter = getLimiter(limit, windowMs)

  // No Redis configured → allow all (dev/fallback)
  if (!limiter) return true

  const { success } = await limiter.limit(key)
  return success
}

/** Extract client IP from Next.js request headers */
export function getClientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    headers.get('x-real-ip') ??
    'unknown'
  )
}
