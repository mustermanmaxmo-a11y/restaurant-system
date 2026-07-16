import type { Metadata } from 'next'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import BestellenV1 from './_v1/BestellenV1'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const admin = createSupabaseAdmin()

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('name, description, logo_url')
    .eq('slug', slug)
    .maybeSingle()

  if (!restaurant) return {}

  const r = restaurant as { name: string; description: string | null; logo_url: string | null }
  const title = `Bestellen bei ${r.name}`
  const description = r.description ?? `Speisekarte von ${r.name} durchstöbern und direkt online bestellen.`
  const canonical = `/bestellen/${slug}`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      images: r.logo_url ? [{ url: r.logo_url }] : undefined,
    },
  }
}

export default function BestellenPage() {
  return <BestellenV1 />
}
