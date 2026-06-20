'use client'

import { useState } from 'react'
import { Copy, ExternalLink, Mail, Check } from 'lucide-react'

export function QuickActions({
  slug, ownerEmail, restaurantName,
}: {
  slug: string
  ownerEmail: string
  restaurantName: string
}) {
  const [copied, setCopied] = useState(false)
  const guestUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://yourapp.com'}/${slug}`

  function copyUrl() {
    navigator.clipboard.writeText(guestUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const mailBody = encodeURIComponent(
    `Hallo,\n\nich möchte mich bezüglich Ihres Restaurants "${restaurantName}" bei OrderOS melden.\n\n`
  )
  const mailtoLink = `mailto:${ownerEmail}?subject=${encodeURIComponent(`OrderOS – ${restaurantName}`)}&body=${mailBody}`

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
      <button
        onClick={copyUrl}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', borderRadius: '8px', border: '1px solid #2a2a3e',
          background: 'transparent', color: copied ? '#10b981' : '#888',
          fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600,
          transition: 'color 0.15s',
        }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? 'Kopiert!' : 'Gast-URL kopieren'}
      </button>

      <a
        href={guestUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', borderRadius: '8px', border: '1px solid #2a2a3e',
          background: 'transparent', color: '#888',
          fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        <ExternalLink size={13} />
        App öffnen
      </a>

      {ownerEmail !== '—' && (
        <a
          href={mailtoLink}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '8px', border: '1px solid #2a2a3e',
            background: 'transparent', color: '#888',
            fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <Mail size={13} />
          Owner anschreiben
        </a>
      )}
    </div>
  )
}
