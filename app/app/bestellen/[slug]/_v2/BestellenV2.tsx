'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Restaurant } from '@/types/database'
import { Sparkles, UtensilsCrossed, Clock, ArrowRight } from 'lucide-react'
import BestellenV1 from '../_v1/BestellenV1'

export default function BestellenV2() {
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

  if (showV1) return <BestellenV1 />

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
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        {/* Hero */}
        <div
          style={{
            background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)',
            borderRadius: '20px',
            padding: '40px 32px',
            marginBottom: '24px',
            position: 'relative',
            overflow: 'hidden',
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
            Bestell-Seite im neuen V2-Design. Die volle Funktionalität folgt in einer späteren Iteration.
          </p>
        </div>

        {/* Bento Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <BentoCard
            icon={<UtensilsCrossed size={22} />}
            title="Menü"
            desc="Kategorisiert, mit Bildern, live gepflegt."
            accent="linear-gradient(135deg,#EA580C,#F97316)"
          />
          <BentoCard
            icon={<Clock size={22} />}
            title="Echtzeit-Status"
            desc="Verfolge Bestellung von Küche bis Tisch."
            accent="linear-gradient(135deg,#10B981,#059669)"
          />
          <BentoCard
            icon={<Sparkles size={22} />}
            title="Gruppen-Bestellung"
            desc="Mehrere Gäste, ein Warenkorb, geteilte Rechnung."
            accent="linear-gradient(135deg,#6366F1,#8B5CF6)"
          />
        </div>

        {/* CTA */}
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
          Zur vollen Bestell-Seite (V1-Funktionalität) <ArrowRight size={16} />
        </button>

        <p
          style={{
            color: '#8B8B93',
            fontSize: '11px',
            textAlign: 'center',
            marginTop: '16px',
          }}
        >
          V2 dark-only · Geist Font · Bento Layout · Restaurant-Branding bleibt eigenständig
        </p>
      </div>
    </div>
  )
}

function BentoCard({
  icon,
  title,
  desc,
  accent,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  accent: string
}) {
  return (
    <div
      style={{
        background: '#111118',
        border: '1px solid #1F1F28',
        borderRadius: '16px',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          marginBottom: '14px',
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>{title}</div>
      <div style={{ color: '#8B8B93', fontSize: '12px', lineHeight: 1.5 }}>{desc}</div>
    </div>
  )
}
