import { getLegalDocument } from '@/lib/legal'
import { LegalPageShell } from '@/components/LegalPageShell'

export const dynamic = 'force-dynamic'

export default async function DatenschutzPage() {
  const html = await getLegalDocument('datenschutz')
  return <LegalPageShell title="Datenschutzerklärung" stand="Stand: April 2026" html={html} />
}
