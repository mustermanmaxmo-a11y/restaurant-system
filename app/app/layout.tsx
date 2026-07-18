import type { Metadata } from 'next'
import { Syne, DM_Sans, Playfair_Display, Lato, Inter, Space_Grotesk, Merriweather, Source_Sans_3, Noto_Serif_Display, Noto_Sans, Geist } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { LanguageProvider } from '@/components/providers/language-provider'
import { CookieBanner } from '@/components/CookieBanner'
import './globals.css'

// Font families for design packages — each gets its own CSS variable.
// Kern-Schriften (App-Chrome + öffentliche Seiten) werden vorgeladen.
// Die Restaurant-Marken-Paare nutzt nur die jeweilige Gast-Seite → preload: false,
// damit Admin/Platform/Homepage nicht 8 ungenutzte Schriften mitladen.
const syne = Syne({ subsets: ['latin'], variable: '--font-syne', weight: ['700', '800'] })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', weight: ['400', '500', '600'] })
const geist = Geist({ subsets: ['latin'], variable: '--font-geist', weight: ['400', '500', '600', '700', '800'] })

const playfairDisplay = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', weight: ['400', '700'], preload: false })
const lato = Lato({ subsets: ['latin'], variable: '--font-lato', weight: ['400', '700'], preload: false })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', weight: ['400', '500', '600', '700'], preload: false })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', weight: ['500', '700'], preload: false })
const merriweather = Merriweather({ subsets: ['latin'], variable: '--font-merriweather', weight: ['400', '700'], preload: false })
const sourceSans3 = Source_Sans_3({ subsets: ['latin'], variable: '--font-source-sans', weight: ['400', '600'], preload: false })
const notoSerifDisplay = Noto_Serif_Display({ subsets: ['latin'], variable: '--font-noto-serif', weight: ['400', '700'], preload: false })
const notoSans = Noto_Sans({ subsets: ['latin'], variable: '--font-noto-sans', weight: ['400', '500', '600'], preload: false })

const allFontVars = [
  syne, dmSans, playfairDisplay, lato, inter, spaceGrotesk,
  merriweather, sourceSans3, notoSerifDisplay, notoSans, geist,
].map(f => f.variable).join(' ')

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.getorderiq.de'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'OrderIQ — Digitales Bestellsystem für Restaurants',
    template: '%s · OrderIQ',
  },
  description:
    'QR-Bestellung am Tisch und online, Live-Küchenansicht und automatisiertes Marketing — ein System für dein Restaurant.',
  applicationName: 'OrderIQ',
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    siteName: 'OrderIQ',
    locale: 'de_DE',
  },
  twitter: {
    card: 'summary_large_image',
  },
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

        <meta name="theme-color" content="#0E7490" />
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
