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
  const [isMobile, setIsMobile] = useState(false)

  const [page, setPage] = useState<PreviewPage>('start')
  const [device, setDevice] = useState<PreviewDevice>('mobile')
  const [navMode, setNavMode] = useState<NavMode>('pages')
  const [selection, setSelection] = useState<NavSelection>({ kind: 'basis' })

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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

  const nav = <EditorNav mode={navMode} onModeChange={setNavMode} selection={selection} onSelect={setSelection} />
  const canvas = <EditorCanvas slug={restaurant.slug} page={page} device={device} />
  const panel = <EditorPanel selection={selection} restaurant={restaurant} />

  return (
    <EditorDraftProvider restaurantId={restaurant.id}>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden', background: 'var(--bg)' }}>
        <EditorTopBar slug={restaurant.slug} restaurantId={restaurant.id} page={page} device={device} onPageChange={setPage} onDeviceChange={setDevice} />

        {isMobile ? (
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ borderBottom: '1px solid var(--border)', maxHeight: '40vh', overflow: 'hidden', display: 'flex' }}>{nav}</div>
            <div style={{ height: '45vh', flexShrink: 0, borderBottom: '1px solid var(--border)', display: 'flex' }}>{canvas}</div>
            <div style={{ flex: 1 }}>{panel}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <nav style={{ width: '230px', borderRight: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden' }}>{nav}</nav>
            <div style={{ flex: 1, minWidth: 0, borderRight: '1px solid var(--border)', display: 'flex' }}>{canvas}</div>
            <aside style={{ width: '380px', flexShrink: 0, overflow: 'hidden' }}>{panel}</aside>
          </div>
        )}
      </div>
    </EditorDraftProvider>
  )
}
