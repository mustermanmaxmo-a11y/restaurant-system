import Link from 'next/link'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { UtensilsCrossed } from 'lucide-react'
import { LegalFooter } from '@/components/LegalFooter'

export default function HomePage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 32px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>
          <UtensilsCrossed size={20} style={{ verticalAlign: 'middle', marginRight: '6px' }} />RestaurantOS
        </span>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <ThemeToggle />
          <Link
            href="/owner-login"
            style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textDecoration: 'none' }}
          >
            Login
          </Link>
          <Link
            href="/register"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              padding: '8px 20px',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Jetzt starten
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}><UtensilsCrossed size={64} color="var(--accent)" /></div>
        <h1 style={{ color: 'var(--text)', fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.1, maxWidth: '700px', marginBottom: '20px' }}>
          Digitale Bestellungen für dein Restaurant
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '500px', lineHeight: 1.7, marginBottom: '40px' }}>
          QR-Code am Tisch scannen, bestellen, Status live verfolgen. Für Dine-In, Delivery & Pickup.
        </p>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link
            href="/register"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              padding: '16px 36px',
              borderRadius: '12px',
              fontSize: '1.1rem',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Kostenlos starten →
          </Link>
          <Link
            href="/owner-login"
            style={{
              background: 'var(--surface)',
              color: 'var(--text)',
              padding: '16px 36px',
              borderRadius: '12px',
              fontSize: '1.1rem',
              fontWeight: 600,
              textDecoration: 'none',
              border: '1px solid var(--border)',
            }}
          >
            Einloggen
          </Link>
        </div>
      </div>
      <LegalFooter />
    </main>
  )
}
