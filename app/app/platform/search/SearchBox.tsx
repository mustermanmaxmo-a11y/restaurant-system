'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

const PLANS = ['all', 'trial', 'starter', 'pro', 'enterprise', 'expired']

export function SearchBox({ initialQ, initialPlan }: { initialQ: string; initialPlan: string }) {
  const [q, setQ] = useState(initialQ)
  const [plan, setPlan] = useState(initialPlan)
  const router = useRouter()
  const [, startTransition] = useTransition()

  function submit(nextQ = q, nextPlan = plan) {
    const params = new URLSearchParams()
    if (nextQ.trim()) params.set('q', nextQ.trim())
    if (nextPlan !== 'all') params.set('plan', nextPlan)
    startTransition(() => {
      router.push(`/platform/search?${params.toString()}`)
    })
  }

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      <input
        type="text"
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="Name oder Slug…"
        autoFocus
        style={{
          flex: 1, minWidth: '200px', padding: '10px 14px', borderRadius: '10px',
          border: '1px solid #2a2a3e', background: '#1a1a2e', color: '#fff',
          fontSize: '0.9rem', outline: 'none',
        }}
      />
      <select
        value={plan}
        onChange={e => { setPlan(e.target.value); submit(q, e.target.value) }}
        style={{
          padding: '10px 14px', borderRadius: '10px',
          border: '1px solid #2a2a3e', background: '#1a1a2e', color: '#ccc',
          fontSize: '0.85rem', outline: 'none', cursor: 'pointer',
        }}
      >
        {PLANS.map(p => <option key={p} value={p}>{p === 'all' ? 'Alle Pläne' : p}</option>)}
      </select>
      <button
        onClick={() => submit()}
        style={{
          padding: '10px 20px', borderRadius: '10px', border: 'none',
          background: '#ef4444', color: '#fff', fontWeight: 700,
          fontSize: '0.85rem', cursor: 'pointer',
        }}
      >
        Suchen
      </button>
    </div>
  )
}
