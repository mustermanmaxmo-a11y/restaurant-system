'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { GroupItem, GroupPayment } from '@/types/database'

interface Props {
  groupId: string
  memberName: string
  groupItems: GroupItem[]
  accent: string
}

const STATUS_LABEL: Record<string, string> = {
  paid: '✓ Online bezahlt',
  cash: '💵 Zahlt bar',
  terminal: '🃏 Karte – Kellner kommt',
  covered: '✓ Übernommen',
  pending: 'Ausstehend',
}

const STATUS_COLOR: Record<string, string> = {
  paid: '#10b981',
  cash: '#10b981',
  terminal: '#10b981',
  covered: '#10b981',
  pending: '#f59e0b',
}

export default function GroupPayView({ groupId, memberName, groupItems, accent }: Props) {
  const [payments, setPayments] = useState<GroupPayment[]>([])
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('group_payments').select('*').eq('group_id', groupId).then(({ data }) => {
      if (data) setPayments(data as GroupPayment[])
    })

    const channel = supabase
      .channel(`group-payments-${groupId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'group_payments',
        filter: `group_id=eq.${groupId}`,
      }, payload => {
        setPayments(prev => prev.map(p =>
          p.member_name === (payload.new as GroupPayment).member_name
            ? payload.new as GroupPayment
            : p
        ))
      })
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [groupId])

  const myItems = groupItems.filter(i => i.added_by === memberName)
  const myTotal = myItems.reduce((s, i) => s + i.price * i.qty, 0)
  const myPayment = payments.find(p => p.member_name === memberName)
  const alreadyCommitted = myPayment !== undefined && myPayment.status !== 'pending'
  const allMembers = [...new Set(groupItems.map(i => i.added_by))]
  const allCommitted = payments.length > 0 && payments.every(p => p.status !== 'pending')

  async function payOnline() {
    setLoading('online')
    try {
      const res = await fetch('/api/stripe/group-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, member_name: memberName }),
      })
      if (!res.ok) { setLoading(null); return }
      const json = await res.json()
      if (json.url) window.location.href = json.url
      else setLoading(null)
    } catch {
      setLoading(null)
    }
  }

  async function payOffline(method: 'cash' | 'terminal') {
    setLoading(method)
    try {
      const res = await fetch('/api/group-payment/offline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, member_name: memberName, method }),
      })
      if (res.ok) {
        setPayments(prev => prev.map(p =>
          p.member_name === memberName ? { ...p, status: method } : p
        ))
      }
    } catch {
      // silent — user can retry
    }
    setLoading(null)
  }

  async function coverMember(targetMember: string) {
    const coveredItems = groupItems.filter(i => i.added_by === targetMember)
    const coveredAmount = coveredItems.reduce((s, i) => s + i.price * i.qty, 0)

    try {
      await supabase.from('group_payments')
        .update({ status: 'covered', covered_by: memberName })
        .eq('group_id', groupId)
        .eq('member_name', targetMember)

      const ownPayment = payments.find(p => p.member_name === memberName)
      if (ownPayment) {
        await supabase.from('group_payments')
          .update({ amount: ownPayment.amount + coveredAmount })
          .eq('group_id', groupId)
          .eq('member_name', memberName)
      }

      setPayments(prev => prev.map(p => {
        if (p.member_name === targetMember) return { ...p, status: 'covered' as const, covered_by: memberName }
        if (p.member_name === memberName) return { ...p, amount: p.amount + coveredAmount }
        return p
      }))
    } catch {
      // silent — realtime will sync correct state
    }
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px' }}>
      <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.2rem', marginBottom: '6px' }}>
        Zahlung
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
        Wähle wie du zahlen möchtest. Die Bestellung geht erst an die Küche wenn alle eine Wahl getroffen haben.
      </p>

      {/* Eigene Items */}
      <div style={{ background: 'var(--surface)', border: `1px solid ${accent}44`, borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
        <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '12px' }}>Deine Bestellung</p>
        {myItems.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{item.qty}× {item.name}</span>
            <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{(item.price * item.qty).toFixed(2)} €</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: '12px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text)', fontWeight: 700 }}>Gesamt</span>
          <span style={{ color: accent, fontWeight: 700, fontSize: '1.1rem' }}>{myTotal.toFixed(2)} €</span>
        </div>
      </div>

      {/* Zahlungsauswahl */}
      {!alreadyCommitted ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
          <button
            onClick={payOnline}
            disabled={loading !== null}
            style={{
              padding: '14px', borderRadius: '12px', border: 'none',
              background: accent, color: '#fff',
              fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
              opacity: loading === 'online' ? 0.7 : 1,
            }}
          >
            {loading === 'online' ? 'Weiterleitung...' : `💳 Online zahlen — ${myTotal.toFixed(2)} €`}
          </button>
          <button
            onClick={() => payOffline('cash')}
            disabled={loading !== null}
            style={{
              padding: '14px', borderRadius: '12px',
              border: '1.5px solid var(--border)', background: 'transparent',
              color: 'var(--text)', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
              opacity: loading === 'cash' ? 0.7 : 1,
            }}
          >
            {loading === 'cash' ? 'Wird gespeichert...' : '💵 Bar zahlen'}
          </button>
          <button
            onClick={() => payOffline('terminal')}
            disabled={loading !== null}
            style={{
              padding: '14px', borderRadius: '12px',
              border: '1.5px solid var(--border)', background: 'transparent',
              color: 'var(--text)', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
              opacity: loading === 'terminal' ? 0.7 : 1,
            }}
          >
            {loading === 'terminal' ? 'Wird gespeichert...' : '🃏 Mit Karte – Kellner kommt'}
          </button>
        </div>
      ) : (
        <div style={{
          background: '#10b98115', border: '1px solid #10b98133',
          borderRadius: '12px', padding: '14px', textAlign: 'center',
          color: '#10b981', fontWeight: 700, marginBottom: '24px', fontSize: '0.9rem',
        }}>
          {STATUS_LABEL[myPayment?.status ?? 'pending']}
        </div>
      )}

      {/* Status aller Mitglieder */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px' }}>
        <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '12px' }}>Gruppe</p>
        {allMembers.map(member => {
          const payment = payments.find(p => p.member_name === member)
          const status = payment?.status ?? 'pending'
          const committed = status !== 'pending'
          const memberTotal = groupItems
            .filter(i => i.added_by === member)
            .reduce((s, i) => s + i.price * i.qty, 0)

          return (
            <div key={member} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ color: member === memberName ? accent : 'var(--text)', fontWeight: member === memberName ? 700 : 400, fontSize: '0.9rem' }}>
                {member === memberName ? 'Du' : member}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{memberTotal.toFixed(2)} €</span>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                  background: `${STATUS_COLOR[status]}20`,
                  color: STATUS_COLOR[status],
                  whiteSpace: 'nowrap',
                }}>
                  {STATUS_LABEL[status]}
                </span>
                {/* Variante B: Für anderen zahlen — nur wenn ich selbst schon gewählt habe */}
                {!committed && member !== memberName && alreadyCommitted && (
                  <button
                    onClick={() => coverMember(member)}
                    style={{
                      fontSize: '0.7rem', padding: '2px 7px', borderRadius: '6px',
                      border: '1px solid var(--border)', background: 'transparent',
                      color: 'var(--text-muted)', cursor: 'pointer',
                    }}
                  >
                    Ich zahle
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {allCommitted && (
          <p style={{ color: '#10b981', fontWeight: 700, fontSize: '0.85rem', marginTop: '14px', textAlign: 'center' }}>
            Alle haben gewählt — Bestellung wird vorbereitet!
          </p>
        )}
      </div>
    </div>
  )
}
