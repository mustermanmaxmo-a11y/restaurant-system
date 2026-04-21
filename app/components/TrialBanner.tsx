'use client'

import { useRouter } from 'next/navigation'
import type { RestaurantPlan } from '@/types/database'
import { getTrialDaysLeft, PLAN_DISPLAY_NAMES } from '@/lib/plan-limits'

interface TrialBannerProps {
  plan: RestaurantPlan
  trialEndsAt: string | null
}

export function TrialBanner({ plan, trialEndsAt }: TrialBannerProps) {
  const router = useRouter()

  if (plan === 'trial') {
    const daysLeft = getTrialDaysLeft(trialEndsAt)
    const urgent = daysLeft <= 3

    return (
      <div style={{
        background: urgent ? '#431407' : 'var(--accent-subtle)',
        border: `1px solid ${urgent ? '#fb923c44' : 'var(--accent)'}33`,
        borderRadius: '12px',
        padding: '14px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <p style={{
            color: urgent ? '#fdba74' : 'var(--accent)',
            fontWeight: 700,
            fontSize: '0.875rem',
            marginBottom: '2px',
          }}>
            {daysLeft > 0
              ? `Testphase: noch ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tage'}`
              : 'Testphase abgelaufen'
            }
          </p>
          <p style={{
            color: urgent ? '#fb923c88' : 'var(--text-muted)',
            fontSize: '0.8rem',
          }}>
            {daysLeft > 0
              ? 'Alle Pro-Features sind freigeschaltet. Wähle einen Plan, um weiterzumachen.'
              : 'Deine Bestellseite ist offline. Wähle einen Plan, um sie zu reaktivieren.'
            }
          </p>
        </div>
        <button
          onClick={() => router.push('/admin/billing')}
          style={{
            padding: '8px 20px',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--accent)',
            color: 'var(--accent-text)',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Plan wählen
        </button>
      </div>
    )
  }

  if (plan === 'expired') {
    return (
      <div style={{
        background: '#431407',
        border: '1px solid #fb923c44',
        borderRadius: '12px',
        padding: '14px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <p style={{ color: '#fdba74', fontWeight: 700, fontSize: '0.875rem', marginBottom: '2px' }}>
            Abo abgelaufen
          </p>
          <p style={{ color: '#fb923c88', fontSize: '0.8rem' }}>
            Deine Bestellseite ist offline. Wähle einen Plan, um sie zu reaktivieren.
          </p>
        </div>
        <button
          onClick={() => router.push('/admin/billing')}
          style={{
            padding: '8px 20px', borderRadius: '8px', border: 'none',
            background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 700,
            fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          Plan wählen
        </button>
      </div>
    )
  }

  return null
}
