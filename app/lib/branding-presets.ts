export interface BrandingPreset {
  id: string
  name: string
  emoji: string
  cuisine: string
  description: string
  primaryColor: string
  surfaceColor: string
  bgColor: string
}

export const BRANDING_PRESETS: BrandingPreset[] = [
  {
    id: 'classic',
    name: 'Classic',
    emoji: '🍽️',
    cuisine: 'Allgemein',
    description: 'Zeitloses Orange — passt zu jedem Konzept',
    primaryColor: '#FF6B2C',
    surfaceColor: '#131313',
    bgColor: '#080808',
  },
  {
    id: 'italian',
    name: 'Italiano',
    emoji: '🍕',
    cuisine: 'Italienisch',
    description: 'Warmes Tomatenrot, mediterrane Wärme',
    primaryColor: '#E63946',
    surfaceColor: '#1a0a08',
    bgColor: '#0d0503',
  },
  {
    id: 'sushi',
    name: 'Sushi & Sake',
    emoji: '🍣',
    cuisine: 'Japanisch',
    description: 'Kirschblüten-Rosa, zen-minimalistisch',
    primaryColor: '#E91E8C',
    surfaceColor: '#130d1a',
    bgColor: '#0a0810',
  },
  {
    id: 'biergarten',
    name: 'Biergarten',
    emoji: '🍺',
    cuisine: 'Bayerisch',
    description: 'Goldenes Gerstengelb — Hopfen & Malz',
    primaryColor: '#F5A623',
    surfaceColor: '#1a1408',
    bgColor: '#0d0b04',
  },
  {
    id: 'burger',
    name: 'Burger Joint',
    emoji: '🍔',
    cuisine: 'American',
    description: 'Sattes Gelb, fette Energie',
    primaryColor: '#FFC300',
    surfaceColor: '#141208',
    bgColor: '#0b0a04',
  },
  {
    id: 'cafe',
    name: 'Café & Bistro',
    emoji: '☕',
    cuisine: 'Café',
    description: 'Warmes Röstbraun, gemütlich & einladend',
    primaryColor: '#A0522D',
    surfaceColor: '#150f0a',
    bgColor: '#0c0806',
  },
  {
    id: 'finedining',
    name: 'Fine Dining',
    emoji: '🥂',
    cuisine: 'Gehobene Küche',
    description: 'Champagnergold, elegant & exklusiv',
    primaryColor: '#C9A84C',
    surfaceColor: '#111008',
    bgColor: '#090803',
  },
  {
    id: 'vegan',
    name: 'Green & Vegan',
    emoji: '🌿',
    cuisine: 'Vegan / Vegetarisch',
    description: 'Frisches Smaragdgrün, natürlich & nachhaltig',
    primaryColor: '#2D9E5F',
    surfaceColor: '#0a1410',
    bgColor: '#050d08',
  },
  {
    id: 'mediterranean',
    name: 'Mediterraneo',
    emoji: '🫒',
    cuisine: 'Mediterran',
    description: 'Tiefes Meeresblau, Côte d\'Azur',
    primaryColor: '#1B6CA8',
    surfaceColor: '#081020',
    bgColor: '#040810',
  },
  {
    id: 'asian-fusion',
    name: 'Asian Fusion',
    emoji: '🥢',
    cuisine: 'Asiatisch',
    description: 'Lachs-Orange, streetfood-energetisch',
    primaryColor: '#FF6B6B',
    surfaceColor: '#150808',
    bgColor: '#0d0404',
  },
]
