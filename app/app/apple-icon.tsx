import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/** iOS-Homescreen-Icon: „IQ"-Monogramm auf Marken-Petrol. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0E7490',
          color: '#fff',
          fontSize: 92,
          fontWeight: 800,
          letterSpacing: '-0.04em',
          fontFamily: 'sans-serif',
        }}
      >
        IQ
      </div>
    ),
    { ...size },
  )
}
