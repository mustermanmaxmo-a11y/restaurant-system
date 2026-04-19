'use client'

import { createContext, useContext, useEffect } from 'react'
import type { DesignVersion } from '@/lib/design-version'

interface DesignVersionContext {
  version: DesignVersion
}

const Ctx = createContext<DesignVersionContext | null>(null)

/**
 * Wraps children and (client-side) applies the theme class to <html>.
 * The initial class is also set server-side in the root layout to avoid FOUC.
 */
export function DesignVersionProvider({
  version,
  children,
}: {
  version: DesignVersion
  children: React.ReactNode
}) {
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('theme-v1', 'theme-v2')
    root.classList.add(`theme-${version}`)
  }, [version])

  return <Ctx.Provider value={{ version }}>{children}</Ctx.Provider>
}

export function useDesignVersion(): DesignVersion {
  const ctx = useContext(Ctx)
  if (!ctx) {
    // Im Admin-/Platform-Layout immer gesetzt. Außerhalb (z.B. statische Pages)
    // defaulten wir auf V1 statt zu werfen, damit die App nicht crasht.
    return 'v1'
  }
  return ctx.version
}
