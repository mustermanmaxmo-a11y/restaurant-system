'use client'

import { useState } from 'react'
import { trackEvent } from '@/lib/marketing/trackEvent'

interface Props {
  orderId: string
  restaurantId: string
  stars: number
  token: string
  restaurantName: string
  logoUrl: string | null
  googleReviewUrl: string | null
  primaryColor: string
}

export function FeedbackClient({ orderId, restaurantId, stars, token, restaurantName, logoUrl, googleReviewUrl, primaryColor }: Props) {
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const positive = stars >= 4
  const showGoogle = positive && !!googleReviewUrl

  async function handleSubmit() {
    if (!feedback.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, stars, token, feedback: feedback.trim() }),
      })
      if (!res.ok) {
        const { error: e } = await res.json().catch(() => ({ error: 'Fehler' }))
        setError(e ?? 'Konnte Feedback nicht senden.')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Netzwerkfehler. Bitte später versuchen.')
    }
    setSubmitting(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f5', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', padding: '40px 16px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', background: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
        {/* Header */}
        <div style={{ padding: '32px 32px 20px', textAlign: 'center', borderBottom: '1px solid #e4e4e7' }}>
          {logoUrl ? (
            <img src={logoUrl} alt={restaurantName} height={44} style={{ maxWidth: '180px', height: '44px', objectFit: 'contain', display: 'block', margin: '0 auto 12px' }} />
          ) : (
            <p style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: '#0a0a0a', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{restaurantName}</p>
          )}
        </div>

        {/* Stars (read-only display) */}
        <div style={{ padding: '32px 32px 16px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 700, color: '#71717a', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Deine Bewertung</p>
          <div style={{ marginBottom: '16px' }}>
            {[1, 2, 3, 4, 5].map(n => (
              <span key={n} style={{ display: 'inline-block', padding: '0 4px', fontSize: '36px', lineHeight: 1, color: n <= stars ? '#facc15' : '#d4d4d8' }}>★</span>
            ))}
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 700, color: '#0a0a0a', letterSpacing: '-0.02em' }}>
            {submitted ? 'Vielen Dank!' : positive ? 'Danke für deine Bewertung!' : 'Danke für dein Feedback'}
          </h1>
          <p style={{ margin: 0, fontSize: '15px', color: '#71717a', lineHeight: 1.6 }}>
            {submitted
              ? `Wir freuen uns sehr — bis bald bei ${restaurantName}!`
              : showGoogle
                ? `Würdest du uns auch bei Google bewerten? Das hilft ${restaurantName} sehr.`
                : positive
                  ? 'Magst du uns kurz sagen, was dir besonders gefallen hat?'
                  : 'Was können wir besser machen? Dein Feedback hilft uns wirklich.'}
          </p>
        </div>

        {/* Action area */}
        {!submitted && (
          <div style={{ padding: '0 32px 32px' }}>
            {showGoogle && (
              <a
                href={googleReviewUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackEvent({
                    restaurantId,
                    eventType: 'google_review_clicked',
                    props: { source: 'email_landing', order_id: orderId },
                  })
                }}
                style={{
                  display: 'block', textAlign: 'center', textDecoration: 'none',
                  background: primaryColor, color: '#ffffff',
                  padding: '16px', borderRadius: '12px',
                  fontSize: '15px', fontWeight: 700,
                  marginBottom: '14px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              >
                ★ Auf Google bewerten
              </a>
            )}

            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder={positive ? 'Was hat dir gefallen? (optional)' : 'Was können wir verbessern?'}
              rows={4}
              maxLength={2000}
              style={{
                width: '100%',
                background: '#fafafa',
                border: '1px solid #e4e4e7',
                borderRadius: '12px',
                padding: '14px',
                fontSize: '15px',
                color: '#0a0a0a',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                marginBottom: '12px',
              }}
            />

            {error && (
              <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#dc2626' }}>{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || !feedback.trim()}
              style={{
                width: '100%',
                background: feedback.trim() ? '#0a0a0a' : '#a3a3a3',
                color: '#ffffff',
                border: 'none',
                padding: '14px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: submitting || !feedback.trim() ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                fontFamily: 'inherit',
              }}
            >
              {submitting ? 'Sende…' : 'Feedback senden'}
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '20px 32px 28px', textAlign: 'center', borderTop: '1px solid #f4f4f5' }}>
          <p style={{ margin: 0, fontSize: '11px', color: '#a3a3a3' }}>
            {restaurantName} · Bestellung #{orderId.slice(0, 8)}
          </p>
        </div>
      </div>
    </div>
  )
}
