'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function UnsubscribePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const email = searchParams.get('email')
  const restaurantId = searchParams.get('rid')
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading')
  const [restaurantName, setRestaurantName] = useState('')

  useEffect(() => {
    async function unsubscribe() {
      if (!email || !restaurantId) { setStatus('error'); return }

      const { data: resto } = await supabase.from('restaurants').select('name').eq('id', restaurantId).single()
      if (resto) setRestaurantName(resto.name)

      const { error } = await supabase
        .from('marketing_subscribers')
        .update({ unsubscribed_at: new Date().toISOString() })
        .eq('restaurant_id', restaurantId)
        .eq('email', email)
        .is('unsubscribed_at', null)

      setStatus(error ? 'error' : 'done')
    }
    unsubscribe()
  }, [email, restaurantId, params.token])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', fontFamily: 'system-ui, sans-serif', padding: '24px' }}>
      <div style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        {status === 'loading' && <p style={{ color: '#6b7280' }}>Abmeldung wird verarbeitet…</p>}
        {status === 'done' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
            <h1 style={{ fontWeight: 700, fontSize: '1.3rem', color: '#111827', marginBottom: '8px' }}>Erfolgreich abgemeldet</h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
              Du erhältst keine weiteren Marketing-Emails von{restaurantName ? ` ${restaurantName}` : ''}.
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>❌</div>
            <h1 style={{ fontWeight: 700, fontSize: '1.3rem', color: '#111827', marginBottom: '8px' }}>Fehler</h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Der Abmeldelink ist ungültig oder abgelaufen.</p>
          </>
        )}
      </div>
    </div>
  )
}
