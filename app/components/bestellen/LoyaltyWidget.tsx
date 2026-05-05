'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface LoyaltyProgram {
  id: string
  enabled: boolean
  mechanic: 'stamps' | 'points'
  goal: number
  points_per_euro: number
  reward_text: string
  show_banner: boolean
  email_link_enabled: boolean
}

interface LoyaltyMember {
  id: string
  stamp_count: number
  points: number
  dietary_preferences: string[]
  favorite_item_ids: string[]
}

interface Props {
  restaurantId: string
  accentColor?: string
}

const spring = { type: 'spring' as const, stiffness: 420, damping: 26 }

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useLoyalty(restaurantId: string) {
  const [program, setProgram] = useState<LoyaltyProgram | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [member, setMember] = useState<LoyaltyMember | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('loyalty_programs')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('enabled', true)
      .maybeSingle()
      .then(({ data }) => setProgram(data))
  }, [restaurantId])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user || !program) { setMember(null); return }
    supabase
      .from('loyalty_members')
      .select('id, stamp_count, points, dietary_preferences, favorite_item_ids')
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurantId)
      .maybeSingle()
      .then(({ data }) => setMember(data ? { ...data, dietary_preferences: data.dietary_preferences ?? [], favorite_item_ids: data.favorite_item_ids ?? [] } : null))
  }, [user, program, restaurantId])

  const creditStamp = useCallback(async (orderTotal: number) => {
    if (!user || !program) return
    let mem = member
    if (!mem) {
      const { data } = await supabase
        .from('loyalty_members')
        .upsert({ user_id: user.id, restaurant_id: restaurantId }, { onConflict: 'user_id,restaurant_id' })
        .select('id, stamp_count, points, dietary_preferences, favorite_item_ids')
        .single()
      mem = data ? { ...data, dietary_preferences: data.dietary_preferences ?? [], favorite_item_ids: data.favorite_item_ids ?? [] } : null
    }
    if (!mem) return

    if (program.mechanic === 'stamps') {
      await supabase.from('loyalty_members').update({ stamp_count: mem.stamp_count + 1 }).eq('id', mem.id)
      setMember({ ...mem, stamp_count: mem.stamp_count + 1 })
      setToastMsg('+1 Stempel 🎉')
    } else {
      const earned = Math.floor(orderTotal * program.points_per_euro)
      await supabase.from('loyalty_members').update({ points: mem.points + earned }).eq('id', mem.id)
      setMember({ ...mem, points: mem.points + earned })
      setToastMsg(`+${earned} Punkte 🎉`)
    }
    setTimeout(() => setToastMsg(null), 4000)
  }, [user, program, member, restaurantId])

  return { program, user, member, toastMsg, setUser, setMember, creditStamp }
}

// ─── LoyaltyButton (top-right header) ────────────────────────────────────────
export function LoyaltyButton({ restaurantId, accentColor = '#EA580C' }: Props) {
  const { program, user, member, toastMsg, setUser, setMember, creditStamp: _ } = useLoyalty(restaurantId)
  const [showModal, setShowModal] = useState(false)
  const [showCard, setShowCard] = useState(false)

  if (!program) return null

  const displayName = user?.email?.split('@')[0] ?? null

  return (
    <>
      {/* Button */}
      <button
        onClick={() => user ? setShowCard(v => !v) : setShowModal(true)}
        style={{
          background: accentColor + '20',
          border: `1px solid ${accentColor}40`,
          borderRadius: '20px',
          padding: '6px 12px',
          color: accentColor,
          fontWeight: 700,
          fontSize: '0.78rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          whiteSpace: 'nowrap',
        }}
      >
        {user ? `${displayName} ★` : 'Anmelden'}
      </button>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <LoyaltyModal
            restaurantId={restaurantId}
            accentColor={accentColor}
            emailLinkEnabled={program.email_link_enabled}
            onClose={() => setShowModal(false)}
            onSuccess={(u, m) => { setUser(u); setMember(m); setShowModal(false) }}
          />
        )}
      </AnimatePresence>

      {/* Card Dropdown */}
      <AnimatePresence>
        {showCard && user && member !== undefined && (
          <LoyaltyCardDropdown
            program={program}
            member={member}
            memberId={member?.id}
            accentColor={accentColor}
            onClose={() => setShowCard(false)}
            onSignOut={async () => {
              await supabase.auth.signOut()
              setUser(null)
              setMember(null)
              setShowCard(false)
            }}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 60, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 60, x: '-50%' }}
            transition={spring}
            style={{
              position: 'fixed', bottom: '80px', left: '50%',
              background: accentColor, color: '#fff',
              borderRadius: '24px', padding: '10px 20px',
              fontWeight: 700, fontSize: '0.9rem',
              zIndex: 9999, pointerEvents: 'none',
              boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            }}
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Banner (above menu, optional) ────────────────────────────────────────────
export function LoyaltyBanner({ restaurantId, accentColor = '#EA580C' }: Props) {
  const { program, user, member } = useLoyalty(restaurantId)

  if (!program?.show_banner || user) return null

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      style={{
        background: accentColor + '15',
        borderBottom: `1px solid ${accentColor}30`,
        padding: '10px 20px',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: accentColor,
        fontWeight: 600,
      }}
    >
      ⭐ Sammle Stempel und erhalte {program.reward_text} — jetzt anmelden!
    </motion.div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function LoyaltyModal({
  restaurantId,
  accentColor,
  emailLinkEnabled,
  onClose,
  onSuccess,
}: {
  restaurantId: string
  accentColor: string
  emailLinkEnabled: boolean
  onClose: () => void
  onSuccess: (user: User, member: LoyaltyMember | null) => void
}) {
  const [mode, setMode] = useState<'login' | 'register' | 'magic'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [magicSent, setMagicSent] = useState(false)

  async function handleSubmit() {
    if (!email.trim() || (!password.trim() && mode !== 'magic')) return
    setLoading(true); setError('')

    if (mode === 'magic') {
      const { error: err } = await supabase.auth.signInWithOtp({ email })
      if (err) { setError(err.message); setLoading(false); return }
      setMagicSent(true); setLoading(false); return
    }

    if (mode === 'register') {
      const { data, error: err } = await supabase.auth.signUp({ email, password })
      if (err) { setError(err.message); setLoading(false); return }
      if (data.user) {
        const { data: mem } = await supabase
          .from('loyalty_members')
          .upsert({ user_id: data.user.id, restaurant_id: restaurantId }, { onConflict: 'user_id,restaurant_id' })
          .select('id, stamp_count, points, dietary_preferences, favorite_item_ids').single()
        onSuccess(data.user, mem ? { ...mem, dietary_preferences: mem.dietary_preferences ?? [], favorite_item_ids: mem.favorite_item_ids ?? [] } : null)
      }
    } else {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) { setError(err.message); setLoading(false); return }
      if (data.user) {
        const { data: mem } = await supabase
          .from('loyalty_members')
          .select('id, stamp_count, points, dietary_preferences, favorite_item_ids')
          .eq('user_id', data.user.id)
          .eq('restaurant_id', restaurantId)
          .maybeSingle()
        onSuccess(data.user, mem ? { ...mem, dietary_preferences: mem.dietary_preferences ?? [], favorite_item_ids: mem.favorite_item_ids ?? [] } : null)
      }
    }
    setLoading(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        zIndex: 9000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={spring}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0f0f13', borderRadius: '20px 20px 0 0',
          padding: '28px 24px 40px', width: '100%', maxWidth: '480px',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: '#F5F5F7', fontWeight: 800, fontSize: '1.1rem' }}>
            {mode === 'register' ? 'Konto erstellen' : mode === 'magic' ? 'Link senden' : 'Anmelden'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8B8B93', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>

        {magicSent ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📬</div>
            <p style={{ color: '#F5F5F7', fontWeight: 700, marginBottom: '6px' }}>E-Mail gesendet!</p>
            <p style={{ color: '#8B8B93', fontSize: '0.85rem' }}>Klicke auf den Link in der E-Mail um dich anzumelden.</p>
          </div>
        ) : (
          <>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="deine@email.de"
              style={inputStyle}
            />
            {mode !== 'magic' && (
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Passwort"
                style={{ ...inputStyle, marginTop: '10px' }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            )}
            {error && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '8px' }}>{error}</p>}
            <button
              onClick={handleSubmit}
              disabled={loading || !email.trim() || (mode !== 'magic' && !password.trim())}
              style={{
                width: '100%', marginTop: '16px',
                background: accentColor, color: '#fff', border: 'none',
                borderRadius: '12px', padding: '13px',
                fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Bitte warten…' : mode === 'register' ? 'Konto erstellen' : mode === 'magic' ? 'Link senden' : 'Anmelden'}
            </button>

            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              {mode === 'login' && (
                <button onClick={() => setMode('register')} style={linkBtnStyle}>
                  Noch kein Konto? Registrieren →
                </button>
              )}
              {mode === 'register' && (
                <button onClick={() => setMode('login')} style={linkBtnStyle}>
                  Bereits ein Konto? Anmelden →
                </button>
              )}
              {emailLinkEnabled && mode !== 'magic' && (
                <button onClick={() => setMode('magic')} style={linkBtnStyle}>
                  Ohne Passwort per E-Mail-Link →
                </button>
              )}
              {mode === 'magic' && (
                <button onClick={() => setMode('login')} style={linkBtnStyle}>
                  Zurück zur Anmeldung
                </button>
              )}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

const DIETARY_OPTIONS = [
  { key: 'vegetarisch', label: '🥗 Vegetarisch' },
  { key: 'vegan', label: '🌱 Vegan' },
  { key: 'glutenfrei', label: '🌾 Glutenfrei' },
  { key: 'laktosefrei', label: '🥛 Laktosefrei' },
  { key: 'no_nuts', label: '🥜 Keine Nüsse' },
  { key: 'no_fish', label: '🐟 Kein Fisch' },
]

// ─── Card Dropdown ─────────────────────────────────────────────────────────────
function LoyaltyCardDropdown({
  program,
  member,
  memberId,
  accentColor,
  onClose,
  onSignOut,
}: {
  program: LoyaltyProgram
  member: LoyaltyMember | null
  memberId?: string
  accentColor: string
  onClose: () => void
  onSignOut: () => void
}) {
  const [tab, setTab] = useState<'card' | 'profile'>('card')
  const [dietary, setDietary] = useState<string[]>(member?.dietary_preferences ?? [])
  const [savingPref, setSavingPref] = useState(false)
  const current = program.mechanic === 'stamps' ? (member?.stamp_count ?? 0) : (member?.points ?? 0)
  const pct = Math.min(current / program.goal, 1)
  const mId = member?.id ?? memberId

  async function toggleDietary(key: string) {
    const newVal = dietary.includes(key) ? dietary.filter(d => d !== key) : [...dietary, key]
    setDietary(newVal)
    if (!mId) return
    setSavingPref(true)
    await supabase.from('loyalty_members').update({ dietary_preferences: newVal }).eq('id', mId)
    setSavingPref(false)
  }

  async function downloadData() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/profile/export', { headers: { Authorization: `Bearer ${session.access_token}` } })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'meine-daten.json'; a.click()
    URL.revokeObjectURL(url)
  }

  async function deleteAccount() {
    if (!confirm('Konto und alle Daten unwiderruflich löschen?')) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch('/api/profile/delete', { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } })
    onSignOut()
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 8998 }} />
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.95 }}
        transition={spring}
        style={{
          position: 'absolute', top: '70px', right: '16px',
          background: '#0f0f13', borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '18px', width: '260px',
          zIndex: 8999, boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}
      >
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '3px' }}>
          {(['card', 'profile'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '5px 0', borderRadius: '8px', border: 'none', background: tab === t ? accentColor : 'transparent', color: tab === t ? '#fff' : '#8B8B93', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
              {t === 'card' ? '⭐ Karte' : '👤 Profil'}
            </button>
          ))}
        </div>

        {tab === 'card' && (
          <>
            <p style={{ color: '#8B8B93', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
              Deine {program.mechanic === 'stamps' ? 'Stempelkarte' : 'Punkte'}
            </p>

            {program.mechanic === 'stamps' ? (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                  {Array.from({ length: Math.min(program.goal, 20) }).map((_, i) => (
                    <span key={i} style={{ fontSize: '1.1rem', filter: i < current ? 'none' : 'grayscale(1) opacity(0.25)' }}>⭐</span>
                  ))}
                </div>
                <p style={{ color: '#F5F5F7', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>
                  {current} / {program.goal} Stempel
                </p>
              </>
            ) : (
              <>
                <p style={{ color: accentColor, fontSize: '1.4rem', fontWeight: 800, marginBottom: '6px' }}>{current} Punkte</p>
                <div style={{ background: '#2a2a3a', borderRadius: '4px', height: '6px', marginBottom: '8px' }}>
                  <div style={{ background: accentColor, width: `${pct * 100}%`, height: '100%', borderRadius: '4px', transition: 'width 0.4s' }} />
                </div>
              </>
            )}

            {current >= program.goal ? (
              <div style={{ background: accentColor + '20', borderRadius: '8px', padding: '8px 10px', fontSize: '0.8rem', color: accentColor, fontWeight: 700 }}>
                🎉 Belohnung verfügbar: {program.reward_text}
              </div>
            ) : (
              <p style={{ color: '#8B8B93', fontSize: '0.78rem' }}>
                Noch {program.goal - current} {program.mechanic === 'stamps' ? 'Stempel' : 'Punkte'} bis: <span style={{ color: '#F5F5F7' }}>{program.reward_text}</span>
              </p>
            )}
          </>
        )}

        {tab === 'profile' && (
          <>
            <p style={{ color: '#8B8B93', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Ernährung {savingPref ? '(speichert…)' : ''}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
              {DIETARY_OPTIONS.map(opt => (
                <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={dietary.includes(opt.key)} onChange={() => toggleDietary(opt.key)} />
                  <span style={{ color: '#F5F5F7', fontSize: '0.82rem' }}>{opt.label}</span>
                </label>
              ))}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button onClick={downloadData} style={{ ...linkBtnStyle, textAlign: 'left', fontSize: '0.75rem' }}>⬇ Meine Daten herunterladen</button>
              <button onClick={deleteAccount} style={{ ...linkBtnStyle, color: '#ef4444', textAlign: 'left', fontSize: '0.75rem' }}>🗑 Konto löschen</button>
            </div>
          </>
        )}

        <button onClick={onSignOut} style={{ ...linkBtnStyle, marginTop: '14px', display: 'block' }}>
          Abmelden
        </button>
      </motion.div>
    </>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: '#1a1a2a', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px', padding: '12px 14px',
  color: '#F5F5F7', fontSize: '0.875rem',
  fontFamily: 'inherit', outline: 'none',
}

const linkBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#8B8B93',
  fontSize: '0.8rem', cursor: 'pointer', padding: '2px 0',
}
