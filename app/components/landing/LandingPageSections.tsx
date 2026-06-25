// app/components/landing/LandingPageSections.tsx
import type { ResolvedBrand } from '@/lib/resolve-brand'
import type { LandingPageContent, OpeningHours } from '@/lib/landing-content'
import type { FeaturedItem } from './types'

interface Props {
  brand: ResolvedBrand
  content: LandingPageContent
  restaurantName: string
  slug: string
  featuredItems: FeaturedItem[]
}

const DAY_LABELS: Record<string, string> = {
  mo: 'Montag', di: 'Dienstag', mi: 'Mittwoch', do: 'Donnerstag',
  fr: 'Freitag', sa: 'Samstag', so: 'Sonntag',
}
const DAY_ORDER = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so']

function getTodayKey(): string {
  const d = new Date().getDay()
  return DAY_ORDER[d === 0 ? 6 : d - 1]
}

function hasAnyOpeningHours(oh: OpeningHours): boolean {
  return DAY_ORDER.some(d => oh[d as keyof OpeningHours] !== undefined)
}

export function LandingPageSections({ brand, content, restaurantName, slug, featuredItems }: Props) {
  const { colors, font } = brand
  const todayKey = getTodayKey()

  const sectionStyle = {
    padding: '40px 24px',
    borderTop: `1px solid ${colors.border}`,
  }
  const innerStyle = {
    maxWidth: '680px',
    margin: '0 auto',
  }
  const sectionLabel = {
    fontSize: '0.65rem' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    color: colors.accent,
    marginBottom: '20px',
    fontWeight: 700,
  }

  return (
    <>
      {/* ── 1. Info-Strip ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1px 1fr 1px 1fr',
        background: colors.surface,
        borderTop: `1px solid ${colors.border}`,
        borderBottom: `1px solid ${colors.border}`,
        padding: '16px 24px',
      }}>
        {(() => {
          const today = content.opening_hours?.[todayKey as keyof OpeningHours]
          const todayStr = today?.open && today.from && today.to ? `${today.from}–${today.to} Uhr` : today?.open === false ? 'Geschlossen' : '–'
          return [
            { label: 'Heute', value: todayStr },
            null,
            { label: 'Küche', value: today?.open === false ? 'Geschlossen' : 'Geöffnet' },
            null,
            { label: 'Bestellung', value: 'Am Tisch & Online' },
          ].map((item, i) =>
            item === null
              ? <div key={i} style={{ background: colors.border }} />
              : (
                <div key={i} style={{ textAlign: 'center', padding: '0 12px' }}>
                  <div style={{ color: colors.muted, fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>{item.label}</div>
                  <div style={{ color: colors.text, fontSize: '0.82rem', fontWeight: 700 }}>{item.value}</div>
                </div>
              )
          )
        })()}
      </div>

      {/* ── 2. Galerie ── */}
      {(content.gallery ?? []).length > 0 && (
        <section style={sectionStyle}>
          <div style={innerStyle}>
            <div style={sectionLabel}>Unsere Küche</div>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '4px' }}>
              {content.gallery!.map((url, i) => (
                <img key={i} src={url} alt="" style={{
                  flexShrink: 0, width: '160px', height: '120px',
                  objectFit: 'cover', borderRadius: '10px',
                }} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 3. Featured Menu ── */}
      {featuredItems.length > 0 && (
        <section style={sectionStyle}>
          <div style={innerStyle}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={sectionLabel}>Highlights</div>
              <a href={`/bestellen/${slug}`} style={{ fontSize: '0.75rem', color: colors.accent, textDecoration: 'none' }}>Zur Speisekarte →</a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {featuredItems.slice(0, 4).map(item => (
                <a key={item.id} href={`/bestellen/${slug}`} style={{ textDecoration: 'none', background: colors.surface, borderRadius: '10px', border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '110px', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '110px', background: colors.surface }} />
                  }
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ color: colors.text, fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px' }}>{item.name}</div>
                    <div style={{ color: colors.accent, fontSize: '0.8rem', fontWeight: 800 }}>{item.price.toFixed(2).replace('.', ',')} €</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Über uns ── */}
      {content.about_text && (
        <section style={sectionStyle}>
          <div style={innerStyle}>
            <h2 style={{ fontFamily: `${font.heading}, Georgia, serif`, fontStyle: 'italic', fontSize: '1.6rem', color: colors.text, marginBottom: '14px', fontWeight: 700 }}>Über uns</h2>
            <p style={{ color: colors.muted, lineHeight: 1.8, fontSize: '0.95rem' }}>{content.about_text}</p>
          </div>
        </section>
      )}

      {/* ── 5. Öffnungszeiten ── */}
      {content.opening_hours && hasAnyOpeningHours(content.opening_hours) && (
        <section style={sectionStyle}>
          <div style={innerStyle}>
            <div style={sectionLabel}>Öffnungszeiten</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {DAY_ORDER.map(dayKey => {
                  const day = content.opening_hours![dayKey as keyof OpeningHours]
                  if (!day) return null
                  const isToday = dayKey === todayKey
                  return (
                    <tr key={dayKey} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: '10px 0', fontSize: '0.85rem', color: colors.text, fontWeight: isToday ? 700 : 400 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isToday ? (day.open ? colors.accent : '#ef4444') : 'transparent', display: 'inline-block', flexShrink: 0, border: isToday ? 'none' : `1px solid transparent` }} />
                          {DAY_LABELS[dayKey]}
                        </span>
                      </td>
                      <td style={{ padding: '10px 0', fontSize: '0.85rem', color: day.open ? colors.text : colors.muted, textAlign: 'right', fontWeight: isToday ? 700 : 400 }}>
                        {day.open && day.from && day.to ? `${day.from} – ${day.to} Uhr` : 'Geschlossen'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 6. Bewertungen ── */}
      {content.google_rating != null && (
        <section style={{ ...sectionStyle, background: colors.surface }}>
          <div style={innerStyle}>
            <div style={sectionLabel}>Bewertungen</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div style={{ fontFamily: `${font.heading}, Georgia, serif`, fontSize: '3.5rem', fontWeight: 700, color: colors.text, lineHeight: 1 }}>
                {content.google_rating.toFixed(1)}
              </div>
              <div>
                <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
                  {[1,2,3,4,5].map(s => (
                    <span key={s} style={{ color: s <= Math.round(content.google_rating!) ? '#f59e0b' : colors.border, fontSize: '1rem' }}>★</span>
                  ))}
                </div>
                {content.google_review_count && (
                  <div style={{ color: colors.muted, fontSize: '0.78rem' }}>{content.google_review_count} Google-Bewertungen</div>
                )}
              </div>
            </div>
            {(content.review_quotes ?? []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {content.review_quotes!.slice(0, 3).map((q, i) => (
                  <div key={i} style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '14px 16px' }}>
                    <div style={{ color: colors.text, fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '8px' }}>"{q.text}"</div>
                    <div style={{ color: colors.muted, fontSize: '0.72rem', fontWeight: 600 }}>— {q.author}</div>
                  </div>
                ))}
              </div>
            )}
            {content.google_maps_url && (
              <a href={content.google_maps_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '16px', color: colors.accent, fontSize: '0.78rem', textDecoration: 'none' }}>
                Alle Bewertungen auf Google lesen →
              </a>
            )}
          </div>
        </section>
      )}

      {/* ── 7. Reservierung CTA ── */}
      <section style={{ padding: '56px 24px', background: colors.accent, textAlign: 'center' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '12px' }}>Reservierung</div>
          <h2 style={{ fontFamily: `${font.heading}, Georgia, serif`, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 700, fontStyle: 'italic', color: '#ffffff', marginBottom: '12px' }}>
            Tisch reservieren
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem', marginBottom: '28px' }}>
            Für besondere Anlässe oder einfach um sicher zu gehen — reserviere deinen Tisch direkt online.
          </p>
          <a href={`/bestellen/${slug}?tab=reserve`} style={{
            display: 'inline-block', padding: '14px 36px', borderRadius: '8px',
            background: '#ffffff', color: colors.accent,
            fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none',
          }}>
            Jetzt reservieren
          </a>
        </div>
      </section>

      {/* ── 8. Kontakt & Anfahrt ── */}
      {(content.address || content.phone || content.email) && (
        <section style={sectionStyle}>
          <div style={innerStyle}>
            <div style={sectionLabel}>Kontakt & Anfahrt</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {content.address && (
                <a
                  href={content.maps_url || `https://maps.google.com?q=${encodeURIComponent(content.address)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', textDecoration: 'none' }}
                >
                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>📍</span>
                  <span style={{ color: colors.text, fontSize: '0.9rem', lineHeight: 1.5 }}>{content.address}</span>
                </a>
              )}
              {content.phone && (
                <a href={`tel:${content.phone}`} style={{ display: 'flex', gap: '12px', alignItems: 'center', textDecoration: 'none' }}>
                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>📞</span>
                  <span style={{ color: colors.text, fontSize: '0.9rem' }}>{content.phone}</span>
                </a>
              )}
              {content.email && (
                <a href={`mailto:${content.email}`} style={{ display: 'flex', gap: '12px', alignItems: 'center', textDecoration: 'none' }}>
                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>✉️</span>
                  <span style={{ color: colors.text, fontSize: '0.9rem' }}>{content.email}</span>
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 9. Instagram ── */}
      {content.instagram && (
        <section style={{ ...sectionStyle, background: colors.surface }}>
          <div style={{ ...innerStyle, display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
              background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fff', fontSize: '1.4rem' }}>📷</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: colors.text, fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>@{content.instagram.replace('@', '')}</div>
              <div style={{ color: colors.muted, fontSize: '0.78rem' }}>Folge uns für tägliche Specials & Neuigkeiten</div>
            </div>
            <a
              href={`https://instagram.com/${content.instagram.replace('@', '')}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                padding: '10px 20px', borderRadius: '8px',
                background: 'linear-gradient(135deg, #f09433, #dc2743, #bc1888)',
                color: '#fff', fontWeight: 700, fontSize: '0.82rem',
                textDecoration: 'none', flexShrink: 0,
              }}
            >
              Folgen
            </a>
          </div>
        </section>
      )}

      {/* ── 10. Footer ── */}
      <footer style={{ padding: '28px 24px', borderTop: `1px solid ${colors.border}`, textAlign: 'center' }}>
        <div style={{ color: colors.muted, fontFamily: `${font.heading}, Georgia, serif`, fontStyle: 'italic', fontSize: '0.9rem', marginBottom: '10px' }}>
          {restaurantName}
        </div>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/legal/impressum" style={{ color: colors.muted, fontSize: '0.72rem', textDecoration: 'none' }}>Impressum</a>
          <a href="/legal/datenschutz" style={{ color: colors.muted, fontSize: '0.72rem', textDecoration: 'none' }}>Datenschutz</a>
          <span style={{ color: colors.muted, fontSize: '0.72rem' }}>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </>
  )
}
