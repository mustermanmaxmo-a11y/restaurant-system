'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Download, Trash2, ShieldCheck, AlertTriangle, KeyRound, CheckCircle2 } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [restaurant, setRestaurant] = useState<{ id: string; plan: string; weekly_report_email: boolean; delivery_buffer_minutes: number } | null>(null)
  const [emailToggleLoading, setEmailToggleLoading] = useState(false)
  const [deliveryBuffer, setDeliveryBuffer] = useState<string>('25')
  const [deliveryBufferSaving, setDeliveryBufferSaving] = useState(false)

  // Password change state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }
      setEmail(session.user.email ?? '')
      const { data: resto } = await supabase
        .from('restaurants')
        .select('id, plan, weekly_report_email, delivery_buffer_minutes')
        .eq('owner_id', session.user.id)
        .limit(1)
        .single()
      if (resto) {
        setRestaurant(resto)
        setDeliveryBuffer(String(resto.delivery_buffer_minutes ?? 25))
      }
      setLoading(false)
    }
    init()
  }, [router])

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

  if (loading) return null

  return (
    <div style={{ padding: '32px 24px', maxWidth: '640px' }}>
      <h1 style={{ color: 'var(--text)', fontSize: '1.5rem', fontWeight: 800, marginBottom: '4px' }}>
        Einstellungen
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '40px' }}>
        Konto & Datenschutz
      </p>

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
            <input
              type="password"
              placeholder="Neues Passwort"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setPwError(''); setPwSuccess(false) }}
              style={{
                padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem',
                outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
            />
            <input
              type="password"
              placeholder="Passwort bestätigen"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setPwError(''); setPwSuccess(false) }}
              style={{
                padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem',
                outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
            />
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
