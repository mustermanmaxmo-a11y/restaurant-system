'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

/**
 * Auffang für Fehler im Root-Layout selbst. Ersetzt das Layout komplett,
 * daher eigenes html/body und Inline-Styles (keine Tokens/Fonts verfügbar).
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="de">
      <body style={{ margin: 0, background: '#0C0C0E', color: '#F2F2F2', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Etwas ist schiefgelaufen</h1>
          <p style={{ marginTop: '8px', maxWidth: '360px', fontSize: '0.875rem', color: '#8A8A8A' }}>
            Der Fehler wurde gemeldet. Versuch es erneut oder lade die Seite neu.
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{ marginTop: '24px', background: '#0E7490', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Erneut versuchen
          </button>
        </main>
      </body>
    </html>
  )
}
