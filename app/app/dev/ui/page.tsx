import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { UiGallery } from './UiGallery'

export const metadata: Metadata = {
  title: 'UI-Primitives',
  robots: { index: false, follow: false },
}

/** Interne Vorschau aller UI-Primitives. Nur im Dev-Modus erreichbar. */
export default function DevUiPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <UiGallery />
}
