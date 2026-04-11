'use client'

import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

interface UpgradeHintProps {
  feature: string
  requiredPlan?: 'pro' | 'enterprise'
}

export function UpgradeHint({ feature, requiredPlan = 'pro' }: UpgradeHintProps) {
  const router = useRouter()
  const planLabel = requiredPlan === 'enterprise' ? 'Enterprise' : 'Professional'

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px dashed var(--border)',
      borderRadius: '16px',
      padding: '40px 24px',
      textAlign: 'center',
    }}>
      <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}><Lock size={32} color="var(--accent)" /></div>
      <p style={{
        color: 'var(--text)',
        fontWeight: 700,
        fontSize: '1rem',
        marginBottom: '8px',
      }}>
        {feature}
      </p>
      <p style={{
        color: 'var(--text-muted)',
        fontSize: '0.85rem',
        marginBottom: '20px',
      }}>
        Verfügbar im {planLabel}-Plan
      </p>
      <button
        onClick={() => router.push('/admin/billing')}
        style={{
          padding: '10px 24px',
          borderRadius: '10px',
          border: 'none',
          background: 'var(--accent)',
          color: '#fff',
          fontWeight: 700,
          fontSize: '0.85rem',
          cursor: 'pointer',
        }}
      >
        Upgrade auf {planLabel}
      </button>
    </div>
  )
}
