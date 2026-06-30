import type { ResolvedBrand } from '@/lib/resolve-brand'

interface Props {
  brand: ResolvedBrand
  storyText: string
  imageUrl?: string
  foundedYear?: string
}

export function StorySection({ brand, storyText, imageUrl, foundedYear }: Props) {
  const { colors, font } = brand
  return (
    <section style={{ padding: '40px 24px', borderTop: `1px solid ${colors.border}` }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'grid', gridTemplateColumns: imageUrl ? 'minmax(0, 1fr) minmax(0, 1fr)' : '1fr', gap: '28px', alignItems: 'center' }}>
        {imageUrl && (
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', maxHeight: '360px', objectFit: 'cover', borderRadius: '16px' }} />
        )}
        <div>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: colors.accent, marginBottom: '12px', fontWeight: 700 }}>
            Unsere Geschichte
          </div>
          {foundedYear && (
            <div style={{ fontFamily: `${font.heading}, Georgia, serif`, fontStyle: 'italic', fontSize: '1.8rem', color: colors.text, marginBottom: '12px', fontWeight: 700 }}>
              Seit {foundedYear}
            </div>
          )}
          <p style={{ color: colors.muted, lineHeight: 1.8, fontSize: '0.95rem', whiteSpace: 'pre-line' }}>{storyText}</p>
        </div>
      </div>
    </section>
  )
}
