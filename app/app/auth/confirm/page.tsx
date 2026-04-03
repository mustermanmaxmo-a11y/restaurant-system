'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Handles Supabase implicit flow: #access_token= is in the URL hash.
// The Supabase JS client picks it up automatically via onAuthStateChange.
export default function AuthConfirmPage() {
  const router = useRouter()

  useEffect(() => {
    // Listen for the SIGNED_IN event — Supabase fires this automatically
    // when it detects #access_token= in the URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.replace('/admin/setup')
      }
    })

    // Also check if already signed in (e.g. page reload)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/admin/setup')
    })

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'system-ui' }}>
      <p>Wird eingeloggt…</p>
    </div>
  )
}
