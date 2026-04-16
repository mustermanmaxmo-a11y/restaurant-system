import Link from 'next/link'

type Props = {
  title: string
  stand?: string
  html: string | null
  fallback?: React.ReactNode
}

export function LegalPageShell({ title, stand, html, fallback }: Props) {
  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: '48px 24px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', fontFamily: 'sans-serif' }}>
        <Link href="/" style={{ color: '#6c63ff', fontSize: '0.875rem', textDecoration: 'none', display: 'inline-block', marginBottom: '32px' }}>
          ← Zurück
        </Link>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '8px' }}>{title}</h1>
        {stand && (
          <p style={{ color: '#888', fontSize: '0.875rem', marginBottom: '40px' }}>{stand}</p>
        )}

        <div className="legal-content" style={{ color: '#444', fontSize: '0.875rem', lineHeight: 1.75 }}>
          {html
            ? <div dangerouslySetInnerHTML={{ __html: html }} />
            : fallback ?? <p style={{ color: '#888' }}>Inhalt noch nicht verfügbar.</p>
          }
        </div>

        <style>{`
          .legal-content h2 {
            font-size: 1.05rem;
            font-weight: 700;
            color: #1a1a2e;
            margin: 32px 0 14px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e0e0e0;
          }
          .legal-content h3 {
            font-size: 0.95rem;
            font-weight: 700;
            color: #1a1a2e;
            margin: 20px 0 10px;
          }
          .legal-content p { margin-bottom: 10px; }
          .legal-content ul { padding-left: 20px; margin: 8px 0 12px; }
          .legal-content li { margin-bottom: 4px; }
          .legal-content a { color: #6c63ff; }
        `}</style>
      </div>
    </div>
  )
}
