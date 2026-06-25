import type { HeroProps } from './types'

export function HeroGradientGlow({ brand, content, ctaHref, restaurantName }: HeroProps) {
  const { colors, font } = brand
  const secondary = colors.accentSecondary
  const heading = content.headline || restaurantName
  const lines = heading.split(' ')
  const firstLine = lines.slice(0, Math.ceil(lines.length / 2)).join(' ')
  const secondLine = lines.slice(Math.ceil(lines.length / 2)).join(' ')

  const gradientBg = `linear-gradient(90deg, ${secondary}, ${colors.accent})`

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* ── Ambient glows ── */}
      <div style={{ position: 'fixed', top: '-100px', right: '-80px', width: '300px', height: '300px', borderRadius: '50%', background: `radial-gradient(circle, ${colors.accent}30 0%, transparent 70%)`, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-60px', left: '40px', width: '200px', height: '200px', borderRadius: '50%', background: `radial-gradient(circle, ${secondary}25 0%, transparent 70%)`, pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {brand.logoUrl && <img src={brand.logoUrl} alt={restaurantName} style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }} />}
            <span style={{ fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.02em' }}>{restaurantName}</span>
          </div>
          <div style={{ background: `${colors.accent}22`, border: `1px solid ${colors.accent}44`, color: colors.accent, fontSize: '0.6rem', padding: '3px 10px', borderRadius: '20px', fontWeight: 700 }}>OFFEN</div>
        </div>

        {/* ── Statement hero ── */}
        <div style={{ padding: '32px 20px 28px' }}>
          <div style={{ fontFamily: `${font.heading}, system-ui, sans-serif`, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em', fontSize: 'clamp(2.5rem, 10vw, 4.5rem)' }}>
            <div>{firstLine}</div>
            {secondLine && (
              <div style={{
                background: gradientBg,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              } as React.CSSProperties}>
                {secondLine}
              </div>
            )}
          </div>
          {content.subheadline && (
            <div style={{ color: colors.muted, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '16px' }}>{content.subheadline}</div>
          )}
          <a href={ctaHref} style={{
            display: 'inline-block', marginTop: '24px',
            padding: '14px 32px', borderRadius: '10px',
            background: gradientBg,
            color: '#ffffff',
            fontWeight: 700, fontSize: '0.9rem',
            textDecoration: 'none',
            boxShadow: `0 4px 24px ${colors.accent}44`,
          }}>
            {content.cta_text || 'Jetzt bestellen'}
          </a>
        </div>

        {/* ── Category chips ── */}
        <div style={{ display: 'flex', gap: '8px', padding: '0 20px 28px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {['Alles', 'Empfehlungen', 'Gerichte', 'Getränke'].map((cat, i) => (
            <div key={cat} style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: '20px', fontSize: '0.72rem',
              background: i === 0 ? gradientBg : `${colors.accent}12`,
              border: i === 0 ? 'none' : `1px solid ${colors.accent}30`,
              color: i === 0 ? '#fff' : colors.accent,
              fontWeight: i === 0 ? 700 : 400,
            }}>
              {cat}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
