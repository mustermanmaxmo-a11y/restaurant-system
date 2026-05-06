import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import TemplateAccessClient from './TemplateAccessClient'

export const dynamic = 'force-dynamic'

export default async function PlatformTemplatesPage() {
  await requirePlatformAccess()

  const admin = createSupabaseAdmin()

  const [restaurantsRes, templatesRes] = await Promise.all([
    admin.from('restaurants').select('id, name, slug, plan').order('name'),
    admin.from('design_templates').select('id, name, slug, category, plan_tier').order('sort_order'),
  ])

  if (restaurantsRes.error || templatesRes.error) {
    throw new Error(restaurantsRes.error?.message ?? templatesRes.error?.message ?? 'DB error')
  }

  const restaurants = restaurantsRes.data ?? []
  const templates = templatesRes.data ?? []

  return (
    <TemplateAccessClient
      restaurants={restaurants}
      allTemplates={templates}
    />
  )
}
