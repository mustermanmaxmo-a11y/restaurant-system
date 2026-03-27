import { createClient } from '@supabase/supabase-js'

// Only use in Server Components or API Routes — never in client components
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
