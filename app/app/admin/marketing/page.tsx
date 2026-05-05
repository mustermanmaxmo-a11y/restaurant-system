'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Mail, Users, Send, Plus, Trash2, Eye } from 'lucide-react'

interface Subscriber {
  id: string
  email: string
  name: string | null
  opted_in_at: string
  unsubscribed_at: string | null
  source: string
}

interface Campaign {
  id: string
  subject: string
  body: string
  target: string
  status: string
  sent_at: string | null
  recipient_count: number | null
  created_at: string
}

export default function MarketingPage() {
  const router = useRouter()
  const [restaurantId, setRestaurantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'subscribers' | 'campaigns' | 'guests'>('campaigns')
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [sending, setSending] = useState<string | null>(null)

  // Campaign editor state
  const [showEditor, setShowEditor] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [target, setTarget] = useState('all')
  const [saving, setSaving] = useState(false)

  // Preview
  const [previewCampaign, setPreviewCampaign] = useState<Campaign | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }
      const { data: resto } = await supabase.from('restaurants').select('id, email_marketing_enabled').eq('owner_id', session.user.id).limit(1).single()
      if (!resto) { router.push('/admin/setup'); return }
      setRestaurantId(resto.id)
      await loadData(resto.id)
      setLoading(false)
    }
    load()
  }, [router])

  async function loadData(rid: string) {
    const [{ data: subs }, { data: camps }, { data: members }] = await Promise.all([
      supabase.from('marketing_subscribers').select('*').eq('restaurant_id', rid).order('opted_in_at', { ascending: false }),
      supabase.from('marketing_campaigns').select('*').eq('restaurant_id', rid).order('created_at', { ascending: false }),
      supabase.from('loyalty_members').select('id, user_id, stamp_count, created_at').eq('restaurant_id', rid).order('created_at', { ascending: false }),
    ])
    setSubscribers((subs ?? []) as Subscriber[])
    setCampaigns((camps ?? []) as Campaign[])
    setLoyaltyMembers((members ?? []) as LoyaltyMemberCRM[])
  }

  async function saveCampaign() {
    if (!subject.trim() || !body.trim()) return
    setSaving(true)
    await supabase.from('marketing_campaigns').insert({
      restaurant_id: restaurantId,
      subject: subject.trim(),
      body: body.trim(),
      target,
      status: 'draft',
    })
    await loadData(restaurantId)
    setShowEditor(false)
    setSubject('')
    setBody('')
    setTarget('all')
    setSaving(false)
  }

  async function sendCampaign(campaign: Campaign) {
    if (campaign.status === 'sent') return
    if (!confirm(`Kampagne "${campaign.subject}" an alle passenden Abonnenten senden?`)) return
    setSending(campaign.id)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/marketing/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ restaurantId, campaignId: campaign.id }),
    })
    const data = await res.json()
    if (res.ok) {
      alert(`✅ ${data.sent} Emails versendet.`)
    } else {
      alert('Fehler: ' + (data.error ?? 'Unbekannter Fehler'))
    }
    await loadData(restaurantId)
    setSending(null)
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Kampagne löschen?')) return
    await supabase.from('marketing_campaigns').delete().eq('id', id)
    setCampaigns(prev => prev.filter(c => c.id !== id))
  }

  interface LoyaltyMemberCRM { id: string; user_id: string; stamp_count: number; created_at: string; email?: string }
  const [loyaltyMembers, setLoyaltyMembers] = useState<LoyaltyMemberCRM[]>([])

  const activeSubscribers = subscribers.filter(s => !s.unsubscribed_at).length

  const s = {
    input: { width: '100%', boxSizing: 'border-box' as const, background: 'var(--surface-2, #1a1a2a)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none' },
    label: { color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 as const, display: 'block' as const, marginBottom: '6px' },
  }

  if (loading) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '1.2rem' }}>←</button>
        <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>Email Marketing</h1>
      </div>

      <div style={{ padding: '24px', maxWidth: '860px', margin: '0 auto' }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Users size={14} color="var(--accent)" />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Abonnenten</span>
            </div>
            <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.6rem' }}>{activeSubscribers}</p>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Mail size={14} color="var(--accent)" />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Kampagnen</span>
            </div>
            <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.6rem' }}>{campaigns.length}</p>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Send size={14} color="var(--accent)" />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Versendet</span>
            </div>
            <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.6rem' }}>{campaigns.filter(c => c.status === 'sent').reduce((s, c) => s + (c.recipient_count ?? 0), 0)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--surface)', borderRadius: '12px', padding: '4px', width: 'fit-content', flexWrap: 'wrap' }}>
          {([
            { key: 'campaigns', label: 'Kampagnen' },
            { key: 'subscribers', label: 'Abonnenten' },
            { key: 'guests', label: 'Gäste (CRM)' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '8px 16px', borderRadius: '9px', border: 'none', background: tab === t.key ? 'var(--accent)' : 'transparent', color: tab === t.key ? '#fff' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'campaigns' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button onClick={() => setShowEditor(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--accent)', border: 'none', borderRadius: '10px', padding: '9px 16px', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                <Plus size={14} /> Neue Kampagne
              </button>
            </div>

            {campaigns.length === 0 && (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Noch keine Kampagnen.</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {campaigns.map(camp => (
                <div key={camp.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>{camp.subject}</p>
                      <span style={{ background: camp.status === 'sent' ? 'rgba(34,197,94,0.12)' : 'rgba(234,88,12,0.12)', color: camp.status === 'sent' ? '#22c55e' : 'var(--accent)', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px' }}>
                        {camp.status === 'sent' ? `Versendet (${camp.recipient_count ?? 0} Empfänger)` : 'Entwurf'}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
                      Ziel: {camp.target === 'all' ? 'Alle Abonnenten' : camp.target === 'loyalty' ? 'Loyalty-Mitglieder' : camp.target} · {new Date(camp.created_at).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setPreviewCampaign(camp)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 10px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                      <Eye size={13} /> Vorschau
                    </button>
                    {camp.status !== 'sent' && (
                      <button onClick={() => sendCampaign(camp)} disabled={sending === camp.id} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '7px 12px', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: sending === camp.id ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Send size={12} /> {sending === camp.id ? 'Sende…' : 'Senden'}
                      </button>
                    )}
                    <button onClick={() => deleteCampaign(camp.id)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 10px', color: '#ef4444', cursor: 'pointer' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'subscribers' && (
          <div>
            {subscribers.length === 0 && (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
                Noch keine Abonnenten. Aktiviere Email-Marketing in den Einstellungen und füge eine Opt-in-Checkbox beim Checkout hinzu.
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {subscribers.map(sub => (
                <div key={sub.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem', margin: '0 0 2px' }}>{sub.email}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>{sub.name ?? 'Kein Name'} · {new Date(sub.opted_in_at).toLocaleDateString('de-DE')}</p>
                  </div>
                  {sub.unsubscribed_at ? (
                    <span style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 600 }}>Abgemeldet</span>
                  ) : (
                    <span style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 700 }}>✓ Aktiv</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === 'guests' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
              {[
                { label: 'Gesamt', value: loyaltyMembers.length },
                { label: 'Aktiv (≤30T)', value: loyaltyMembers.filter(m => (Date.now() - new Date(m.created_at).getTime()) / 86400000 <= 30).length },
                { label: 'Inaktiv (>30T)', value: loyaltyMembers.filter(m => (Date.now() - new Date(m.created_at).getTime()) / 86400000 > 30).length },
              ].map(stat => (
                <div key={stat.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>{stat.label}</p>
                  <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.5rem' }}>{stat.value}</p>
                </div>
              ))}
            </div>
            {loyaltyMembers.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Noch keine Loyalty-Gäste. Aktiviere das Loyalty-Programm in den Einstellungen.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {loyaltyMembers.map(member => {
                  const daysSince = Math.floor((Date.now() - new Date(member.created_at).getTime()) / 86400000)
                  const statusColor = daysSince <= 14 ? '#22c55e' : daysSince <= 30 ? '#f59e0b' : '#ef4444'
                  return (
                    <div key={member.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.user_id.slice(0, 8)}…</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>
                          {member.stamp_count} Stempel · beigetreten vor {daysSince}T
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Campaign Editor Modal */}
      {showEditor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px', padding: '28px', maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '20px' }}>Neue Kampagne</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={s.label}>Betreff</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="z.B. Unser Wochenspecial 🍝" style={s.input} />
              </div>
              <div>
                <label style={s.label}>Nachricht</label>
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} placeholder="Deine Nachricht an die Gäste…" style={{ ...s.input, resize: 'vertical', lineHeight: 1.6 }} />
              </div>
              <div>
                <label style={s.label}>Zielgruppe</label>
                <select value={target} onChange={e => setTarget(e.target.value)} style={s.input}>
                  <option value="all">Alle Abonnenten</option>
                  <option value="loyalty">Nur Loyalty-Mitglieder</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowEditor(false)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 16px', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>Abbrechen</button>
                <button onClick={saveCampaign} disabled={saving || !subject.trim() || !body.trim()} style={{ background: 'var(--accent)', border: 'none', borderRadius: '10px', padding: '10px 20px', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: saving ? 'wait' : 'pointer' }}>
                  {saving ? 'Speichert…' : 'Als Entwurf speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewCampaign && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px', padding: '28px', maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem' }}>Vorschau: {previewCampaign.subject}</h2>
              <button onClick={() => setPreviewCampaign(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', color: '#111' }}>
              <h3 style={{ fontWeight: 700, marginBottom: '12px' }}>{previewCampaign.subject}</h3>
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: '24px' }}>{previewCampaign.body}</p>
              <hr style={{ border: 'none', borderTop: '1px solid #eee', marginBottom: '12px' }} />
              <p style={{ color: '#999', fontSize: '12px' }}>Du erhältst diese Email weil du dich angemeldet hast. <span style={{ textDecoration: 'underline' }}>Abmelden</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
