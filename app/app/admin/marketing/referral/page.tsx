'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Stats {
  total_shared: number
  total_converted: number
  conversion_rate: number
}

interface TopReferrer {
  email: string
  conversions: number
}

interface RestaurantConfig {
  id: string
  referral_enabled: boolean
  referral_reward_type: string
  referral_reward_points: number
  referral_reward_discount_percent: number
  referral_referred_discount_percent: number
}

const sectionStyle: React.CSSProperties = {
  background: '#0f0f13',
  borderRadius: '14px',
  padding: '20px',
  border: '1px solid rgba(255,255,255,0.08)',
  marginBottom: '20px',
}

const labelStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '6px',
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{value}</div>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', marginTop: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  )
}

export default function ReferralAdminPage() {
  const [config, setConfig] = useState<RestaurantConfig | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [topReferrers, setTopReferrers] = useState<TopReferrer[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: resto } = await supabase
        .from('restaurants')
        .select('id, referral_enabled, referral_reward_type, referral_reward_points, referral_reward_discount_percent, referral_referred_discount_percent')
        .eq('owner_id', user.id)
        .maybeSingle()
      if (!resto) { setLoading(false); return }
      setConfig(resto as RestaurantConfig)

      // Stats: total referral_conversions for this restaurant
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const [convRes, sharedRes, topRes] = await Promise.all([
        supabase
          .from('referral_conversions')
          .select('id, referrer_subscriber_id', { count: 'exact' })
          .eq('restaurant_id', resto.id)
          .gte('created_at', since),
        supabase
          .from('marketing_subscribers')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', resto.id)
          .not('referral_code', 'is', null),
        supabase
          .from('referral_conversions')
          .select('referrer_subscriber_id, marketing_subscribers!referrer_subscriber_id(email)')
          .eq('restaurant_id', resto.id)
          .gte('created_at', since),
      ])

      const totalConverted = convRes.count ?? 0
      const totalShared = sharedRes.count ?? 0

      setStats({
        total_shared: totalShared,
        total_converted: totalConverted,
        conversion_rate: totalShared > 0 ? Math.round((totalConverted / totalShared) * 100) : 0,
      })

      // Aggregate top referrers client-side
      const byReferrer: Record<string, { email: string; count: number }> = {}
      for (const row of (topRes.data ?? [])) {
        const id = row.referrer_subscriber_id
        const email = (row.marketing_subscribers as { email: string }[] | null)?.[0]?.email ?? '–'
        if (!byReferrer[id]) byReferrer[id] = { email, count: 0 }
        byReferrer[id].count++
      }
      const sorted = Object.values(byReferrer)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(r => ({ email: r.email, conversions: r.count }))
      setTopReferrers(sorted)
      setLoading(false)
    })()
  }, [])

  async function save() {
    if (!config) return
    setSaving(true)
    await supabase.from('restaurants').update({
      referral_enabled: config.referral_enabled,
      referral_reward_type: config.referral_reward_type,
      referral_reward_points: config.referral_reward_points,
      referral_reward_discount_percent: config.referral_reward_discount_percent,
      referral_referred_discount_percent: config.referral_referred_discount_percent,
    }).eq('id', config.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div style={{ padding: '32px', color: 'rgba(255,255,255,0.4)' }}>Lade…</div>
  if (!config) return <div style={{ padding: '32px', color: 'rgba(255,255,255,0.4)' }}>Kein Restaurant gefunden.</div>

  const inputStyle: React.CSSProperties = {
    background: '#1a1a22',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '10px 12px',
    color: '#fff',
    fontSize: '0.875rem',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    outline: 'none',
  }

  return (
    <div style={{ padding: '28px', maxWidth: '880px', margin: '0 auto', fontFamily: 'var(--font-geist), system-ui, sans-serif', color: '#fff' }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '4px', letterSpacing: '-0.02em' }}>Referral-Programm</h1>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginBottom: '28px' }}>
        Gäste empfehlen dein Restaurant — beide werden belohnt.
      </p>

      {/* Stats */}
      {stats && (
        <div style={{ ...sectionStyle }}>
          <p style={labelStyle}>Letzte 30 Tage</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '12px' }}>
            <Stat label="Aktive Referrer" value={stats.total_shared} />
            <Stat label="Conversions" value={stats.total_converted} />
            <Stat label="Conv.-Rate" value={`${stats.conversion_rate}%`} />
          </div>
        </div>
      )}

      {/* Config */}
      <div style={sectionStyle}>
        <p style={labelStyle}>Einstellungen</p>

        {/* Enable toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Referral aktiv</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: '2px' }}>Share-Block erscheint nach jeder Bestellung</div>
          </div>
          <button
            onClick={() => setConfig(c => c ? { ...c, referral_enabled: !c.referral_enabled } : c)}
            style={{
              width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
              background: config.referral_enabled ? '#ea580c' : 'rgba(255,255,255,0.1)',
              position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: '3px',
              left: config.referral_enabled ? '23px' : '3px',
              width: '18px', height: '18px', borderRadius: '9px',
              background: '#fff', transition: 'left 0.2s',
            }} />
          </button>
        </div>

        {/* Reward type */}
        <div style={{ marginBottom: '16px' }}>
          <p style={{ ...labelStyle, marginBottom: '8px' }}>Belohnungstyp für Referrer</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['points', 'discount', 'both'] as const).map(type => (
              <button
                key={type}
                onClick={() => setConfig(c => c ? { ...c, referral_reward_type: type } : c)}
                style={{
                  flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer',
                  border: `1px solid ${config.referral_reward_type === type ? '#ea580c' : 'rgba(255,255,255,0.1)'}`,
                  background: config.referral_reward_type === type ? 'rgba(234,88,12,0.15)' : 'transparent',
                  color: config.referral_reward_type === type ? '#ea580c' : 'rgba(255,255,255,0.5)',
                  fontWeight: 700, fontSize: '0.8rem',
                }}
              >
                {type === 'points' ? '⭐ Punkte' : type === 'discount' ? '🎟 Rabatt' : '✨ Beides'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div>
            <p style={labelStyle}>Punkte für Referrer</p>
            <input
              type="number"
              min={0}
              value={config.referral_reward_points}
              onChange={e => setConfig(c => c ? { ...c, referral_reward_points: Number(e.target.value) } : c)}
              style={inputStyle}
            />
          </div>
          <div>
            <p style={labelStyle}>% Rabatt für Referrer</p>
            <input
              type="number"
              min={0}
              max={100}
              value={config.referral_reward_discount_percent}
              onChange={e => setConfig(c => c ? { ...c, referral_reward_discount_percent: Number(e.target.value) } : c)}
              style={inputStyle}
            />
          </div>
          <div>
            <p style={labelStyle}>% Rabatt für Geworbenen</p>
            <input
              type="number"
              min={0}
              max={100}
              value={config.referral_referred_discount_percent}
              onChange={e => setConfig(c => c ? { ...c, referral_referred_discount_percent: Number(e.target.value) } : c)}
              style={inputStyle}
            />
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '11px 24px', borderRadius: '10px', border: 'none',
            background: saved ? '#166534' : '#ea580c', color: '#fff',
            fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {saved ? '✓ Gespeichert' : saving ? 'Speichere…' : 'Speichern'}
        </button>
      </div>

      {/* Top Referrers */}
      {topReferrers.length > 0 && (
        <div style={sectionStyle}>
          <p style={{ ...labelStyle, marginBottom: '12px' }}>Top Referrer (30 Tage)</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {topReferrers.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>{r.email}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ea580c' }}>{r.conversions} Conversions</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
