import { requirePlatformAccess } from '@/lib/platform-auth'
import { LiveMonitor } from './LiveMonitor'

export const dynamic = 'force-dynamic'

export default async function PlatformMonitorPage() {
  await requirePlatformAccess()

  // Fetch initial data server-side so there's no loading flash
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  let initial = null
  try {
    const res = await fetch(`${baseUrl}/api/platform/monitor`, { cache: 'no-store' })
    if (res.ok) initial = await res.json()
  } catch { /* falls through to empty state */ }

  const empty = {
    stats: { todayCount: 0, todayTotal: 0, ordersThisHour: 0, activeRestaurantCount: 0, statusCounts: {} },
    activeRestaurants: [],
    feed: [],
    generatedAt: new Date().toISOString(),
  }

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', flexShrink: 0, animation: 'monitor-pulse 1.5s ease-in-out infinite' }} />
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0f0f8', letterSpacing: '-0.025em', marginBottom: '2px' }}>
            Live Monitor
          </h1>
          <p style={{ color: '#44445a', fontSize: '0.82rem' }}>
            Alle Bestellungen über alle Restaurants in Echtzeit
          </p>
        </div>
      </div>
      <LiveMonitor initial={initial ?? empty} />
      <style>{`@keyframes monitor-pulse { 0%,100% { opacity:1; } 50% { opacity:0.2; } }`}</style>
    </div>
  )
}
