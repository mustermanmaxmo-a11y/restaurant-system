import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveBrand } from '@/lib/resolve-brand'
import { LandingHero } from '@/components/landing/LandingHero'
import type { FeaturedItem } from '@/components/landing/types'

export const dynamic = 'force-dynamic'

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

  let featuredItems: FeaturedItem[] = []
  if (brand.heroLayout === 'bold-statement') {
    const { data: items } = await admin
      .from('menu_items')
      .select('id, name, price, image_url')
      .eq('restaurant_id', resto.id)
      .eq('available', true)
      .limit(4)
    featuredItems = (items ?? []) as FeaturedItem[]
  }

  return (
    <LandingHero
      brand={brand}
      content={content}
      ctaHref={content.cta_url || `/bestellen/${resto.slug}`}
      restaurantName={resto.name}
      featuredItems={featuredItems}
    />
  )
}
