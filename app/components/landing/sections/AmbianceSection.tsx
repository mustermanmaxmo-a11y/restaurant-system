import type { ResolvedBrand } from '@/lib/resolve-brand'

interface Props {
  brand: ResolvedBrand
  images: string[]
}

export function AmbianceSection({ brand, images }: Props) {
  const { colors } = brand
  return (
    <section style={{ padding: '40px 24px', borderTop: `1px solid ${colors.border}` }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: colors.accent, marginBottom: '20px', fontWeight: 700 }}>
          Atmosphäre
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {images.map((url, i) => (
            <img key={i} src={url} alt="" style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '14px' }} />
          ))}
        </div>
      </div>
    </section>
  )
}
