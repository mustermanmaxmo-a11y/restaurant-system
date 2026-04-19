'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { darken } from '@/lib/color-utils'
import { getDesignPackage } from '@/lib/design-packages'
import { FONT_PAIRS } from '@/lib/font-pairs'
import { useTheme } from '@/components/providers/theme-provider'
import type { Restaurant, Reservation, Table } from '@/types/database'
import { CheckCircle2, Dices, Map, PartyPopper, PersonStanding, Sun, Moon } from 'lucide-react'

type TableStatus = 'available' | 'tight' | 'taken' | 'no-position'
type ResInfo = { id: string; table_id: string | null; date: string; time_from: string; guests: number; status: string }

const TABLE_STATUS_COLORS: Record<TableStatus, string | null> = {
  available: '#10b981',
  tight: '#10b981',
  taken: '#ef4444',
  'no-position': null,
}

export default function ReservierenPage() {
  const params = useParams()
  const slug = params.slug as string
  const { theme, toggleTheme } = useTheme()

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [tables, setTables] = useState<Table[]>([])
  const [allReservations, setAllReservations] = useState<ResInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [resMode, setResMode] = useState<'any' | 'pick'>('any')

  // Reservation form
  const [resName, setResName] = useState('')
  const [resPhone, setResPhone] = useState('')
  const [resEmail, setResEmail] = useState('')
  const [resDate, setResDate] = useState('')
  const [resTime, setResTime] = useState('12:00')
  const [resGuests, setResGuests] = useState(2)
  const [resNote, setResNote] = useState('')
  const [resDone, setResDone] = useState<Reservation | null>(null)
  const [resSubmitting, setResSubmitting] = useState(false)
  const [resError, setResError] = useState('')
  const [resConsent, setResConsent] = useState(false)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/restaurant/${slug}`)
      const resto = res.ok ? await res.json() : null

      if (!resto) {
        setError('Restaurant nicht gefunden.')
        setLoading(false)
        return
      }

      setRestaurant(resto)

      const [{ data: tablesData }, { data: resData }] = await Promise.all([
        supabase.from('tables').select('*').eq('restaurant_id', resto.id).eq('active', true).order('table_num'),
        supabase.from('reservations').select('id,table_id,date,time_from,guests,status').eq('restaurant_id', resto.id).neq('status', 'cancelled'),
      ])

      setTables((tablesData as Table[]) || [])
      setAllReservations((resData as ResInfo[]) || [])
      setLoading(false)
    }
    load()
  }, [slug])

  async function submitReservation() {
    if (!restaurant || !resName.trim() || !resPhone.trim() || !resDate || !resTime) return
    setResSubmitting(true)
    setResError('')
    const { data, error: err } = await supabase
      .from('reservations')
      .insert({
        restaurant_id: restaurant.id,
        customer_name: resName.trim(),
        customer_phone: resPhone.trim(),
        customer_email: resEmail.trim() || null,
        guests: resGuests,
        date: resDate,
        time_from: resTime,
        note: resNote.trim() || null,
        table_id: selectedTableId || null,
      })
      .select()
      .single()
    if (err || !data) {
      setResError('Fehler beim Absenden. Bitte versuche es erneut.')
      setResSubmitting(false)
      return
    }
    setResDone(data as Reservation)
    setSelectedTableId(null)
    setResSubmitting(false)
  }

  function getTableStatus(table: Table, date: string, timeFrom: string, guests: number): TableStatus {
    if (table.position_x === null || table.position_y === null) return 'no-position'
    if (table.capacity < guests) return 'taken'
    const [rh, rm] = timeFrom.split(':').map(Number)
    const requestMin = rh * 60 + rm
    const hasConflict = allReservations.some(r => {
      if (r.table_id !== table.id || r.date !== date) return false
      const [eh, em] = r.time_from.split(':').map(Number)
      return Math.abs(eh * 60 + em - requestMin) < 120
    })
    if (hasConflict) return 'taken'
    return table.capacity === guests ? 'tight' : 'available'
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const freeTablesNow = tables.filter(t => {
    if (!t.active || t.position_x === null) return false
    return !allReservations.some(r => {
      if (r.table_id !== t.id || r.date !== todayStr) return false
      const [h, m] = r.time_from.split(':').map(Number)
      return Math.abs(h * 60 + m - nowMin) < 120
    })
  }).length

  const placedTables = tables.filter(t => t.position_x !== null && t.position_y !== null)
  const showFloorPlan = !!(restaurant?.floor_plan_url && placedTables.length > 0 && resDate && resTime && resGuests)

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', width: '100%', overflowX: 'hidden' }}>
        <div style={{ background: 'var(--header-bg)', padding: '28px 20px 20px' }}>
          <div className="skeleton" style={{ width: '120px', height: '14px', marginBottom: '10px' }} />
          <div className="skeleton" style={{ width: '200px', height: '28px', marginBottom: '16px' }} />
        </div>
        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: '52px', borderRadius: '10px' }} />
          ))}
        </div>
      </div>
    )
  }

  if (error || !restaurant) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#ef4444', fontWeight: 600 }}>{error || 'Restaurant nicht gefunden.'}</p>
      </div>
    )
  }

  const pkg = getDesignPackage(restaurant.design_package)
  const accent = restaurant.primary_color ?? pkg.preview.primaryColor
  const header = restaurant.header_color ?? pkg.preview.headerColor
  const btn = restaurant.button_color ?? pkg.preview.buttonColor
  const fp = FONT_PAIRS[restaurant.font_pair ?? pkg.fontPair] ?? FONT_PAIRS['syne-dmsans']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', width: '100%', overflowX: 'hidden' }}>
      <style>{`
        :root, .dark {
          --accent: ${accent};
          --accent-hover: ${darken(accent, 15)};
          --accent-subtle: ${accent}18;
          --border-accent: ${accent}33;
          --header-bg: ${header};
          --btn-bg: ${btn};
          --font-heading: ${fp.heading};
          --font-body: ${fp.body};
        }
      `}</style>

      {/* Header */}
      <div style={{ background: 'var(--header-bg)', padding: '28px 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0, flex: 1 }}>
            {restaurant.logo_url && (
              <img src={restaurant.logo_url} alt="" style={{ width: '52px', height: '52px', objectFit: 'contain', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', padding: '4px', flexShrink: 0, marginTop: '2px' }} />
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '5px' }}>Willkommen bei</p>
              <h1 style={{ color: '#ffffff', fontWeight: 800, fontSize: 'clamp(1.2rem, 5vw, 1.6rem)', letterSpacing: '-0.02em', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{restaurant.name}</h1>
              {restaurant.description && (
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', marginTop: '3px', lineHeight: 1.3 }}>{restaurant.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={toggleTheme}
            style={{ background: 'var(--accent)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, marginTop: '4px' }}
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        {/* Tab navigation — link back to ordering */}
        <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.08)', borderRadius: '12px', padding: '4px', gap: '4px' }}>
          <a href={`/bestellen/${slug}`} style={{ padding: '8px 16px', borderRadius: '9px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.45)', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-block' }}>
            Bestellen
          </a>
          <span style={{ padding: '8px 16px', borderRadius: '9px', background: 'rgba(255,255,255,0.12)', color: '#FFFFFF', fontWeight: 700, fontSize: '0.8rem' }}>
            Reservieren
          </span>
        </div>
      </div>

      {/* Reservation content */}
      <div style={{ padding: '24px 20px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>
        {resDone ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><PartyPopper size={56} color="var(--accent)" /></div>
            <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.3rem', marginBottom: '8px' }}>Anfrage eingegangen!</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Wir melden uns unter <strong style={{ color: 'var(--text)' }}>{resDone.customer_phone}</strong> zur Bestätigung.</p>
            <div style={{ background: 'var(--surface)', borderRadius: '14px', padding: '20px', textAlign: 'left', marginBottom: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888', fontSize: '0.875rem' }}>Datum</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem' }}>{new Date(resDone.date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888', fontSize: '0.875rem' }}>Uhrzeit</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem' }}>{resDone.time_from.slice(0, 5)} Uhr</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888', fontSize: '0.875rem' }}>Personen</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem' }}>{resDone.guests}</span>
                </div>
                {resDone.table_id && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888', fontSize: '0.875rem' }}>Tisch</span>
                    <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem' }}>{tables.find(t => t.id === resDone.table_id)?.label ?? 'Ausgewählt'}</span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => { setResDone(null); setResName(''); setResPhone(''); setResEmail(''); setResDate(''); setResTime('12:00'); setResGuests(2); setResNote('') }}
              style={{ background: 'var(--btn-bg)', border: 'none', borderRadius: '12px', padding: '13px 28px', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
            >
              Weitere Reservierung
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '4px' }}>Tisch reservieren</h2>

            {/* Mode selector — only show if floor plan exists */}
            {restaurant.floor_plan_url && placedTables.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
                {([
                  ['any', Dices, 'Beliebiger Tisch', 'Wir wählen für dich'],
                  ['pick', Map, 'Tisch selbst wählen', 'Grundriss anzeigen'],
                ] as const).map(([mode, ModeIcon, title, sub]) => (
                  <button
                    key={mode}
                    onClick={() => { setResMode(mode); setSelectedTableId(null) }}
                    style={{
                      padding: '14px 12px', borderRadius: '12px', border: '2px solid',
                      borderColor: resMode === mode ? 'var(--btn-bg)' : 'var(--border)',
                      background: resMode === mode ? 'var(--btn-bg)' : 'var(--surface)',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{ marginBottom: '4px', display: 'flex' }}><ModeIcon size={22} color={resMode === mode ? 'var(--btn-text)' : 'var(--text)'} /></div>
                    <div style={{ color: resMode === mode ? 'var(--btn-text)' : 'var(--text)', fontWeight: 700, fontSize: '0.875rem' }}>{title}</div>
                    <div style={{ color: resMode === mode ? 'var(--btn-text)' : 'var(--text-muted)', fontSize: '0.75rem', opacity: 0.7 }}>{sub}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Personen */}
            <div>
              <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Personen</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={() => setResGuests(g => Math.max(1, g - 1))} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-2)', border: '1.5px solid var(--border)', color: 'var(--text)', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 700 }}>−</button>
                <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.2rem', minWidth: '32px', textAlign: 'center' }}>{resGuests}</span>
                <button onClick={() => setResGuests(g => Math.min(20, g + 1))} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent)', border: 'none', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 700, color: '#fff' }}>+</button>
              </div>
            </div>

            {/* Datum + Zeit */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '100%' }}>
              <div>
                <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Datum *</label>
                <input type="date" value={resDate} onChange={e => setResDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', color: '#1a1a2e', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Uhrzeit *</label>
                <select value={resTime} onChange={e => setResTime(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', color: '#1a1a2e', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}>
                  {Array.from({ length: 23 }, (_, i) => {
                    const h = Math.floor(i / 2) + 11
                    const m = i % 2 === 0 ? '00' : '30'
                    return `${h}:${m}`
                  }).map(t => <option key={t} value={t}>{t} Uhr</option>)}
                </select>
              </div>
            </div>

            {/* Floor Plan */}
            {resMode === 'pick' && showFloorPlan && (
              <div>
                <div style={{ position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
                  <img src={restaurant.floor_plan_url!} alt="Grundriss"
                    style={{ width: '100%', display: 'block', userSelect: 'none' }} draggable={false} />
                  {placedTables.map(table => {
                    const status = getTableStatus(table, resDate, resTime, resGuests)
                    const color = TABLE_STATUS_COLORS[status]
                    if (!color) return null
                    const isSelected = selectedTableId === table.id
                    return (
                      <div
                        key={table.id}
                        onClick={() => status !== 'taken' && setSelectedTableId(isSelected ? null : table.id)}
                        title={`${table.label} · ${table.capacity} Plätze`}
                        style={{
                          position: 'absolute',
                          left: `${table.position_x}%`, top: `${table.position_y}%`,
                          transform: 'translate(-50%, -50%)',
                          width: '36px', height: '36px', borderRadius: '50%',
                          background: color,
                          border: isSelected ? '3px solid #1a1a2e' : '2.5px solid rgba(255,255,255,0.9)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: '0.7rem', fontWeight: 700,
                          cursor: status === 'taken' ? 'not-allowed' : 'pointer',
                          boxShadow: isSelected ? '0 0 0 3px #6c63ff66' : '0 2px 6px rgba(0,0,0,0.25)',
                          zIndex: 10, transition: 'transform 0.15s',
                        }}
                      >
                        {table.table_num}
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: '14px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {[{ color: '#10b981', label: 'Frei' }, { color: '#ef4444', label: 'Belegt' }].map(({ color, label }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
                      <span style={{ color: '#888', fontSize: '0.75rem' }}>{label}</span>
                    </div>
                  ))}
                </div>
                {selectedTableId ? (
                  <div style={{ background: 'var(--accent-subtle)', borderRadius: '8px', padding: '10px 14px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text)', fontSize: '0.875rem', fontWeight: 600 }}>
                      <CheckCircle2 size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />{tables.find(t => t.id === selectedTableId)?.label} ausgewählt
                    </span>
                    <button onClick={() => setSelectedTableId(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.8rem' }}>Abwählen</button>
                  </div>
                ) : (
                  <p style={{ color: '#888', fontSize: '0.78rem', marginTop: '6px' }}>Tippe auf einen freien Tisch um ihn auszuwählen.</p>
                )}
              </div>
            )}

            {resMode === 'pick' && !showFloorPlan && restaurant.floor_plan_url && (
              <div style={{ background: 'var(--surface)', borderRadius: '10px', padding: '14px 16px', textAlign: 'center' }}>
                <p style={{ color: '#888', fontSize: '0.875rem' }}>Wähle Datum, Uhrzeit und Personenzahl um den Grundriss zu sehen.</p>
              </div>
            )}

            {/* Name + Tel + Email + Notiz */}
            <div>
              <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Name *</label>
              <input value={resName} onChange={e => setResName(e.target.value)} placeholder="Vor- und Nachname"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', color: '#1a1a2e', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Telefon *</label>
              <input value={resPhone} onChange={e => setResPhone(e.target.value)} placeholder="+49 170 1234567" type="tel"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', color: '#1a1a2e', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>E-Mail (optional)</label>
              <input value={resEmail} onChange={e => setResEmail(e.target.value)} placeholder="email@beispiel.de" type="email"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', color: '#1a1a2e', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Anmerkung (optional)</label>
              <textarea value={resNote} onChange={e => setResNote(e.target.value)} placeholder="z.B. Fensterplatz, Geburtstagstorte..." rows={2}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', color: '#1a1a2e', fontSize: '0.875rem', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={resConsent}
                onChange={e => setResConsent(e.target.checked)}
                style={{ marginTop: '3px', accentColor: 'var(--accent)', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer' }}
              />
              <span style={{ color: '#888', fontSize: '0.78rem', lineHeight: 1.5 }}>
                Ich habe die{' '}
                <a href="/datenschutz" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>Datenschutzerklärung</a>
                {' '}gelesen und stimme der Verarbeitung meiner Daten zur Bearbeitung der Reservierungsanfrage zu.
              </span>
            </label>

            {resError && <p style={{ color: '#ef4444', fontSize: '0.875rem', textAlign: 'center' }}>{resError}</p>}

            <button
              onClick={submitReservation}
              disabled={resSubmitting || !resName.trim() || !resPhone.trim() || !resDate || !resConsent}
              style={{
                width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
                background: (!resName.trim() || !resPhone.trim() || !resDate || !resConsent) ? 'var(--border)' : 'var(--btn-bg)',
                color: (!resName.trim() || !resPhone.trim() || !resDate || !resConsent) ? 'var(--text-muted)' : '#fff',
                fontWeight: 800, fontSize: '1rem', cursor: resSubmitting ? 'wait' : 'pointer',
                boxShadow: (!resName.trim() || !resPhone.trim() || !resDate || !resConsent) ? 'none' : '0 4px 16px rgba(0,0,0,0.2)',
              }}
            >
              {resSubmitting ? 'Wird gesendet...' : 'Reservierung anfragen'}
            </button>

            {/* Walk-in section */}
            <div style={{ marginTop: '8px', padding: '20px', background: 'var(--surface)', borderRadius: '14px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ marginBottom: '6px', display: 'flex', justifyContent: 'center' }}><PersonStanding size={28} color="#888" /></div>
              <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.95rem', marginBottom: '6px' }}>Ohne Reservierung</h3>
              <p style={{ color: '#888', fontSize: '0.8rem', lineHeight: 1.5 }}>
                Einfach vorbeikommen!{freeTablesNow > 0
                  ? <> Aktuell <strong style={{ color: '#10b981' }}>{freeTablesNow} {freeTablesNow === 1 ? 'Tisch' : 'Tische'}</strong> heute noch verfügbar.</>
                  : ' Schau gerne vorbei, wir helfen dir gerne weiter.'}
              </p>
              {resGuests > 6 && (
                <p style={{ color: '#aaa', fontSize: '0.75rem', marginTop: '6px' }}>Für Gruppen ab 6 Personen empfehlen wir eine Reservierung.</p>
              )}
            </div>

            {/* Link to ordering */}
            <div style={{ textAlign: 'center', paddingBottom: '32px' }}>
              <a href={`/bestellen/${slug}`} style={{ color: 'var(--accent)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
                Direkt bestellen →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
