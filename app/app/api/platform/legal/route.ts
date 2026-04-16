import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { LEGAL_PUBLIC_PATH, type LegalKey } from '@/lib/legal'

export const dynamic = 'force-dynamic'

const VALID_KEYS: LegalKey[] = ['agb', 'datenschutz', 'impressum', 'cookie_banner']

export async function POST(req: Request) {
  const supabase = await createSupabaseServerSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data: isOwner, error: rpcErr } = await supabase.rpc('is_platform_owner')
  if (rpcErr || isOwner !== true) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: { key?: string; content?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { key, content } = body
  if (!key || !VALID_KEYS.includes(key as LegalKey)) {
    return NextResponse.json({ error: 'invalid key' }, { status: 400 })
  }
  if (typeof content !== 'string') {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('legal_documents')
    .upsert({
      key,
      content,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }, { onConflict: 'key' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const publicPath = LEGAL_PUBLIC_PATH[key as LegalKey]
  if (publicPath) revalidatePath(publicPath)
  revalidatePath('/platform/legal')
  revalidatePath(`/platform/legal/${key}`)

  return NextResponse.json({ ok: true })
}
