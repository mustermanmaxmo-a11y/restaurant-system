import type { Metadata } from 'next'
import { Syne, DM_Sans, Playfair_Display, Lato, Inter, Space_Grotesk, Merriweather, Source_Sans_3, Noto_Serif_Display, Noto_Sans } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { LanguageProvider } from '@/components/providers/language-provider'
import { CookieBanner } from '@/components/CookieBanner'
import './globals.css'

// Font families for design packages — each gets its own CSS variable
const syne = Syne({ subsets: ['latin'], variable: '--font-syne', weight: ['700', '800'] })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', weight: ['400', '500', '600'] })
const playfairDisplay = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', weight: ['400', '700'] })
const lato = Lato({ subsets: ['latin'], variable: '--font-lato', weight: ['400', '700'] })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', weight: ['400', '500', '600', '700'] })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', weight: ['500', '700'] })
const merriweather = Merriweather({ subsets: ['latin'], variable: '--font-merriweather', weight: ['400', '700'] })
const sourceSans3 = Source_Sans_3({ subsets: ['latin'], variable: '--font-source-sans', weight: ['400', '600'] })
const notoSerifDisplay = Noto_Serif_Display({ subsets: ['latin'], variable: '--font-noto-serif', weight: ['400', '700'] })
const notoSans = Noto_Sans({ subsets: ['latin'], variable: '--font-noto-sans', weight: ['400', '500', '600'] })

const allFontVars = [
  syne, dmSans, playfairDisplay, lato, inter, spaceGrotesk,
  merriweather, sourceSans3, notoSerifDisplay, notoSans,
].map(f => f.variable).join(' ')

export const metadata: Metadata = {
  title: 'RestaurantOS',
  description: 'Digitales Restaurant-System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme')||'dark';document.documentElement.classList.toggle('dark',t==='dark');})();`,
          }}
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#6c63ff" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={allFontVars} style={{ fontFamily: 'var(--font-body, var(--font-dm-sans)), system-ui, sans-serif' }}>
        <ThemeProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </ThemeProvider>
        <CookieBanner />
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(function() {}); }`,
          }}
        />
      </body>
    </html>
  )
}
