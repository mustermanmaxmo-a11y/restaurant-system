import { redirect } from 'next/navigation'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import type { User } from '@supabase/supabase-js'

export type PlatformRole = 'owner' | 'co_founder' | 'developer' | 'billing' | 'support'

export async function requirePlatformOwner() {
  const supabase = await createSupabaseServerSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/platform-login?next=/platform')

  const { data, error } = await supabase.rpc('is_platform_owner')
  if (error || data !== true) redirect('/')

  return { user, supabase, role: 'owner' as PlatformRole }
}

export async function requirePlatformAccess(): Promise<{ user: User; role: PlatformRole }> {
  const supabase = await createSupabaseServerSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/team-login?next=/platform')

  const { data: role } = await supabase.rpc('get_platform_role')
  if (!role) redirect('/team-login')

  return { user, role: role as PlatformRole }
}
