'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui'

/** Fehler-Boundary für Route-Segmente. Meldet an Sentry und bietet Wiederholen an. */
export default function Error({
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
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-bold text-text">Etwas ist schiefgelaufen</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Der Fehler wurde automatisch gemeldet. Versuch es erneut — wenn es weiter hakt, lade die Seite neu.
      </p>
      <Button onClick={() => unstable_retry()} className="mt-6">
        <RotateCcw size={16} /> Erneut versuchen
      </Button>
      {error.digest && (
        <p className="mt-4 text-2xs text-muted/70">Fehler-ID: {error.digest}</p>
      )}
    </main>
  )
}
