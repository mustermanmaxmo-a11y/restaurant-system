'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, X } from 'lucide-react'

type Result = {
  id: string; name: string; slug: string; plan: string
  active: boolean; trial_ends_at: string | null; created_at: string
  email: string; stripe_subscription_id: string | null
}

const PLAN_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  trial:      { bg: 'rgba(96,165,250,0.12)',   text: '#60a5fa', border: 'rgba(96,165,250,0.25)' },
  starter:    { bg: 'rgba(52,211,153,0.1)',    text: '#34d399', border: 'rgba(52,211,153,0.25)' },
  pro:        { bg: 'rgba(251,191,36,0.1)',    text: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
  enterprise: { bg: 'rgba(167,139,250,0.12)', text: '#a78bfa', border: 'rgba(167,139,250,0.25)' },
  expired:    { bg: 'rgba(248,113,113,0.08)', text: '#f87171', border: 'rgba(248,113,113,0.2)' },
}

const PLANS = ['all', 'trial', 'starter', 'pro', 'enterprise', 'expired']
const STATUSES = [
  { value: '', label: 'Alle Status' },
  { value: 'active', label: 'Aktiv' },
  { value: 'inactive', label: 'Inaktiv' },
]

export function SearchBox({ initialQ, initialPlan }: { initialQ: string; initialPlan: string }) {
  const router = useRouter()
  const [q, setQ] = useState(initialQ)
  const [plan, setPlan] = useState(initialPlan === 'all' ? '' : initialPlan)
  const [status, setStatus] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (query: string, planFilter: string, statusFilter: string) => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (planFilter && planFilter !== 'all') params.set('plan', planFilter)
    if (statusFilter) params.set('status', statusFilter)
    if (!params.toString()) { setResults([]); setSearched(false); return }

    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/platform/search?${params}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } catch { setResults([]) }
    setLoading(false)
    setActiveIdx(-1)
  }, [])

  // Debounce on query change
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => doSearch(q, plan, status), 280)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [q, plan, status, doSearch])

  // Keyboard nav
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
      if (e.key === 'Enter' && activeIdx >= 0 && results[activeIdx]) {
        router.push(`/platform/restaurants/${results[activeIdx].id}`)
      }
      if (e.key === 'Escape') { setQ(''); setResults([]); setSearched(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [results, activeIdx, router])

  useEffect(() => { inputRef.current?.focus() }, [])

  const clear = () => { setQ(''); setResults([]); setSearched(false); inputRef.current?.focus() }

  return (
    <div>
      {/* Search bar */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <Search size={15} color="rgba(255,255,255,0.25)" style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Name, Slug oder E-Mail suchen…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '11px 36px 11px 36px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', color: 'rgba(255,255,255,0.88)', fontSize: '0.9rem',
              outline: 'none', transition: 'border-color 0.15s',
            }}
          />
          {q && (
            <button onClick={clear} style={{ position: 'absolute', top: '50%', right: '10px', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center' }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Plan filter */}
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {PLANS.map(p => {
            const active = (p === 'all' && !plan) || plan === p
            const pc = PLAN_COLOR[p]
            return (
              <button key={p} onClick={() => setPlan(p === 'all' ? '' : p)} style={{
                padding: '5px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
                border: `1px solid ${active ? (pc?.border ?? 'rgba(124,58,237,0.5)') : 'rgba(255,255,255,0.07)'}`,
                background: active ? (pc?.bg ?? 'rgba(124,58,237,0.12)') : 'transparent',
                color: active ? (pc?.text ?? '#c4b5fd') : 'rgba(255,255,255,0.3)',
              }}>
                {p === 'all' ? 'Alle' : p}
              </button>
            )
          })}
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: '5px' }}>
          {STATUSES.map(s => (
            <button key={s.value} onClick={() => setStatus(s.value)} style={{
              padding: '5px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
              border: `1px solid ${status === s.value ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.07)'}`,
              background: status === s.value ? 'rgba(52,211,153,0.1)' : 'transparent',
              color: status === s.value ? '#34d399' : 'rgba(255,255,255,0.3)',
            }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Shortcuts hint */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[['↑↓', 'Navigieren'], ['↵', 'Öffnen'], ['ESC', 'Leeren']].map(([key, label]) => (
          <div key={key} style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <kbd style={{ padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)', fontSize: '0.62rem', border: '1px solid rgba(255,255,255,0.08)' }}>{key}</kbd>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.65rem' }}>{label}</span>
          </div>
        ))}
        {loading && <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>Suche…</span>}
        {searched && !loading && <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>{results.length} Treffer</span>}
      </div>

      {/* Results */}
      {searched && results.length === 0 && !loading && (
        <div style={{ padding: '48px', textAlign: 'center', color: 'rgba(255,255,255,0.12)', fontSize: '0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
          Keine Treffer für &quot;{q}&quot;
        </div>
      )}

      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {results.map((r, i) => {
            const pc = PLAN_COLOR[r.plan] ?? { bg: '#111', text: '#888', border: '#222' }
            const isActive = i === activeIdx
            const trialEnd = r.trial_ends_at ? new Date(r.trial_ends_at) : null
            const daysLeft = trialEnd ? Math.floor((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null

            return (
              <Link key={r.id} href={`/platform/restaurants/${r.id}`} style={{ textDecoration: 'none' }}
                onMouseEnter={() => setActiveIdx(i)}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '13px 18px', borderRadius: '12px',
                  background: isActive ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isActive ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  transition: 'all 0.08s',
                }}>
                  {/* Active dot */}
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: r.active ? '#34d399' : '#f87171', flexShrink: 0 }} />

                  {/* Name + email */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700, fontSize: '0.88rem' }}>{r.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.7rem', fontFamily: 'monospace' }}>
                      /{r.slug}{r.email ? ` · ${r.email}` : ''}
                    </div>
                  </div>

                  {/* Plan badge */}
                  <span style={{ padding: '3px 10px', borderRadius: '20px', background: pc.bg, color: pc.text, border: `1px solid ${pc.border}`, fontSize: '0.68rem', fontWeight: 700, flexShrink: 0 }}>
                    {r.plan}
                  </span>

                  {/* Trial days */}
                  {r.plan === 'trial' && daysLeft !== null && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: daysLeft <= 3 ? '#f87171' : daysLeft <= 7 ? '#fbbf24' : '#60a5fa', flexShrink: 0 }}>
                      {daysLeft < 0 ? 'Abgelaufen' : `${daysLeft}d`}
                    </span>
                  )}

                  {/* Stripe indicator */}
                  {r.stripe_subscription_id && (
                    <span style={{ color: 'rgba(52,211,153,0.5)', fontSize: '0.65rem', flexShrink: 0 }}>S</span>
                  )}

                  {/* Created */}
                  <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.68rem', flexShrink: 0 }}>
                    {new Date(r.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </span>

                  <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.7rem' }}>→</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {!searched && (
        <div style={{ marginTop: '48px', textAlign: 'center' }}>
          <div style={{ color: 'rgba(255,255,255,0.1)', fontSize: '0.85rem', marginBottom: '20px' }}>
            Tippe um sofort zu suchen
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {['trial', 'starter', 'pro', 'enterprise', 'expired'].map(p => {
              const pc = PLAN_COLOR[p]
              return (
                <button key={p} onClick={() => setPlan(p)} style={{
                  padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
                  border: `1px solid ${pc.border}`, background: pc.bg, color: pc.text,
                }}>
                  Alle {p}-Restaurants
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
