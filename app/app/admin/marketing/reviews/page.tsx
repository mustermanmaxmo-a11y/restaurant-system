'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Stats {
  emails_sent: number
  ratings_received: number
  positive_ratings: number
  positive_percent: number
  google_clicks: number
  by_stars: Record<number, number>
}

interface FeedbackRow {
  id: string
  stars: number
  feedback: string
  created_at: string
}

export default function ReviewsAdminPage() {
  const [restaurantId, setRestaurantId] = useState<string>('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentFeedback, setRecentFeedback] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: resto } = await supabase
        .from('restaurants').select('id').eq('owner_id', user.id).maybeSingle()
      if (!resto) { setLoading(false); return }
      setRestaurantId(resto.id)

      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const [emailsRes, ratingsRes, clicksRes, feedbackRes] = await Promise.all([
        supabase
          .from('marketing_events')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', resto.id)
          .eq('event_type', 'rating_email_sent')
          .gte('occurred_at', since),
        supabase
          .from('order_ratings')
          .select('id, stars, feedback, created_at')
          .eq('restaurant_id', resto.id)
          .gte('created_at', since),
        supabase
          .from('marketing_events')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', resto.id)
          .eq('event_type', 'google_review_clicked')
          .gte('occurred_at', since),
        supabase
          .from('order_ratings')
          .select('id, stars, feedback, created_at')
          .eq('restaurant_id', resto.id)
          .not('feedback', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      const ratings = ratingsRes.data ?? []
      const totalRatings = ratings.length
      const positiveRatings = ratings.filter(r => r.stars >= 4).length
      const byStars: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      for (const r of ratings) byStars[r.stars] = (byStars[r.stars] ?? 0) + 1

      setStats({
        emails_sent: emailsRes.count ?? 0,
        ratings_received: totalRatings,
        positive_ratings: positiveRatings,
        positive_percent: totalRatings > 0 ? Math.round((positiveRatings / totalRatings) * 100) : 0,
        google_clicks: clicksRes.count ?? 0,
        by_stars: byStars,
      })

      setRecentFeedback((feedbackRes.data ?? []).map(r => ({
        id: r.id,
        stars: r.stars,
        feedback: r.feedback ?? '',
        created_at: r.created_at,
      })))

      setLoading(false)
    })()
  }, [])

  if (loading) return <div style={{ padding: '24px', color: 'var(--text)' }}>Lädt…</div>
  if (!restaurantId) return <div style={{ padding: '24px', color: 'var(--text)' }}>Kein Restaurant gefunden.</div>

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '24px', color: 'var(--text)' }}>★ Google Reviews</h1>

      {stats && (
        <>
          <section style={sectionStyle}>
            <h2 style={h2Style}>Letzte 30 Tage</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              <Stat label="Emails verschickt" value={stats.emails_sent.toString()} />
              <Stat label="Bewertungen" value={stats.ratings_received.toString()} />
              <Stat label="Davon positiv (4-5★)" value={`${stats.positive_ratings} (${stats.positive_percent}%)`} />
              <Stat label="Google-Klicks" value={stats.google_clicks.toString()} />
            </div>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>Sternverteilung</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[5, 4, 3, 2, 1].map(s => {
                const count = stats.by_stars[s] ?? 0
                const max = Math.max(...Object.values(stats.by_stars), 1)
                const pct = (count / max) * 100
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ minWidth: '80px', fontSize: '0.85rem', color: 'var(--text)' }}>{'★'.repeat(s)}</div>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '4px', height: '20px', position: 'relative' }}>
                      <div style={{ background: '#EA580C', width: `${pct}%`, height: '100%', borderRadius: '4px', transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ minWidth: '40px', textAlign: 'right', fontSize: '0.85rem', color: '#71717a' }}>{count}</div>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}

      <section style={sectionStyle}>
        <h2 style={h2Style}>Letzte Bewertungen mit Feedback</h2>
        {recentFeedback.length === 0 ? (
          <p style={{ color: '#71717a', fontSize: '0.85rem' }}>Noch keine Bewertungen mit Feedback.</p>
        ) : (
          <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', color: 'var(--text)' }}>
            <thead><tr>
              <th style={thStyle}>Datum</th>
              <th style={thStyle}>Sterne</th>
              <th style={thStyle}>Feedback</th>
            </tr></thead>
            <tbody>
              {recentFeedback.map(r => (
                <tr key={r.id}>
                  <td style={tdStyle}>{new Date(r.created_at).toLocaleDateString('de-DE')}</td>
                  <td style={tdStyle}>{'★'.repeat(r.stars)}</td>
                  <td style={tdStyle}>{r.feedback}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <a href="/admin/settings" style={{ color: '#EA580C', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none' }}>
        → Auto-Email-Einstellungen ändern
      </a>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p style={{ fontSize: '0.7rem', color: '#8B8B93', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
      <p style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)' }}>{value}</p>
    </div>
  )
}

const sectionStyle: React.CSSProperties = {
  background: '#0f0f13', borderRadius: '14px', padding: '20px',
  border: '1px solid rgba(255,255,255,0.08)', marginBottom: '20px',
}
const h2Style: React.CSSProperties = { fontSize: '1rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text)' }
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px', color: '#8B8B93', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 600 }
const tdStyle: React.CSSProperties = { padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'top' }
