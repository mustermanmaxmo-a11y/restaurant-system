'use client'

import { useState } from 'react'

interface Automation {
  id: string
  trigger_type: string
  active: boolean
  discount_percent: number | null
  trigger_config: { weekday?: string; time?: string } | null
  template_id: string | null
  segment: string | null
  last_run_at: string | null
  created_at: string
}

const SEGMENT_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Alle Abonnenten' },
  { value: 'new', label: 'Neu (0 Bestellungen)' },
  { value: 'occasional', label: 'Gelegentlich (1-3)' },
  { value: 'loyal', label: 'Treu (4+)' },
  { value: 'vip', label: 'VIP (10+ oder >300€)' },
  { value: 'lapsed', label: 'Lapsed (>30 Tage)' },
]

interface EmailTemplate {
  id: string
  name: string
  trigger_type: string | null
  is_active: boolean
}

interface Props {
  automations: Automation[]
  restaurantId: string
  templates?: EmailTemplate[]
}

const AUTOMATION_TYPES = [
  {
    trigger_type: 'post_order',
    icon: '🛎️',
    title: 'Nach Bestellung',
    description: '2 Stunden nach einer Bestellung: Dankeschön-Email mit Bewertungslink',
    configLabel: 'Aktivierbar ohne weitere Konfiguration',
    hasDiscount: false,
    hasSchedule: false,
  },
  {
    trigger_type: 'inactivity_14d',
    icon: '💤',
    title: '14 Tage inaktiv',
    description: 'Gäste die 14 Tage nicht bestellt haben erhalten ein Comeback-Angebot',
    configLabel: 'Rabatt in %:',
    hasDiscount: true,
    hasSchedule: false,
  },
  {
    trigger_type: 'birthday',
    icon: '🎂',
    title: 'Geburtstag',
    description: 'Automatische Geburtstags-Email (wenn Datum erfasst)',
    configLabel: 'Rabatt in %:',
    hasDiscount: true,
    hasSchedule: false,
  },
  {
    trigger_type: 'seasonal',
    icon: '🌿',
    title: 'Saisonale Events',
    description: 'Automatische Emails zu Ostern, Weihnachten, Valentinstag etc.',
    configLabel: 'KI schlägt Inhalt automatisch vor',
    hasDiscount: false,
    hasSchedule: false,
  },
  {
    trigger_type: 'scheduled',
    icon: '🗓️',
    title: 'Wochentag-Plan',
    description: 'Jeden Freitag 17:00 Uhr oder andere Zeiten',
    configLabel: 'Wochentag & Uhrzeit:',
    hasDiscount: false,
    hasSchedule: true,
  },
] as const

const WEEKDAYS = [
  { value: 'monday', label: 'Montag' },
  { value: 'tuesday', label: 'Dienstag' },
  { value: 'wednesday', label: 'Mittwoch' },
  { value: 'thursday', label: 'Donnerstag' },
  { value: 'friday', label: 'Freitag' },
  { value: 'saturday', label: 'Samstag' },
  { value: 'sunday', label: 'Sonntag' },
]

function formatLastRun(iso: string | null): string {
  if (!iso) return 'Noch nie ausgeführt'
  return `Zuletzt ausgeführt: ${new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })} Uhr`
}

interface CardState {
  active: boolean
  discount: number
  weekday: string
  time: string
  templateId: string | null
  segment: string
  saving: boolean
  toggling: boolean
  savedMsg: string | null
  error: string | null
}

export function AutomationRules({ automations, restaurantId, templates = [] }: Props) {
  // Build initial state per trigger_type from DB data
  const initialStates: Record<string, CardState> = {}
  for (const type of AUTOMATION_TYPES) {
    const record = automations.find(a => a.trigger_type === type.trigger_type)
    initialStates[type.trigger_type] = {
      active: record?.active ?? false,
      discount: record?.discount_percent ?? 10,
      weekday: record?.trigger_config?.weekday ?? 'friday',
      time: record?.trigger_config?.time ?? '17:00',
      templateId: record?.template_id ?? null,
      segment: record?.segment ?? 'all',
      saving: false,
      toggling: false,
      savedMsg: null,
      error: null,
    }
  }

  const [states, setStates] = useState<Record<string, CardState>>(initialStates)
  // Track the DB record ids so we can PATCH
  const [recordIds, setRecordIds] = useState<Record<string, string>>(
    Object.fromEntries(automations.filter(a => a.id).map(a => [a.trigger_type, a.id]))
  )
  // Track last_run_at per type
  const [lastRuns] = useState<Record<string, string | null>>(
    Object.fromEntries(AUTOMATION_TYPES.map(t => {
      const record = automations.find(a => a.trigger_type === t.trigger_type)
      return [t.trigger_type, record?.last_run_at ?? null]
    }))
  )

  function update(trigger_type: string, patch: Partial<CardState>) {
    setStates(prev => ({
      ...prev,
      [trigger_type]: { ...prev[trigger_type], ...patch },
    }))
  }

  async function handleToggle(trigger_type: string) {
    const current = states[trigger_type]
    const newActive = !current.active
    const existingId = recordIds[trigger_type]

    update(trigger_type, { toggling: true, error: null })

    try {
      if (existingId) {
        // PATCH existing record
        const res = await fetch('/api/marketing/automations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: existingId, active: newActive }),
        })
        if (!res.ok) {
          const data = await res.json()
          update(trigger_type, { toggling: false, error: data.error ?? 'Fehler beim Speichern' })
          return
        }
        update(trigger_type, { active: newActive, toggling: false })
      } else {
        // No record yet — create via POST
        const res = await fetch('/api/marketing/automations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trigger_type,
            active: newActive,
            discount_percent: current.discount,
            trigger_config: { weekday: current.weekday, time: current.time },
            template_id: current.templateId,
            segment: current.segment,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          update(trigger_type, { toggling: false, error: data.error ?? 'Fehler beim Speichern' })
          return
        }
        if (data.automation?.id) {
          setRecordIds(prev => ({ ...prev, [trigger_type]: data.automation.id }))
        }
        update(trigger_type, { active: newActive, toggling: false })
      }
    } catch {
      update(trigger_type, { toggling: false, error: 'Netzwerkfehler. Bitte erneut versuchen.' })
    }
  }

  async function handleSave(trigger_type: string) {
    const current = states[trigger_type]
    update(trigger_type, { saving: true, savedMsg: null, error: null })

    try {
      const res = await fetch('/api/marketing/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger_type,
          active: current.active,
          discount_percent: current.discount,
          trigger_config: { weekday: current.weekday, time: current.time },
          template_id: current.templateId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        update(trigger_type, { saving: false, error: data.error ?? 'Fehler beim Speichern' })
        return
      }
      if (data.automation?.id) {
        setRecordIds(prev => ({ ...prev, [trigger_type]: data.automation.id }))
      }
      update(trigger_type, { saving: false, savedMsg: 'Gespeichert!' })
      setTimeout(() => update(trigger_type, { savedMsg: null }), 2500)
    } catch {
      update(trigger_type, { saving: false, error: 'Netzwerkfehler. Bitte erneut versuchen.' })
    }
  }

  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh', background: 'var(--bg, #0a0a0f)' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
          Automationen
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '4px' }}>
          {automations.filter(a => a.active).length} von {AUTOMATION_TYPES.length} aktiv
        </p>
      </div>

      {/* Info banner */}
      <div style={{
        background: 'rgba(59,130,246,0.08)',
        border: '1px solid rgba(59,130,246,0.2)',
        borderRadius: '12px',
        padding: '12px 18px',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        color: '#93c5fd',
        fontSize: '0.875rem',
      }}>
        <span style={{ fontSize: '1rem' }}>ℹ️</span>
        Automationen werden täglich ausgeführt. Änderungen sind sofort aktiv.
      </div>

      {/* Cards grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: '16px',
      }}>
        {AUTOMATION_TYPES.map(type => {
          const s = states[type.trigger_type]
          const lastRun = lastRuns[type.trigger_type]

          return (
            <div
              key={type.trigger_type}
              style={{
                background: s.active
                  ? 'rgba(249,115,22,0.05)'
                  : 'rgba(255,255,255,0.03)',
                border: s.active
                  ? '1px solid rgba(249,115,22,0.25)'
                  : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                padding: '22px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                transition: 'border-color 0.2s, background 0.2s',
              }}
            >
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>{type.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#f3f4f6', fontWeight: 700, fontSize: '0.95rem', marginBottom: '3px' }}>
                      {type.title}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.8rem', lineHeight: 1.4 }}>
                      {type.description}
                    </div>
                  </div>
                </div>

                {/* Toggle switch */}
                <button
                  onClick={() => handleToggle(type.trigger_type)}
                  disabled={s.toggling}
                  title={s.active ? 'Deaktivieren' : 'Aktivieren'}
                  style={{
                    flexShrink: 0,
                    width: '44px',
                    height: '24px',
                    borderRadius: '12px',
                    border: 'none',
                    background: s.active ? '#f97316' : 'rgba(255,255,255,0.12)',
                    cursor: s.toggling ? 'not-allowed' : 'pointer',
                    position: 'relative',
                    transition: 'background 0.2s',
                    opacity: s.toggling ? 0.6 : 1,
                    padding: 0,
                  }}
                  aria-checked={s.active}
                  role="switch"
                >
                  <span style={{
                    display: 'block',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: '3px',
                    left: s.active ? '23px' : '3px',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                  }} />
                </button>
              </div>

              {/* Status badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  background: s.active ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
                  border: `1px solid ${s.active ? 'rgba(34,197,94,0.3)' : 'rgba(107,114,128,0.25)'}`,
                  color: s.active ? '#22c55e' : '#9ca3af',
                  borderRadius: '6px',
                  padding: '2px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}>
                  {s.active ? 'Aktiv' : 'Inaktiv'}
                </span>
                <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>
                  {formatLastRun(lastRun)}
                </span>
              </div>

              {/* Config section */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px',
                padding: '12px 14px',
              }}>
                <div style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                  Konfiguration
                </div>

                {/* Config label */}
                <div style={{ color: '#9ca3af', fontSize: '0.82rem', marginBottom: type.hasDiscount || type.hasSchedule ? '10px' : '0' }}>
                  {type.configLabel}
                </div>

                {/* Discount input */}
                {type.hasDiscount && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={s.discount}
                      onChange={e => update(type.trigger_type, { discount: Number(e.target.value) })}
                      style={{
                        width: '72px',
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(255,255,255,0.14)',
                        borderRadius: '8px',
                        color: '#f3f4f6',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        padding: '7px 10px',
                        outline: 'none',
                        textAlign: 'center',
                      }}
                    />
                    <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>%</span>
                    <span style={{ color: '#4b5563', fontSize: '0.78rem' }}>Rabatt (1–50%)</span>
                  </div>
                )}

                {/* Schedule inputs */}
                {type.hasSchedule && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                      value={s.weekday}
                      onChange={e => update(type.trigger_type, { weekday: e.target.value })}
                      style={{
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(255,255,255,0.14)',
                        borderRadius: '8px',
                        color: '#f3f4f6',
                        fontSize: '0.85rem',
                        padding: '7px 10px',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {WEEKDAYS.map(d => (
                        <option key={d.value} value={d.value} style={{ background: '#1a1a2e' }}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={s.time}
                      onChange={e => update(type.trigger_type, { time: e.target.value })}
                      style={{
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(255,255,255,0.14)',
                        borderRadius: '8px',
                        color: '#f3f4f6',
                        fontSize: '0.85rem',
                        padding: '7px 10px',
                        outline: 'none',
                      }}
                    />
                  </div>
                )}

                {/* Template dropdown */}
                {templates.length > 0 && (
                  <div style={{ marginTop: type.hasDiscount || type.hasSchedule ? '10px' : '0' }}>
                    <div style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                      Email-Template
                    </div>
                    <select
                      value={s.templateId ?? ''}
                      onChange={e => update(type.trigger_type, { templateId: e.target.value || null })}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.07)',
                        border: `1px solid ${s.templateId ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.14)'}`,
                        borderRadius: '8px',
                        color: s.templateId ? '#c4b5fd' : '#6b7280',
                        fontSize: '0.83rem',
                        padding: '7px 10px',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="" style={{ background: '#1a1a2e', color: '#9ca3af' }}>— Kein Template (Nur Text) —</option>
                      {templates
                        .filter(t => t.is_active && (t.trigger_type === null || t.trigger_type === type.trigger_type))
                        .map(t => (
                          <option key={t.id} value={t.id} style={{ background: '#1a1a2e', color: '#f3f4f6' }}>
                            {t.name}
                          </option>
                        ))
                      }
                    </select>
                  </div>
                )}

                {/* Segment filter */}
                <div style={{ marginTop: '10px' }}>
                  <div style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                    Segment
                  </div>
                  <select
                    value={s.segment}
                    onChange={e => update(type.trigger_type, { segment: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.07)',
                      border: `1px solid ${s.segment !== 'all' ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.14)'}`,
                      borderRadius: '8px',
                      color: s.segment !== 'all' ? '#86efac' : '#9ca3af',
                      fontSize: '0.83rem',
                      padding: '7px 10px',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {SEGMENT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value} style={{ background: '#1a1a2e', color: '#f3f4f6' }}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Error */}
              {s.error && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#ef4444',
                  fontSize: '0.8rem',
                }}>
                  {s.error}
                </div>
              )}

              {/* Save button + feedback */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => handleSave(type.trigger_type)}
                  disabled={s.saving}
                  style={{
                    background: s.saving ? 'rgba(249,115,22,0.4)' : '#f97316',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '9px',
                    padding: '9px 18px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: s.saving ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                    opacity: s.saving ? 0.7 : 1,
                  }}
                >
                  {s.saving ? 'Speichert…' : 'Speichern'}
                </button>
                {s.savedMsg && (
                  <span style={{ color: '#22c55e', fontSize: '0.82rem', fontWeight: 600 }}>
                    {s.savedMsg}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Responsive style override for small screens */}
      <style>{`
        @media (max-width: 640px) {
          div[style*="minmax(340px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
