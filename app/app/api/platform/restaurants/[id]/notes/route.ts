import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { logAudit } from '@/lib/audit'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try { await requirePlatformAccess() }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { id } = await params
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('platform_notes')
    .select('id, author_email, content, pinned, created_at')
    .eq('restaurant_id', id)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: Params) {
  let authorEmail: string
  try {
    const { user } = await requirePlatformAccess()
    authorEmail = user.email ?? 'team'
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { id } = await params
  const { content } = await req.json()

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'Content required' }, { status: 400 })
  }
  if (content.length > 2000) {
    return NextResponse.json({ error: 'Max 2000 Zeichen' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('platform_notes')
    .insert({ restaurant_id: id, author_email: authorEmail, content: content.trim(), pinned: false })
    .select('id, author_email, content, pinned, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ actor_email: authorEmail, action: 'note_created', target_type: 'restaurant', target_id: id, details: { note_id: data.id } })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try { await requirePlatformAccess() }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { id } = await params
  const { noteId, pinned } = await req.json()
  if (!noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('platform_notes')
    .update({ pinned: Boolean(pinned) })
    .eq('id', noteId)
    .eq('restaurant_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  let authorEmail: string
  let role: string
  try {
    const access = await requirePlatformAccess()
    authorEmail = access.user.email ?? ''
    role = access.role
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { id } = await params
  const { noteId } = await req.json()
  if (!noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 })

  const admin = createSupabaseAdmin()
  let query = admin.from('platform_notes').delete().eq('id', noteId).eq('restaurant_id', id)

  // Non-owners can only delete their own notes
  if (role !== 'owner' && role !== 'co_founder') {
    query = query.eq('author_email', authorEmail)
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ actor_email: authorEmail, action: 'note_deleted', target_type: 'restaurant', target_id: id, details: { note_id: noteId } })
  return NextResponse.json({ ok: true })
}
