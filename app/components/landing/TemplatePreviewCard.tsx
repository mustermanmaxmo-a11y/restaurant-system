'use client'

interface TemplateConfig {
  bg_color?: string
  surface_color?: string
  primary_color?: string
  button_color?: string
  text_color?: string
  hero_layout?: string
  font_pair?: string
  border_radius?: string
  [key: string]: unknown
}

interface TemplatePreviewCardProps {
  config: TemplateConfig
  name: string
}

export function TemplatePreviewCard({ config, name }: TemplatePreviewCardProps) {
  const bg = config.bg_color ?? '#ffffff'
  const surface = config.surface_color ?? '#f5f5f5'
  const accent = config.primary_color ?? '#333333'
  const text = config.text_color ?? '#111111'
  const heroLayout = config.hero_layout ?? 'classic-overlay'
  const isLight = parseInt(bg.replace('#', '').substring(0, 2), 16) > 180

  const muted = isLight ? '#888' : '#666'
  const radius = config.border_radius === 'sharp' ? '3px' : config.border_radius === 'pill' ? '20px' : '10px'

  return (
    <div style={{
      width: '100%', height: '120px',
      borderRadius: '8px', overflow: 'hidden',
      background: bg, position: 'relative',
      border: `1px solid ${isLight ? '#e5e5e5' : '#2a2a2a'}`,
    }}>
      {heroLayout === 'classic-overlay' && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${accent}22, ${bg})` }} />
          <div style={{ position: 'relative', padding: '16px', textAlign: 'center' }}>
            <div style={{ width: '40px', height: '2px', background: accent, margin: '0 auto 6px' }} />
            <div style={{ color: text, fontSize: '11px', fontWeight: 700, fontStyle: 'italic', marginBottom: '4px' }}>{name}</div>
            <div style={{ width: '24px', height: '1px', background: accent, margin: '0 auto 8px', opacity: 0.6 }} />
            <div style={{ display: 'inline-block', background: accent, color: '#fff', fontSize: '7px', padding: '3px 10px', borderRadius: radius, fontWeight: 700 }}>Bestellen</div>
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', background: surface, borderTop: `1px solid ${isLight ? '#eee' : '#333'}` }}>
            {['Zeit', 'Tisch', 'Status'].map(l => (
              <div key={l} style={{ flex: 1, padding: '5px', textAlign: 'center', fontSize: '6px', color: muted }}>{l}</div>
            ))}
          </div>
        </>
      )}
      {heroLayout === 'bold-statement' && (
        <div style={{ padding: '12px' }}>
          <div style={{ color: text, fontSize: '7px', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '4px', opacity: 0.6 }}>{name.toUpperCase()}</div>
          <div style={{ color: text, fontSize: '22px', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.03em' }}>BOLD</div>
          <div style={{ color: accent, fontSize: '22px', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.03em' }}>FOOD.</div>
          <div style={{ display: 'inline-block', background: accent, color: '#fff', fontSize: '7px', padding: '4px 10px', borderRadius: radius, marginTop: '8px', fontWeight: 700 }}>Bestellen →</div>
        </div>
      )}
      {heroLayout === 'split' && (
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: `1px solid ${isLight ? '#eee' : '#333'}` }}>
            <div>
              <div style={{ color: muted, fontSize: '5px', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '6px' }}>Speisekarte</div>
              <div style={{ color: text, fontSize: '13px', fontWeight: 200, lineHeight: 1.1 }}>{name}</div>
            </div>
            <div style={{ display: 'inline-block', border: `1.5px solid ${text}`, color: text, fontSize: '6px', padding: '4px 8px', fontWeight: 600 }}>BESTELLEN</div>
          </div>
          <div style={{ flex: 1, background: `linear-gradient(135deg, ${surface}, ${isLight ? '#e8e8e8' : '#2a2a2a'})` }} />
        </div>
      )}
      {heroLayout === 'centered-minimal' && (
        <div style={{ padding: '12px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: `${accent}18`, border: `1px solid ${accent}30`, borderRadius: '20px', padding: '2px 8px', marginBottom: '8px' }}>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: accent }} />
            <span style={{ color: accent, fontSize: '5px', fontWeight: 600 }}>Geöffnet</span>
          </div>
          <div style={{ color: text, fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>{name}</div>
          <div style={{ display: 'inline-block', background: accent, color: '#fff', fontSize: '6px', padding: '4px 14px', borderRadius: radius, fontWeight: 600 }}>Bestellen</div>
        </div>
      )}
      {heroLayout === 'gradient-glow' && (
        <div style={{ padding: '12px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '60px', height: '60px', borderRadius: '50%', background: `radial-gradient(circle, ${accent}40 0%, transparent 70%)` }} />
          <div style={{ color: text, fontSize: '18px', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.03em', position: 'relative' }}>{name.split(' ')[0] ?? name}</div>
          <div style={{ fontSize: '18px', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.03em', background: `linear-gradient(90deg, #FF6B6B, ${accent})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', position: 'relative' } as React.CSSProperties}>
            {name.split(' ').slice(1).join(' ') || 'Food'}
          </div>
          <div style={{ display: 'inline-block', marginTop: '8px', background: `linear-gradient(90deg, #FF6B6B, ${accent})`, color: '#fff', fontSize: '6px', padding: '4px 10px', borderRadius: radius, fontWeight: 700 }}>Bestellen</div>
        </div>
      )}
    </div>
  )
}
