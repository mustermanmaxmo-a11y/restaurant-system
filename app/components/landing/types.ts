import type { ResolvedBrand } from '@/lib/resolve-brand'

export interface HeroContent {
  hero_image_url?: string
  headline?: string
  subheadline?: string
  about_text?: string
  cta_text?: string
}

export interface FeaturedItem {
  id: string
  name: string
  price: number
  image_url: string | null
}

export interface HeroProps {
  brand: ResolvedBrand
  content: HeroContent
  ctaHref: string
  restaurantName: string
  featuredItems?: FeaturedItem[]
}
