import type { HeroProps } from './types'

export function HeroBoldStatement({ brand, content, ctaHref, restaurantName, featuredItems = [] }: HeroProps) {
  const { colors, font } = brand
  const lines = (content.headline || restaurantName).split(' ')
  const firstWord = lines[0] ?? restaurantName
  const restWords = lines.slice(1).join(' ')

  return (
    <div style={{ fontFamily: `${font.body}, system-ui, sans-serif`, background: colors.bg, color: colors.text, minHeight: '100vh' }}>
      {/* ── Header bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: '12px', borderBottom: `1px solid ${colors.border}` }}>
        {brand.logoUrl && (
          <img src={brand.logoUrl} alt={restaurantName} style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }} />
        )}
        <span style={{ fontFamily: `${font.heading}, system-ui, sans-serif`, fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.05em' }}>{restaurantName}</span>
        <div style={{ marginLeft: 'auto', background: colors.accent, color: colors.buttonText, fontSize: '0.65rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px' }}>OFFEN</div>
      </div>

      {/* ── Statement ── */}
      <div style={{ padding: '36px 20px 24px' }}>
        <div style={{ fontFamily: `${font.heading}, system-ui, sans-serif`, fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.03em' }}>
          <div style={{ fontSize: 'clamp(3rem, 12vw, 5.5rem)', color: colors.text }}>{firstWord}</div>
          {restWords && (
            <div style={{ fontSize: 'clamp(3rem, 12vw, 5.5rem)', color: colors.accent }}>{restWords}.</div>
          )}
        </div>
        {content.subheadline && (
          <div style={{ color: colors.muted, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '16px' }}>
            {content.subheadline}
          </div>
        )}
        <a href={ctaHref} style={{
          display: 'inline-block', marginTop: '24px',
          padding: '14px 32px', borderRadius: '10px',
          background: colors.buttonBg, color: colors.buttonText,
          fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.02em',
          textDecoration: 'none',
          boxShadow: `0 4px 24px ${colors.accent}44`,
        }}>
          {content.cta_text || 'Jetzt bestellen'}
        </a>
      </div>

      {/* ── Featured preview strip ── */}
      {featuredItems.length > 0 && (
        <div style={{ padding: '0 20px 32px' }}>
          <div style={{ fontSize: '0.6rem', color: colors.muted, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '12px' }}>Highlights</div>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '4px' }}>
            {featuredItems.map(item => (
              <a key={item.id} href={ctaHref} style={{
                flexShrink: 0, width: '120px',
                background: colors.surface, borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                overflow: 'hidden', textDecoration: 'none',
              }}>
                {item.image_url
                  ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '70px', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '70px', background: colors.surface2 }} />
                }
                <div style={{ padding: '8px' }}>
                  <div style={{ color: colors.text, fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                  <div style={{ color: colors.accent, fontSize: '0.7rem', fontWeight: 800, marginTop: '2px' }}>{item.price.toFixed(2).replace('.', ',')} €</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── About ── */}
      {content.about_text && (
        <section style={{ padding: '32px 20px', borderTop: `1px solid ${colors.border}` }}>
          <div style={{ color: colors.muted, lineHeight: 1.7, fontSize: '0.9rem', maxWidth: '600px' }}>{content.about_text}</div>
        </section>
      )}

      <footer style={{ padding: '20px', textAlign: 'center', color: colors.muted, fontSize: '0.72rem', borderTop: `1px solid ${colors.border}` }}>
        {restaurantName}
      </footer>
    </div>
  )
}
