import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { LEGAL_LABELS, LEGAL_PUBLIC_PATH, type LegalKey } from '@/lib/legal'
import { LegalEditor } from '@/components/LegalEditor'
import { ChevronLeft, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

const VALID_KEYS: LegalKey[] = ['agb', 'datenschutz', 'impressum', 'cookie_banner']

export default async function LegalEditorPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  if (!VALID_KEYS.includes(key as LegalKey)) notFound()

  const { role } = await requirePlatformAccess()
  if (role !== 'owner' && role !== 'co_founder') redirect('/platform')

  const typedKey = key as LegalKey
  const admin = createSupabaseAdmin()

  const { data: doc } = await admin
    .from('legal_documents')
    .select('content, draft_content')
    .eq('key', typedKey)
    .maybeSingle()

  const content = doc?.content ?? ''
  const draftContent = doc?.draft_content ?? null
  const publicPath = LEGAL_PUBLIC_PATH[typedKey]

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1400px', margin: '0 auto' }}>
      <Link href="/platform/legal" style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        color: '#888', fontSize: '0.8rem', textDecoration: 'none', marginBottom: '12px',
      }}>
        <ChevronLeft size={14} /> Zurück zu Rechtstexten
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
            {LEGAL_LABELS[typedKey]}
          </h1>
          <p style={{ color: '#888', fontSize: '0.8rem' }}>
            {role === 'owner'
              ? 'Direkt bearbeiten und live schalten.'
              : 'Änderungen werden zur Freigabe eingereicht.'}
          </p>
        </div>
        {publicPath && (
          <a href={publicPath} target="_blank" rel="noreferrer" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '8px',
            background: 'transparent', color: '#888',
            border: '1px solid #2a2a3e',
            fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
          }}>
            <ExternalLink size={13} /> Vorschau öffnen
          </a>
        )}
      </div>

      <LegalEditor
        legalKey={typedKey}
        initialContent={content}
        role={role as 'owner' | 'co_founder'}
        draftContent={draftContent}
      />
    </div>
  )
}
