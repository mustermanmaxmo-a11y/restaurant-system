'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bot, Mail, Cake, Droplets, Gift, Zap, LayoutTemplate,
  Share2, BarChart3, Users, type LucideIcon,
} from 'lucide-react'

interface NavItem {
  href: string
  icon: LucideIcon
  label: string
  badge?: string | null
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin/marketing/advisor', icon: Bot, label: 'KI-Berater' },
  { href: '/admin/marketing/campaigns', icon: Mail, label: 'Kampagnen' },
  { href: '/admin/marketing/birthday', icon: Cake, label: 'Geburtstag' },
  { href: '/admin/marketing/drip', icon: Droplets, label: 'Win-Back Drip' },
  { href: '/admin/marketing/referral', icon: Gift, label: 'Referral' },
  { href: '/admin/marketing/automations', icon: Zap, label: 'Automationen' },
  { href: '/admin/marketing/templates', icon: LayoutTemplate, label: 'Templates' },
  { href: '/admin/marketing/social', icon: Share2, label: 'Social Media' },
  { href: '/admin/marketing/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/admin/marketing/subscribers', icon: Users, label: 'Abonnenten' },
]

export default function MarketingNav() {
  const pathname = usePathname()

  return (
    <nav style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {NAV_ITEMS.map(item => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        const Icon = item.icon
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
              background: isActive ? 'var(--accent-subtle)' : 'transparent',
              color: isActive ? 'var(--accent-fg)' : 'var(--sidebar-text, #9ca3af)',
              fontWeight: isActive ? 700 : 500,
              fontSize: '0.85rem',
              borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            <Icon size={17} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
            {item.badge && (
              <span style={{
                background: 'var(--accent)',
                color: 'var(--accent-text)',
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
