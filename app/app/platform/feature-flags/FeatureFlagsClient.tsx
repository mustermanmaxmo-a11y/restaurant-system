'use client'

import { useState, useTransition, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, ChevronDown, ChevronUp, Download } from 'lucide-react'

type FlagKey =
  | 'auto_translate_enabled'
  | 'email_marketing_enabled'
  | 'weekly_report_email'
  | 'prep_show_in_kds'
  | 'prep_push_enabled'
  | 'benchmark_opt_in'
  | 'crm_rule_inactive'
  | 'crm_rule_almost_goal'
  | 'crm_rule_welcome'
  | 'referral_enabled'

const ALL_FLAG_KEYS: FlagKey[] = [
  'email_marketing_enabled', 'weekly_report_email', 'referral_enabled',
  'crm_rule_inactive', 'crm_rule_almost_goal', 'crm_rule_welcome',
  'auto_translate_enabled', 'benchmark_opt_in',
  'prep_show_in_kds', 'prep_push_enabled',
]

const FLAG_GROUPS: { label: string; color: string; flags: { key: FlagKey; label: string; desc: string }[] }[] = [
  {
    label: 'Marketing & CRM',
    color: '#f59e0b',
    flags: [
      { key: 'email_marketing_enabled', label: 'E-Mail Marketing', desc: 'Aktiviert automatische Marketing-Mails' },
      { key: 'weekly_report_email', label: 'Wochenbericht', desc: 'Wöchentlicher Report per E-Mail' },
      { key: 'referral_enabled', label: 'Referral Program', desc: 'Weiterempfehlungs-System aktiv' },
      { key: 'crm_rule_inactive', label: 'CRM: Inaktiv-Trigger', desc: 'Automatik bei inaktiven Gästen' },
      { key: 'crm_rule_almost_goal', label: 'CRM: Fast-Ziel', desc: 'Trigger bei Fast-Ziel-Erreichen' },
      { key: 'crm_rule_welcome', label: 'CRM: Willkommen', desc: 'Willkommensnachricht für neue Gäste' },
    ],
  },
  {
    label: 'KI & System',
    color: '#0e7490',
    flags: [
      { key: 'auto_translate_enabled', label: 'Auto-Übersetzung', desc: 'Speisekarte automatisch übersetzen' },
      { key: 'benchmark_opt_in', label: 'Benchmark Opt-In', desc: 'Anonyme Daten für Plattform-Benchmarks' },
    ],
  },
  {
    label: 'Küche / KDS',
    color: '#34d399',
    flags: [
      { key: 'prep_show_in_kds', label: 'Im KDS anzeigen', desc: 'Bestellungen im Küchenbildschirm' },
      { key: 'prep_push_enabled', label: 'KDS Push', desc: 'Push-Benachrichtigungen für KDS' },
    ],
  },
]

type Restaurant = { id: string; name: string; slug: string; flags: Record<FlagKey, boolean> }

async function apiToggle(restaurantId: string, flag: FlagKey, value: boolean) {
  const { data: { session } } = await supabase.auth.getSession()
  return fetch('/api/platform/feature-flags', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: JSON.stringify({ restaurantId, flag, value }),
  })
}

function Toggle({ on, onClick, pending }: { on: boolean; onClick: () => void; pending: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      title={on ? 'An – klicken zum Deaktivieren' : 'Aus – klicken zum Aktivieren'}
      style={{
        width: '36px', height: '20px', borderRadius: '10px', border: 'none', cursor: pending ? 'wait' : 'pointer',
        background: on ? 'rgba(52,211,153,0.8)' : 'rgba(255,255,255,0.1)',
        position: 'relative', transition: 'background 0.15s', flexShrink: 0, opacity: pending ? 0.6 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: '3px', left: on ? '18px' : '3px',
        width: '14px', height: '14px', borderRadius: '50%',
        background: on ? '#fff' : 'rgba(255,255,255,0.4)',
        transition: 'left 0.15s, background 0.15s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
      }} />
    </button>
  )
}

export function FeatureFlagsClient({ restaurants }: { restaurants: Restaurant[] }) {
  const [states, setStates] = useState<Record<string, Record<FlagKey, boolean>>>(
    Object.fromEntries(restaurants.map(r => [r.id, { ...r.flags }]))
  )
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [bulkKey, setBulkKey] = useState<FlagKey | ''>('')
  const [bulkVal, setBulkVal] = useState<boolean>(true)
  const [bulkStatus, setBulkStatus] = useState<string | null>(null)

  const visible = useMemo(() => {
    if (!search.trim()) return restaurants
    const q = search.toLowerCase()
    return restaurants.filter(r => r.name.toLowerCase().includes(q) || r.slug.includes(q))
  }, [restaurants, search])

  const allSelected = selected.size === visible.length && visible.length > 0

  async function toggle(restaurantId: string, flag: FlagKey, value: boolean) {
    const key = `${restaurantId}:${flag}`
    setPending(p => ({ ...p, [key]: true }))
    const res = await apiToggle(restaurantId, flag, value)
    if (res.ok) {
      startTransition(() => {
        setStates(prev => ({ ...prev, [restaurantId]: { ...prev[restaurantId], [flag]: value } }))
      })
    }
    setPending(p => { const n = { ...p }; delete n[key]; return n })
  }

  async function doBulk() {
    if (!bulkKey || selected.size === 0) return
    setBulkStatus('Wird angewendet...')
    const ids = [...selected]
    await Promise.all(ids.map(id => apiToggle(id, bulkKey as FlagKey, bulkVal)))
    startTransition(() => {
      setStates(prev => {
        const next = { ...prev }
        for (const id of ids) next[id] = { ...next[id], [bulkKey]: bulkVal }
        return next
      })
    })
    setBulkStatus(`✓ ${ids.length} Restaurants aktualisiert`)
    setTimeout(() => setBulkStatus(null), 3000)
  }

  function countOn(flag: FlagKey) {
    return restaurants.filter(r => states[r.id]?.[flag]).length
  }

  function exportCsv() {
    const rows = [['restaurant', 'slug', ...ALL_FLAG_KEYS].join(',')]
    for (const r of restaurants) {
      rows.push([r.name, r.slug, ...ALL_FLAG_KEYS.map(k => String(states[r.id]?.[k] ?? false))].join(','))
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `feature_flags_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  }

  if (restaurants.length === 0) {
    return <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem' }}>Noch keine Restaurants.</p>
  }

  return (
    <div>
      {/* Stats per flag */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {FLAG_GROUPS.map(g => (
          <button
            key={g.label}
            onClick={() => setActiveGroup(activeGroup === g.label ? null : g.label)}
            style={{
              padding: '6px 14px', borderRadius: '20px', border: `1px solid ${activeGroup === g.label ? g.color : 'rgba(255,255,255,0.08)'}`,
              background: activeGroup === g.label ? `${g.color}20` : 'transparent',
              color: activeGroup === g.label ? g.color : 'rgba(255,255,255,0.35)',
              fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Flag overview cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginBottom: '28px' }}>
        {FLAG_GROUPS.flatMap(g =>
          (activeGroup ? (activeGroup === g.label ? g.flags : []) : g.flags).map(f => {
            const on = countOn(f.key)
            const total = restaurants.length
            const pct = total > 0 ? Math.round((on / total) * 100) : 0
            return (
              <div key={f.key} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px 16px' }}>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '8px' }}>{f.label}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: pct > 50 ? '#34d399' : pct > 0 ? '#fbbf24' : 'rgba(255,255,255,0.2)', lineHeight: 1, marginBottom: '6px' }}>{on}<span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'rgba(255,255,255,0.2)', marginLeft: '4px' }}>/ {total}</span></div>
                <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: pct > 50 ? '#34d399' : pct > 0 ? '#fbbf24' : 'rgba(255,255,255,0.1)', transition: 'width 0.3s' }} />
                </div>
                <div style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.62rem', marginTop: '4px' }}>{pct}% aktiv</div>
              </div>
            )
          })
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 0 220px' }}>
          <Search size={13} color="rgba(255,255,255,0.25)" style={{ position: 'absolute', top: '50%', left: '10px', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Restaurant suchen..."
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '7px 10px 7px 28px', color: 'rgba(255,255,255,0.8)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {selected.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(14,116,144,0.08)', border: '1px solid rgba(14,116,144,0.2)', borderRadius: '10px', padding: '6px 12px', flexWrap: 'wrap' }}>
            <span style={{ color: '#7dd3e8', fontSize: '0.75rem', fontWeight: 700 }}>{selected.size} gewählt</span>
            <select value={bulkKey} onChange={e => setBulkKey(e.target.value as FlagKey)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'rgba(255,255,255,0.7)', fontSize: '0.73rem', padding: '3px 6px' }}>
              <option value="">Flag wählen...</option>
              {FLAG_GROUPS.flatMap(g => g.flags.map(f => <option key={f.key} value={f.key}>{f.label}</option>))}
            </select>
            <select value={String(bulkVal)} onChange={e => setBulkVal(e.target.value === 'true')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'rgba(255,255,255,0.7)', fontSize: '0.73rem', padding: '3px 6px' }}>
              <option value="true">AN</option>
              <option value="false">AUS</option>
            </select>
            <button onClick={doBulk} disabled={!bulkKey} style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(14,116,144,0.4)', background: 'rgba(14,116,144,0.15)', color: '#7dd3e8', fontSize: '0.73rem', fontWeight: 700, cursor: !bulkKey ? 'not-allowed' : 'pointer' }}>
              Anwenden
            </button>
            {bulkStatus && <span style={{ color: '#34d399', fontSize: '0.72rem', fontWeight: 700 }}>{bulkStatus}</span>}
          </div>
        )}

        <button onClick={exportCsv} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)', fontSize: '0.73rem', cursor: 'pointer' }}>
          <Download size={13} />
          CSV
        </button>
      </div>

      {/* Restaurant rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {/* Select-all */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 14px', color: 'rgba(255,255,255,0.2)', fontSize: '0.68rem' }}>
          <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(visible.map(r => r.id)))} style={{ cursor: 'pointer', accentColor: '#0e7490' }} />
          <span>Alle {visible.length} auswählen</span>
        </div>

        {visible.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: '0.85rem' }}>
            Keine Restaurants für &quot;{search}&quot;
          </div>
        )}

        {visible.map(r => {
          const isCollapsed = collapsed.has(r.id)
          const isSel = selected.has(r.id)
          const flagStates = states[r.id] ?? r.flags
          const onCount = ALL_FLAG_KEYS.filter(k => flagStates[k]).length
          const groups = activeGroup ? FLAG_GROUPS.filter(g => g.label === activeGroup) : FLAG_GROUPS

          return (
            <div key={r.id} style={{
              background: isSel ? 'rgba(14,116,144,0.05)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${isSel ? 'rgba(14,116,144,0.2)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: '14px', overflow: 'hidden', transition: 'border-color 0.1s',
            }}>
              {/* Header */}
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                onClick={() => setCollapsed(prev => { const n = new Set(prev); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n })}>
                <input
                  type="checkbox"
                  checked={isSel}
                  onClick={e => e.stopPropagation()}
                  onChange={e => {
                    e.stopPropagation()
                    setSelected(prev => { const n = new Set(prev); e.target.checked ? n.add(r.id) : n.delete(r.id); return n })
                  }}
                  style={{ cursor: 'pointer', accentColor: '#0e7490' }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: '0.85rem' }}>{r.name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem', marginLeft: '8px' }}>/{r.slug}</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: onCount > 0 ? '#34d399' : 'rgba(255,255,255,0.2)', fontWeight: 700 }}>
                  {onCount}/{ALL_FLAG_KEYS.length} aktiv
                </span>
                {isCollapsed ? <ChevronDown size={13} color="rgba(255,255,255,0.3)" /> : <ChevronUp size={13} color="rgba(255,255,255,0.3)" />}
              </div>

              {/* Flags */}
              {!isCollapsed && (
                <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  {groups.map(group => (
                    <div key={group.label} style={{ paddingTop: '12px' }}>
                      <div style={{ color: group.color, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', opacity: 0.8 }}>{group.label}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {group.flags.map(({ key, label, desc }) => {
                          const isOn = flagStates[key] ?? false
                          const isPending = !!pending[`${r.id}:${key}`]
                          return (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ color: isOn ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)', fontSize: '0.78rem', fontWeight: 600 }}>{label}</div>
                                <div style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.65rem', marginTop: '1px' }}>{desc}</div>
                              </div>
                              <Toggle on={isOn} onClick={() => toggle(r.id, key, !isOn)} pending={isPending} />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
