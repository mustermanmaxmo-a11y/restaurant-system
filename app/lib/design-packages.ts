export type LayoutVariant = 'cards' | 'list' | 'grid' | 'large-cards'

export interface DesignPackage {
  id: string
  name: string
  description: string
  emoji: string
  preview: {
    bgColor: string
    headerColor: string
    surfaceColor: string
    cardColor: string
    primaryColor: string
    buttonColor: string
    textColor: string
  }
  layoutVariant: LayoutVariant
  fontPair: string
}

export const DESIGN_PACKAGES: DesignPackage[] = [
  {
    id: 'modern-classic',
    name: 'Modern Classic',
    description: 'Zeitloses Orange, dunkle Eleganz — der aktuelle Look',
    emoji: '🍽️',
    preview: {
      bgColor: '#080808',
      headerColor: '#080808',
      surfaceColor: '#131313',
      cardColor: '#131313',
      primaryColor: '#FF6B2C',
      buttonColor: '#FF6B2C',
      textColor: '#f0ede8',
    },
    layoutVariant: 'cards',
    fontPair: 'syne-dmsans',
  },
  {
    id: 'elegant-gold',
    name: 'Elegant Gold',
    description: 'Champagnergold trifft dunkles Navy — gehobene Kueche',
    emoji: '🥂',
    preview: {
      bgColor: '#0a0b14',
      headerColor: '#08091a',
      surfaceColor: '#12132a',
      cardColor: '#12132a',
      primaryColor: '#C9A84C',
      buttonColor: '#C9A84C',
      textColor: '#e8e4d8',
    },
    layoutVariant: 'list',
    fontPair: 'playfair-lato',
  },
  {
    id: 'minimalist-light',
    name: 'Minimalist Light',
    description: 'Hell, clean, skandinavisch — Klarheit pur',
    emoji: '☕',
    preview: {
      bgColor: '#FAFAF8',
      headerColor: '#FFFFFF',
      surfaceColor: '#FFFFFF',
      cardColor: '#F5F5F3',
      primaryColor: '#2C2C2C',
      buttonColor: '#111111',
      textColor: '#1a1a1a',
    },
    layoutVariant: 'cards',
    fontPair: 'inter-inter',
  },
  {
    id: 'bold-street',
    name: 'Bold Street',
    description: 'Neon-Energie, grosse Bilder — Streetfood & Burger',
    emoji: '🍔',
    preview: {
      bgColor: '#0a0a0a',
      headerColor: '#0a0a0a',
      surfaceColor: '#141414',
      cardColor: '#141414',
      primaryColor: '#FF3D00',
      buttonColor: '#FF3D00',
      textColor: '#ffffff',
    },
    layoutVariant: 'large-cards',
    fontPair: 'space-dmsans',
  },
  {
    id: 'warm-trattoria',
    name: 'Warm Trattoria',
    description: 'Terrakotta & Creme — italienische Waerme',
    emoji: '🍕',
    preview: {
      bgColor: '#FDF8F0',
      headerColor: '#3D2214',
      surfaceColor: '#FFF9F2',
      cardColor: '#FFF4E8',
      primaryColor: '#C75B39',
      buttonColor: '#C75B39',
      textColor: '#2C1810',
    },
    layoutVariant: 'list',
    fontPair: 'merriweather-source',
  },
  {
    id: 'zen-garden',
    name: 'Zen Garden',
    description: 'Kirschbluete trifft Minimalismus — japanische Aesthetik',
    emoji: '🍣',
    preview: {
      bgColor: '#0c0c0e',
      headerColor: '#0c0c0e',
      surfaceColor: '#161618',
      cardColor: '#161618',
      primaryColor: '#D4627A',
      buttonColor: '#D4627A',
      textColor: '#e8e4e0',
    },
    layoutVariant: 'grid',
    fontPair: 'noto-noto',
  },
  {
    id: 'biergarten-fresh',
    name: 'Biergarten Fresh',
    description: 'Goldener Bernstein, waldiges Gruen — bayerische Gemuetlichkeit',
    emoji: '🍺',
    preview: {
      bgColor: '#0a0d08',
      headerColor: '#0a0d08',
      surfaceColor: '#141a10',
      cardColor: '#141a10',
      primaryColor: '#F5A623',
      buttonColor: '#F5A623',
      textColor: '#f0ede4',
    },
    layoutVariant: 'cards',
    fontPair: 'syne-dmsans',
  },
  {
    id: 'neon-nights',
    name: 'Neon Nights',
    description: 'Lila Glow, dunkle Atmosphaere — Bar & Cocktails',
    emoji: '🍸',
    preview: {
      bgColor: '#08080c',
      headerColor: '#08080c',
      surfaceColor: '#121218',
      cardColor: '#121218',
      primaryColor: '#B44AFF',
      buttonColor: '#B44AFF',
      textColor: '#ede8f4',
    },
    layoutVariant: 'large-cards',
    fontPair: 'space-dmsans',
  },
]

export function getDesignPackage(id?: string | null): DesignPackage {
  return DESIGN_PACKAGES.find(p => p.id === id) ?? DESIGN_PACKAGES[0]
}
