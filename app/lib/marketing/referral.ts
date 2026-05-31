// localStorage-Helper für Referral-Code-Attribution.
// Speichert den ?ref= URL-Parameter über Tab-Closes hinweg (30 Tage TTL).

const KEY_PREFIX = 'referral_ref:'
const TTL_MS = 30 * 24 * 60 * 60 * 1000

interface StoredRef {
  code: string
  savedAt: number
}

export function saveReferralRef(restaurantSlug: string, code: string): void {
  if (typeof window === 'undefined') return
  try {
    const entry: StoredRef = { code: code.toUpperCase().trim(), savedAt: Date.now() }
    window.localStorage.setItem(KEY_PREFIX + restaurantSlug, JSON.stringify(entry))
  } catch {
    // Quota/Privacy-Mode: silently ignore
  }
}

export function getReferralRef(restaurantSlug: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + restaurantSlug)
    if (!raw) return null
    const entry: StoredRef = JSON.parse(raw)
    if (Date.now() - entry.savedAt > TTL_MS) {
      window.localStorage.removeItem(KEY_PREFIX + restaurantSlug)
      return null
    }
    return entry.code
  } catch {
    return null
  }
}

export function clearReferralRef(restaurantSlug: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY_PREFIX + restaurantSlug)
  } catch {
    // ignore
  }
}
