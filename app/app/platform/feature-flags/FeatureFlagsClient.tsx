'use client'

import { useState, useTransition } from 'react'
import { supabase } from '@/lib/supabase'

type FlagKey =
  | 'auto_translate_enabled'
  | 'email_marketing_enabled'
  | 'weekly_report_email'
  | 'prep_show_in_kds'
  | 'prep_push_enabled'
  | 'benchmark_opt_in'
  | 'crm_rule_inactive'
  | 'crm_rule_almost_goal'
  | 'crm_rule_welcome'
  | 'referral_enabled'

const FLAG_GROUPS: { label: string; flags: { key: FlagKey; label: string }[] }[] = [
  {
    label: 'Marketing & CRM',
    flags: [
      { key: 'email_marketing_enabled', label: 'E-Mail Marketing' },
      { key: 'weekly_report_email', label: 'Wochenbericht' },
      { key: 'referral_enabled', label: 'Referral Program' },
      { key: 'crm_rule_inactive', label: 'CRM: Inaktiv-Trigger' },
      { key: 'crm_rule_almost_goal', label: 'CRM: Fast-Ziel-Trigger' },
      { key: 'crm_rule_welcome', label: 'CRM: Willkommen-Trigger' },
    ],
  },
  {
    label: 'KI & System',
    flags: [
      { key: 'auto_translate_enabled', label: 'Auto-Übersetzung' },
      { key: 'benchmark_opt_in', label: 'Benchmark Opt-In' },
    ],
  },
  {
    label: 'Küche / KDS',
    flags: [
      { key: 'prep_show_in_kds', label: 'Im KDS anzeigen' },
      { key: 'prep_push_enabled', label: 'KDS Push-Benachrichtigung' },
    ],
  },
]

type Restaurant = {
  id: string
  name: string
  slug: string
  flags: Record<FlagKey, boolean>
}

export function FeatureFlagsClient({ restaurants }: { restaurants: Restaurant[] }) {
  const [states, setStates] = useState<Record<string, Record<FlagKey, boolean>>>(
    Object.fromEntries(restaurants.map(r => [r.id, r.flags]))
  )
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [, startTransition] = useTransition()

  async function toggle(restaurantId: string, flag: FlagKey, value: boolean) {
    const key = `${restaurantId}:${flag}`
    setPending(p => ({ ...p, [key]: true }))

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/platform/feature-flags', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ restaurantId, flag, value }),
    })

    if (res.ok) {
      startTransition(() => {
        setStates(prev => ({
          ...prev,
          [restaurantId]: { ...prev[restaurantId], [flag]: value },
        }))
      })
    }
    setPending(p => { const n = { ...p }; delete n[key]; return n })
  }

  if (restaurants.length === 0) {
    return <p style={{ color: '#666', fontSize: '0.85rem' }}>Noch keine Restaurants.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {restaurants.map(r => (
        <div key={r.id} style={{
          background: '#242438', border: '1px solid #2a2a3e',
          borderRadius: '14px', overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 18px', background: '#1f1f30',
            borderBottom: '1px solid #2a2a3e',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <div>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.88rem' }}>{r.name}</span>
              <span style={{ color: '#555', fontSize: '0.75rem', marginLeft: '8px' }}>/{r.slug}</span>
            </div>
          </div>

          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {FLAG_GROUPS.map(group => (
              <div key={group.label}>
                <p style={{
                  color: '#555', fontSize: '0.65rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px',
                }}>{group.label}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {group.flags.map(({ key, label }) => {
                    const isOn = states[r.id]?.[key] ?? false
                    const isPending = pending[`${r.id}:${key}`]
                    return (
                      <button
                        key={key}
                        onClick={() => toggle(r.id, key, !isOn)}
                        disabled={isPending}
                        title={key}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '7px',
                          padding: '6px 12px', borderRadius: '20px', border: 'none',
                          background: isOn ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                          color: isOn ? '#10b981' : '#555',
                          fontSize: '0.78rem', fontWeight: 600,
                          cursor: isPending ? 'wait' : 'pointer',
                          opacity: isPending ? 0.6 : 1,
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{
                          width: '7px', height: '7px', borderRadius: '50%',
                          background: isOn ? '#10b981' : '#444',
                          flexShrink: 0,
                        }} />
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
