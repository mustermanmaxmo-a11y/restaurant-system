'use client'

import type { NavSelection } from './EditorNav'
import type { Restaurant } from '@/types/database'
import { BrandColorsPanel } from './panels/BrandColorsPanel'
import { BrandLogoPanel } from './panels/BrandLogoPanel'
import { SectionEditorPanel } from './panels/SectionEditorPanel'
import { TemplatesPanel } from './panels/TemplatesPanel'

const TOOL_LABELS: Record<'ai-chat' | 'ai-scan' | 'requests', string> = {
  'ai-chat': 'KI-Assistent',
  'ai-scan': 'Design erkennen',
  'requests': 'Design anfragen',
}

function ToolPlaceholder({ label }: { label: string }) {
  return (
    <div>
      <h2 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '8px' }}>{label}</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.6 }}>
        Diese Funktion wird gerade ins neue Studio übernommen und ist in Kürze hier verfügbar.
      </p>
    </div>
  )
}

export function EditorPanel({ selection, restaurant }: { selection: NavSelection; restaurant: Restaurant }) {
  return (
    <div style={{ padding: '16px', overflowY: 'auto', height: '100%' }}>
      {selection.kind === 'basis' && <SectionEditorPanel section="basis" restaurantId={restaurant.id} />}
      {selection.kind === 'section' && <SectionEditorPanel section={selection.key} restaurantId={restaurant.id} />}
      {selection.kind === 'brand' && selection.key === 'colors' && <BrandColorsPanel />}
      {selection.kind === 'brand' && selection.key === 'logo' && <BrandLogoPanel restaurantId={restaurant.id} />}
      {selection.kind === 'tool' && selection.key === 'templates' && <TemplatesPanel restaurant={restaurant} />}
      {selection.kind === 'tool' && selection.key !== 'templates' && <ToolPlaceholder label={TOOL_LABELS[selection.key]} />}
    </div>
  )
}
