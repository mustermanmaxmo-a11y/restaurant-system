import type { HeroProps } from './types'

const DIETARY_TAGS = ['🌱 Vegan', '🌾 Glutenfrei', '♻️ Bio', '🥦 Regional']

export function HeroCenteredMinimal({ brand, content, ctaHref, restaurantName }: HeroProps) {
  const { colors, font } = brand
  const heading = content.headline || restaurantName
  const radius = '999px'

  return (
    <div style={{ fontFamily: `${font.body}, system-ui, sans-serif`, background: colors.bg, color: colors.text, minHeight: '100vh' }}>
      {/* ── Hero: centered, no bg image ── */}
      <header style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '72px 24px 48px', textAlign: 'center' }}>
        {brand.logoUrl && (
          <img src={brand.logoUrl} alt={restaurantName} style={{ width: '64px', height: '64px', borderRadius: '16px', objectFit: 'cover', marginBottom: '24px' }} />
        )}

        {/* Status pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: `${colors.accent}18`, border: `1px solid ${colors.accent}40`,
          borderRadius: radius, padding: '5px 14px', marginBottom: '24px',
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors.accent }} />
          <span style={{ color: colors.accent, fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.05em' }}>Küche geöffnet</span>
        </div>

        <h1 style={{
          fontFamily: `${font.heading}, system-ui, sans-serif`,
          fontSize: 'clamp(2rem, 6vw, 3.5rem)',
          fontWeight: 600,
          color: colors.text,
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          marginBottom: '12px',
        }}>
          {heading}
        </h1>

        {content.subheadline && (
          <p style={{ color: colors.muted, fontSize: '0.95rem', lineHeight: 1.6, maxWidth: '400px', marginBottom: '28px' }}>
            {content.subheadline}
          </p>
        )}

        <a href={ctaHref} style={{
          display: 'inline-block', padding: '14px 36px',
          borderRadius: radius,
          background: colors.buttonBg, color: colors.buttonText,
          fontWeight: 600, fontSize: '0.9rem',
          textDecoration: 'none',
          marginBottom: '28px',
        }}>
          {content.cta_text || 'Jetzt bestellen'}
        </a>

        {/* Dietary tags */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {DIETARY_TAGS.map(tag => (
            <span key={tag} style={{
              background: `${colors.accent}14`,
              border: `1px solid ${colors.accent}30`,
              borderRadius: radius, padding: '4px 12px',
              color: colors.text, fontSize: '0.72rem',
            }}>
              {tag}
            </span>
          ))}
        </div>
      </header>

      {/* ── About ── */}
      {content.about_text && (
        <section style={{ padding: '40px 24px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{ color: colors.muted, lineHeight: 1.8 }}>{content.about_text}</p>
        </section>
      )}

      {/* ── Menu CTA ── */}
      <section style={{ padding: '32px 24px', background: colors.surface, borderTop: `1px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ maxWidth: '560px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ color: colors.text, fontSize: '1rem', fontWeight: 600 }}>Speisekarte entdecken</div>
          <a href={ctaHref} style={{ padding: '10px 24px', borderRadius: radius, background: colors.buttonBg, color: colors.buttonText, fontWeight: 600, fontSize: '0.82rem', textDecoration: 'none' }}>
            Zur Karte
          </a>
        </div>
      </section>

      <footer style={{ padding: '24px', textAlign: 'center', color: colors.muted, fontSize: '0.72rem' }}>
        {restaurantName}
      </footer>
    </div>
  )
}
