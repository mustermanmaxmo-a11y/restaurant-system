import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { LEGAL_PUBLIC_PATH, type LegalKey } from '@/lib/legal'

export const dynamic = 'force-dynamic'

const VALID_KEYS: LegalKey[] = ['agb', 'datenschutz', 'impressum', 'cookie_banner']

// POST — Draft genehmigen { key } oder ablehnen { key, reject: true }
export async function POST(req: Request) {
  const supabase = await createSupabaseServerSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data: isOwner } = await supabase.rpc('is_platform_owner')
  if (isOwner !== true) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { key, reject } = body

  if (!key || !VALID_KEYS.includes(key as LegalKey)) {
    return NextResponse.json({ error: 'invalid key' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()

  if (reject) {
    // Draft verwerfen
    const { error } = await admin
      .from('legal_documents')
      .update({ draft_content: null, draft_by: null, draft_updated_at: null })
      .eq('key', key)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    revalidatePath('/platform/legal')
    revalidatePath(`/platform/legal/${key}`)
    return NextResponse.json({ ok: true, action: 'rejected' })
  }

  // Draft genehmigen → content übernehmen
  const { data: doc } = await admin
    .from('legal_documents')
    .select('draft_content')
    .eq('key', key)
    .single()

  if (!doc?.draft_content) {
    return NextResponse.json({ error: 'Kein Draft vorhanden.' }, { status: 400 })
  }

  const { error } = await admin
    .from('legal_documents')
    .update({
      content: doc.draft_content,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
      draft_content: null,
      draft_by: null,
      draft_updated_at: null,
    })
    .eq('key', key)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const publicPath = LEGAL_PUBLIC_PATH[key as LegalKey]
  if (publicPath) revalidatePath(publicPath)
  revalidatePath('/platform/legal')
  revalidatePath(`/platform/legal/${key}`)

  return NextResponse.json({ ok: true, action: 'approved' })
}
