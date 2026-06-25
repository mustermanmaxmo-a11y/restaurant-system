// app/components/landing/types.ts
import type { ResolvedBrand } from '@/lib/resolve-brand'
import type { LandingPageContent } from '@/lib/landing-content'

export type { LandingPageContent }

export interface FeaturedItem {
  id: string
  name: string
  price: number
  image_url: string | null
}

export interface HeroProps {
  brand: ResolvedBrand
  content: LandingPageContent
  ctaHref: string
  restaurantName: string
  featuredItems?: FeaturedItem[]
}
