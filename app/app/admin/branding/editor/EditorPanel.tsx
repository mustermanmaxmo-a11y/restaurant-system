'use client'

import type { NavSelection } from './EditorNav'
import type { Restaurant } from '@/types/database'
import { BrandColorsPanel } from './panels/BrandColorsPanel'
import { BrandLogoPanel } from './panels/BrandLogoPanel'
import { SectionEditorPanel } from './panels/SectionEditorPanel'
import { TemplatesPanel } from './panels/TemplatesPanel'
import { AiChatPanel } from './panels/AiChatPanel'
import { AiScanPanel } from './panels/AiScanPanel'
import { RequestsPanel } from './panels/RequestsPanel'

export function EditorPanel({ selection, restaurant }: { selection: NavSelection; restaurant: Restaurant }) {
  return (
    <div style={{ padding: '16px', overflowY: 'auto', height: '100%' }}>
      {selection.kind === 'basis' && <SectionEditorPanel section="basis" restaurantId={restaurant.id} />}
      {selection.kind === 'section' && <SectionEditorPanel section={selection.key} restaurantId={restaurant.id} />}
      {selection.kind === 'brand' && selection.key === 'colors' && <BrandColorsPanel />}
      {selection.kind === 'brand' && selection.key === 'logo' && <BrandLogoPanel restaurantId={restaurant.id} />}
      {selection.kind === 'tool' && selection.key === 'templates' && <TemplatesPanel restaurant={restaurant} />}
      {selection.kind === 'tool' && selection.key === 'ai-chat' && <AiChatPanel restaurant={restaurant} />}
      {selection.kind === 'tool' && selection.key === 'ai-scan' && <AiScanPanel restaurant={restaurant} />}
      {selection.kind === 'tool' && selection.key === 'requests' && <RequestsPanel restaurant={restaurant} />}
    </div>
  )
}
