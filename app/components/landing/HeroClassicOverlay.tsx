import type { HeroProps } from './types'

export function HeroClassicOverlay({ brand, content, ctaHref, restaurantName }: HeroProps) {
  const { colors, font } = brand
  const heading = content.headline || restaurantName
  const hasImage = Boolean(content.hero_image_url)

  return (
    <div style={{ fontFamily: `${font.body}, system-ui, sans-serif` }}>
      {/* ── Hero ── */}
      <header style={{
        position: 'relative',
        minHeight: 'clamp(320px, 50vw, 480px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 24px',
        textAlign: 'center',
        overflow: 'hidden',
        background: hasImage
          ? `url(${content.hero_image_url}) center/cover no-repeat`
          : `linear-gradient(160deg, ${colors.accent}18 0%, ${colors.bg} 100%)`,
      }}>
        {hasImage && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.65) 100%)',
          }} />
        )}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '600px', width: '100%' }}>
          <div style={{
            color: hasImage ? 'rgba(255,255,255,0.7)' : colors.muted,
            fontSize: '0.65rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: '16px',
          }}>
            {content.subheadline ? '' : 'Willkommen'}
          </div>
          <h1 style={{
            fontFamily: `${font.heading}, Georgia, serif`,
            fontSize: 'clamp(2.2rem, 7vw, 4rem)',
            fontWeight: 700,
            fontStyle: 'italic',
            lineHeight: 1.1,
            color: hasImage ? '#ffffff' : colors.text,
            letterSpacing: '-0.01em',
            marginBottom: '12px',
            textShadow: hasImage ? '0 2px 10px rgba(0,0,0,0.5)' : 'none',
          }}>
            {heading}
          </h1>
          <div style={{
            width: '48px', height: '1.5px',
            background: colors.accent,
            margin: '16px auto',
            opacity: 0.8,
          }} />
          {content.subheadline && (
            <p style={{
              color: hasImage ? 'rgba(255,255,255,0.85)' : colors.muted,
              fontSize: '1rem',
              lineHeight: 1.6,
              marginBottom: '28px',
              textShadow: hasImage ? '0 1px 4px rgba(0,0,0,0.4)' : 'none',
            }}>
              {content.subheadline}
            </p>
          )}
          <a href={ctaHref} style={{
            display: 'inline-block',
            padding: '14px 36px',
            borderRadius: '6px',
            background: colors.buttonBg,
            color: colors.buttonText,
            fontWeight: 700,
            fontSize: '0.9rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            boxShadow: `0 4px 20px ${colors.accent}44`,
            textDecoration: 'none',
          }}>
            {content.cta_text || 'Jetzt bestellen'}
          </a>
        </div>
      </header>

      {/* ── Info strip ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1px 1fr 1px 1fr',
        background: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        padding: '16px 24px',
      }}>
        {[
          { label: 'Heute', value: '11–23 Uhr' },
          null,
          { label: 'Küche', value: 'Geöffnet' },
          null,
          { label: 'Bestellung', value: 'Am Tisch' },
        ].map((item, i) =>
          item === null
            ? <div key={i} style={{ background: colors.border }} />
            : (
              <div key={i} style={{ textAlign: 'center', padding: '0 12px' }}>
                <div style={{ color: colors.muted, fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>{item.label}</div>
                <div style={{ color: colors.text, fontSize: '0.82rem', fontWeight: 700 }}>{item.value}</div>
              </div>
            )
        )}
      </div>

      {/* ── About ── */}
      {content.about_text && (
        <section style={{ padding: '56px 24px', maxWidth: '680px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: `${font.heading}, Georgia, serif`, fontStyle: 'italic', fontSize: '1.8rem', color: colors.text, marginBottom: '16px' }}>Über uns</h2>
          <p style={{ color: colors.muted, lineHeight: 1.8, fontSize: '1rem' }}>{content.about_text}</p>
        </section>
      )}

      {/* ── Menu CTA ── */}
      <section style={{ padding: '40px 24px', background: colors.surface, borderTop: `1px solid ${colors.border}` }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ color: colors.accent, fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Speisekarte</div>
            <div style={{ color: colors.text, fontFamily: `${font.heading}, Georgia, serif`, fontStyle: 'italic', fontSize: '1.4rem' }}>Alle Gerichte entdecken</div>
          </div>
          <a href={ctaHref} style={{ padding: '12px 28px', borderRadius: '6px', background: colors.buttonBg, color: colors.buttonText, fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}>
            Zur Karte
          </a>
        </div>
      </section>

      <footer style={{ padding: '24px', textAlign: 'center', color: colors.muted, fontSize: '0.75rem', borderTop: `1px solid ${colors.border}` }}>
        {restaurantName}
      </footer>
    </div>
  )
}
