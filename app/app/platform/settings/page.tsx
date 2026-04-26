'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { KeyRound, CheckCircle2, Sparkles } from 'lucide-react'

export default function PlatformSettingsPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  const [aiKey, setAiKey] = useState('')
  const [aiKeySaving, setAiKeySaving] = useState(false)
  const [aiKeySuccess, setAiKeySuccess] = useState(false)
  const [aiKeyError, setAiKeyError] = useState('')

  async function handleAiKeySave() {
    if (!aiKey.trim()) { setAiKeyError('Bitte API Key eingeben.'); return }
    setAiKeySaving(true)
    setAiKeyError('')
    setAiKeySuccess(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/platform/ai-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ apiKey: aiKey.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setAiKeyError('Speichern fehlgeschlagen: ' + (json.error ?? 'Unbekannter Fehler'))
      } else {
        setAiKeySuccess(true)
        setAiKey('')
      }
    } catch {
      setAiKeyError('Speichern fehlgeschlagen.')
    }
    setAiKeySaving(false)
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

  return (
    <div style={{ padding: '32px 24px', maxWidth: '640px' }}>
      <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 800, marginBottom: '4px' }}>
        Einstellungen
      </h1>
      <p style={{ color: '#888', fontSize: '0.875rem', marginBottom: '40px' }}>
        Konto & Sicherheit
      </p>

      <Section title="KI / Anthropic">
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px', padding: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(108,99,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={18} color="#6c63ff" />
            </div>
            <div>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.875rem', marginBottom: '2px' }}>Platform API Key</p>
              <p style={{ color: '#888', fontSize: '0.78rem' }}>Anthropic Key für alle KI-Features — gilt für alle Restaurants</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="password"
              placeholder="sk-ant-api03-..."
              value={aiKey}
              onChange={e => { setAiKey(e.target.value); setAiKeyError(''); setAiKeySuccess(false) }}
              style={{
                padding: '10px 12px', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)', color: '#fff',
                fontSize: '0.875rem', outline: 'none',
                width: '100%', boxSizing: 'border-box', fontFamily: 'monospace',
              }}
            />
            {aiKeyError && <p style={{ color: '#ef4444', fontSize: '0.8rem' }}>{aiKeyError}</p>}
            {aiKeySuccess && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.82rem' }}>
                <CheckCircle2 size={14} /> API Key gespeichert
              </div>
            )}
            <button
              onClick={handleAiKeySave}
              disabled={aiKeySaving || !aiKey}
              style={{
                alignSelf: 'flex-start', padding: '9px 18px', borderRadius: '8px',
                border: 'none', background: '#6c63ff', color: '#fff',
                fontSize: '0.82rem', fontWeight: 700,
                cursor: aiKeySaving || !aiKey ? 'not-allowed' : 'pointer',
                opacity: aiKeySaving || !aiKey ? 0.6 : 1,
              }}
            >
              {aiKeySaving ? 'Wird gespeichert...' : 'Key speichern'}
            </button>
          </div>
        </div>
      </Section>

      <Section title="Sicherheit">
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px', padding: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <KeyRound size={18} color="#ef4444" />
            </div>
            <div>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.875rem', marginBottom: '2px' }}>Passwort ändern</p>
              <p style={{ color: '#888', fontSize: '0.78rem' }}>Neues Passwort (mind. 8 Zeichen)</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="password"
              placeholder="Neues Passwort"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setPwError(''); setPwSuccess(false) }}
              style={{
                padding: '10px 12px', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)', color: '#fff',
                fontSize: '0.875rem', outline: 'none',
                width: '100%', boxSizing: 'border-box',
              }}
            />
            <input
              type="password"
              placeholder="Passwort bestätigen"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setPwError(''); setPwSuccess(false) }}
              style={{
                padding: '10px 12px', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)', color: '#fff',
                fontSize: '0.875rem', outline: 'none',
                width: '100%', boxSizing: 'border-box',
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
                border: 'none', background: '#ef4444', color: '#fff',
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
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '36px' }}>
      <h2 style={{
        color: '#666', fontSize: '0.7rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px',
      }}>{title}</h2>
      {children}
    </div>
  )
}
