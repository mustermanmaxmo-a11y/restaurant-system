import Link from 'next/link'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { LEGAL_LABELS, LEGAL_PUBLIC_PATH, type LegalKey } from '@/lib/legal'
import { FileText, ExternalLink, Pencil, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

const KEYS: LegalKey[] = ['agb', 'datenschutz', 'impressum', 'cookie_banner']

export default async function PlatformLegal() {
  const { role } = await requirePlatformAccess()
  const admin = createSupabaseAdmin()

  const { data: docs } = await admin
    .from('legal_documents')
    .select('key, updated_at, draft_content, draft_updated_at')

  const byKey: Record<string, { updated_at: string | null; hasDraft: boolean; draft_updated_at: string | null }> = {}
  for (const d of docs ?? []) {
    byKey[d.key] = {
      updated_at: d.updated_at,
      hasDraft: !!d.draft_content,
      draft_updated_at: d.draft_updated_at,
    }
  }

  const isOwner = role === 'owner'

  return (
    <div style={{ padding: '32px 24px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>Rechtstexte</h1>
        <p style={{ color: '#888', fontSize: '0.85rem' }}>
          {isOwner
            ? 'Du kannst Texte direkt live speichern oder Drafts von Co-Foundern genehmigen.'
            : 'Deine Änderungen werden zur Freigabe eingereicht und gehen erst nach Owner-OK live.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {KEYS.map(key => {
          const doc = byKey[key]
          const publicPath = LEGAL_PUBLIC_PATH[key]
          const hasDraft = doc?.hasDraft ?? false

          return (
            <div key={key} style={{
              background: '#242438',
              border: `1px solid ${hasDraft && isOwner ? '#f59e0b' : '#2a2a3e'}`,
              borderRadius: '14px',
              padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px',
              position: 'relative',
            }}>
              {hasDraft && isOwner && (
                <div style={{
                  position: 'absolute', top: '-8px', right: '14px',
                  background: '#f59e0b', borderRadius: '6px',
                  padding: '2px 8px', fontSize: '0.65rem', fontWeight: 800,
                  color: '#000', textTransform: 'uppercase', letterSpacing: '0.05em',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                  <Clock size={10} /> Freigabe ausstehend
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: hasDraft && isOwner ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <FileText size={16} color={hasDraft && isOwner ? '#f59e0b' : '#ef4444'} />
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>{LEGAL_LABELS[key]}</div>
                  <div style={{ color: '#666', fontSize: '0.7rem', fontFamily: 'ui-monospace, monospace' }}>{key}</div>
                </div>
              </div>

              <div style={{ color: '#888', fontSize: '0.75rem' }}>
                {doc?.updated_at
                  ? <>Live seit: <span style={{ color: '#ccc' }}>{formatDateTime(doc.updated_at)}</span></>
                  : <span style={{ color: '#f59e0b' }}>Noch nicht veröffentlicht</span>
                }
                {hasDraft && doc?.draft_updated_at && (
                  <div style={{ marginTop: '4px', color: '#f59e0b' }}>
                    Draft vom {formatDateTime(doc.draft_updated_at)}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <Link href={`/platform/legal/${key}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '8px',
                  background: hasDraft && isOwner ? '#f59e0b' : '#ef4444', color: hasDraft && isOwner ? '#000' : '#fff',
                  fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none',
                }}>
                  <Pencil size={13} />
                  {hasDraft && isOwner ? 'Freigabe prüfen' : 'Bearbeiten'}
                </Link>
                {publicPath && (
                  <a href={publicPath} target="_blank" rel="noreferrer" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '8px',
                    background: 'transparent', color: '#888',
                    border: '1px solid #2a2a3e',
                    fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
                  }}>
                    <ExternalLink size={13} /> Vorschau
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
