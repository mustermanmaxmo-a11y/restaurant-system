'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { ColorSet } from '@/lib/color-utils'

interface ReferralShareProps {
  restaurantSlug: string
  referralCode: string
  rewardLabel: string  // e.g. "50 Punkte" oder "10% Rabatt"
  C: ColorSet | null
}

const spring = { type: 'spring' as const, stiffness: 420, damping: 26 }

export function ReferralShare({ restaurantSlug, referralCode, rewardLabel, C: CProp }: ReferralShareProps) {
  const C = CProp ?? {
    surface: 'var(--surface, #1a1a1a)',
    surface2: 'var(--surface2, #222)',
    border: 'var(--border, #333)',
    text: 'var(--text, #fff)',
    muted: 'var(--text-muted, #888)',
    accent: 'var(--accent, #ea580c)',
  } as ColorSet

  const [copied, setCopied] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const shareUrl = `${origin}/bestellen/${restaurantSlug}?ref=${referralCode}`

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleWhatsApp() {
    const text = encodeURIComponent(`Ich bestelle hier immer — probier es aus! ${shareUrl}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.5 }}
      style={{
        background: C.surface,
        borderRadius: '18px',
        padding: '24px 20px',
        marginBottom: '16px',
        border: `1px solid ${C.border}`,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '1.6rem', marginBottom: '6px' }}>🎁</div>
        <p style={{ color: C.text, fontWeight: 800, fontSize: '1rem', marginBottom: '4px', letterSpacing: '-0.01em' }}>
          Freunde einladen
        </p>
        <p style={{ color: C.muted, fontSize: '0.8rem', lineHeight: 1.5 }}>
          Teile deinen Link — du bekommst&nbsp;
          <span style={{ color: C.accent, fontWeight: 700 }}>{rewardLabel}</span>
          &nbsp;wenn jemand bestellt.
        </p>
      </div>

      {/* Link display */}
      <div style={{
        background: C.surface2,
        border: `1px solid ${C.border}`,
        borderRadius: '10px',
        padding: '10px 14px',
        fontSize: '0.75rem',
        color: C.muted,
        wordBreak: 'break-all',
        marginBottom: '12px',
        fontFamily: 'monospace',
      }}>
        {shareUrl}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <motion.button
          onClick={handleCopy}
          whileTap={{ scale: 0.97 }}
          transition={spring}
          style={{
            flex: 1,
            background: copied ? '#166534' : C.accent,
            border: 'none',
            borderRadius: '12px',
            padding: '12px',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {copied ? '✓ Kopiert!' : 'Link kopieren'}
        </motion.button>

        <motion.button
          onClick={handleWhatsApp}
          whileTap={{ scale: 0.97 }}
          transition={spring}
          style={{
            flex: 1,
            background: '#25D366',
            border: 'none',
            borderRadius: '12px',
            padding: '12px',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          WhatsApp
        </motion.button>
      </div>
    </motion.div>
  )
}
