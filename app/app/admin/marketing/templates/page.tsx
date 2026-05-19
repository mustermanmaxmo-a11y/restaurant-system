import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { TemplateLibrary } from '@/components/marketing/TemplateLibrary'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function TemplatesPage() {
  const supabase = await createSupabaseServerSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createSupabaseAdmin()
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!restaurant) redirect('/admin')

  const { data: templates } = await admin
    .from('email_templates')
    .select('id, name, trigger_type, subject_template, body_html, is_active, created_by_ai, created_at')
    .eq('restaurant_id', restaurant.id)
    .order('created_at', { ascending: false })

  return <TemplateLibrary initialTemplates={templates ?? []} restaurantId={restaurant.id} />
}
