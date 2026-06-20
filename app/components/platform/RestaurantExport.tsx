'use client'

import { Download } from 'lucide-react'

type ExportRow = {
  id: string
  name: string
  slug: string
  plan: string
  active: boolean
  trial_ends_at: string | null
  created_at: string
  owner_email: string
  stripe_subscription_id: string | null
}

export function RestaurantExport({ rows }: { rows: ExportRow[] }) {
  function download() {
    const headers = ['Name', 'Slug', 'Plan', 'Status', 'Trial-Ende', 'Owner E-Mail', 'Stripe Sub', 'Angelegt']
    const lines = rows.map(r => [
      r.name,
      r.slug,
      r.plan,
      r.active ? 'aktiv' : 'inaktiv',
      r.trial_ends_at ? new Date(r.trial_ends_at).toLocaleDateString('de-DE') : '',
      r.owner_email,
      r.stripe_subscription_id ?? '',
      new Date(r.created_at).toLocaleDateString('de-DE'),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))

    const csv = [headers.join(';'), ...lines].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `restaurants-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={download}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 14px', borderRadius: '8px', border: '1px solid #2a2a3e',
        background: 'transparent', color: '#888', fontSize: '0.8rem',
        cursor: 'pointer', fontWeight: 600, transition: 'color 0.15s',
      }}
    >
      <Download size={13} />
      CSV
    </button>
  )
}
