import { cookies } from 'next/headers'
import { createServerClient as createSSRClient } from '@supabase/ssr'

export async function createSupabaseServerSSR() {
  const cookieStore = await cookies()
  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Called from a Server Component — set() can throw.
            // Cookie refresh is handled by proxy.ts for /platform/* routes.
          }
        },
      },
    }
  )
}
