import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveBrand } from '@/lib/resolve-brand'

// Immer live rendern: die Seite liest den Brand aus design_config, der sich bei
// jedem Template-Wechsel ändert. Ohne dies cached Next.js eine veraltete Version
// (Symptom: Landing-Farbe „eingefroren", ändert sich nicht beim Template-Wechsel).
// Gleiches Muster wie die Geschwister-Seite app/bestellen/[slug]/page.tsx.
export const dynamic = 'force-dynamic'

// ─── Types ───────────────────────────────────────────────────────────────────
interface LandingPageContent {
  logo_url?: string
  hero_image_url?: string
  headline?: string
  subheadline?: string
  about_text?: string
  cta_text?: string
  cta_url?: string
}

interface LandingPageRow {
  id: string
  restaurant_id: string
  template_slug: string
  content: LandingPageContent
  is_published: boolean
}

interface RestaurantRow {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  design_config: Record<string, unknown> | null
  primary_color: string | null
  bg_color: string | null
  surface_color: string | null
  header_color: string | null
  button_color: string | null
  card_color: string | null
  text_color: string | null
  font_pair: string | null
  layout_variant: string | null
  design_package: string | null
}

// ─── Metadata ────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const admin = createSupabaseAdmin()

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('name, description')
    .eq('slug', slug)
    .maybeSingle()

  if (!restaurant) return {}

  const r = restaurant as Pick<RestaurantRow, 'name' | 'description'>
  return {
    title: r.name,
    description: r.description ?? `${r.name} — Online bestellen`,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function PublicLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const admin = createSupabaseAdmin()

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, name, slug, description, logo_url, design_config, primary_color, bg_color, surface_color, header_color, button_color, card_color, text_color, font_pair, layout_variant, design_package')
    .eq('slug', slug)
    .maybeSingle()

  if (!restaurant) notFound()

  const { data: lp } = await admin
    .from('landing_pages')
    .select('id, restaurant_id, template_slug, content, is_published')
    .eq('restaurant_id', (restaurant as RestaurantRow).id)
    .maybeSingle()

  if (!lp || !(lp as LandingPageRow).is_published) notFound()

  const landingPage = lp as LandingPageRow
  const resto = restaurant as RestaurantRow
  const content: LandingPageContent = landingPage.content ?? {}

  const brand = resolveBrand(resto, 'landing', {
    hero_image_url: content.hero_image_url,
    headline: content.headline,
    subheadline: content.subheadline,
    lp_layout: (landingPage.content as Record<string, unknown>)?.lp_layout as string | undefined,
  })
  const theme = {
    bg: brand.colors.bg,
    text: brand.colors.text,
    accent: brand.colors.accent,
    muted: brand.colors.muted,
    card: brand.colors.cardBg,
    border: brand.colors.border,
  }

  const ctaHref = content.cta_url || `/bestellen/${resto.slug}`
  const logoUrl = content.logo_url || resto.logo_url
  const headline = content.headline || resto.name

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.bg,
      color: theme.text,
      fontFamily: `${brand.font.body}, system-ui, sans-serif`,
    }}>
      <style>{`
        #lp-root *, #lp-root *::before, #lp-root *::after { box-sizing: border-box; }
        #lp-root a { color: inherit; text-decoration: none; }
        #lp-root img { max-width: 100%; display: block; }
      `}</style>

      <div id="lp-root">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <header
          style={{
            position: 'relative',
            minHeight: content.hero_image_url ? '420px' : '280px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 24px',
            textAlign: 'center',
            overflow: 'hidden',
            background: content.hero_image_url
              ? `url(${content.hero_image_url}) center/cover no-repeat`
              : `linear-gradient(135deg, ${theme.accent}22, ${theme.bg})`,
          }}
        >
          {content.hero_image_url && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.7) 100%)',
            }} />
          )}

          <div style={{ position: 'relative', zIndex: 1, maxWidth: '680px', width: '100%' }}>
            {logoUrl && (
              <img
                src={logoUrl}
                alt={`${resto.name} Logo`}
                style={{
                  width: '80px', height: '80px', objectFit: 'contain',
                  borderRadius: '12px', background: '#ffffff',
                  padding: '8px', margin: '0 auto 20px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}
              />
            )}

            <h1 style={{
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              fontWeight: 900,
              lineHeight: 1.1,
              color: content.hero_image_url ? '#ffffff' : theme.text,
              letterSpacing: '-0.02em',
              marginBottom: '16px',
              textShadow: content.hero_image_url ? '0 2px 8px rgba(0,0,0,0.6)' : 'none',
              fontFamily: `${brand.font.heading}, system-ui, sans-serif`,
            }}>
              {headline}
            </h1>

            {content.subheadline && (
              <p style={{
                fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
                color: content.hero_image_url ? 'rgba(255,255,255,0.85)' : theme.muted,
                lineHeight: 1.5,
                marginBottom: '28px',
                textShadow: content.hero_image_url ? '0 1px 4px rgba(0,0,0,0.5)' : 'none',
              }}>
                {content.subheadline}
              </p>
            )}

            <a
              href={ctaHref}
              style={{
                display: 'inline-block',
                padding: '16px 36px',
                borderRadius: '10px',
                background: theme.accent,
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '1rem',
                letterSpacing: '-0.01em',
                boxShadow: `0 4px 24px ${theme.accent}66`,
              }}
            >
              {content.cta_text || 'Jetzt bestellen'}
            </a>
          </div>
        </header>

        {/* ── About section ─────────────────────────────────────────────── */}
        {content.about_text && (
          <section style={{ padding: '64px 24px', maxWidth: '720px', margin: '0 auto' }}>
            <h2 style={{
              fontSize: 'clamp(1.4rem, 3vw, 2rem)',
              fontWeight: 800,
              color: theme.text,
              marginBottom: '20px',
              letterSpacing: '-0.02em',
            }}>
              Über uns
            </h2>
            <p style={{ fontSize: '1.05rem', color: theme.muted, lineHeight: 1.7 }}>
              {content.about_text}
            </p>
          </section>
        )}

        {/* ── Menu CTA block ────────────────────────────────────────────── */}
        <section style={{
          padding: '48px 24px',
          background: theme.card,
          borderTop: `1px solid ${theme.border}`,
          borderBottom: `1px solid ${theme.border}`,
        }}>
          <div style={{
            maxWidth: '720px', margin: '0 auto',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '20px',
          }}>
            <div>
              <div style={{
                fontSize: '0.72rem', fontWeight: 700, color: theme.accent,
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px',
              }}>
                Speisekarte
              </div>
              <div style={{
                fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)', fontWeight: 800,
                color: theme.text, letterSpacing: '-0.02em',
              }}>
                Alle Gerichte entdecken
              </div>
              <div style={{ fontSize: '0.875rem', color: theme.muted, marginTop: '4px' }}>
                Frisch, regional, direkt am Tisch bestellen
              </div>
            </div>
            <a
              href={ctaHref}
              style={{
                display: 'inline-block', padding: '14px 28px', borderRadius: '10px',
                background: theme.accent, color: '#ffffff', fontWeight: 700, fontSize: '0.9rem',
                boxShadow: `0 4px 16px ${theme.accent}44`, flexShrink: 0,
              }}
            >
              Zur Speisekarte
            </a>
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <footer style={{
          padding: '28px 24px',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: theme.muted,
          borderTop: `1px solid ${theme.border}`,
        }}>
          {resto.name}
        </footer>
      </div>
    </div>
  )
}
