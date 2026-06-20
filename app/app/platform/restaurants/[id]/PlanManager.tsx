'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Plan = 'trial' | 'starter' | 'pro' | 'enterprise' | 'expired'

const PLAN_LABELS: Record<Plan, string> = {
  trial: 'Trial', starter: 'Starter', pro: 'Professional',
  enterprise: 'Enterprise', expired: 'Abgelaufen',
}
const PLAN_COLORS: Record<Plan, { bg: string; fg: string }> = {
  trial:      { bg: '#1e3a8a', fg: '#93c5fd' },
  starter:    { bg: '#065f46', fg: '#6ee7b7' },
  pro:        { bg: '#92400e', fg: '#fcd34d' },
  enterprise: { bg: '#581c87', fg: '#e9d5ff' },
  expired:    { bg: '#450a0a', fg: '#fca5a5' },
}

export function PlanManager({
  restaurantId, currentPlan, trialEndsAt,
}: {
  restaurantId: string
  currentPlan: Plan
  trialEndsAt: string | null
}) {
  const [plan, setPlan] = useState<Plan>(currentPlan)
  const [trialDays, setTrialDays] = useState('14')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    setSaved(false)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/platform/restaurants/${restaurantId}/plan`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ plan, trialDays: Number(trialDays) }),
    })
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } else {
      const j = await res.json()
      setError(j.error ?? 'Fehler')
    }
    setSaving(false)
  }

  const c = PLAN_COLORS[plan]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(Object.keys(PLAN_LABELS) as Plan[]).map(p => (
          <button
            key={p}
            onClick={() => { setPlan(p); setSaved(false) }}
            style={{
              padding: '6px 14px', borderRadius: '20px', border: 'none',
              cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
              background: plan === p ? PLAN_COLORS[p].bg : 'rgba(255,255,255,0.05)',
              color: plan === p ? PLAN_COLORS[p].fg : '#555',
              outline: plan === p ? `1px solid ${PLAN_COLORS[p].fg}40` : 'none',
              transition: 'all 0.15s',
            }}
          >{PLAN_LABELS[p]}</button>
        ))}
      </div>

      {plan === 'trial' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#888', fontSize: '0.8rem' }}>Trial verlängern um</span>
          <input
            type="number"
            value={trialDays}
            onChange={e => setTrialDays(e.target.value)}
            min="1"
            max="365"
            style={{
              width: '64px', padding: '6px 10px', borderRadius: '8px',
              border: '1px solid #2a2a3e', background: '#1a1a2e',
              color: '#fff', fontSize: '0.85rem', outline: 'none', textAlign: 'center',
            }}
          />
          <span style={{ color: '#888', fontSize: '0.8rem' }}>Tage</span>
          {trialEndsAt && (
            <span style={{ color: '#555', fontSize: '0.75rem' }}>
              (aktuell bis {new Date(trialEndsAt).toLocaleDateString('de-DE')})
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '8px 20px', borderRadius: '8px', border: 'none',
            background: saving ? '#2a2a3e' : c.bg,
            color: saving ? '#666' : c.fg,
            fontSize: '0.82rem', fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {saving ? 'Speichert…' : `Auf ${PLAN_LABELS[plan]} setzen`}
        </button>
        {saved && <span style={{ color: '#10b981', fontSize: '0.8rem' }}>✓ Gespeichert</span>}
        {error && <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>{error}</span>}
      </div>
    </div>
  )
}
