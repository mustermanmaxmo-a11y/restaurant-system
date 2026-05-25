// LocalStorage-Helper für anonyme Loyalty-Identifikation.
// Pro Restaurant-Slug wird die zuletzt eingegebene Email gespeichert,
// damit Wiederkehrer ihren Loyalty-Status sehen.

const KEY_PREFIX = 'loyalty_email:'

export function saveLoyaltyEmail(restaurantSlugOrId: string, email: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY_PREFIX + restaurantSlugOrId, email.toLowerCase().trim())
  } catch {
    // Quota/Privacy-Mode: silently ignore
  }
}

export function getLoyaltyEmail(restaurantSlugOrId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(KEY_PREFIX + restaurantSlugOrId)
  } catch {
    return null
  }
}

export function clearLoyaltyEmail(restaurantSlugOrId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY_PREFIX + restaurantSlugOrId)
  } catch {
    // ignore
  }
}
