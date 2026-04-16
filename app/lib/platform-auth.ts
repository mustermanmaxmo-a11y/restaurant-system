import { redirect } from 'next/navigation'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'

export async function requirePlatformOwner() {
  const supabase = await createSupabaseServerSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/platform-login?next=/platform')

  const { data, error } = await supabase.rpc('is_platform_owner')
  if (error || data !== true) redirect('/')

  return { user, supabase }
}
