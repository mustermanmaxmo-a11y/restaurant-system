'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'

const PERSON_COLORS = ['#6c63ff', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6']

interface Person { name: string; color: string }
interface OrderItem { name: string; price: number; qty: number }
interface Split {
  id: string
  share_token: string
  order_id: string
  persons: Person[]
  item_assignments: Record<string, string[]>
}

export default function SplitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [split, setSplit] = useState<Split | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'assign' | 'result'>('assign')
  const [assignments, setAssignments] = useState<Record<string, string[]>>({})

  useEffect(() => {
    async function load() {
      const { data: splitData } = await supabase
        .from('bill_splits')
        .select('*')
        .eq('share_token', token)
        .single()

      if (!splitData) { setLoading(false); return }
      setSplit(splitData as Split)
      setAssignments(splitData.item_assignments ?? {})

      const { data: order } = await supabase
        .from('orders')
        .select('items')
        .eq('id', splitData.order_id)
        .single()

      if (order) {
        const items = order.items as OrderItem[]
        // Expand qty into individual item entries
        const expanded: OrderItem[] = []
        items.forEach(item => {
          for (let i = 0; i < item.qty; i++) {
            expanded.push({ name: item.name, price: item.price, qty: 1 })
          }
        })
        setOrderItems(expanded)
      }
      setLoading(false)
    }
    load()
  }, [token])

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

  // Calculate each person's total
  const personTotals: Record<string, number> = {}
  persons.forEach(p => { personTotals[p.name] = 0 })
  orderItems.forEach((item, idx) => {
    const assigned = assignments[String(idx)] ?? []
    if (assigned.length > 0) {
      const share = item.price / assigned.length
      assigned.forEach(name => {
        personTotals[name] = (personTotals[name] ?? 0) + share
      })
    }
  })

  const unassignedCount = orderItems.filter((_, idx) => (assignments[String(idx)] ?? []).length === 0).length

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#fff' }}>
      <div style={{ padding: '20px 16px', maxWidth: '560px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <p style={{ fontSize: '2rem', marginBottom: '8px' }}>🧾</p>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '4px' }}>Rechnung aufteilen</h1>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>{persons.length} Personen · {orderItems.length} Positionen</p>
        </div>

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
            {persons.map(person => (
              <div key={person.name} style={{ background: '#1a1a1a', borderRadius: '14px', padding: '16px 18px', borderLeft: `4px solid ${person.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <p style={{ color: person.color, fontWeight: 700, fontSize: '1rem' }}>{person.name}</p>
                  <p style={{ color: '#fff', fontWeight: 800, fontSize: '1.3rem' }}>{(personTotals[person.name] ?? 0).toFixed(2)} €</p>
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
            ))}
            <div style={{ background: '#1a1a1a', borderRadius: '12px', padding: '14px 18px', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888', fontSize: '0.9rem' }}>Gesamt</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>{Object.values(personTotals).reduce((s, v) => s + v, 0).toFixed(2)} €</span>
              </div>
            </div>
            <div style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: '12px', padding: '14px 18px', textAlign: 'center' }}>
              <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Bitte beim Personal bezahlen 🙏</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
