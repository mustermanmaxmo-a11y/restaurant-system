import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveDesignVersion } from '@/lib/design-version'
import { DesignVersionProvider } from '@/components/providers/design-version-provider'
import BestellenV1 from './_v1/BestellenV1'
import BestellenV2 from './_v2/BestellenV2'

export const dynamic = 'force-dynamic'

export default async function BestellenPage({
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
      {version === 'v2' ? <BestellenV2 /> : <BestellenV1 />}
    </DesignVersionProvider>
  )
}
