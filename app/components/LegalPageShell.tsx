import Link from 'next/link'

type Props = {
  title: string
  stand?: string
  html: string | null
  fallback?: React.ReactNode
}

export function LegalPageShell({ title, stand, html, fallback }: Props) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '48px 24px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', fontFamily: 'sans-serif' }}>
        <Link href="/" style={{ color: 'var(--accent)', fontSize: '0.875rem', textDecoration: 'none', display: 'inline-block', marginBottom: '32px' }}>
          ← Zurück
        </Link>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>{title}</h1>
        {stand && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '40px' }}>{stand}</p>
        )}

        <div className="legal-content" style={{ color: 'var(--text)', fontSize: '0.875rem', lineHeight: 1.75 }}>
          {html
            ? <div dangerouslySetInnerHTML={{ __html: html }} />
            : fallback ?? <p style={{ color: 'var(--text-muted)' }}>Inhalt noch nicht verfügbar.</p>
          }
        </div>

        <style>{`
          .legal-content h2 {
            font-size: 1.05rem;
            font-weight: 700;
            color: var(--text);
            margin: 32px 0 14px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border);
          }
          .legal-content h3 {
            font-size: 0.95rem;
            font-weight: 700;
            color: var(--text);
            margin: 20px 0 10px;
          }
          .legal-content p { margin-bottom: 10px; }
          .legal-content ul { padding-left: 20px; margin: 8px 0 12px; }
          .legal-content li { margin-bottom: 4px; }
          .legal-content a { color: var(--accent); }
        `}</style>
      </div>
    </div>
  )
}
