'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function BillingPage() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/owner-login')
    })
  }, [router])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--text)', fontSize: '1.25rem', fontWeight: 600 }}>💳 Billing</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '8px' }}>
          Stripe Customer Portal — kommt in Plan 5
        </p>
        <button
          onClick={() => router.push('/admin')}
          style={{ marginTop: '16px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          ← Zurück zum Admin
        </button>
      </div>
    </div>
  )
}
