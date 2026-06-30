'use client'

export type PreviewPage = 'start' | 'speisekarte' | 'reservieren'
export type PreviewDevice = 'mobile' | 'desktop'

interface PreviewPaneProps {
  slug: string
  /** Bei jeder Änderung wird der iframe neu geladen. */
  reloadToken: number
  page: PreviewPage
  device: PreviewDevice
}

function buildSrc(slug: string, page: PreviewPage): string {
  switch (page) {
    case 'speisekarte': return `/bestellen/${slug}?preview=1`
    case 'reservieren': return `/bestellen/${slug}?tab=reserve&preview=1`
    case 'start':
    default: return `/${slug}/info?preview=1`
  }
}

export function PreviewPane({ slug, reloadToken, page, device }: PreviewPaneProps) {
  return (
    <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto', background: 'var(--surface-2)', display: 'flex', justifyContent: 'center', padding: device === 'mobile' ? '16px' : '0' }}>
      <iframe
        key={`${page}-${reloadToken}`}
        src={buildSrc(slug, page)}
        title="Vorschau"
        style={{
          border: device === 'mobile' ? '1px solid var(--border)' : 'none',
          borderRadius: device === 'mobile' ? '12px' : '0',
          width: device === 'mobile' ? '390px' : '100%',
          maxWidth: '100%',
          height: '100%',
          minHeight: '600px',
          background: '#fff',
        }}
      />
    </div>
  )
}
