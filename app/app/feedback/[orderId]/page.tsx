import { createClient } from '@supabase/supabase-js'
import { FeedbackClient } from './FeedbackClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ orderId: string }>
  searchParams: Promise<{ stars?: string; t?: string }>
}

export default async function FeedbackPage({ params, searchParams }: PageProps) {
  const { orderId } = await params
  const sp = await searchParams
  const stars = Math.max(1, Math.min(5, parseInt(sp.stars ?? '5', 10) || 5))
  const token = sp.t ?? ''

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: order } = await supabase
    .from('orders')
    .select('id, restaurant_id, restaurants!inner(name, logo_url, google_review_url, primary_color)')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f4f5', fontFamily: 'system-ui, sans-serif', padding: '24px' }}>
        <div style={{ maxWidth: '420px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0a0a0a', marginBottom: '8px' }}>Bestellung nicht gefunden</h1>
          <p style={{ color: '#71717a', fontSize: '0.9rem' }}>Der Link ist ungültig oder die Bestellung wurde gelöscht.</p>
        </div>
      </div>
    )
  }

  const restaurant = (order.restaurants as unknown) as {
    name: string
    logo_url: string | null
    google_review_url: string | null
    primary_color: string | null
  }

  return (
    <FeedbackClient
      orderId={orderId}
      stars={stars}
      token={token}
      restaurantName={restaurant.name}
      logoUrl={restaurant.logo_url}
      googleReviewUrl={restaurant.google_review_url}
      primaryColor={restaurant.primary_color ?? '#ea580c'}
    />
  )
}
