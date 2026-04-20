import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveDesignVersion } from '@/lib/design-version'
import { DesignVersionProvider } from '@/components/providers/design-version-provider'
import ReservierenV1 from './_v1/ReservierenV1'
import ReservierenV2 from './_v2/ReservierenV2'

export const dynamic = 'force-dynamic'

export default async function ReservierenPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  let restaurantId: string | null = null
  try {
    const admin = createSupabaseAdmin()
    const { data } = await admin
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    restaurantId = data?.id ?? null
  } catch {
    restaurantId = null
  }

  const version = await resolveDesignVersion('guest', restaurantId)

  return (
    <DesignVersionProvider version={version}>
      {version === 'v2' ? <ReservierenV2 /> : <ReservierenV1 />}
    </DesignVersionProvider>
  )
}
