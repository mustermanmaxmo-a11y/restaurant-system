'use client'

export function LegalFooter() {
  return (
    <footer style={{
      width: '100%',
      padding: '20px 24px',
      borderTop: '1px solid var(--border, #e0e0e0)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '24px',
      flexWrap: 'wrap',
    }}>
      <a href="/impressum" style={{ color: 'var(--text-muted, #888)', fontSize: '0.8rem', textDecoration: 'none' }}>
        Impressum
      </a>
      <a href="/datenschutz" style={{ color: 'var(--text-muted, #888)', fontSize: '0.8rem', textDecoration: 'none' }}>
        Datenschutz
      </a>
      <a href="/agb" style={{ color: 'var(--text-muted, #888)', fontSize: '0.8rem', textDecoration: 'none' }}>
        AGB
      </a>
    </footer>
  )
}
