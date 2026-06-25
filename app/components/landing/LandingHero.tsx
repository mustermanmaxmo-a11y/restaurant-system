// app/components/landing/LandingHero.tsx
import type { ResolvedBrand } from '@/lib/resolve-brand'
import type { LandingPageContent, FeaturedItem } from './types'
import { HeroClassicOverlay } from './HeroClassicOverlay'
import { HeroBoldStatement } from './HeroBoldStatement'
import { HeroSplit } from './HeroSplit'
import { HeroCenteredMinimal } from './HeroCenteredMinimal'
import { HeroGradientGlow } from './HeroGradientGlow'

interface LandingHeroProps {
  brand: ResolvedBrand
  content: LandingPageContent
  ctaHref: string
  restaurantName: string
  featuredItems?: FeaturedItem[]
}

export function LandingHero(props: LandingHeroProps) {
  switch (props.brand.heroLayout) {
    case 'bold-statement':    return <HeroBoldStatement {...props} />
    case 'split':             return <HeroSplit {...props} />
    case 'centered-minimal':  return <HeroCenteredMinimal {...props} />
    case 'gradient-glow':     return <HeroGradientGlow {...props} />
    case 'classic-overlay':
    default:                  return <HeroClassicOverlay {...props} />
  }
}
