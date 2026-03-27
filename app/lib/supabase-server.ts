import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client for use in Server Components and API Routes.
// Intentionally uses the anon key so RLS policies are always enforced.
// For operations that need to bypass RLS (e.g. Stripe webhooks), use
// SUPABASE_SERVICE_ROLE_KEY in a dedicated server-only module.
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
