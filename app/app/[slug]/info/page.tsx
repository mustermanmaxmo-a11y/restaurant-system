import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { resolveBrand } from '@/lib/resolve-brand'
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingPageSections } from '@/components/landing/LandingPageSections'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import type { LandingPageContent } from '@/lib/landing-content'
import type { DraftConfig } from '@/lib/editor-draft'
import type { FeaturedItem } from '@/components/landing/types'

export const dynamic = 'force-dynamic'

interface LandingPageRow {
  id: string
  restaurant_id: string
  template_slug: string
  content: LandingPageContent
  is_published: boolean
}

interface RestaurantRow {
  id: string
  owner_id: string
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

export default async function PublicLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const wantsPreview = sp.preview === '1'
  const admin = createSupabaseAdmin()

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, owner_id, name, slug, description, logo_url, design_config, primary_color, bg_color, surface_color, header_color, button_color, card_color, text_color, font_pair, layout_variant, design_package, draft_config')
    .eq('slug', slug)
    .maybeSingle()

  if (!restaurant) notFound()

  // Vorschau unveröffentlichter Entwürfe nur für den eingeloggten Besitzer (Cookie-Session).
  // Verhindert IDOR: ?preview=1 darf keine fremden, unveröffentlichten Seiten offenlegen.
  let isPreview = false
  if (wantsPreview) {
    const ssr = await createSupabaseServerSSR()
    const { data: { user } } = await ssr.auth.getUser()
    isPreview = !!user && user.id === (restaurant as RestaurantRow).owner_id
  }

  const { data: lp } = await admin
    .from('landing_pages')
    .select('id, restaurant_id, template_slug, content, is_published')
    .eq('restaurant_id', (restaurant as RestaurantRow).id)
    .maybeSingle()

  if (!lp || (!(lp as LandingPageRow).is_published && !isPreview)) notFound()

  const landingPage = lp as LandingPageRow
  let resto = restaurant as RestaurantRow
  let content: LandingPageContent = landingPage.content ?? {}

  // Im Besitzer-Preview Entwurf statt Live lesen (falls vorhanden).
  if (isPreview) {
    const draft = (restaurant as RestaurantRow & { draft_config?: DraftConfig | null }).draft_config
    if (draft && draft.brand) {
      resto = {
        ...resto,
        design_package: draft.brand.design_package ?? resto.design_package,
        layout_variant: draft.brand.layout_variant ?? resto.layout_variant,
        font_pair: draft.brand.font_pair ?? resto.font_pair,
        primary_color: draft.brand.primary_color,
        bg_color: draft.brand.bg_color,
        header_color: draft.brand.header_color,
        card_color: draft.brand.card_color,
        button_color: draft.brand.button_color,
        text_color: draft.brand.text_color,
        design_config: draft.brand.design_config as Record<string, unknown> | null,
        logo_url: draft.brand.logo_url,
      }
      content = draft.landing_content ?? content
    }
  }

  const brand = resolveBrand(resto, 'landing', {
    hero_image_url: content.hero_image_url,
    headline: content.headline,
    subheadline: content.subheadline,
    lp_layout: content.lp_layout,
  })

  const { data: itemsData } = await admin
    .from('menu_items')
    .select('id, name, price, image_url')
    .eq('restaurant_id', resto.id)
    .eq('available', true)
    .not('image_url', 'is', null)
    .order('sort_order', { ascending: true })
    .limit(4)

  const featuredItems: FeaturedItem[] = (itemsData ?? []) as FeaturedItem[]

  return (
    <div style={{
      fontFamily: `${brand.font.body}, system-ui, sans-serif`,
      background: brand.colors.bg,
      color: brand.colors.text,
    }}>
      <SiteHeader
        colors={brand.colors}
        font={brand.font}
        slug={resto.slug}
        restaurantName={resto.name}
        logoUrl={content.logo_url ?? resto.logo_url ?? undefined}
        active="start"
      />
      <LandingHero
        brand={brand}
        content={content}
        ctaHref={content.cta_url || `/bestellen/${resto.slug}`}
        restaurantName={resto.name}
        featuredItems={featuredItems}
      />
      <LandingPageSections
        brand={brand}
        content={content}
        slug={resto.slug}
        featuredItems={featuredItems}
      />
      <SiteFooter
        colors={brand.colors}
        font={brand.font}
        restaurantName={resto.name}
      />
    </div>
  )
}
