import type { ColorSet } from '@/lib/color-utils'
import type { FontPair } from '@/lib/font-pairs'

interface SiteFooterProps {
  colors: ColorSet
  font: FontPair
  restaurantName: string
}

export function SiteFooter({ colors, font, restaurantName }: SiteFooterProps) {
  return (
    <footer style={{ padding: '28px 24px', borderTop: `1px solid ${colors.border}`, textAlign: 'center', background: colors.bg }}>
      <div style={{ color: colors.muted, fontFamily: `${font.heading}, Georgia, serif`, fontStyle: 'italic', fontSize: '0.9rem', marginBottom: '10px' }}>
        {restaurantName}
      </div>
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <a href="/impressum" style={{ color: colors.muted, fontSize: '0.72rem', textDecoration: 'none' }}>Impressum</a>
        <a href="/datenschutz" style={{ color: colors.muted, fontSize: '0.72rem', textDecoration: 'none' }}>Datenschutz</a>
        <span style={{ color: colors.muted, fontSize: '0.72rem' }}>© {new Date().getFullYear()}</span>
      </div>
    </footer>
  )
}
