import { createServerClient } from '@/lib/supabase-server'

export type LegalKey = 'agb' | 'datenschutz' | 'impressum' | 'cookie_banner'

export const LEGAL_LABELS: Record<LegalKey, string> = {
  agb: 'AGB',
  datenschutz: 'Datenschutzerklärung',
  impressum: 'Impressum',
  cookie_banner: 'Cookie-Banner Text',
}

export const LEGAL_PUBLIC_PATH: Record<LegalKey, string | null> = {
  agb: '/agb',
  datenschutz: '/datenschutz',
  impressum: '/impressum',
  cookie_banner: null,
}

export async function getLegalDocument(key: LegalKey): Promise<string | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('legal_documents')
    .select('content')
    .eq('key', key)
    .maybeSingle()
  return data?.content ?? null
}

export async function listLegalDocuments() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('legal_documents')
    .select('key, updated_at')
  return data ?? []
}
