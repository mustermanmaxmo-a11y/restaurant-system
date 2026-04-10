'use client'

import type { LayoutVariant } from '@/lib/design-packages'

interface MenuItemGridProps {
  layout: LayoutVariant
  children: React.ReactNode
}

export function MenuItemGrid({ layout, children }: MenuItemGridProps) {
  if (layout === 'grid') {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
      }}>
        {children}
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: layout === 'list' ? '8px' : '10px',
    }}>
      {children}
    </div>
  )
}
