'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { LoyaltyProgram } from '@/lib/loyalty/api'

interface TopMember {
  id: string
  subscriber_email: string | null
  stamp_count: number
  points: number
  total_redeemed: number
}

interface Stats {
  total_members: number
  total_redemptions: number
  redemptions_30d: number
  value_redeemed_cents: number
}

export default function LoyaltyAdminPage() {
  const [restaurantId, setRestaurantId] = useState<string>('')
  const [program, setProgram] = useState<Partial<LoyaltyProgram>>({})
  const [topMembers, setTopMembers] = useState<TopMember[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: resto } = await supabase
        .from('restaurants').select('id').eq('owner_id', user.id).maybeSingle()
      if (!resto) return
      setRestaurantId(resto.id)
      const { data: lp } = await supabase
        .from('loyalty_programs').select('*').eq('restaurant_id', resto.id).maybeSingle()
      if (lp) setProgram(lp)

      // Top 10 Members
      const { data: members } = await supabase
        .from('loyalty_members')
        .select('id, stamp_count, points, total_redeemed, marketing_subscribers!loyalty_members_subscriber_id_fkey(email)')
        .eq('restaurant_id', resto.id)
        .order('stamp_count', { ascending: false })
        .limit(10)
      if (members) {
        setTopMembers(members.map((m: { id: string; stamp_count: number; points: number; total_redeemed: number; marketing_subscribers: { email: string } | { email: string }[] | null }) => {
          const subs = m.marketing_subscribers
          const email = Array.isArray(subs) ? (subs[0]?.email ?? null) : (subs?.email ?? null)
          return {
            id: m.id,
            subscriber_email: email,
            stamp_count: m.stamp_count,
            points: m.points,
            total_redeemed: m.total_redeemed,
          }
        }))
      }

      // Stats
      const { count: totalMembers } = await supabase
        .from('loyalty_members').select('*', { count: 'exact', head: true })
        .eq('restaurant_id', resto.id)

      const { data: redemptions } = await supabase
        .from('marketing_events')
        .select('occurred_at, props')
        .eq('restaurant_id', resto.id)
        .eq('event_type', 'redeemed_reward')

      const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString()
      const totalRed = redemptions?.length ?? 0
      const red30d = redemptions?.filter(r => r.occurred_at >= thirtyDaysAgo).length ?? 0
      const valueCents = (redemptions ?? []).reduce((sum: number, r: { props: { value_cents?: number } | null }) =>
        sum + (Number(r.props?.value_cents) || 0), 0)

      setStats({
        total_members: totalMembers ?? 0,
        total_redemptions: totalRed,
        redemptions_30d: red30d,
        value_redeemed_cents: valueCents,
      })
    })()
  }, [])

  async function saveProgram() {
    if (!restaurantId) return
    setSaving(true)
    const payload = { ...program, restaurant_id: restaurantId }
    let error = null
    if (program.id) {
      const res = await supabase.from('loyalty_programs').update(payload).eq('id', program.id)
      error = res.error
    } else {
      const res = await supabase.from('loyalty_programs').insert(payload).select('id').single()
      error = res.error
      if (res.data?.id) setProgram(p => ({ ...p, id: res.data.id }))
    }
    setSaving(false)
    if (!error) { setSavedMsg('Gespeichert ✓'); setTimeout(() => setSavedMsg(''), 2500) }
  }

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '24px' }}>
        Loyalty-Programm
      </h1>

      {/* Konfiguration */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>Konfiguration</h2>
        <label style={labelStyle}>
          <input type="checkbox" checked={program.enabled ?? false}
                 onChange={e => setProgram(p => ({ ...p, enabled: e.target.checked }))} />
          {' '}Aktiviert
        </label>

        <label style={labelStyle}>Mechanik
          <select value={program.mechanic ?? 'stamps'}
                  onChange={e => setProgram(p => ({ ...p, mechanic: e.target.value as 'stamps' | 'points' }))}>
            <option value="stamps">Stempel (z.B. 10 Bestellungen)</option>
            <option value="points">Punkte (pro Euro)</option>
          </select>
        </label>

        <label style={labelStyle}>Ziel (Stempel oder Punkte)
          <input type="number" value={program.goal ?? 10}
                 onChange={e => setProgram(p => ({ ...p, goal: parseInt(e.target.value) || 10 }))} />
        </label>

        {program.mechanic === 'points' && (
          <label style={labelStyle}>Punkte pro Euro
            <input type="number" value={program.points_per_euro ?? 10}
                   onChange={e => setProgram(p => ({ ...p, points_per_euro: parseInt(e.target.value) || 10 }))} />
          </label>
        )}

        <label style={labelStyle}>Reward-Text (was bekommt der Gast?)
          <input type="text" value={program.reward_text ?? ''}
                 placeholder="z.B. Gratis-Getränk"
                 onChange={e => setProgram(p => ({ ...p, reward_text: e.target.value }))} />
        </label>

        <label style={labelStyle}>Reward-Wert (in Cents — z.B. 400 = 4€)
          <input type="number" value={program.reward_value_cents ?? 400}
                 onChange={e => setProgram(p => ({ ...p, reward_value_cents: parseInt(e.target.value) || 0 }))} />
        </label>

        <label style={labelStyle}>
          <input type="checkbox" checked={program.show_banner ?? false}
                 onChange={e => setProgram(p => ({ ...p, show_banner: e.target.checked }))} />
          {' '}Banner oberhalb der Speisekarte zeigen
        </label>

        <button onClick={saveProgram} disabled={saving} style={btnStyle}>
          {saving ? 'Speichert…' : 'Speichern'}
        </button>
        {savedMsg && <span style={{ marginLeft: '12px', color: '#22c55e' }}>{savedMsg}</span>}
      </section>

      {/* Statistiken */}
      {stats && (
        <section style={sectionStyle}>
          <h2 style={h2Style}>Statistiken</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            <Stat label="Mitglieder" value={stats.total_members.toString()} />
            <Stat label="Einlösungen Gesamt" value={stats.total_redemptions.toString()} />
            <Stat label="Einlösungen 30 Tage" value={stats.redemptions_30d.toString()} />
            <Stat label="Verschenkt (Wert)"
                  value={(stats.value_redeemed_cents/100).toFixed(2).replace('.', ',') + ' €'} />
          </div>
        </section>
      )}

      {/* Top Members */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>Top Mitglieder</h2>
        <table style={{ width: '100%', fontSize: '0.85rem' }}>
          <thead><tr>
            <th style={thStyle}>Email</th>
            <th style={thStyle}>Stempel</th>
            <th style={thStyle}>Punkte</th>
            <th style={thStyle}>Eingelöst</th>
          </tr></thead>
          <tbody>
            {topMembers.map(m => (
              <tr key={m.id}>
                <td style={tdStyle}>{m.subscriber_email ?? '(anonym)'}</td>
                <td style={tdStyle}>{m.stamp_count}</td>
                <td style={tdStyle}>{m.points}</td>
                <td style={tdStyle}>{m.total_redeemed}</td>
              </tr>
            ))}
            {topMembers.length === 0 && (
              <tr><td colSpan={4} style={{ ...tdStyle, color: '#8B8B93' }}>Noch keine Mitglieder.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px' }}>
      <p style={{ fontSize: '0.7rem', color: '#8B8B93', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '1.2rem', fontWeight: 800 }}>{value}</p>
    </div>
  )
}

const sectionStyle: React.CSSProperties = {
  background: '#0f0f13', borderRadius: '14px', padding: '20px',
  border: '1px solid rgba(255,255,255,0.08)', marginBottom: '20px',
}
const h2Style: React.CSSProperties = { fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '12px', fontSize: '0.85rem' }
const btnStyle: React.CSSProperties = {
  background: '#EA580C', color: '#fff', border: 'none', borderRadius: '8px',
  padding: '10px 18px', fontWeight: 700, cursor: 'pointer',
}
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px', color: '#8B8B93', borderBottom: '1px solid rgba(255,255,255,0.08)' }
const tdStyle: React.CSSProperties = { padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }
