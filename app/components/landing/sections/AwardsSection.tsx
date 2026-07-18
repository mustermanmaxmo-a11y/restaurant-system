import type { ResolvedBrand } from '@/lib/resolve-brand'
import type { Award } from '@/lib/landing-content'

interface Props {
  brand: ResolvedBrand
  awards: Award[]
}

export function AwardsSection({ brand, awards }: Props) {
  const { colors } = brand
  return (
    <section style={{ padding: '40px 24px', borderTop: `1px solid ${colors.border}`, background: colors.surface }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: colors.accent, marginBottom: '20px', fontWeight: 700 }}>
          Auszeichnungen & Presse
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {awards.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '14px 16px' }}>
              {a.logo_url ? (
                <img loading="lazy" decoding="async" src={a.logo_url} alt="" style={{ width: '48px', height: '48px', objectFit: 'contain', flexShrink: 0 }} />
              ) : (
                <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>🏆</span>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ color: colors.text, fontWeight: 700, fontSize: '0.9rem' }}>{a.title}</div>
                {a.subtitle && <div style={{ color: colors.muted, fontSize: '0.78rem' }}>{a.subtitle}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
