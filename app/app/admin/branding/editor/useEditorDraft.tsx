'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { DraftConfig, DraftBrand } from '@/lib/editor-draft'
import type { LandingPageContent } from '@/lib/landing-content'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface EditorDraftContextValue {
  draft: DraftConfig | null
  loading: boolean
  saveStatus: SaveStatus
  hasUnpublishedChanges: boolean
  lastPublishedAt: string | null
  publishing: boolean
  reloadToken: number
  updateBrand: (partial: Partial<DraftBrand>) => void
  updateLandingContent: (updater: (prev: LandingPageContent) => LandingPageContent) => void
  publish: () => Promise<boolean>
}

const Ctx = createContext<EditorDraftContextValue | null>(null)

export function useEditorDraft(): EditorDraftContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useEditorDraft must be used within EditorDraftProvider')
  return v
}

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function EditorDraftProvider({ restaurantId, children }: { restaurantId: string; children: React.ReactNode }) {
  const [draft, setDraft] = useState<DraftConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false)
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const didLoad = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initiales Laden
  useEffect(() => {
    let active = true
    async function load() {
      const headers = await authHeader()
      const res = await fetch(`/api/admin/editor-draft?restaurant_id=${restaurantId}`, { headers })
      if (!active) return
      if (res.ok) {
        const j = await res.json()
        setDraft(j.draft)
        setLastPublishedAt(j.last_published_at ?? null)
        setHasUnpublishedChanges(!!j.has_unpublished_changes)
      }
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [restaurantId])

  // Debounced Auto-Save bei jeder Entwurf-Änderung (NICHT beim initialen Laden:
  // der erste draft-Set wird übersprungen, sonst würde sofort ein Save laufen und
  // fälschlich "nicht veröffentlichte Änderungen" markieren).
  useEffect(() => {
    if (!draft) return
    if (!didLoad.current) { didLoad.current = true; return }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    saveTimer.current = setTimeout(async () => {
      const headers = { 'Content-Type': 'application/json', ...(await authHeader()) }
      const res = await fetch('/api/admin/editor-draft', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ restaurant_id: restaurantId, draft }),
      })
      if (res.ok) {
        const j = await res.json()
        setSaveStatus('saved')
        setHasUnpublishedChanges(!!j.has_unpublished_changes)
        setReloadToken(t => t + 1)
      } else {
        setSaveStatus('error')
      }
    }, 800)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, restaurantId])

  const updateBrand = useCallback((partial: Partial<DraftBrand>) => {
    setDraft(prev => prev ? { ...prev, brand: { ...prev.brand, ...partial } } : prev)
  }, [])

  const updateLandingContent = useCallback((updater: (prev: LandingPageContent) => LandingPageContent) => {
    setDraft(prev => prev ? { ...prev, landing_content: updater(prev.landing_content) } : prev)
  }, [])

  const publish = useCallback(async (): Promise<boolean> => {
    setPublishing(true)
    const headers = { 'Content-Type': 'application/json', ...(await authHeader()) }
    const res = await fetch('/api/admin/editor-publish', {
      method: 'POST', headers, body: JSON.stringify({ restaurant_id: restaurantId }),
    })
    setPublishing(false)
    if (res.ok) {
      const j = await res.json()
      setLastPublishedAt(j.last_published_at ?? null)
      setHasUnpublishedChanges(false)
      return true
    }
    return false
  }, [restaurantId])

  return (
    <Ctx.Provider value={{
      draft, loading, saveStatus, hasUnpublishedChanges, lastPublishedAt, publishing, reloadToken,
      updateBrand, updateLandingContent, publish,
    }}>
      {children}
    </Ctx.Provider>
  )
}
