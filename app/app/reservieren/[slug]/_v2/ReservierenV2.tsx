'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Restaurant } from '@/types/database'
import { Sparkles, CalendarDays, Users, Clock, ArrowRight } from 'lucide-react'
import ReservierenV1 from '../_v1/ReservierenV1'

export default function ReservierenV2() {
  const params = useParams()
  const slug = params.slug as string
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [showV1, setShowV1] = useState(false)

  useEffect(() => {
    supabase
      .from('restaurants')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => setRestaurant(data))
  }, [slug])

  if (showV1) return <ReservierenV1 />

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0A0A0F',
        color: '#F5F5F7',
        fontFamily: 'var(--font-geist), system-ui, sans-serif',
        padding: '24px',
      }}
    >
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)',
            borderRadius: '20px',
            padding: '40px 32px',
            marginBottom: '24px',
            boxShadow: '0 20px 60px rgba(234,88,12,0.35)',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '999px',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              marginBottom: '16px',
            }}
          >
            <Sparkles size={11} /> V2 Bento Premium · Preview
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            {restaurant?.name ?? 'Lädt...'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.95rem', marginTop: '8px' }}>
            Tisch reservieren im neuen V2-Design. Volle Funktionalität in Folge-Release.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <StepCard icon={<CalendarDays size={20} />} step="1" label="Datum" />
          <StepCard icon={<Clock size={20} />} step="2" label="Uhrzeit" />
          <StepCard icon={<Users size={20} />} step="3" label="Personen" />
        </div>

        <button
          onClick={() => setShowV1(true)}
          style={{
            width: '100%',
            padding: '18px',
            borderRadius: '14px',
            background: '#111118',
            border: '1px solid #1F1F28',
            color: '#F5F5F7',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontFamily: 'inherit',
          }}
        >
          Zur vollen Reservierungs-Seite (V1) <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

function StepCard({ icon, step, label }: { icon: React.ReactNode; step: string; label: string }) {
  return (
    <div
      style={{
        background: '#111118',
        border: '1px solid #1F1F28',
        borderRadius: '14px',
        padding: '18px',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '14px',
          right: '14px',
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          background: 'rgba(234,88,12,0.15)',
          color: '#EA580C',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          fontWeight: 800,
        }}
      >
        {step}
      </div>
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg,#EA580C,#F97316)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          marginBottom: '10px',
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: '14px', fontWeight: 700 }}>{label}</div>
    </div>
  )
}
