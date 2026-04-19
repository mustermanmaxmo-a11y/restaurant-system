'use client'

export default function BentoOverview() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px',
    }}>
      <div style={{
        maxWidth: '600px',
        textAlign: 'center',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--card-radius, 12px)',
        padding: '40px 32px',
        boxShadow: 'var(--card-shadow, none)',
      }}>
        <div style={{
          display: 'inline-block',
          padding: '6px 14px',
          background: 'var(--gradient-accent, var(--accent))',
          color: '#fff',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          marginBottom: '20px',
        }}>V2 · Preview</div>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '32px',
          fontWeight: 700,
          marginBottom: '12px',
        }}>Bento Premium — aktiv</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6 }}>
          Dieser Platzhalter bestätigt, dass die V2-Umschaltung funktioniert.
          Das vollständige Bento-Dashboard wird in Phase 2 implementiert.
        </p>
      </div>
    </div>
  )
}
