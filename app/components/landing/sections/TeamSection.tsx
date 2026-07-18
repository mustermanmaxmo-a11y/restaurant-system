import type { ResolvedBrand } from '@/lib/resolve-brand'
import type { TeamMember } from '@/lib/landing-content'

interface Props {
  brand: ResolvedBrand
  team: TeamMember[]
}

export function TeamSection({ brand, team }: Props) {
  const { colors } = brand
  return (
    <section style={{ padding: '40px 24px', borderTop: `1px solid ${colors.border}` }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: colors.accent, marginBottom: '20px', fontWeight: 700 }}>
          Unser Team
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '18px' }}>
          {team.map((m, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              {m.photo_url ? (
                <img loading="lazy" decoding="async" src={m.photo_url} alt={m.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '14px', marginBottom: '10px' }} />
              ) : (
                <div style={{ width: '100%', aspectRatio: '1', borderRadius: '14px', marginBottom: '10px', background: colors.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 700, color: colors.muted }}>
                  {m.name.charAt(0)}
                </div>
              )}
              <div style={{ color: colors.text, fontWeight: 700, fontSize: '0.9rem' }}>{m.name}</div>
              <div style={{ color: colors.muted, fontSize: '0.78rem' }}>{m.role}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
