'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, BarChart2, CreditCard, Megaphone, Settings,
  Search, Radio, Brain, ClipboardList, Activity, LayoutDashboard,
  Users, FileText, ToggleLeft, GitBranch, Trophy, AlertTriangle,
  TrendingUp, FlaskConical, Sprout, Flame, GitCompare, HeartPulse,
} from 'lucide-react'

type Restaurant = { id: string; name: string; slug: string; plan: string }

const PLAN_DOT: Record<string, string> = {
  trial: '#60a5fa', starter: '#34d399', pro: '#fbbf24', enterprise: '#a78bfa', expired: '#f87171',
}

const PAGES = [
  { icon: LayoutDashboard, label: 'Dashboard',      href: '/platform',              category: 'Seiten' },
  { icon: Building2,       label: 'Alle Restaurants',href: '/platform/restaurants', category: 'Seiten' },
  { icon: Radio,           label: 'Live Monitor',   href: '/platform/monitor',      category: 'Seiten' },
  { icon: Activity,        label: 'Activity Feed',  href: '/platform/activity',     category: 'Seiten' },
  { icon: Brain,           label: 'AI Insights',    href: '/platform/insights',     category: 'Seiten' },
  { icon: BarChart2,       label: 'Analytics',        href: '/platform/analytics',    category: 'Seiten' },
  { icon: TrendingUp,     label: 'Revenue',           href: '/platform/revenue',      category: 'Seiten' },
  { icon: Sprout,         label: 'Growth Funnel',     href: '/platform/growth',       category: 'Seiten' },
  { icon: GitBranch,      label: 'Cohort Analysis',   href: '/platform/cohorts',      category: 'Seiten' },
  { icon: Trophy,         label: 'Leaderboard',       href: '/platform/leaderboard',  category: 'Seiten' },
  { icon: AlertTriangle,  label: 'Churn Risk',        href: '/platform/churn',        category: 'Seiten' },
  { icon: FlaskConical,   label: 'Trial Pipeline',    href: '/platform/trials',       category: 'Seiten' },
  { icon: Flame,          label: 'Order Heatmap',     href: '/platform/heatmap',      category: 'Seiten' },
  { icon: GitCompare,     label: 'Restaurant Vergleich', href: '/platform/compare',   category: 'Seiten' },
  { icon: HeartPulse,     label: 'Platform Status',   href: '/platform/status',       category: 'Seiten' },
  { icon: CreditCard,      label: 'Billing',        href: '/platform/billing',      category: 'Seiten' },
  { icon: Megaphone,       label: 'Outreach',       href: '/platform/outreach',     category: 'Seiten' },
  { icon: ClipboardList,   label: 'Audit Log',      href: '/platform/audit',        category: 'Seiten' },
  { icon: ToggleLeft,      label: 'Feature Flags',  href: '/platform/feature-flags',category: 'Seiten' },
  { icon: Users,           label: 'Team',           href: '/platform/team',         category: 'Seiten' },
  { icon: FileText,        label: 'Rechtstexte',    href: '/platform/legal',        category: 'Seiten' },
  { icon: Settings,        label: 'Einstellungen',  href: '/platform/settings',     category: 'Seiten' },
]

type Item =
  | { kind: 'restaurant'; id: string; name: string; slug: string; plan: string; href: string }
  | { kind: 'page'; label: string; href: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>; category: string }

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load restaurant list on first open
  useEffect(() => {
    if (!open || loaded) return
    fetch('/api/platform/restaurants')
      .then(r => r.ok ? r.json() : [])
      .then((data: unknown) => {
        if (Array.isArray(data)) setRestaurants(data as Restaurant[])
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [open, loaded])

  // ⌘K / Ctrl+K trigger
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Focus input on open
  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); setQuery(''); setActiveIdx(0) }
  }, [open])

  // Build filtered results
  const q = query.toLowerCase().trim()
  const items: Item[] = []

  if (q.length === 0) {
    // Show all pages + first 5 restaurants
    for (const p of PAGES) items.push({ kind: 'page', ...p })
    for (const r of restaurants.slice(0, 6)) items.push({ kind: 'restaurant', ...r, href: `/platform/restaurants/${r.id}` })
  } else {
    // Filter restaurants
    for (const r of restaurants) {
      if (r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q)) {
        items.push({ kind: 'restaurant', ...r, href: `/platform/restaurants/${r.id}` })
      }
    }
    // Filter pages
    for (const p of PAGES) {
      if (p.label.toLowerCase().includes(q) || p.href.includes(q)) {
        items.push({ kind: 'page', ...p })
      }
    }
  }

  const handleSelect = useCallback((href: string) => {
    router.push(href)
    setOpen(false)
  }, [router])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, items.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' && items[activeIdx]) handleSelect(items[activeIdx].href)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, items, activeIdx, handleSelect])

  useEffect(() => setActiveIdx(0), [query])

  if (!open) return null

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '14vh',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '560px', maxWidth: '92vw',
          background: '#0a0a1c',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(124,58,237,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <Search size={16} color="rgba(255,255,255,0.3)" strokeWidth={2} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Restaurant suchen oder Seite öffnen..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'rgba(255,255,255,0.9)', fontSize: '0.95rem', fontWeight: 400,
            }}
          />
          <kbd style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', border: '1px solid rgba(255,255,255,0.1)' }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
          {items.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem' }}>
              Keine Ergebnisse für &quot;{query}&quot;
            </div>
          ) : (
            (() => {
              const groups: Record<string, Item[]> = {}
              for (const item of items) {
                const cat = item.kind === 'restaurant' ? 'Restaurants' : item.category
                groups[cat] = groups[cat] ?? []
                groups[cat].push(item)
              }
              let idx = 0
              return Object.entries(groups).map(([cat, catItems]) => (
                <div key={cat}>
                  <div style={{ padding: '8px 20px 4px', color: 'rgba(255,255,255,0.2)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {cat}
                  </div>
                  {catItems.map(item => {
                    const i = idx++
                    const active = i === activeIdx
                    return (
                      <button key={item.href} onClick={() => handleSelect(item.href)}
                        onMouseEnter={() => setActiveIdx(i)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '9px 20px', border: 'none', cursor: 'pointer', textAlign: 'left',
                          background: active ? 'rgba(124,58,237,0.15)' : 'transparent',
                          transition: 'background 0.08s',
                        }}>
                        {item.kind === 'restaurant' ? (
                          <>
                            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: PLAN_DOT[item.plan] ?? '#888', flexShrink: 0 }} />
                            <span style={{ color: active ? '#e0d9ff' : 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 500, flex: 1 }}>{item.name}</span>
                            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>/{item.slug}</span>
                            <span style={{ color: PLAN_DOT[item.plan] ?? '#888', fontSize: '0.65rem', fontWeight: 700 }}>{item.plan}</span>
                          </>
                        ) : (
                          <>
                            <item.icon size={14} strokeWidth={1.8} color={active ? '#c4b5fd' : 'rgba(255,255,255,0.35)'} />
                            <span style={{ color: active ? '#e0d9ff' : 'rgba(255,255,255,0.65)', fontSize: '0.85rem', fontWeight: 500 }}>{item.label}</span>
                          </>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))
            })()
          )}
        </div>

        {/* Footer hint */}
        <div style={{ padding: '8px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '16px' }}>
          {[['↑↓', 'Navigieren'], ['↵', 'Öffnen'], ['ESC', 'Schließen']].map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <kbd style={{ padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', fontSize: '0.6rem', border: '1px solid rgba(255,255,255,0.08)' }}>{key}</kbd>
              <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.65rem' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
