import { createClient } from '@supabase/supabase-js'

// Service-role Supabase client. BYPASSES RLS.
// Only use after explicit authorization check (e.g. requirePlatformOwner()).
// Never import into client components.
export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing Supabase admin env vars')
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
