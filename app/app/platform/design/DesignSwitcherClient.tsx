'use client'

import { useState } from 'react'
import { Zap, Building2, Target } from 'lucide-react'

type Version = 'v1' | 'v2'
type Override = Version | null
type Restaurant = { id: string; name: string; override: Override }

interface Props {
  canEdit: boolean
  initialPlatformVersion: Version
  initialDefaultVersion: Version
  restaurants: Restaurant[]
}

export default function DesignSwitcherClient({
  canEdit,
  initialPlatformVersion,
  initialDefaultVersion,
  restaurants: initialRestaurants,
}: Props) {
  const [platformVersion, setPlatformVersion] = useState<Version>(initialPlatformVersion)
  const [defaultVersion, setDefaultVersion] = useState<Version>(initialDefaultVersion)
  const [restaurants, setRestaurants] = useState<Restaurant[]>(initialRestaurants)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function patchSettings(
    field: 'platform_design_version' | 'restaurants_default_version',
    value: Version,
  ) {
    setError(null)
    setPending(true)
    const prev = field === 'platform_design_version' ? platformVersion : defaultVersion
    if (field === 'platform_design_version') setPlatformVersion(value)
    else setDefaultVersion(value)

    const res = await fetch('/api/platform/design/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    if (!res.ok) {
      if (field === 'platform_design_version') setPlatformVersion(prev)
      else setDefaultVersion(prev)
      setError('Konnte nicht speichern.')
    }
    setPending(false)
  }

  async function patchRestaurant(id: string, version: Override) {
    setError(null)
    setPending(true)
    const prev = restaurants.find((r) => r.id === id)?.override ?? null
    setRestaurants((list) => list.map((r) => (r.id === id ? { ...r, override: version } : r)))

    const res = await fetch('/api/platform/design/restaurants', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: id, version }),
    })
    if (!res.ok) {
      setRestaurants((list) => list.map((r) => (r.id === id ? { ...r, override: prev } : r)))
      setError('Konnte nicht speichern.')
    }
    setPending(false)
  }

  return (
    <div style={{ padding: '32px 24px', maxWidth: '860px' }}>
      <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 800, marginBottom: '4px' }}>
        Design-System
      </h1>
      <p style={{ color: '#888', fontSize: '0.875rem', marginBottom: '32px' }}>
        Steuere das aktive Theme für dich und alle Restaurants auf der Plattform.
      </p>

      {!canEdit && (
        <div
          style={{
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '12px',
            color: '#fbbf24',
            marginBottom: '24px',
          }}
        >
          Nur Owner und Co-Founder können Änderungen speichern. Du siehst die Ansicht read-only.
        </div>
      )}

      {error && (
        <div
          style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.35)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '12px',
            color: '#fca5a5',
            marginBottom: '20px',
          }}
        >
          {error}
        </div>
      )}

      <SectionLabel>Platform Admin · nur für dich</SectionLabel>
      <Card
        icon={<Zap size={16} color="#fff" />}
        title="Dein Platform-Interface"
        desc="Wählt das Design für deine /platform/*-Seiten."
      >
        <VersionToggle
          value={platformVersion}
          onChange={(v) => canEdit && patchSettings('platform_design_version', v)}
          disabled={!canEdit || pending}
        />
      </Card>

      <Divider />

      <SectionLabel>Restaurants · Plattform-Default</SectionLabel>
      <Card
        icon={<Building2 size={16} color="#fff" />}
        title="Standard-Theme für alle Restaurants"
        desc="Gilt für Restaurant-Admin und Gast-Seiten. Einzelne Restaurants können überschreiben."
      >
        <VersionToggle
          value={defaultVersion}
          onChange={(v) => canEdit && patchSettings('restaurants_default_version', v)}
          disabled={!canEdit || pending}
        />
        <div
          style={{
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '11px',
            color: '#e5e7eb',
            lineHeight: 1.5,
            marginTop: '14px',
          }}
        >
          <strong style={{ color: '#ef4444' }}>Wichtig:</strong> Ändern des Defaults betrifft nur
          Restaurants, die keine eigene Wahl getroffen haben. Restaurant-Branding (Farben, Logos)
          bleibt unabhängig aktiv.
        </div>
      </Card>

      <Divider />

      <SectionLabel>Einzelne Restaurants · Override</SectionLabel>
      <Card
        icon={<Target size={16} color="#fff" />}
        title="Individuelle Zuweisung"
        desc={'Setze pro Restaurant explizit V1 oder V2. "Auto" = Plattform-Default wird verwendet.'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
          {restaurants.length === 0 && (
            <p style={{ color: '#888', fontSize: '12px' }}>Keine Restaurants.</p>
          )}
          {restaurants.map((r) => (
            <RestaurantRow
              key={r.id}
              name={r.name}
              override={r.override}
              disabled={!canEdit || pending}
              onChange={(v) => patchRestaurant(r.id, v)}
            />
          ))}
        </div>
      </Card>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: '#ef4444',
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '2px',
        fontWeight: 700,
        marginBottom: '12px',
      }}
    >
      {children}
    </div>
  )
}

function Divider() {
  return (
    <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '28px 0' }} />
  )
}

function Card({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px',
        padding: '20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '14px',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ color: '#fff', fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>
            {title}
          </div>
          <div style={{ color: '#888', fontSize: '12px', lineHeight: 1.5 }}>{desc}</div>
        </div>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>
      {children}
    </div>
  )
}

function VersionToggle({
  value,
  onChange,
  disabled,
}: {
  value: Version
  onChange: (v: Version) => void
  disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
      {(['v1', 'v2'] as Version[]).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          disabled={disabled}
          style={{
            flex: 1,
            padding: '14px',
            borderRadius: '12px',
            background: value === v ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
            border: value === v ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)',
            boxShadow: value === v ? '0 0 0 1px #ef4444 inset' : 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            textAlign: 'left' as const,
            color: '#fff',
            position: 'relative' as const,
          }}
        >
          {value === v && (
            <span
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                padding: '3px 8px',
                background: '#ef4444',
                color: '#fff',
                borderRadius: '10px',
                fontSize: '9px',
                fontWeight: 700,
              }}
            >
              AKTIV
            </span>
          )}
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '3px' }}>
            {v === 'v1' ? 'V1 Classic' : 'V2 Bento Premium'}
          </div>
          <div style={{ fontSize: '11px', color: '#888' }}>
            {v === 'v1' ? 'Aktuelles Design · Syne + DM Sans' : 'Neu · Geist Font · Dark Bento'}
          </div>
        </button>
      ))}
    </div>
  )
}

function RestaurantRow({
  name,
  override,
  disabled,
  onChange,
}: {
  name: string
  override: Override
  disabled?: boolean
  onChange: (v: Override) => void
}) {
  const modes: { label: string; value: Override }[] = [
    { label: 'Auto', value: null },
    { label: 'V1', value: 'v1' },
    { label: 'V2', value: 'v2' },
  ]
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 16px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
      }}
    >
      <div
        style={{
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap' as const,
          paddingRight: '12px',
        }}
      >
        {name}
      </div>
      <div
        style={{
          display: 'flex',
          gap: '4px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px',
          padding: '3px',
          flexShrink: 0,
        }}
      >
        {modes.map((m) => {
          const isActive = override === m.value
          return (
            <button
              key={m.label}
              onClick={() => !disabled && onChange(m.value)}
              disabled={disabled}
              style={{
                padding: '5px 12px',
                borderRadius: '7px',
                background: isActive ? '#ef4444' : 'transparent',
                color: isActive ? '#fff' : '#888',
                border: 'none',
                fontSize: '11px',
                fontWeight: 600,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {m.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
