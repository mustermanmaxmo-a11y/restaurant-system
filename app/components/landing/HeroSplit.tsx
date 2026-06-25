import type { HeroProps } from './types'

export function HeroSplit({ brand, content, ctaHref, restaurantName }: HeroProps) {
  const { colors, font } = brand
  const heading = content.headline || restaurantName

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: 'clamp(360px, 55vw, 520px)' }}>
      {/* Left: text column */}
      <div style={{
        flex: '1 1 300px', padding: '56px 40px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        borderRight: `1px solid ${colors.border}`,
      }}>
        <div>
          <div style={{ color: colors.muted, fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '32px' }}>
            Speisekarte & Bestellung
          </div>
          <h1 style={{
            fontFamily: `${font.heading}, system-ui, sans-serif`,
            fontSize: 'clamp(2rem, 5vw, 3.2rem)',
            fontWeight: 200,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            color: colors.text,
            marginBottom: '24px',
          }}>
            {heading}
          </h1>
          {content.subheadline && (
            <p style={{ color: colors.muted, fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '32px' }}>
              {content.subheadline}
            </p>
          )}
        </div>
        <div>
          <div style={{ color: colors.muted, fontSize: '0.72rem', marginBottom: '16px' }}>Di–So · 12–22 Uhr</div>
          <a href={ctaHref} style={{
            display: 'inline-block', padding: '12px 28px',
            border: `1.5px solid ${colors.text}`,
            color: colors.text, fontWeight: 600,
            fontSize: '0.82rem', letterSpacing: '0.08em',
            textTransform: 'uppercase', textDecoration: 'none',
          }}>
            {content.cta_text || 'Bestellen'}
          </a>
        </div>
      </div>

      {/* Right: image */}
      <div style={{ flex: '1 1 300px', background: colors.surface2, position: 'relative', overflow: 'hidden', minHeight: '260px' }}>
        {content.hero_image_url
          ? <img src={content.hero_image_url} alt={heading} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
          : <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${colors.surface2}, ${colors.border})` }} />
        }
      </div>
    </div>
  )
}
