'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { DraftConfig, DraftBrand } from '@/lib/editor-draft'
import type { LandingPageContent } from '@/lib/landing-content'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** Standard-Marke-Felder, die ein design_config/Delta auf die Entwurf-Spalten mappt. */
const BRAND_COLOR_KEYS: (keyof DraftBrand)[] = [
  'primary_color', 'bg_color', 'header_color', 'card_color', 'button_color', 'text_color', 'font_pair', 'layout_variant',
]

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
  /** Wendet ein design_config / Delta (von Template/KI) auf den Entwurf an (Spalten + design_config). */
  applyDesignConfig: (cfg: Record<string, unknown>) => void
  publish: () => Promise<boolean>
  /** Verwirft den Entwurf → zurück auf den Live-Stand. */
  discard: () => Promise<void>
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

  const loadDraft = useCallback(async () => {
    const headers = await authHeader()
    const res = await fetch(`/api/admin/editor-draft?restaurant_id=${restaurantId}`, { headers })
    if (res.ok) {
      const j = await res.json()
      didLoad.current = false // nächster draft-Set ist ein Load, kein Edit → kein Autosave
      setDraft(j.draft)
      setLastPublishedAt(j.last_published_at ?? null)
      setHasUnpublishedChanges(!!j.has_unpublished_changes)
      setSaveStatus('idle')
      setReloadToken(t => t + 1)
    }
  }, [restaurantId])

  // Initiales Laden
  useEffect(() => {
    let active = true
    ;(async () => {
      await loadDraft()
      if (active) setLoading(false)
    })()
    return () => { active = false }
  }, [loadDraft])

  // Debounced Auto-Save bei jeder Entwurf-Änderung (NICHT beim Laden: der erste
  // draft-Set nach einem Load wird übersprungen, sonst liefe sofort ein Save).
  useEffect(() => {
    if (!draft) return
    if (!didLoad.current) { didLoad.current = true; return }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- gewollt: Status auf "saving" bei jeder Entwurf-Änderung
    setSaveStatus('saving')
    saveTimer.current = setTimeout(async () => {
      const headers = { 'Content-Type': 'application/json', ...(await authHeader()) }
      const res = await fetch('/api/admin/editor-draft', {
        method: 'PATCH', headers,
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
  }, [draft, restaurantId])

  const updateBrand = useCallback((partial: Partial<DraftBrand>) => {
    setDraft(prev => prev ? { ...prev, brand: { ...prev.brand, ...partial } } : prev)
  }, [])

  const updateLandingContent = useCallback((updater: (prev: LandingPageContent) => LandingPageContent) => {
    setDraft(prev => prev ? { ...prev, landing_content: updater(prev.landing_content) } : prev)
  }, [])

  const applyDesignConfig = useCallback((cfg: Record<string, unknown>) => {
    setDraft(prev => {
      if (!prev) return prev
      const b: DraftBrand = { ...prev.brand }
      const bRec = b as unknown as Record<string, unknown>
      for (const k of BRAND_COLOR_KEYS) {
        const val = cfg[k]
        if (typeof val === 'string') bRec[k] = val
      }
      b.design_config = { ...(prev.brand.design_config ?? {}), ...cfg }
      return { ...prev, brand: b }
    })
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

  const discard = useCallback(async () => {
    const headers = await authHeader()
    await fetch(`/api/admin/editor-draft?restaurant_id=${restaurantId}`, { method: 'DELETE', headers })
    await loadDraft()
  }, [restaurantId, loadDraft])

  return (
    <Ctx.Provider value={{
      draft, loading, saveStatus, hasUnpublishedChanges, lastPublishedAt, publishing, reloadToken,
      updateBrand, updateLandingContent, applyDesignConfig, publish, discard,
    }}>
      {children}
    </Ctx.Provider>
  )
}
