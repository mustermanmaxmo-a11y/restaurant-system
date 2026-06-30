'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Restaurant, RestaurantPlan } from '@/types/database'
import { getPlanLimits } from '@/lib/plan-limits'
import { UpgradeHint } from '@/components/UpgradeHint'
import { EditorDraftProvider } from './editor/useEditorDraft'
import { EditorTopBar } from './editor/EditorTopBar'
import { EditorNav, type NavMode, type NavSelection } from './editor/EditorNav'
import { EditorPanel } from './editor/EditorPanel'
import { EditorCanvas } from './editor/EditorCanvas'
import type { PreviewPage, PreviewDevice } from './editor/PreviewPane'

export default function BrandingPage() {
  const router = useRouter()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)

  const [page, setPage] = useState<PreviewPage>('start')
  const [device, setDevice] = useState<PreviewDevice>('mobile')
  const [navMode, setNavMode] = useState<NavMode>('pages')
  const [selection, setSelection] = useState<NavSelection>({ kind: 'basis' })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/owner-login'); return }
      const { data: resto } = await supabase.from('restaurants').select('*').eq('owner_id', user.id).limit(1).single()
      if (!resto) { router.push('/admin/setup'); return }
      setRestaurant(resto)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading || !restaurant) return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Lädt…</div>

  const limits = getPlanLimits((restaurant.plan ?? 'starter') as RestaurantPlan)
  if (!limits.hasBranding) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px' }}>
        <div style={{ maxWidth: '600px', margin: '80px auto' }}><UpgradeHint feature="Branding & Design" /></div>
      </div>
    )
  }

  return (
    <EditorDraftProvider restaurantId={restaurant.id}>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden', background: 'var(--bg)' }}>
        <EditorTopBar slug={restaurant.slug} page={page} device={device} onPageChange={setPage} onDeviceChange={setDevice} />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <nav style={{ width: '230px', borderRight: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden' }}>
            <EditorNav mode={navMode} onModeChange={setNavMode} selection={selection} onSelect={setSelection} />
          </nav>
          <div style={{ flex: 1, minWidth: 0, borderRight: '1px solid var(--border)', display: 'flex' }}>
            <EditorCanvas slug={restaurant.slug} page={page} device={device} />
          </div>
          <aside style={{ width: '380px', flexShrink: 0, overflow: 'hidden' }}>
            <EditorPanel selection={selection} restaurant={restaurant} />
          </aside>
        </div>
      </div>
    </EditorDraftProvider>
  )
}
