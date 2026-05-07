import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

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
}

// ─── Template themes ─────────────────────────────────────────────────────────
const THEMES: Record<string, {
  bg: string; text: string; accent: string; muted: string; card: string; border: string
}> = {
  'minimal-dark': {
    bg: '#0a0a0a', text: '#f0f0f0', accent: '#e85d26',
    muted: 'rgba(240,240,240,0.55)', card: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)',
  },
  'warm-rustic': {
    bg: '#FDF8F0', text: '#2C1810', accent: '#C75B39',
    muted: 'rgba(44,24,16,0.55)', card: 'rgba(44,24,16,0.05)', border: 'rgba(44,24,16,0.12)',
  },
  'bold-modern': {
    bg: '#0a0a0a', text: '#ffffff', accent: '#FF3D00',
    muted: 'rgba(255,255,255,0.55)', card: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)',
  },
  'elegant-white': {
    bg: '#FFFFFF', text: '#1a1a1a', accent: '#2C2C2C',
    muted: 'rgba(26,26,26,0.5)', card: 'rgba(26,26,26,0.04)', border: 'rgba(26,26,26,0.1)',
  },
  'street-energy': {
    bg: '#0d0d0d', text: '#ffffff', accent: '#B44AFF',
    muted: 'rgba(255,255,255,0.55)', card: 'rgba(180,74,255,0.08)', border: 'rgba(180,74,255,0.2)',
  },
}

const DEFAULT_THEME = THEMES['minimal-dark']

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
    .select('id, name, slug, description, logo_url')
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
  const theme = THEMES[landingPage.template_slug] ?? DEFAULT_THEME

  const ctaHref = content.cta_url || `/bestellen/${resto.slug}`
  const logoUrl = content.logo_url || resto.logo_url
  const headline = content.headline || resto.name

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.bg,
      color: theme.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
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
