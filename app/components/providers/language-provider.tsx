'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { type Lang, resolveKey } from '@/lib/translations'

interface LanguageContextType {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('de')

  useEffect(() => {
    const saved = localStorage.getItem('language') as Lang | null
    const validLangs: Lang[] = ['de', 'en', 'es', 'it', 'tr', 'fr', 'pl', 'ru']
    if (saved && validLangs.includes(saved)) {
      setLangState(saved)
      document.documentElement.lang = saved
    }
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('language', l)
    document.documentElement.lang = l
  }

  function t(key: string): string {
    return resolveKey(lang, key)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}
