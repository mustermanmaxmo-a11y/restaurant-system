import { notFound } from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import OrderV1 from './_v1/OrderV1'

export const dynamic = 'force-dynamic'

export default async function OrderPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  let restaurantId: string | null = null
  try {
    const admin = createSupabaseAdmin()
    const { data } = await admin
      .from('tables')
      .select('restaurant_id')
      .eq('qr_token', token)
      .maybeSingle()
    restaurantId = data?.restaurant_id ?? null
  } catch {
    restaurantId = null
  }

  if (!restaurantId) {
    notFound()
  }

  return <OrderV1 />
}
