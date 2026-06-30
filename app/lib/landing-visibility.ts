import type { LandingPageContent, SectionKey } from './landing-content'

/**
 * Eine Sektion ist sichtbar, solange der Betreiber sie nicht explizit
 * deaktiviert hat. Default (kein Eintrag) = sichtbar.
 * Die zusätzliche Inhalts-Prüfung (hat die Sektion überhaupt Daten?)
 * bleibt am jeweiligen Render-Ort.
 */
export function isSectionVisible(key: SectionKey, content: LandingPageContent): boolean {
  return content.section_visibility?.[key] !== false
}
