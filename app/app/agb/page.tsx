import { getLegalDocument } from '@/lib/legal'
import { LegalPageShell } from '@/components/LegalPageShell'

export const dynamic = 'force-dynamic'

export default async function AgbPage() {
  const html = await getLegalDocument('agb')
  return <LegalPageShell title="Allgemeine Geschäftsbedingungen" stand="Stand: April 2026" html={html} />
}
