'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Download, Trash2, ShieldCheck, AlertTriangle, KeyRound, CheckCircle2, Smartphone, Bell, Eye, EyeOff } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

export default function SettingsPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [userId, setUserId] = useState<string | null>(null)
  const [restaurant, setRestaurant] = useState<{ id: string; plan: string; weekly_report_email: boolean; delivery_buffer_minutes: number; google_review_url: string | null; email_marketing_enabled: boolean; prep_show_in_kds: boolean; prep_push_enabled: boolean; benchmark_opt_in: boolean; restaurant_category: string | null; seating_capacity: number | null; crm_rule_inactive: boolean; crm_rule_almost_goal: boolean; crm_rule_welcome: boolean; online_payments_enabled: boolean; stripe_connect_account_id: string | null } | null>(null)
  const [emailToggleLoading, setEmailToggleLoading] = useState(false)
  const [deliveryBuffer, setDeliveryBuffer] = useState<string>('25')
  const [deliveryBufferSaving, setDeliveryBufferSaving] = useState(false)
  const [googleReviewUrl, setGoogleReviewUrl] = useState('')
  const [googleReviewSaving, setGoogleReviewSaving] = useState(false)
  const [googleReviewSaved, setGoogleReviewSaved] = useState(false)

  const [loyalty, setLoyalty] = useState<{
    id?: string
    enabled: boolean
    mechanic: 'stamps' | 'points'
    goal: number
    points_per_euro: number
    reward_text: string
    show_banner: boolean
    email_link_enabled: boolean
  }>({ enabled: false, mechanic: 'stamps', goal: 10, points_per_euro: 10, reward_text: 'Gratis-Getränk', show_banner: false, email_link_enabled: true })
  const [loyaltySaving, setLoyaltySaving] = useState(false)
  const [loyaltySaved, setLoyaltySaved] = useState(false)

  const [alerts, setAlerts] = useState<{
    id?: string
    alerts_enabled: boolean
    push_kitchen: boolean
    push_admin: boolean
    kds_visual: boolean
    show_sold_out_label: boolean
    auto_hide_item: boolean
    default_threshold: number
  }>({ alerts_enabled: false, push_kitchen: false, push_admin: false, kds_visual: false, show_sold_out_label: false, auto_hide_item: false, default_threshold: 5 })
  const [alertsSaving, setAlertsSaving] = useState(false)
  const [alertsSaved, setAlertsSaved] = useState(false)

  // Password change state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwNew, setShowPwNew] = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  // 2FA state
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [mfaEnrolling, setMfaEnrolling] = useState(false)
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null)
  const [mfaSecret, setMfaSecret] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaVerifying, setMfaVerifying] = useState(false)
  const [mfaError, setMfaError] = useState('')
  const [mfaSuccess, setMfaSuccess] = useState(false)
  const [mfaUnenrolling, setMfaUnenrolling] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }
      setEmail(session.user.email ?? '')
      setUserId(session.user.id)
      const { data: resto } = await supabase
        .from('restaurants')
        .select('id, plan, weekly_report_email, delivery_buffer_minutes, google_review_url, email_marketing_enabled, prep_show_in_kds, prep_push_enabled, benchmark_opt_in, restaurant_category, seating_capacity, crm_rule_inactive, crm_rule_almost_goal, crm_rule_welcome, online_payments_enabled, stripe_connect_account_id')
        .eq('owner_id', session.user.id)
        .limit(1)
        .single()
      if (resto) {
        setRestaurant(resto)
        setDeliveryBuffer(String(resto.delivery_buffer_minutes ?? 25))
        setGoogleReviewUrl(resto.google_review_url ?? '')
        const { data: lp } = await supabase
          .from('loyalty_programs')
          .select('*')
          .eq('restaurant_id', resto.id)
          .single()
        if (lp) setLoyalty({ id: lp.id, enabled: lp.enabled, mechanic: lp.mechanic, goal: lp.goal, points_per_euro: lp.points_per_euro, reward_text: lp.reward_text, show_banner: lp.show_banner, email_link_enabled: lp.email_link_enabled })
        const { data: as_ } = await supabase.from('alert_settings').select('*').eq('restaurant_id', resto.id).single()
        if (as_) setAlerts({ id: as_.id, alerts_enabled: as_.alerts_enabled, push_kitchen: as_.push_kitchen, push_admin: as_.push_admin, kds_visual: as_.kds_visual, show_sold_out_label: as_.show_sold_out_label, auto_hide_item: as_.auto_hide_item, default_threshold: as_.default_threshold })
      }
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totpFactor = factors?.totp?.find((f: { status: string }) => f.status === 'verified')
      if (totpFactor) {
        setMfaEnabled(true)
        setMfaFactorId(totpFactor.id)
      }
      setLoading(false)
    }
    init()
  }, [router])

  async function handleMfaEnroll() {
    setMfaEnrolling(true)
    setMfaError('')
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'RestaurantOS', friendlyName: 'RestaurantOS' })
    if (error || !data) {
      setMfaError('Fehler beim Aktivieren. Bitte versuche es erneut.')
      setMfaEnrolling(false)
      return
    }
    setMfaFactorId(data.id)
    setMfaQrCode(data.totp.qr_code)
    setMfaSecret(data.totp.secret)
    setMfaEnrolling(false)
  }

  async function handleMfaVerify() {
    if (!mfaFactorId || mfaCode.length !== 6) return
    setMfaVerifying(true)
    setMfaError('')
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId })
    if (challengeError || !challengeData) {
      setMfaError('Fehler beim Challenge. Bitte erneut versuchen.')
      setMfaVerifying(false)
      return
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challengeData.id, code: mfaCode })
    if (verifyError) {
      setMfaError('Ungültiger Code. Bitte prüfe deine Authenticator-App.')
      setMfaVerifying(false)
      return
    }
    setMfaEnabled(true)
    setMfaQrCode(null)
    setMfaSecret(null)
    setMfaCode('')
    setMfaSuccess(true)
    setMfaVerifying(false)
  }

  async function handleMfaUnenroll() {
    if (!mfaFactorId) return
    setMfaUnenrolling(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId })
    if (error) {
      alert('Deaktivierung fehlgeschlagen.')
    } else {
      setMfaEnabled(false)
      setMfaFactorId(null)
      setMfaSuccess(false)
    }
    setMfaUnenrolling(false)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch('/api/me/export')
      if (!res.ok) throw new Error('Export fehlgeschlagen')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `restaurantos-daten-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Export fehlgeschlagen. Bitte versuche es erneut.')
    } finally {
      setExporting(false)
    }
  }

  async function handlePasswordChange() {
    setPwError('')
    setPwSuccess(false)
    if (newPassword.length < 8) { setPwError('Passwort muss mindestens 8 Zeichen haben.'); return }
    if (newPassword !== confirmPassword) { setPwError('Passwörter stimmen nicht überein.'); return }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPwError('Fehler: ' + error.message)
    } else {
      setPwSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    }
    setPwLoading(false)
  }

  async function handleEmailToggle() {
    if (!restaurant) return
    setEmailToggleLoading(true)
    const newValue = !restaurant.weekly_report_email
    const { error } = await supabase
      .from('restaurants')
      .update({ weekly_report_email: newValue })
      .eq('id', restaurant.id)
    if (error) {
      alert('Einstellung konnte nicht gespeichert werden.')
    } else {
      setRestaurant(prev => prev ? { ...prev, weekly_report_email: newValue } : prev)
    }
    setEmailToggleLoading(false)
  }

  async function handleGoogleReviewSave() {
    if (!restaurant) return
    setGoogleReviewSaving(true)
    setGoogleReviewSaved(false)
    const { error } = await supabase
      .from('restaurants')
      .update({ google_review_url: googleReviewUrl || null })
      .eq('id', restaurant.id)
    if (error) {
      alert('Speichern fehlgeschlagen.')
    } else {
      setGoogleReviewSaved(true)
      setRestaurant(prev => prev ? { ...prev, google_review_url: googleReviewUrl || null } : prev)
      setTimeout(() => setGoogleReviewSaved(false), 2500)
    }
    setGoogleReviewSaving(false)
  }

  async function handleDeliveryBufferSave() {
    if (!restaurant) return
    const val = parseInt(deliveryBuffer, 10)
    if (isNaN(val) || val < 1 || val > 120) { alert('Wert zwischen 1 und 120 Minuten eingeben.'); return }
    setDeliveryBufferSaving(true)
    const { error } = await supabase
      .from('restaurants')
      .update({ delivery_buffer_minutes: val })
      .eq('id', restaurant.id)
    if (error) alert('Speichern fehlgeschlagen.')
    setDeliveryBufferSaving(false)
  }

  async function handleLoyaltySave() {
    if (!restaurant) return
    setLoyaltySaving(true)
    setLoyaltySaved(false)
    const payload = {
      restaurant_id: restaurant.id,
      enabled: loyalty.enabled,
      mechanic: loyalty.mechanic,
      goal: loyalty.goal,
      points_per_euro: loyalty.points_per_euro,
      reward_text: loyalty.reward_text,
      show_banner: loyalty.show_banner,
      email_link_enabled: loyalty.email_link_enabled,
    }
    const { error } = loyalty.id
      ? await supabase.from('loyalty_programs').update(payload).eq('id', loyalty.id)
      : await supabase.from('loyalty_programs').insert(payload).select('id').single().then(async (r) => {
          if (r.data) setLoyalty(prev => ({ ...prev, id: r.data.id }))
          return r
        })
    if (error) {
      alert('Speichern fehlgeschlagen.')
    } else {
      setLoyaltySaved(true)
      setTimeout(() => setLoyaltySaved(false), 2500)
    }
    setLoyaltySaving(false)
  }

  async function handleAlertsSave() {
    if (!restaurant) return
    setAlertsSaving(true)
    setAlertsSaved(false)
    const payload = { restaurant_id: restaurant.id, ...alerts }
    const { error } = alerts.id
      ? await supabase.from('alert_settings').update(payload).eq('id', alerts.id)
      : await supabase.from('alert_settings').upsert(payload, { onConflict: 'restaurant_id' })
    if (error) {
      alert('Speichern fehlgeschlagen.')
    } else {
      setAlertsSaved(true)
      setTimeout(() => setAlertsSaved(false), 2500)
    }
    setAlertsSaving(false)
  }

  async function handleDelete() {
    if (deleteInput !== 'LÖSCHEN') return
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch('/api/me/delete', { method: 'DELETE' })
      if (!res.ok) throw new Error('Löschung fehlgeschlagen')
      await supabase.auth.signOut()
      router.push('/')
    } catch {
      setDeleteError('Konto konnte nicht gelöscht werden. Bitte kontaktiere den Support.')
      setDeleting(false)
    }
  }

  const { permission: pushPermission, subscribed: pushSubscribed, loading: pushLoading, subscribe: subscribePush, unsubscribe: unsubscribePush } = usePushNotifications({
    appContext: 'admin',
    restaurantId: restaurant?.id,
    userId: userId ?? undefined,
  })

  if (loading) return null

  return (
    <div style={{ padding: '32px 24px', maxWidth: '640px' }}>
      <h1 style={{ color: 'var(--text)', fontSize: '1.5rem', fontWeight: 800, marginBottom: '4px' }}>
        Einstellungen
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '40px' }}>
        Konto & Datenschutz
      </p>

      {/* Google Review URL */}
      {restaurant && (
        <div style={{
          background: 'var(--surface)', borderRadius: '16px',
          border: '1px solid var(--border)', padding: '20px 24px', marginBottom: '20px',
        }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>
            ⭐ Google Bewertungen
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>
            Wenn Gäste 4–5 Sterne geben, werden sie direkt zu Google weitergeleitet.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '16px' }}>
            Deinen Google Review-Link findest du in Google Maps → dein Restaurant → &quot;Bewertung schreiben&quot; → Link kopieren.
          </p>
          <input
            type="url"
            value={googleReviewUrl}
            onChange={e => setGoogleReviewUrl(e.target.value)}
            placeholder="https://g.page/r/..."
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--surface-2, #1a1a2a)', border: '1px solid var(--border)',
              borderRadius: '10px', padding: '10px 14px',
              color: 'var(--text)', fontSize: '0.875rem', marginBottom: '12px',
              fontFamily: 'inherit', outline: 'none',
            }}
          />
          <button
            onClick={handleGoogleReviewSave}
            disabled={googleReviewSaving}
            style={{
              background: googleReviewSaved ? '#22c55e' : 'var(--accent)',
              border: 'none', borderRadius: '10px', padding: '10px 20px',
              color: '#fff', fontWeight: 700, fontSize: '0.875rem',
              cursor: googleReviewSaving ? 'wait' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {googleReviewSaving ? 'Speichert…' : googleReviewSaved ? '✓ Gespeichert' : 'Speichern'}
          </button>
        </div>
      )}

      {/* Loyalty / Stempelkarte */}
      {restaurant && (
        <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '20px 24px', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>🎁 Digitale Stempelkarte</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>Belohne Stammgäste mit einem Treueprogramm.</p>

          {/* Master toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text)', fontSize: '0.9rem', fontWeight: 600 }}>Loyalty aktiv</span>
            <button onClick={() => setLoyalty(p => ({ ...p, enabled: !p.enabled }))} style={{ width: '48px', height: '26px', borderRadius: '13px', border: 'none', background: loyalty.enabled ? 'var(--accent)' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
              <span style={{ position: 'absolute', top: '3px', left: loyalty.enabled ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </button>
          </div>

          {loyalty.enabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Mechanic */}
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Mechanik</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['stamps', 'points'] as const).map(m => (
                    <button key={m} onClick={() => setLoyalty(p => ({ ...p, mechanic: m }))} style={{ flex: 1, padding: '8px 12px', borderRadius: '10px', border: `1px solid ${loyalty.mechanic === m ? 'var(--accent)' : 'var(--border)'}`, background: loyalty.mechanic === m ? 'rgba(234,88,12,0.12)' : 'transparent', color: loyalty.mechanic === m ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                      {m === 'stamps' ? '🔖 Stempel' : '⭐ Punkte'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Goal */}
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  {loyalty.mechanic === 'stamps' ? 'Stempel-Ziel (Anzahl Bestellungen)' : 'Punkte-Ziel'}
                </label>
                <input type="number" min={1} max={999} value={loyalty.goal} onChange={e => setLoyalty(p => ({ ...p, goal: parseInt(e.target.value) || 1 }))} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--surface-2, #1a1a2a)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none' }} />
              </div>

              {loyalty.mechanic === 'points' && (
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Punkte pro Euro</label>
                  <input type="number" min={1} max={1000} value={loyalty.points_per_euro} onChange={e => setLoyalty(p => ({ ...p, points_per_euro: parseInt(e.target.value) || 1 }))} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--surface-2, #1a1a2a)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none' }} />
                </div>
              )}

              {/* Reward */}
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Belohnung</label>
                <input type="text" value={loyalty.reward_text} onChange={e => setLoyalty(p => ({ ...p, reward_text: e.target.value }))} placeholder="z.B. Gratis-Getränk" style={{ width: '100%', boxSizing: 'border-box', background: 'var(--surface-2, #1a1a2a)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none' }} />
              </div>

              {/* Banner toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>Loyalty-Banner anzeigen</span>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '2px 0 0' }}>Schmaler Hinweis-Banner über dem Menü</p>
                </div>
                <button onClick={() => setLoyalty(p => ({ ...p, show_banner: !p.show_banner }))} style={{ width: '48px', height: '26px', borderRadius: '13px', border: 'none', background: loyalty.show_banner ? 'var(--accent)' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: '3px', left: loyalty.show_banner ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </button>
              </div>

              {/* Email link toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>Magic-Link Login (Email)</span>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '2px 0 0' }}>Gäste können sich per Email-Link anmelden (kein Passwort)</p>
                </div>
                <button onClick={() => setLoyalty(p => ({ ...p, email_link_enabled: !p.email_link_enabled }))} style={{ width: '48px', height: '26px', borderRadius: '13px', border: 'none', background: loyalty.email_link_enabled ? 'var(--accent)' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: '3px', left: loyalty.email_link_enabled ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </button>
              </div>
            </div>
          )}

          <button onClick={handleLoyaltySave} disabled={loyaltySaving} style={{ marginTop: '16px', background: loyaltySaved ? '#22c55e' : 'var(--accent)', border: 'none', borderRadius: '10px', padding: '10px 20px', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: loyaltySaving ? 'wait' : 'pointer', transition: 'background 0.2s' }}>
            {loyaltySaving ? 'Speichert…' : loyaltySaved ? '✓ Gespeichert' : 'Speichern'}
          </button>
        </div>
      )}

      {/* Engpass-Alerts */}
      {restaurant && (
        <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '20px 24px', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>⚠️ Engpass-Alerts</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>Automatische Meldungen wenn Menü-Items knapp werden.</p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text)', fontSize: '0.9rem', fontWeight: 600 }}>Engpass-Alerts aktiv</span>
            <button onClick={() => setAlerts(p => ({ ...p, alerts_enabled: !p.alerts_enabled }))} style={{ width: '48px', height: '26px', borderRadius: '13px', border: 'none', background: alerts.alerts_enabled ? 'var(--accent)' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
              <span style={{ position: 'absolute', top: '3px', left: alerts.alerts_enabled ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </button>
          </div>

          {alerts.alerts_enabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Globaler Schwellwert (Bestand unter X → Alert)</label>
                <input type="number" min={1} max={100} value={alerts.default_threshold} onChange={e => setAlerts(p => ({ ...p, default_threshold: parseInt(e.target.value) || 1 }))} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--surface-2, #1a1a2a)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none' }} />
              </div>

              {([
                { key: 'push_kitchen', label: 'Push-Benachrichtigung an Küche', desc: 'Notification im KDS wenn Schwellwert unterschritten' },
                { key: 'push_admin', label: 'Push-Benachrichtigung an Admin', desc: 'Notification im Admin-Dashboard' },
                { key: 'kds_visual', label: 'Visueller Alert im KDS', desc: 'Rote/orange Hervorhebung im Küchen-Display' },
                { key: 'show_sold_out_label', label: '"Ausverkauft"-Label', desc: 'Item grau + Label wenn Bestand = 0' },
                { key: 'auto_hide_item', label: 'Item automatisch ausblenden', desc: 'Item verschwindet komplett wenn Bestand = 0' },
              ] as { key: keyof typeof alerts; label: string; desc: string }[]).map(({ key, label, desc }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{label}</span>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '2px 0 0' }}>{desc}</p>
                  </div>
                  <button onClick={() => setAlerts(p => ({ ...p, [key]: !p[key] }))} style={{ width: '48px', height: '26px', borderRadius: '13px', border: 'none', background: (alerts[key] as boolean) ? 'var(--accent)' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', top: '3px', left: (alerts[key] as boolean) ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button onClick={handleAlertsSave} disabled={alertsSaving} style={{ marginTop: '16px', background: alertsSaved ? '#22c55e' : 'var(--accent)', border: 'none', borderRadius: '10px', padding: '10px 20px', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: alertsSaving ? 'wait' : 'pointer', transition: 'background 0.2s' }}>
            {alertsSaving ? 'Speichert…' : alertsSaved ? '✓ Gespeichert' : 'Speichern'}
          </button>
        </div>
      )}

      {/* Email Marketing */}
      {restaurant && (
        <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '20px 24px', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>📧 Email Marketing</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
            Wenn aktiv erscheint beim Checkout eine Opt-in-Checkbox. Kampagnen verwalten unter <a href="/admin/marketing" style={{ color: 'var(--accent)' }}>Marketing</a>.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>Email Marketing aktiv</span>
            <button
              onClick={async () => {
                const newVal = !restaurant.email_marketing_enabled
                const { error } = await supabase.from('restaurants').update({ email_marketing_enabled: newVal }).eq('id', restaurant.id)
                if (!error) setRestaurant(prev => prev ? { ...prev, email_marketing_enabled: newVal } : prev)
              }}
              style={{ width: '48px', height: '26px', borderRadius: '13px', border: 'none', background: restaurant.email_marketing_enabled ? 'var(--accent)' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
            >
              <span style={{ position: 'absolute', top: '3px', left: restaurant.email_marketing_enabled ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </button>
          </div>
        </div>
      )}

      {/* KI-Vorbereitungsplan */}
      {restaurant && (
        <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '20px 24px', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>🍳 KI-Vorbereitungsplan</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
            Täglich generierter Prep-Plan basierend auf Reservierungen und Bestellhistorie.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ color: 'var(--text)', fontSize: '0.9rem', fontWeight: 600 }}>Im KDS anzeigen</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Prep-Plan im Küchen-Display sichtbar</p>
              </div>
              <button
                onClick={async () => {
                  const newVal = !restaurant.prep_show_in_kds
                  const { error } = await supabase.from('restaurants').update({ prep_show_in_kds: newVal }).eq('id', restaurant.id)
                  if (!error) setRestaurant(prev => prev ? { ...prev, prep_show_in_kds: newVal } : prev)
                }}
                style={{ width: '48px', height: '26px', borderRadius: '13px', border: 'none', background: restaurant.prep_show_in_kds ? 'var(--accent)' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
              >
                <span style={{ position: 'absolute', top: '3px', left: restaurant.prep_show_in_kds ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ color: 'var(--text)', fontSize: '0.9rem', fontWeight: 600 }}>Push um 08:00</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Tägliche Push-Benachrichtigung mit neuem Plan</p>
              </div>
              <button
                onClick={async () => {
                  const newVal = !restaurant.prep_push_enabled
                  const { error } = await supabase.from('restaurants').update({ prep_push_enabled: newVal }).eq('id', restaurant.id)
                  if (!error) setRestaurant(prev => prev ? { ...prev, prep_push_enabled: newVal } : prev)
                }}
                style={{ width: '48px', height: '26px', borderRadius: '13px', border: 'none', background: restaurant.prep_push_enabled ? 'var(--accent)' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
              >
                <span style={{ position: 'absolute', top: '3px', left: restaurant.prep_push_enabled ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CRM Re-Engagement Regeln */}
      {restaurant && (
        <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '20px 24px', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>🔄 Re-Engagement Regeln</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
            Automatische Emails an Loyalty-Gäste. Versand täglich via n8n. Verwalte Gäste unter <a href="/admin/marketing" style={{ color: 'var(--accent)' }}>Marketing → Gäste</a>.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {([
              { key: 'crm_rule_welcome', label: 'Willkommens-Email', desc: '24h nach erstem Besuch automatisch senden' },
              { key: 'crm_rule_inactive', label: 'Inaktiv seit 30 Tagen', desc: '"Wir vermissen dich!" mit aktuellem Stempel-Stand' },
              { key: 'crm_rule_almost_goal', label: 'Fast am Ziel', desc: 'Bei 8+ Stempeln + 14T inaktiv — Motivation zur Rückkehr' },
            ] as const).map(rule => (
              <div key={rule.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <p style={{ color: 'var(--text)', fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>{rule.label}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>{rule.desc}</p>
                </div>
                <button
                  onClick={async () => {
                    const newVal = !restaurant[rule.key]
                    const { error } = await supabase.from('restaurants').update({ [rule.key]: newVal }).eq('id', restaurant.id)
                    if (!error) setRestaurant(prev => prev ? { ...prev, [rule.key]: newVal } : prev)
                  }}
                  style={{ width: '48px', height: '26px', borderRadius: '13px', border: 'none', background: restaurant[rule.key] ? 'var(--accent)' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                >
                  <span style={{ position: 'absolute', top: '3px', left: restaurant[rule.key] ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Branchenvergleich / Benchmarking */}
      {restaurant && (
        <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '20px 24px', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>📊 Branchenvergleich</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
            Vergleiche deine Kennzahlen anonym mit ähnlichen Restaurants. Nur aggregierte Durchschnitte — kein Restaurant sieht individuelle Daten.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>Am Branchenvergleich teilnehmen</span>
              <button
                onClick={async () => {
                  const newVal = !restaurant.benchmark_opt_in
                  const { error } = await supabase.from('restaurants').update({ benchmark_opt_in: newVal }).eq('id', restaurant.id)
                  if (!error) setRestaurant(prev => prev ? { ...prev, benchmark_opt_in: newVal } : prev)
                }}
                style={{ width: '48px', height: '26px', borderRadius: '13px', border: 'none', background: restaurant.benchmark_opt_in ? 'var(--accent)' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
              >
                <span style={{ position: 'absolute', top: '3px', left: restaurant.benchmark_opt_in ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Restaurantkategorie</label>
              <select
                value={restaurant.restaurant_category ?? ''}
                onChange={async (e) => {
                  const val = e.target.value || null
                  const { error } = await supabase.from('restaurants').update({ restaurant_category: val }).eq('id', restaurant.id)
                  if (!error) setRestaurant(prev => prev ? { ...prev, restaurant_category: val } : prev)
                }}
                style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem' }}
              >
                <option value="">— Auswählen —</option>
                <option value="italian">Italienisch</option>
                <option value="burger">Burger</option>
                <option value="cafe">Café</option>
                <option value="asian">Asiatisch</option>
                <option value="pizza">Pizza</option>
                <option value="german">Deutsch</option>
                <option value="other">Sonstiges</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sitzkapazität (Plätze)</label>
              <input
                type="number"
                min={1}
                value={restaurant.seating_capacity ?? ''}
                onChange={async (e) => {
                  const val = e.target.value ? parseInt(e.target.value) : null
                  const { error } = await supabase.from('restaurants').update({ seating_capacity: val }).eq('id', restaurant.id)
                  if (!error) setRestaurant(prev => prev ? { ...prev, seating_capacity: val } : prev)
                }}
                placeholder="z.B. 40"
                style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* KI-Wochenbericht E-Mail — Pro/Enterprise only */}
      {restaurant && (restaurant.plan === 'pro' || restaurant.plan === 'enterprise') && (
        <div style={{
          background: 'var(--surface)', borderRadius: '16px',
          border: '1px solid var(--border)', padding: '20px 24px', marginBottom: '20px',
        }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>
            KI-Wochenbericht
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
            Erhalte jeden Montag automatisch den KI-Wochenbericht per E-Mail.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>Wöchentliche E-Mail</span>
            <button
              onClick={handleEmailToggle}
              disabled={emailToggleLoading}
              style={{
                width: '48px', height: '26px', borderRadius: '13px', border: 'none',
                background: restaurant.weekly_report_email ? 'var(--accent)' : 'var(--border)',
                cursor: emailToggleLoading ? 'wait' : 'pointer',
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <span style={{
                position: 'absolute', top: '3px',
                left: restaurant.weekly_report_email ? '25px' : '3px',
                width: '20px', height: '20px', borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }} />
            </button>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '8px' }}>
            {restaurant.weekly_report_email ? 'E-Mail aktiviert' : 'E-Mail deaktiviert'}
          </p>
        </div>
      )}

      {/* Online-Zahlung / Stripe Connect */}
      {restaurant && (
        <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '20px 24px', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>💳 Online-Zahlung (Stripe)</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
            Verbinde dein Stripe-Konto damit Gäste direkt online bezahlen können. Die Online-Zahlung wird vom Platform-Admin aktiviert.
          </p>
          {restaurant.stripe_connect_account_id ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#10b981', fontSize: '1rem' }}>✓</span>
                <div>
                  <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem', margin: 0 }}>Stripe verbunden</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>
                    Konto: {restaurant.stripe_connect_account_id}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {restaurant.online_payments_enabled
                  ? <span style={{ background: '#10b98120', color: '#10b981', borderRadius: '8px', padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600 }}>Online-Zahlung aktiv</span>
                  : <span style={{ background: 'var(--border)', color: 'var(--text-muted)', borderRadius: '8px', padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600 }}>Warte auf Aktivierung</span>
                }
                <button
                  onClick={async () => {
                    const { error } = await supabase.from('restaurants').update({ stripe_connect_account_id: null, online_payments_enabled: false }).eq('id', restaurant.id)
                    if (!error) setRestaurant(prev => prev ? { ...prev, stripe_connect_account_id: null, online_payments_enabled: false } : prev)
                  }}
                  style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 14px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  Trennen
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={async () => {
                const { data: { session } } = await supabase.auth.getSession()
                if (session) {
                  window.location.href = `/api/stripe/connect?token=${session.access_token}`
                }
              }}
              style={{ background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: '10px', padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Stripe-Konto verbinden →
            </button>
          )}
        </div>
      )}

      {/* Push-Benachrichtigungen */}
      <div style={{
        background: 'var(--surface)', borderRadius: '16px',
        border: '1px solid var(--border)', padding: '20px 24px', marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <Bell size={16} color="var(--accent)" />
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem' }}>
            Push-Benachrichtigungen
          </h2>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
          Erhalte sofortige Benachrichtigungen für neue Bestellungen und Reservierungen.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>
            {pushPermission === 'denied' ? 'Vom Browser blockiert' : pushSubscribed ? 'Aktiviert' : 'Deaktiviert'}
          </span>
          {pushPermission === 'denied' ? (
            <span style={{ color: '#f59e0b', fontSize: '0.78rem', fontWeight: 500 }}>In Browser-Einstellungen entsperren</span>
          ) : (
            <button
              onClick={pushSubscribed ? unsubscribePush : subscribePush}
              disabled={pushLoading}
              style={{
                width: '48px', height: '26px', borderRadius: '13px', border: 'none',
                background: pushSubscribed ? 'var(--accent)' : 'var(--border)',
                cursor: pushLoading ? 'wait' : 'pointer',
                position: 'relative', transition: 'background 0.2s',
                opacity: pushLoading ? 0.6 : 1,
              }}
            >
              <span style={{
                position: 'absolute', top: '3px',
                left: pushSubscribed ? '25px' : '3px',
                width: '20px', height: '20px', borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }} />
            </button>
          )}
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '8px' }}>
          {pushPermission === 'denied'
            ? 'Benachrichtigungen wurden im Browser blockiert.'
            : pushSubscribed
              ? 'Du wirst bei neuen Bestellungen und Reservierungen informiert.'
              : 'Aktiviere Benachrichtigungen um keine Events zu verpassen.'}
        </p>
      </div>

      {/* Liefer-Puffer */}
      <div style={{
        background: 'var(--surface)', borderRadius: '16px',
        border: '1px solid var(--border)', padding: '20px 24px', marginBottom: '20px',
      }}>
        <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>
          Liefer-Puffer
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
          Wie viele Minuten dauert die Lieferung typischerweise ab Küche bis zum Gast?
        </p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="number"
            min="1"
            max="120"
            value={deliveryBuffer}
            onChange={e => setDeliveryBuffer(e.target.value)}
            style={{
              width: '80px', padding: '9px 12px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text)', fontSize: '0.875rem', textAlign: 'center',
            }}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Minuten</span>
          <button
            onClick={handleDeliveryBufferSave}
            disabled={deliveryBufferSaving}
            style={{
              padding: '9px 18px', borderRadius: '8px', border: 'none',
              background: 'var(--accent)', color: 'var(--accent-text)',
              fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
              opacity: deliveryBufferSaving ? 0.6 : 1,
            }}
          >
            {deliveryBufferSaving ? 'Speichert...' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* Account Info */}
      <Section title="Konto">
        <Row label="E-Mail" value={email} />
      </Section>

      {/* Password Change */}
      <Section title="Sicherheit">
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(108,99,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <KeyRound size={18} color="var(--accent)" />
            </div>
            <div>
              <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.875rem', marginBottom: '2px' }}>Passwort ändern</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Neues Passwort (mind. 8 Zeichen)</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwNew ? 'text' : 'password'}
                placeholder="Neues Passwort"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPwError(''); setPwSuccess(false) }}
                style={{
                  padding: '10px 40px 10px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                  background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem',
                  outline: 'none', width: '100%', boxSizing: 'border-box',
                }}
              />
              <button type="button" onClick={() => setShowPwNew(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center' }}>
                {showPwNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwConfirm ? 'text' : 'password'}
                placeholder="Passwort bestätigen"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setPwError(''); setPwSuccess(false) }}
                style={{
                  padding: '10px 40px 10px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                  background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem',
                  outline: 'none', width: '100%', boxSizing: 'border-box',
                }}
              />
              <button type="button" onClick={() => setShowPwConfirm(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center' }}>
                {showPwConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {pwError && <p style={{ color: '#ef4444', fontSize: '0.8rem' }}>{pwError}</p>}
            {pwSuccess && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.82rem' }}>
                <CheckCircle2 size={14} /> Passwort erfolgreich geändert
              </div>
            )}
            <button
              onClick={handlePasswordChange}
              disabled={pwLoading || !newPassword || !confirmPassword}
              style={{
                alignSelf: 'flex-start', padding: '9px 18px', borderRadius: '8px',
                border: 'none', background: 'var(--accent)', color: 'var(--accent-text)',
                fontSize: '0.82rem', fontWeight: 700,
                cursor: pwLoading || !newPassword || !confirmPassword ? 'not-allowed' : 'pointer',
                opacity: pwLoading || !newPassword || !confirmPassword ? 0.6 : 1,
              }}
            >
              {pwLoading ? 'Wird gespeichert...' : 'Passwort speichern'}
            </button>
          </div>
        </div>
        {/* 2FA Card */}
        <div style={{
          background: 'var(--surface)', border: mfaEnabled ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border)',
          borderRadius: '12px', padding: '20px', marginTop: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: mfaEnabled ? 'rgba(16,185,129,0.12)' : 'rgba(108,99,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Smartphone size={18} color={mfaEnabled ? '#10b981' : 'var(--accent)'} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.875rem', marginBottom: '2px' }}>Zwei-Faktor-Authentifizierung</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                {mfaEnabled ? 'Aktiv — Login benötigt Authenticator-App' : 'Schütze deinen Account mit einer Authenticator-App'}
              </p>
            </div>
            {mfaEnabled && (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(16,185,129,0.12)', color: '#10b981', padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                Aktiv
              </span>
            )}
          </div>

          {!mfaEnabled && !mfaQrCode && (
            <button
              onClick={handleMfaEnroll}
              disabled={mfaEnrolling}
              style={{
                padding: '9px 18px', borderRadius: '8px', border: 'none',
                background: 'var(--accent)', color: 'var(--accent-text)',
                fontWeight: 700, fontSize: '0.82rem', cursor: mfaEnrolling ? 'wait' : 'pointer',
                opacity: mfaEnrolling ? 0.6 : 1,
              }}
            >
              {mfaEnrolling ? 'Wird vorbereitet...' : '2FA aktivieren'}
            </button>
          )}

          {mfaQrCode && (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '12px', lineHeight: 1.5 }}>
                Scanne den QR-Code mit Google Authenticator, Authy oder einer anderen TOTP-App.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <img src={mfaQrCode} alt="2FA QR Code" style={{ width: '160px', height: '160px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', padding: '4px' }} />
              </div>
              {mfaSecret && (
                <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '4px' }}>Manueller Code</p>
                  <code style={{ color: 'var(--text)', fontSize: '0.85rem', letterSpacing: '0.1em', fontFamily: 'monospace' }}>{mfaSecret}</code>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-stelliger Code"
                  value={mfaCode}
                  onChange={e => { setMfaCode(e.target.value.replace(/\D/g, '')); setMfaError('') }}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: '8px',
                    border: '1px solid var(--border)', background: 'var(--bg)',
                    color: 'var(--text)', fontSize: '1rem', outline: 'none',
                    letterSpacing: '0.2em', textAlign: 'center',
                  }}
                />
                <button
                  onClick={handleMfaVerify}
                  disabled={mfaVerifying || mfaCode.length !== 6}
                  style={{
                    padding: '10px 18px', borderRadius: '8px', border: 'none',
                    background: 'var(--accent)', color: 'var(--accent-text)',
                    fontWeight: 700, fontSize: '0.82rem',
                    cursor: mfaVerifying || mfaCode.length !== 6 ? 'not-allowed' : 'pointer',
                    opacity: mfaVerifying || mfaCode.length !== 6 ? 0.6 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {mfaVerifying ? 'Prüfe...' : 'Bestätigen'}
                </button>
              </div>
              {mfaError && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '8px' }}>{mfaError}</p>}
            </div>
          )}

          {mfaEnabled && (
            <div>
              {mfaSuccess && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.82rem', marginBottom: '12px' }}>
                  <CheckCircle2 size={14} /> 2FA erfolgreich aktiviert
                </div>
              )}
              <button
                onClick={handleMfaUnenroll}
                disabled={mfaUnenrolling}
                style={{
                  padding: '9px 18px', borderRadius: '8px',
                  border: '1px solid #ef444460', background: 'transparent',
                  color: '#ef4444', fontWeight: 600, fontSize: '0.82rem',
                  cursor: mfaUnenrolling ? 'wait' : 'pointer',
                  opacity: mfaUnenrolling ? 0.6 : 1,
                }}
              >
                {mfaUnenrolling ? 'Wird deaktiviert...' : '2FA deaktivieren'}
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* DSGVO */}
      <Section title="Datenschutz & DSGVO">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.6, marginBottom: '20px' }}>
          Gemäß DSGVO hast du das Recht auf Auskunft (Art. 15), Datenübertragbarkeit (Art. 20) und Löschung (Art. 17) deiner Daten.
        </p>

        {/* Export */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(108,99,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldCheck size={18} color="var(--accent)" />
            </div>
            <div>
              <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.875rem', marginBottom: '2px' }}>Daten exportieren</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Alle deine Daten als JSON-Datei herunterladen</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--text)',
              fontSize: '0.82rem', fontWeight: 600, cursor: exporting ? 'not-allowed' : 'pointer',
              opacity: exporting ? 0.6 : 1, whiteSpace: 'nowrap',
            }}
          >
            <Download size={14} />
            {exporting ? 'Exportiere...' : 'Export starten'}
          </button>
        </div>

        {/* Delete */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid #ef444430',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Trash2 size={18} color="#ef4444" />
            </div>
            <div>
              <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.875rem', marginBottom: '2px' }}>Konto löschen</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Konto und alle Daten dauerhaft löschen</p>
            </div>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '9px 16px', borderRadius: '8px', border: '1px solid #ef444460',
              background: 'transparent', color: '#ef4444',
              fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <Trash2 size={14} />
            Konto löschen
          </button>
        </div>
      </Section>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '24px',
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: '16px',
            padding: '28px', maxWidth: '420px', width: '100%',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <AlertTriangle size={22} color="#ef4444" />
              <h2 style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.1rem' }}>Konto wirklich löschen?</h2>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '20px' }}>
              Diese Aktion ist <strong style={{ color: 'var(--text)' }}>nicht rückgängig</strong> zu machen.
              Dein Konto, dein Restaurant und alle Bestellungen werden dauerhaft gelöscht.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '8px' }}>
              Tippe <strong style={{ color: 'var(--text)' }}>LÖSCHEN</strong> zur Bestätigung:
            </p>
            <input
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder="LÖSCHEN"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '8px',
                border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text)', fontSize: '0.875rem', outline: 'none',
                boxSizing: 'border-box', marginBottom: '16px',
              }}
            />
            {deleteError && (
              <p style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '12px' }}>{deleteError}</p>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); setDeleteError('') }}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px',
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteInput !== 'LÖSCHEN' || deleting}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                  background: deleteInput === 'LÖSCHEN' ? '#ef4444' : 'var(--border)',
                  color: deleteInput === 'LÖSCHEN' ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.875rem', fontWeight: 700,
                  cursor: deleteInput !== 'LÖSCHEN' || deleting ? 'not-allowed' : 'pointer',
                }}
              >
                {deleting ? 'Wird gelöscht...' : 'Endgültig löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '36px' }}>
      <h2 style={{
        color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px',
      }}>{title}</h2>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '12px', padding: '14px 20px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px',
    }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{label}</span>
      <span style={{ color: 'var(--text)', fontSize: '0.875rem', fontWeight: 500 }}>{value}</span>
    </div>
  )
}
