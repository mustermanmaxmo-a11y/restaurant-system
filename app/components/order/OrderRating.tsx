'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { trackEvent } from '@/lib/marketing/trackEvent'
import type { ColorSet } from '@/lib/color-utils'

interface OrderRatingProps {
  orderId: string
  restaurantId: string
  googleReviewUrl: string | null
  C: ColorSet | null
}

const spring = { type: 'spring' as const, stiffness: 420, damping: 26 }
const springBouncy = { type: 'spring' as const, stiffness: 500, damping: 18 }

type Step = 'stars' | 'feedback' | 'done'

export function OrderRating({ orderId, restaurantId, googleReviewUrl, C: CProp }: OrderRatingProps) {
  const C = CProp ?? {
    surface: 'var(--surface, #1a1a1a)',
    surface2: 'var(--surface2, #222)',
    border: 'var(--border, #333)',
    text: 'var(--text, #fff)',
    muted: 'var(--text-muted, #888)',
    accent: 'var(--accent, #ea580c)',
  } as ColorSet
  const [step, setStep] = useState<Step>('stars')
  const [hovered, setHovered] = useState(0)
  const [selected, setSelected] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submitRating(stars: number, feedbackText?: string) {
    setSubmitting(true)
    await supabase.from('order_ratings').insert({
      order_id: orderId,
      restaurant_id: restaurantId,
      stars,
      feedback: feedbackText ?? null,
    })
    setSubmitting(false)
    setStep('done')
  }

  async function handleStarClick(stars: number) {
    setSelected(stars)
    if (stars >= 4 && googleReviewUrl) {
      // Positive: save rating + show Google button
      await submitRating(stars)
    } else {
      // Negative or no Google URL: show feedback form
      setStep('feedback')
    }
  }

  async function handleFeedbackSubmit() {
    if (!feedback.trim()) return
    await submitRating(selected, feedback)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.3 }}
      style={{
        background: C.surface,
        borderRadius: '18px',
        padding: '24px 20px',
        marginBottom: '16px',
        border: `1px solid ${C.border}`,
        textAlign: 'center',
      }}
    >
      <AnimatePresence mode="wait">

        {/* Stars step */}
        {step === 'stars' && (
          <motion.div key="stars" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p style={{ color: C.muted, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
              Wie war dein Besuch?
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <motion.button
                  key={star}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => handleStarClick(star)}
                  whileTap={{ scale: 0.82 }}
                  transition={springBouncy}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    fontSize: '2rem',
                    lineHeight: 1,
                    filter: (hovered || selected) >= star ? 'none' : 'grayscale(1) opacity(0.3)',
                    transform: (hovered || selected) >= star ? 'scale(1.1)' : 'scale(1)',
                    transition: 'filter 0.15s, transform 0.15s',
                  }}
                >
                  ⭐
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Feedback step (1-3 stars or no Google URL) */}
        {step === 'feedback' && (
          <motion.div key="feedback" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <p style={{ color: C.text, fontWeight: 700, fontSize: '0.95rem', marginBottom: '6px' }}>
              Was können wir verbessern?
            </p>
            <p style={{ color: C.muted, fontSize: '0.8rem', marginBottom: '14px' }}>
              Dein Feedback hilft uns, besser zu werden.
            </p>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Dein Feedback..."
              rows={3}
              style={{
                width: '100%',
                background: C.surface2,
                border: `1px solid ${C.border}`,
                borderRadius: '10px',
                padding: '12px',
                color: C.text,
                fontSize: '0.875rem',
                resize: 'none',
                marginBottom: '12px',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <motion.button
              onClick={handleFeedbackSubmit}
              disabled={submitting || !feedback.trim()}
              whileTap={{ scale: 0.97 }}
              transition={spring}
              style={{
                width: '100%',
                background: C.accent,
                border: 'none',
                borderRadius: '12px',
                padding: '13px',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: feedback.trim() ? 'pointer' : 'not-allowed',
                opacity: feedback.trim() ? 1 : 0.5,
              }}
            >
              {submitting ? 'Wird gesendet…' : 'Feedback senden'}
            </motion.button>
          </motion.div>
        )}

        {/* Done step */}
        {step === 'done' && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={springBouncy}>
            {selected >= 4 && googleReviewUrl ? (
              <>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎉</div>
                <p style={{ color: C.text, fontWeight: 700, fontSize: '0.95rem', marginBottom: '6px' }}>
                  Danke für deine Bewertung!
                </p>
                <p style={{ color: C.muted, fontSize: '0.8rem', marginBottom: '16px' }}>
                  Magst du uns auch auf Google eine Bewertung hinterlassen?
                </p>
                <a
                  href={googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackEvent({
                      restaurantId,
                      eventType: 'google_review_clicked',
                      props: { source: 'in_app_rating', order_id: orderId },
                    })
                  }}
                  style={{
                    display: 'block',
                    background: C.accent,
                    color: '#fff',
                    borderRadius: '12px',
                    padding: '13px',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                  }}
                >
                  ⭐ Auf Google bewerten
                </a>
              </>
            ) : (
              <>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🙏</div>
                <p style={{ color: C.text, fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>
                  Danke für dein Feedback!
                </p>
                <p style={{ color: C.muted, fontSize: '0.8rem' }}>
                  Wir arbeiten daran, noch besser zu werden.
                </p>
              </>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  )
}
