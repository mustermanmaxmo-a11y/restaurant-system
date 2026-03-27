import { ThemeToggle } from '@/components/ui/theme-toggle'

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
      }}
    >
      <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text)' }}>
        RestaurantOS
      </h1>
      <ThemeToggle />
    </main>
  )
}
