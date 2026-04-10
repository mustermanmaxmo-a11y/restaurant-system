export interface FontPair {
  heading: string
  body: string
  label: string
}

export const FONT_PAIRS: Record<string, FontPair> = {
  'syne-dmsans': {
    heading: 'var(--font-syne)',
    body: 'var(--font-dm-sans)',
    label: 'Modern (Syne + DM Sans)',
  },
  'playfair-lato': {
    heading: 'var(--font-playfair)',
    body: 'var(--font-lato)',
    label: 'Elegant (Playfair + Lato)',
  },
  'inter-inter': {
    heading: 'var(--font-inter)',
    body: 'var(--font-inter)',
    label: 'Clean (Inter)',
  },
  'space-dmsans': {
    heading: 'var(--font-space-grotesk)',
    body: 'var(--font-dm-sans)',
    label: 'Bold (Space Grotesk + DM Sans)',
  },
  'merriweather-source': {
    heading: 'var(--font-merriweather)',
    body: 'var(--font-source-sans)',
    label: 'Warm (Merriweather + Source Sans)',
  },
  'noto-noto': {
    heading: 'var(--font-noto-serif)',
    body: 'var(--font-noto-sans)',
    label: 'Zen (Noto Serif + Noto Sans)',
  },
}
