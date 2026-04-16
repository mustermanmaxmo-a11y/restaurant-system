import Link from 'next/link'
import { listLegalDocuments, LEGAL_LABELS, LEGAL_PUBLIC_PATH, type LegalKey } from '@/lib/legal'
import { FileText, ExternalLink, Pencil } from 'lucide-react'

export const dynamic = 'force-dynamic'

const KEYS: LegalKey[] = ['agb', 'datenschutz', 'impressum', 'cookie_banner']

export default async function PlatformLegal() {
  const docs = await listLegalDocuments()
  const updatedByKey: Record<string, string | null> = {}
  for (const d of docs) updatedByKey[d.key] = d.updated_at

  return (
    <div style={{ padding: '32px 24px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>Rechtstexte</h1>
        <p style={{ color: '#888', fontSize: '0.85rem' }}>
          Live-editierbare Texte. Änderungen gehen sofort auf die öffentlichen Seiten (Revalidate).
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {KEYS.map(key => {
          const updated = updatedByKey[key]
          const publicPath = LEGAL_PUBLIC_PATH[key]
          return (
            <div key={key} style={{
              background: '#242438', border: '1px solid #2a2a3e', borderRadius: '14px',
              padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: 'rgba(239,68,68,0.12)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <FileText size={16} color="#ef4444" />
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>{LEGAL_LABELS[key]}</div>
                  <div style={{ color: '#666', fontSize: '0.7rem', fontFamily: 'ui-monospace, monospace' }}>{key}</div>
                </div>
              </div>

              <div style={{ color: '#888', fontSize: '0.75rem' }}>
                {updated
                  ? <>Zuletzt geändert: <span style={{ color: '#ccc' }}>{formatDateTime(updated)}</span></>
                  : <span style={{ color: '#f59e0b' }}>Noch nicht angelegt</span>
                }
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <Link href={`/platform/legal/${key}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '8px',
                  background: '#ef4444', color: '#fff',
                  fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none',
                }}>
                  <Pencil size={13} /> Bearbeiten
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
