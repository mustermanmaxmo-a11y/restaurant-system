'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { KeyRound, CheckCircle2, Sparkles, Bell, Image, Video, Webhook, Lock, Eye, EyeOff } from 'lucide-react'

export default function PlatformSettingsPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwNew, setShowPwNew] = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  const [aiKey, setAiKey] = useState('')
  const [aiKeySaving, setAiKeySaving] = useState(false)
  const [aiKeySuccess, setAiKeySuccess] = useState(false)
  const [aiKeyError, setAiKeyError] = useState('')

  const [notifyEmail, setNotifyEmail] = useState('')
  const [notifyEmailSaving, setNotifyEmailSaving] = useState(false)
  const [notifyEmailSuccess, setNotifyEmailSuccess] = useState(false)
  const [notifyEmailError, setNotifyEmailError] = useState('')

  // Marketing API keys
  const [falKey, setFalKey] = useState('')
  const [klingKey, setKlingKey] = useState('')
  const [automationSecret, setAutomationSecret] = useState('')
  const [unsubscribeSecret, setUnsubscribeSecret] = useState('')
  const [marketingKeysSet, setMarketingKeysSet] = useState({ fal_api_key: false, kling_api_key: false, marketing_automation_secret: false, unsubscribe_secret: false })
  const [marketingKeysSaving, setMarketingKeysSaving] = useState(false)
  const [marketingKeysSuccess, setMarketingKeysSuccess] = useState(false)
  const [marketingKeysError, setMarketingKeysError] = useState('')

  useEffect(() => {
    async function loadSettings() {
      const { data: { session } } = await supabase.auth.getSession()
      const headers = { 'Authorization': `Bearer ${session?.access_token ?? ''}` }

      const [emailRes, mktRes] = await Promise.all([
        fetch('/api/platform/notification-email', { headers }),
        fetch('/api/platform/marketing-keys', { headers }),
      ])

      if (emailRes.ok) {
        const json = await emailRes.json()
        setNotifyEmail(json.email ?? '')
      }
      if (mktRes.ok) {
        const json = await mktRes.json()
        setMarketingKeysSet(json)
      }
    }
    loadSettings()
  }, [])

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

  async function handleNotifyEmailSave() {
    if (!notifyEmail.trim()) { setNotifyEmailError('Bitte E-Mail eingeben.'); return }
    setNotifyEmailSaving(true)
    setNotifyEmailError('')
    setNotifyEmailSuccess(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/platform/notification-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ email: notifyEmail.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setNotifyEmailError('Fehler: ' + (json.error ?? 'Unbekannt'))
      } else {
        setNotifyEmailSuccess(true)
      }
    } catch {
      setNotifyEmailError('Speichern fehlgeschlagen.')
    }
    setNotifyEmailSaving(false)
  }

  async function handleMarketingKeysSave() {
    const payload: Record<string, string> = {}
    if (falKey.trim()) payload.fal_api_key = falKey.trim()
    if (klingKey.trim()) payload.kling_api_key = klingKey.trim()
    if (automationSecret.trim()) payload.marketing_automation_secret = automationSecret.trim()
    if (unsubscribeSecret.trim()) payload.unsubscribe_secret = unsubscribeSecret.trim()

    if (Object.keys(payload).length === 0) {
      setMarketingKeysError('Bitte mindestens einen Key eingeben.')
      return
    }

    setMarketingKeysSaving(true)
    setMarketingKeysError('')
    setMarketingKeysSuccess(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/platform/marketing-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        setMarketingKeysError('Fehler: ' + (json.error ?? 'Unbekannt'))
      } else {
        setMarketingKeysSuccess(true)
        setFalKey('')
        setKlingKey('')
        setAutomationSecret('')
        setUnsubscribeSecret('')
        setMarketingKeysSet(prev => ({
          ...prev,
          ...(payload.fal_api_key ? { fal_api_key: true } : {}),
          ...(payload.kling_api_key ? { kling_api_key: true } : {}),
          ...(payload.marketing_automation_secret ? { marketing_automation_secret: true } : {}),
          ...(payload.unsubscribe_secret ? { unsubscribe_secret: true } : {}),
        }))
      }
    } catch {
      setMarketingKeysError('Speichern fehlgeschlagen.')
    }
    setMarketingKeysSaving(false)
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

      <Section title="Marketing API Keys">
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          <p style={{ color: '#666', fontSize: '0.78rem', marginTop: 0 }}>
            Diese Keys werden für Bildgenerierung (fal.ai), Videogenerierung (Kling AI) und die N8N-Automationen verwendet.
          </p>

          <KeyField
            icon={<Image size={16} color="#e85d26" />}
            iconBg="rgba(232,93,38,0.12)"
            label="fal.ai API Key"
            description="Bildgenerierung im Social Media Hub"
            placeholder="fal_..."
            value={falKey}
            isSet={marketingKeysSet.fal_api_key}
            onChange={v => { setFalKey(v); setMarketingKeysSuccess(false) }}
          />
          <KeyField
            icon={<Video size={16} color="#8b5cf6" />}
            iconBg="rgba(139,92,246,0.12)"
            label="Kling AI API Key"
            description="Videogenerierung (Pro-Plan)"
            placeholder="Bearer ..."
            value={klingKey}
            isSet={marketingKeysSet.kling_api_key}
            onChange={v => { setKlingKey(v); setMarketingKeysSuccess(false) }}
          />
          <KeyField
            icon={<Webhook size={16} color="#10b981" />}
            iconBg="rgba(16,185,129,0.12)"
            label="N8N Automation Secret"
            description="Sichert den /api/marketing/automation-run Webhook"
            placeholder="Zufälliger langer String..."
            value={automationSecret}
            isSet={marketingKeysSet.marketing_automation_secret}
            onChange={v => { setAutomationSecret(v); setMarketingKeysSuccess(false) }}
          />
          <KeyField
            icon={<Lock size={16} color="#f59e0b" />}
            iconBg="rgba(245,158,11,0.12)"
            label="Unsubscribe Secret"
            description="HMAC-Token für sichere Abmelde-Links in Automations-Emails"
            placeholder="Zufälliger langer String..."
            value={unsubscribeSecret}
            isSet={marketingKeysSet.unsubscribe_secret}
            onChange={v => { setUnsubscribeSecret(v); setMarketingKeysSuccess(false) }}
          />

          {marketingKeysError && <p style={{ color: '#ef4444', fontSize: '0.8rem' }}>{marketingKeysError}</p>}
          {marketingKeysSuccess && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.82rem' }}>
              <CheckCircle2 size={14} /> Keys gespeichert
            </div>
          )}
          <button
            onClick={handleMarketingKeysSave}
            disabled={marketingKeysSaving || (!falKey && !klingKey && !automationSecret && !unsubscribeSecret)}
            style={{
              alignSelf: 'flex-start', padding: '9px 18px', borderRadius: '8px',
              border: 'none', background: '#e85d26', color: '#fff',
              fontSize: '0.82rem', fontWeight: 700,
              cursor: marketingKeysSaving || (!falKey && !klingKey && !automationSecret && !unsubscribeSecret) ? 'not-allowed' : 'pointer',
              opacity: marketingKeysSaving || (!falKey && !klingKey && !automationSecret && !unsubscribeSecret) ? 0.6 : 1,
            }}
          >
            {marketingKeysSaving ? 'Wird gespeichert...' : 'Keys speichern'}
          </button>
        </div>
      </Section>

      <Section title="Benachrichtigungen">
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px', padding: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bell size={18} color="#10b981" />
            </div>
            <div>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.875rem', marginBottom: '2px' }}>Benachrichtigungs-E-Mail</p>
              <p style={{ color: '#888', fontSize: '0.78rem' }}>Wohin sollen Design-Anfragen von Betreibern gesendet werden?</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="email"
              placeholder="deine@email.de"
              value={notifyEmail}
              onChange={e => { setNotifyEmail(e.target.value); setNotifyEmailError(''); setNotifyEmailSuccess(false) }}
              style={{
                padding: '10px 12px', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)', color: '#fff',
                fontSize: '0.875rem', outline: 'none',
                width: '100%', boxSizing: 'border-box' as const,
              }}
            />
            {notifyEmailError && <p style={{ color: '#ef4444', fontSize: '0.8rem' }}>{notifyEmailError}</p>}
            {notifyEmailSuccess && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.82rem' }}>
                <CheckCircle2 size={14} /> E-Mail gespeichert
              </div>
            )}
            <button
              onClick={handleNotifyEmailSave}
              disabled={notifyEmailSaving || !notifyEmail}
              style={{
                alignSelf: 'flex-start', padding: '9px 18px', borderRadius: '8px',
                border: 'none', background: '#10b981', color: '#fff',
                fontSize: '0.82rem', fontWeight: 700,
                cursor: notifyEmailSaving || !notifyEmail ? 'not-allowed' : 'pointer',
                opacity: notifyEmailSaving || !notifyEmail ? 0.6 : 1,
              }}
            >
              {notifyEmailSaving ? 'Wird gespeichert...' : 'E-Mail speichern'}
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
            <div style={{ position: 'relative' }}>
              <input
                type={showPwNew ? 'text' : 'password'}
                placeholder="Neues Passwort"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPwError(''); setPwSuccess(false) }}
                style={{
                  padding: '10px 40px 10px 12px', borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)', color: '#fff',
                  fontSize: '0.875rem', outline: 'none',
                  width: '100%', boxSizing: 'border-box',
                }}
              />
              <button type="button" onClick={() => setShowPwNew(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: '4px', display: 'flex', alignItems: 'center' }}>
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
                  padding: '10px 40px 10px 12px', borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)', color: '#fff',
                  fontSize: '0.875rem', outline: 'none',
                  width: '100%', boxSizing: 'border-box',
                }}
              />
              <button type="button" onClick={() => setShowPwConfirm(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: '4px', display: 'flex', alignItems: 'center' }}>
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

function KeyField({ icon, iconBg, label, description, placeholder, value, isSet, onChange }: {
  icon: React.ReactNode
  iconBg: string
  label: string
  description: string
  placeholder: string
  value: string
  isSet: boolean
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem', marginBottom: 0 }}>
            {label}
            {isSet && <span style={{ marginLeft: '8px', background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px' }}>✓ gesetzt</span>}
          </p>
          <p style={{ color: '#666', fontSize: '0.75rem' }}>{description}</p>
        </div>
      </div>
      <input
        type="password"
        placeholder={isSet ? '••••••••••••••••' : placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: '9px 12px', borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.05)', color: '#fff',
          fontSize: '0.82rem', outline: 'none',
          width: '100%', boxSizing: 'border-box' as const, fontFamily: 'monospace',
        }}
      />
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
