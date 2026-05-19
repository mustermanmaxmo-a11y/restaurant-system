'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  icon: string
  label: string
  badge: string | null
}

interface MarketingNavProps {
  items: NavItem[]
}

export default function MarketingNav({ items }: MarketingNavProps) {
  const pathname = usePathname()

  return (
    <nav style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {items.map(item => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 12px',
              borderRadius: '8px',
              textDecoration: 'none',
              background: isActive ? 'rgba(232, 93, 38, 0.12)' : 'transparent',
              color: isActive ? '#e85d26' : 'var(--sidebar-text, #9ca3af)',
              fontWeight: isActive ? 700 : 500,
              fontSize: '0.85rem',
              borderLeft: isActive ? '3px solid #e85d26' : '3px solid transparent',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
            {item.badge && (
              <span style={{
                background: '#e85d26',
                color: '#fff',
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '999px',
                flexShrink: 0,
              }}>
                {item.badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
