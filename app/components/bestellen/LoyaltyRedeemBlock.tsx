'use client'

import type { LoyaltyMember, LoyaltyProgram } from '@/lib/loyalty/api'

interface Props {
  program: LoyaltyProgram | null
  member: LoyaltyMember | null
  applyReward: boolean
  onToggle: (next: boolean) => void
  accentColor?: string
}

export function LoyaltyRedeemBlock({
  program, member, applyReward, onToggle, accentColor = '#EA580C',
}: Props) {
  if (!program?.enabled || !member) return null

  const current = program.mechanic === 'stamps' ? member.stamp_count : member.points
  if (current < program.goal) return null

  const valueEur = (program.reward_value_cents / 100).toFixed(2).replace('.', ',')

  return (
    <div
      style={{
        background: accentColor + '15',
        border: `1px solid ${accentColor}40`,
        borderRadius: '12px',
        padding: '14px 16px',
        marginBottom: '12px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
      }}
    >
      <div style={{ fontSize: '1.4rem', lineHeight: 1 }}>⭐</div>
      <div style={{ flex: 1 }}>
        <p style={{ color: '#F5F5F7', fontWeight: 700, fontSize: '0.9rem', margin: 0, marginBottom: '4px' }}>
          Du hast {current}/{program.goal} {program.mechanic === 'stamps' ? 'Stempel' : 'Punkte'}!
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={applyReward}
            onChange={(e) => onToggle(e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor }}
          />
          <span style={{ color: '#F5F5F7', fontSize: '0.85rem' }}>
            Belohnung „{program.reward_text}" einlösen{' '}
            <span style={{ color: accentColor, fontWeight: 700 }}>(–{valueEur} €)</span>
          </span>
        </label>
      </div>
    </div>
  )
}
