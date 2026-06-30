export type SiteNavKey = 'start' | 'speisekarte' | 'reservieren' | 'kontakt'

export interface SiteNavItem {
  key: SiteNavKey
  label: string
  href: string
  active: boolean
}

/**
 * Einzige Quelle der seitenübergreifenden Navigation (Website-Dach).
 * `active` markiert den Link der aktuellen Seite.
 */
export function buildSiteNav(slug: string, active?: SiteNavKey): SiteNavItem[] {
  const defs: { key: SiteNavKey; label: string; href: string }[] = [
    { key: 'start', label: 'Start', href: `/${slug}/info` },
    { key: 'speisekarte', label: 'Speisekarte', href: `/bestellen/${slug}` },
    { key: 'reservieren', label: 'Reservieren', href: `/bestellen/${slug}?tab=reserve` },
    { key: 'kontakt', label: 'Kontakt', href: `/${slug}/info#kontakt` },
  ]
  return defs.map(d => ({ ...d, active: d.key === active }))
}
