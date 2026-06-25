'use client'

import { useState } from 'react'
import type { ColorSet } from '@/lib/color-utils'
import type { FontPair } from '@/lib/font-pairs'
import { buildSiteNav, type SiteNavKey } from '@/lib/site-nav'

interface SiteHeaderProps {
  colors: ColorSet
  font: FontPair
  slug: string
  restaurantName: string
  logoUrl?: string
  /** Page-level nav key. 'kontakt' is an anchor, not a page, so it can't be active. */
  active?: Exclude<SiteNavKey, 'kontakt'>
}

export function SiteHeader({ colors, font, slug, restaurantName, logoUrl, active }: SiteHeaderProps) {
  const [open, setOpen] = useState(false)
  const nav = buildSiteNav(slug, active)

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: colors.bg,
      borderBottom: `1px solid ${colors.border}`,
      fontFamily: `${font.body}, system-ui, sans-serif`,
    }}>
      <style>{`
        .site-header-desktop { display: flex; }
        .site-header-burger { display: none; }
        @media (max-width: 768px) {
          .site-header-desktop { display: none; }
          .site-header-burger { display: flex; }
        }
      `}</style>

      <div style={{
        maxWidth: '1100px', margin: '0 auto', padding: '12px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
      }}>
        {/* Logo + Name → Start */}
        <a href={`/${slug}/info`} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', minWidth: 0 }}>
          {logoUrl && (
            <img src={logoUrl} alt="" style={{ width: '34px', height: '34px', objectFit: 'contain', borderRadius: '8px', flexShrink: 0 }} />
          )}
          <span style={{
            fontFamily: `${font.heading}, Georgia, serif`,
            fontWeight: 700, fontSize: '1.05rem', color: colors.text,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{restaurantName}</span>
        </a>

        {/* Desktop-Navi */}
        <nav className="site-header-desktop" style={{ alignItems: 'center', gap: '24px' }}>
          {nav.map(item => (
            <a key={item.key} href={item.href} style={{
              fontSize: '0.85rem', fontWeight: item.active ? 700 : 500,
              color: item.active ? colors.accent : colors.text, textDecoration: 'none',
            }}>{item.label}</a>
          ))}
        </nav>

        {/* Mobiler Burger-Button */}
        <button
          className="site-header-burger"
          onClick={() => setOpen(o => !o)}
          aria-label="Menü"
          aria-expanded={open}
          style={{
            background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: '8px',
            width: '38px', height: '38px', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: colors.text, flexShrink: 0, fontSize: '1.1rem',
          }}
        >☰</button>
      </div>

      {/* Mobiles Dropdown-Panel */}
      {open && (
        <nav className="site-header-burger" style={{ flexDirection: 'column', borderTop: `1px solid ${colors.border}`, padding: '8px 20px 16px' }}>
          {nav.map(item => (
            <a key={item.key} href={item.href} onClick={() => setOpen(false)} style={{
              padding: '12px 0', fontSize: '0.95rem', fontWeight: item.active ? 700 : 500,
              color: item.active ? colors.accent : colors.text, textDecoration: 'none',
              borderBottom: `1px solid ${colors.border}`,
            }}>{item.label}</a>
          ))}
        </nav>
      )}
    </header>
  )
}
