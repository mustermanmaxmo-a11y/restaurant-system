export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  const clamp = (v: number) => Math.max(0, Math.min(255, v))
  return `#${[r, g, b].map(c => clamp(c - amount).toString(16).padStart(2, '0')).join('')}`
}

export function buildColors(primaryColor?: string | null, surfaceColor?: string | null) {
  const accent = primaryColor ?? '#ff6b35'
  const surface = surfaceColor ?? '#131313'
  const bg = surfaceColor ? surfaceColor.replace(/1[3-9]|[2-9][0-9]/, '08') : '#080808'
  return {
    bg,
    surface,
    surface2: '#1c1c1c',
    border: '#222222',
    borderHover: '#2e2e2e',
    accent,
    accentDim: `${accent}1f`,
    accentGlow: `${accent}47`,
    text: '#f0ede8',
    muted: '#5a5650',
    muted2: '#3a3632',
  }
}
