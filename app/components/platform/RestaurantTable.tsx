'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { PaymentToggle } from './PaymentToggle'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

export type TableRow = {
  id: string; name: string; slug: string; plan: string; active: boolean
  trial_ends_at: string | null; created_at: string; owner_email: string
  stripe_subscription_id: string | null; stripe_connect_account_id: string | null
  online_payments_enabled: boolean; healthScore: number
}

const PLAN_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  trial:      { bg: 'rgba(96,165,250,0.12)',   text: '#60a5fa', border: 'rgba(96,165,250,0.25)' },
  starter:    { bg: 'rgba(52,211,153,0.1)',    text: '#34d399', border: 'rgba(52,211,153,0.25)' },
  pro:        { bg: 'rgba(251,191,36,0.1)',    text: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
  enterprise: { bg: 'rgba(167,139,250,0.12)', text: '#a78bfa', border: 'rgba(167,139,250,0.25)' },
  expired:    { bg: 'rgba(248,113,113,0.08)', text: '#f87171', border: 'rgba(248,113,113,0.2)' },
}

const FILTERS = ['Alle', 'Active', 'Trial', 'Starter', 'Pro', 'Enterprise', 'Expired'] as const
type Filter = (typeof FILTERS)[number]

type SortKey = 'name' | 'plan' | 'health' | 'created_at' | 'trial_ends_at'
type SortDir = 'asc' | 'desc'

function D({ d }: { d: string | null }) {
  if (!d) return <span style={{ color: 'rgba(255,255,255,0.12)' }}>—</span>
  return <>{new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}</>
}

function healthDot(score: number) {
  if (score >= 70) return '#34d399'
  if (score >= 35) return '#fbbf24'
  return '#f87171'
}

const BULK_PLANS = ['trial', 'starter', 'pro', 'enterprise', 'expired']
const TRIAL_DAYS = [7, 14, 30]

export function RestaurantTable({ rows, canBulkAction }: { rows: TableRow[]; canBulkAction: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null)
  const [filter, setFilter] = useState<Filter>('Alle')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'created_at', dir: 'desc' })

  // Filtering
  const visible = useMemo(() => {
    let r = rows
    if (filter === 'Active') r = r.filter(x => x.active)
    else if (filter !== 'Alle') r = r.filter(x => x.plan === filter.toLowerCase())
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(x => x.name.toLowerCase().includes(q) || x.slug.includes(q) || x.owner_email.toLowerCase().includes(q))
    }
    return [...r].sort((a, b) => {
      let av: string | number, bv: string | number
      if (sort.key === 'health') { av = a.healthScore; bv = b.healthScore }
      else if (sort.key === 'plan') { av = a.plan; bv = b.plan }
      else if (sort.key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase() }
      else if (sort.key === 'created_at') { av = a.created_at; bv = b.created_at }
      else { av = a.trial_ends_at ?? ''; bv = b.trial_ends_at ?? '' }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1
      if (av > bv) return sort.dir === 'asc' ? 1 : -1
      return 0
    })
  }, [rows, filter, search, sort])

  const allSelected = visible.length > 0 && selected.size === visible.length

  const toggleAll = useCallback(() => {
    setSelected(prev => prev.size === visible.length ? new Set() : new Set(visible.map(r => r.id)))
  }, [visible])

  const toggleOne = useCallback((id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }, [])

  function toggleSort(key: SortKey) {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'desc' })
  }

  async function bulkAction(action: string, params?: Record<string, unknown>) {
    if (selected.size === 0 || loading) return
    setLoading(true); setResult(null)
    try {
      const res = await fetch('/api/platform/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected], action, params }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ text: `${data.ok} aktualisiert${data.err > 0 ? `, ${data.err} Fehler` : ''}`, ok: true })
        setSelected(new Set())
        setTimeout(() => window.location.reload(), 900)
      } else {
        setResult({ text: data.error ?? 'Fehler', ok: false })
      }
    } catch { setResult({ text: 'Netzwerkfehler', ok: false }) }
    setLoading(false)
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sort.key !== k) return <ArrowUpDown size={11} style={{ opacity: 0.25 }} />
    return sort.dir === 'asc' ? <ArrowUp size={11} color="#c4b5fd" /> : <ArrowDown size={11} color="#c4b5fd" />
  }

  const counts: Record<string, number> = {}
  for (const r of rows) {
    counts[r.plan] = (counts[r.plan] ?? 0) + 1
    if (r.active) counts['active'] = (counts['active'] ?? 0) + 1
  }

  return (
    <div>
      {/* Search + Filter bar */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Name, Slug oder E-Mail suchen..."
          style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px', padding: '7px 14px', color: 'rgba(255,255,255,0.8)',
            fontSize: '0.82rem', outline: 'none', width: '220px',
          }}
        />
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            const active = filter === f
            const cnt = f === 'Alle' ? rows.length : f === 'Active' ? (counts['active'] ?? 0) : (counts[f.toLowerCase()] ?? 0)
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '5px 12px', borderRadius: '20px', border: `1px solid ${active ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.07)'}`,
                background: active ? 'rgba(124,58,237,0.15)' : 'transparent',
                color: active ? '#c4b5fd' : 'rgba(255,255,255,0.35)',
                fontSize: '0.72rem', fontWeight: active ? 700 : 400, cursor: 'pointer',
                transition: 'all 0.12s',
              }}>
                {f} {cnt > 0 && <span style={{ opacity: 0.6, fontSize: '0.65rem' }}>{cnt}</span>}
              </button>
            )
          })}
        </div>
        <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: '0.72rem' }}>
          {visible.length} von {rows.length}
        </div>
      </div>

      {/* Bulk toolbar */}
      {selected.size > 0 && canBulkAction && (
        <div style={{
          background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
          borderRadius: '10px', padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <span style={{ color: '#c4b5fd', fontSize: '0.78rem', fontWeight: 700, minWidth: '80px' }}>
            {selected.size} gewählt
          </span>
          <Sep />
          <Lbl>Trial +</Lbl>
          {TRIAL_DAYS.map(d => (
            <Btn key={d} onClick={() => bulkAction('extend-trial', { days: d })} disabled={loading}>{d}d</Btn>
          ))}
          <Sep />
          <Lbl>Plan</Lbl>
          {BULK_PLANS.map(plan => {
            const c = PLAN_COLOR[plan] ?? { bg: '#111', text: '#888', border: '#222' }
            return (
              <button key={plan} onClick={() => bulkAction('set-plan', { plan })} disabled={loading} style={{
                padding: '3px 9px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
                border: `1px solid ${c.border}`, background: c.bg, color: c.text,
              }}>{plan}</button>
            )
          })}
          <Sep />
          <Btn onClick={() => bulkAction('activate')} disabled={loading} style={{ borderColor: 'rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.08)', color: '#34d399' }}>Aktivieren</Btn>
          <Btn onClick={() => bulkAction('deactivate')} disabled={loading} style={{ borderColor: 'rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.07)', color: '#fda4af' }}>Deaktivieren</Btn>
          {result && (
            <span style={{ color: result.ok ? '#34d399' : '#fda4af', fontSize: '0.73rem', fontWeight: 700, marginLeft: 'auto' }}>
              {result.ok ? '✓' : '✗'} {result.text}
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '16px', overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: 'left' }}>
                {canBulkAction && (
                  <th style={{ padding: '11px 14px', width: '36px' }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: '#7c3aed' }} />
                  </th>
                )}
                <Th onClick={() => toggleSort('name')} sort={<SortIcon k="name" />}>Restaurant</Th>
                <Th>Owner</Th>
                <Th onClick={() => toggleSort('plan')} sort={<SortIcon k="plan" />}>Plan</Th>
                <Th>Status</Th>
                <Th onClick={() => toggleSort('health')} sort={<SortIcon k="health" />}>Health</Th>
                <Th onClick={() => toggleSort('trial_ends_at')} sort={<SortIcon k="trial_ends_at" />}>Trial</Th>
                <Th onClick={() => toggleSort('created_at')} sort={<SortIcon k="created_at" />}>Angelegt</Th>
                <Th>Stripe</Th>
                <Th>Zahlung</Th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={canBulkAction ? 10 : 9} style={{ padding: '48px', textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: '0.85rem' }}>
                    {search ? `Keine Ergebnisse für "${search}"` : 'Keine Restaurants gefunden.'}
                  </td>
                </tr>
              )}
              {visible.map(r => {
                const pc = PLAN_COLOR[r.plan] ?? { bg: '#111', text: '#888', border: '#222' }
                const isSel = selected.has(r.id)
                const hc = healthDot(r.healthScore)
                return (
                  <tr key={r.id} style={{
                    borderTop: '1px solid rgba(255,255,255,0.04)',
                    background: isSel ? 'rgba(124,58,237,0.05)' : undefined,
                    transition: 'background 0.1s',
                  }}>
                    {canBulkAction && (
                      <td style={{ padding: '11px 14px' }}>
                        <input type="checkbox" checked={isSel} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', accentColor: '#7c3aed' }} />
                      </td>
                    )}
                    <Td>
                      <Link href={`/platform/restaurants/${r.id}`} style={{ textDecoration: 'none' }}>
                        <div style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{r.name}</div>
                        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.68rem' }}>/{r.slug}</div>
                      </Link>
                    </Td>
                    <Td mono>{r.owner_email}</Td>
                    <Td>
                      <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: '20px', background: pc.bg, color: pc.text, border: `1px solid ${pc.border}`, fontSize: '0.68rem', fontWeight: 700 }}>
                        {r.plan}
                      </span>
                    </Td>
                    <Td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '20px', background: r.active ? 'rgba(52,211,153,0.08)' : 'rgba(244,63,94,0.07)', border: `1px solid ${r.active ? 'rgba(52,211,153,0.2)' : 'rgba(244,63,94,0.18)'}`, fontSize: '0.68rem', fontWeight: 600, color: r.active ? '#34d399' : '#fda4af' }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: r.active ? '#34d399' : '#f87171' }} />
                        {r.active ? 'aktiv' : 'inaktiv'}
                      </span>
                    </Td>
                    <Td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 700, color: hc }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: hc }} />
                        {r.healthScore}
                      </span>
                    </Td>
                    <Td><D d={r.trial_ends_at} /></Td>
                    <Td><D d={r.created_at} /></Td>
                    <Td mono>
                      {r.stripe_subscription_id
                        ? <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>{r.stripe_subscription_id.slice(0, 14)}…</span>
                        : <span style={{ color: 'rgba(255,255,255,0.1)' }}>—</span>}
                    </Td>
                    <Td>
                      <PaymentToggle restaurantId={r.id} initialEnabled={r.online_payments_enabled ?? false} hasStripe={!!r.stripe_connect_account_id} />
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Th({ children, onClick, sort }: { children: React.ReactNode; onClick?: () => void; sort?: React.ReactNode }) {
  return (
    <th onClick={onClick} style={{
      padding: '11px 14px', color: 'rgba(255,255,255,0.28)', fontSize: '0.67rem', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.08em',
      cursor: onClick ? 'pointer' : undefined, userSelect: 'none',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
        {children}
        {sort}
      </span>
    </th>
  )
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td style={{ padding: '11px 14px', color: 'rgba(255,255,255,0.55)', fontFamily: mono ? 'ui-monospace, monospace' : undefined, fontSize: mono ? '0.72rem' : undefined }}>{children}</td>
}

function Sep() { return <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} /> }
function Lbl({ children }: { children: React.ReactNode }) { return <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>{children}:</span> }
function Btn({ children, onClick, disabled, style }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; style?: React.CSSProperties }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '3px 9px', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '0.72rem', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
      color: 'rgba(255,255,255,0.5)', opacity: disabled ? 0.5 : 1, ...style,
    }}>{children}</button>
  )
}
