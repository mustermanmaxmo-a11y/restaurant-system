import Link from 'next/link'
import { Home } from 'lucide-react'
import { Button } from '@/components/ui'

/** Gebrandete 404-Seite für unbekannte URLs (rendert im Root-Layout). */
export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <p className="font-heading text-6xl font-extrabold tracking-tight text-accent-fg">404</p>
      <h1 className="mt-4 text-xl font-bold text-text">Seite nicht gefunden</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Diese Seite existiert nicht oder wurde verschoben. Prüfe die Adresse oder geh zurück zur Startseite.
      </p>
      <Button asChild className="mt-6">
        <Link href="/"><Home size={16} /> Zur Startseite</Link>
      </Button>
    </main>
  )
}
