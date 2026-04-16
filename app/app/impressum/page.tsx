import { getLegalDocument } from '@/lib/legal'
import { LegalPageShell } from '@/components/LegalPageShell'

export const dynamic = 'force-dynamic'

export default async function ImpressumPage() {
  const html = await getLegalDocument('impressum')
  return <LegalPageShell title="Impressum" stand="Angaben gemäß § 5 TMG" html={html} />
}
