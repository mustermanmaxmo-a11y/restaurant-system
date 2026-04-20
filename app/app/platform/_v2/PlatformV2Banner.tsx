'use client'

import { Sparkles } from 'lucide-react'

export default function PlatformV2Banner() {
  return (
    <div
      style={{
        margin: '16px 24px 0',
        padding: '10px 14px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, rgba(234,88,12,0.12), rgba(249,115,22,0.08))',
        border: '1px solid rgba(234,88,12,0.35)',
        color: '#fca48d',
        fontSize: '12px',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontFamily: 'var(--font-geist), system-ui, sans-serif',
      }}
    >
      <Sparkles size={13} />
      V2 Bento Premium aktiv für Platform — Rollout schrittweise pro Unterseite.
    </div>
  )
}
