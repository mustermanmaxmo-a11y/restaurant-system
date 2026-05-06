'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'

interface Person { name: string; color: string }
interface OrderItem { name: string; price: number; qty: number }
interface Split {
  id: string
  share_token: string
  order_id: string
  persons: Person[]
  item_assignments: Record<string, string[]>
  payment_statuses: Record<string, string>
}
interface RestaurantInfo {
  online_payments_enabled: boolean
  stripe_connect_account_id: string | null
}

export default function SplitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [split, setSplit] = useState<Split | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [resto, setResto] = useState<RestaurantInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'assign' | 'result'>('assign')
  const [assignments, setAssignments] = useState<Record<string, string[]>>({})
  const [payStatuses, setPayStatuses] = useState<Record<string, string>>({})
  const [selectedPersons, setSelectedPersons] = useState<string[]>([])
  const [paying, setPaying] = useState(false)

  // Check if just returned from successful payment
  const justPaid = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('paid') === '1'

  useEffect(() => {
    async function load() {
      const { data: splitData } = await supabase
        .from('bill_splits')
        .select('*')
        .eq('share_token', token)
        .single()

      if (!splitData) { setLoading(false); return }
      const s = splitData as Split
      setSplit(s)
      setAssignments(s.item_assignments ?? {})
      setPayStatuses(s.payment_statuses ?? {})

      // Auto-result if assignments already filled (from group order)
      if (Object.keys(s.item_assignments ?? {}).length > 0) {
        setView('result')
      }

      const { data: order } = await supabase
        .from('orders')
        .select('items, restaurant_id')
        .eq('id', s.order_id)
        .single()

      if (order) {
        const items = order.items as OrderItem[]
        const expanded: OrderItem[] = []
        items.forEach(item => {
          for (let i = 0; i < item.qty; i++) {
            expanded.push({ name: item.name, price: item.price, qty: 1 })
          }
        })
        setOrderItems(expanded)

        const { data: restoData } = await supabase
          .from('restaurants')
          .select('online_payments_enabled, stripe_connect_account_id')
          .eq('id', order.restaurant_id)
          .single()

        if (restoData) setResto(restoData as RestaurantInfo)
      }

      setLoading(false)
    }
    load()
  }, [token])

  // Realtime: update payment_statuses as others pay
  useEffect(() => {
    if (!split?.id) return
    const channel = supabase
      .channel(`bill-split-${split.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'bill_splits',
        filter: `id=eq.${split.id}`,
      }, payload => {
        const updated = payload.new as Split
        setPayStatuses(updated.payment_statuses ?? {})
        setAssignments(updated.item_assignments ?? {})
      })
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [split?.id])

  async function saveAssignments(newAssignments: Record<string, string[]>) {
    setSaving(true)
    await fetch('/api/split', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, item_assignments: newAssignments }),
    })
    setSaving(false)
  }

  function togglePersonForItem(itemIdx: number, personName: string) {
    setAssignments(prev => {
      const key = String(itemIdx)
      const current = prev[key] ?? []
      const updated = current.includes(personName)
        ? current.filter(p => p !== personName)
        : [...current, personName]
      const next = { ...prev, [key]: updated }
      saveAssignments(next)
      return next
    })
  }

  function togglePersonSelection(name: string) {
    if (payStatuses[name] === 'paid') return
    setSelectedPersons(prev =>
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
    )
  }

  function calcPersonTotal(name: string): number {
    let total = 0
    orderItems.forEach((item, idx) => {
      const assigned = assignments[String(idx)] ?? []
      if (assigned.includes(name) && assigned.length > 0) {
        total += item.price / assigned.length
      }
    })
    return total
  }

  function calcSelectedTotal(): number {
    return selectedPersons.reduce((s, n) => s + calcPersonTotal(n), 0)
  }

  function calcAllUnpaidTotal(): number {
    if (!split) return 0
    return split.persons
      .filter(p => payStatuses[p.name] !== 'paid')
      .reduce((s, p) => s + calcPersonTotal(p.name), 0)
  }

  async function payForPersons(names: string[]) {
    if (paying || !names.length) return
    setPaying(true)
    try {
      const res = await fetch('/api/stripe/split-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ splitToken: token, personNames: names }),
      })
      const json = await res.json()
      if (json.url) {
        window.location.href = json.url
      } else {
        alert(json.error ?? 'Fehler beim Bezahlen')
        setPaying(false)
      }
    } catch {
      setPaying(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#666' }}>Lädt…</p>
    </div>
  )

  if (!split) return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '2rem', marginBottom: '12px' }}>🔗</p>
        <p style={{ color: '#fff', fontWeight: 700, marginBottom: '8px' }}>Split nicht gefunden</p>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>Dieser Link ist ungültig oder abgelaufen.</p>
      </div>
    </div>
  )

  const persons = split.persons as Person[]
  const onlinePaymentsEnabled = !!(resto?.online_payments_enabled && resto?.stripe_connect_account_id)
  const unassignedCount = orderItems.filter((_, idx) => (assignments[String(idx)] ?? []).length === 0).length
  const unpaidPersons = persons.filter(p => payStatuses[p.name] !== 'paid')
  const allPaid = unpaidPersons.length === 0

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#fff', paddingBottom: selectedPersons.length > 0 ? '100px' : '0' }}>
      <div style={{ padding: '20px 16px', maxWidth: '560px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <p style={{ fontSize: '2rem', marginBottom: '8px' }}>🧾</p>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '4px' }}>Rechnung aufteilen</h1>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>{persons.length} Personen · {orderItems.length} Positionen</p>
        </div>

        {justPaid && (
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', textAlign: 'center', color: '#10b981', fontWeight: 700 }}>
            Zahlung erfolgreich! ✓
          </div>
        )}

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#1a1a1a', borderRadius: '10px', padding: '4px' }}>
          <button onClick={() => setView('assign')} style={{ flex: 1, padding: '8px', borderRadius: '7px', border: 'none', background: view === 'assign' ? '#ff6b35' : 'transparent', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
            Zuweisen
          </button>
          <button onClick={() => setView('result')} style={{ flex: 1, padding: '8px', borderRadius: '7px', border: 'none', background: view === 'result' ? '#ff6b35' : 'transparent', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
            Ergebnis
          </button>
        </div>

        {view === 'assign' && (
          <>
            {unassignedCount > 0 && (
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.85rem', color: '#f59e0b' }}>
                ⚠ {unassignedCount} Position{unassignedCount !== 1 ? 'en' : ''} noch nicht zugewiesen
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {orderItems.map((item, idx) => {
                const assigned = assignments[String(idx)] ?? []
                return (
                  <div key={idx} style={{ background: '#1a1a1a', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</span>
                      <span style={{ color: '#ff6b35', fontWeight: 700 }}>{item.price.toFixed(2)} €</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {persons.map(person => {
                        const isSelected = assigned.includes(person.name)
                        return (
                          <button
                            key={person.name}
                            onClick={() => togglePersonForItem(idx, person.name)}
                            style={{
                              padding: '5px 12px', borderRadius: '20px', border: `2px solid ${isSelected ? person.color : '#2a2a2a'}`,
                              background: isSelected ? person.color + '22' : 'transparent',
                              color: isSelected ? person.color : '#666',
                              fontWeight: isSelected ? 700 : 500, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s',
                            }}
                          >
                            {person.name}
                          </button>
                        )
                      })}
                    </div>
                    {assigned.length > 1 && (
                      <p style={{ color: '#555', fontSize: '0.72rem', marginTop: '6px' }}>
                        Geteilt: je {(item.price / assigned.length).toFixed(2)} €
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            {saving && <p style={{ color: '#555', fontSize: '0.8rem', textAlign: 'center', marginTop: '12px' }}>Speichert…</p>}
          </>
        )}

        {view === 'result' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {allPaid && (
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '12px 16px', textAlign: 'center', color: '#10b981', fontWeight: 700, marginBottom: '4px' }}>
                Alle haben bezahlt ✓
              </div>
            )}

            {persons.map(person => {
              const isPaid = payStatuses[person.name] === 'paid'
              const amount = calcPersonTotal(person.name)
              const isChecked = selectedPersons.includes(person.name)

              return (
                <div
                  key={person.name}
                  onClick={() => !isPaid && onlinePaymentsEnabled && togglePersonSelection(person.name)}
                  style={{
                    background: '#1a1a1a', borderRadius: '14px', padding: '16px 18px',
                    borderLeft: `4px solid ${isPaid ? '#10b981' : person.color}`,
                    opacity: isPaid ? 0.7 : 1,
                    cursor: !isPaid && onlinePaymentsEnabled ? 'pointer' : 'default',
                    outline: isChecked ? `2px solid ${person.color}` : 'none',
                    transition: 'outline 0.1s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {onlinePaymentsEnabled && !isPaid && (
                        <div style={{
                          width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                          border: `2px solid ${isChecked ? person.color : '#444'}`,
                          background: isChecked ? person.color : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {isChecked && <span style={{ color: '#fff', fontSize: '11px', fontWeight: 700 }}>✓</span>}
                        </div>
                      )}
                      <p style={{ color: isPaid ? '#10b981' : person.color, fontWeight: 700, fontSize: '1rem' }}>
                        {person.name}
                        {isPaid && <span style={{ fontSize: '0.75rem', marginLeft: '6px' }}>✓ bezahlt</span>}
                      </p>
                    </div>
                    <p style={{ color: '#fff', fontWeight: 800, fontSize: '1.3rem' }}>{amount.toFixed(2)} €</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {orderItems.map((item, idx) => {
                      const assigned = assignments[String(idx)] ?? []
                      if (!assigned.includes(person.name)) return null
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#666', fontSize: '0.8rem' }}>{item.name}{assigned.length > 1 ? ` (÷${assigned.length})` : ''}</span>
                          <span style={{ color: '#888', fontSize: '0.8rem' }}>{(item.price / assigned.length).toFixed(2)} €</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            <div style={{ background: '#1a1a1a', borderRadius: '12px', padding: '14px 18px', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888', fontSize: '0.9rem' }}>Gesamt</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>
                  {persons.reduce((s, p) => s + calcPersonTotal(p.name), 0).toFixed(2)} €
                </span>
              </div>
            </div>

            {/* Pay all unpaid button */}
            {onlinePaymentsEnabled && unpaidPersons.length > 1 && !allPaid && (
              <button
                onClick={() => payForPersons(unpaidPersons.map(p => p.name))}
                disabled={paying}
                style={{
                  width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                  background: '#6c63ff', color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                  cursor: paying ? 'wait' : 'pointer', opacity: paying ? 0.6 : 1,
                }}
              >
                {paying ? 'Weiterleitung…' : `Gesamtrechnung übernehmen — ${calcAllUnpaidTotal().toFixed(2)} €`}
              </button>
            )}

            {!onlinePaymentsEnabled && !allPaid && (
              <div style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: '12px', padding: '14px 18px', textAlign: 'center' }}>
                <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Bitte beim Personal bezahlen 🙏</p>
              </div>
            )}

            {onlinePaymentsEnabled && !allPaid && (
              <p style={{ color: '#555', fontSize: '0.78rem', textAlign: 'center' }}>
                Person antippen zum Auswählen — jeder kann für jeden zahlen
              </p>
            )}
          </div>
        )}
      </div>

      {/* Floating action bar for selected persons */}
      {selectedPersons.length > 0 && view === 'result' && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#18181b', borderTop: '1px solid #2a2a3e',
          padding: '16px', display: 'flex', gap: '10px', alignItems: 'center',
          maxWidth: '560px', margin: '0 auto',
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>
              {selectedPersons.length} Person{selectedPersons.length !== 1 ? 'en' : ''} ausgewählt
            </p>
            <p style={{ color: '#888', fontSize: '0.8rem' }}>
              {selectedPersons.join(', ')}
            </p>
          </div>
          <button
            onClick={() => payForPersons(selectedPersons)}
            disabled={paying}
            style={{
              padding: '12px 20px', borderRadius: '10px', border: 'none',
              background: '#ff6b35', color: '#fff', fontWeight: 700, fontSize: '0.9rem',
              cursor: paying ? 'wait' : 'pointer', opacity: paying ? 0.6 : 1, whiteSpace: 'nowrap',
            }}
          >
            {paying ? '…' : `${calcSelectedTotal().toFixed(2)} € zahlen`}
          </button>
          <button
            onClick={() => setSelectedPersons([])}
            style={{
              padding: '12px', borderRadius: '10px', border: '1px solid #333',
              background: 'transparent', color: '#888', fontSize: '0.85rem', cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
