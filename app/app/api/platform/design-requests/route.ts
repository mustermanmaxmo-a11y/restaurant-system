import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['pending', 'building', 'done', 'rejected'] as const
type ValidStatus = (typeof VALID_STATUSES)[number]

// GET — list all design requests with restaurant info
export async function GET() {
  await requirePlatformAccess()

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('design_requests')
    .select('*, restaurants(id, name, slug)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// PATCH — update a design request status/notes
export async function PATCH(req: NextRequest) {
  const { role } = await requirePlatformAccess()

  if (role !== 'owner' && role !== 'co_founder') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { id, status, admin_notes, result_template_id } = body

  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'id fehlt' }, { status: 400 })
  }
  if (typeof status !== 'string' || !(VALID_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: `Ungültiger Status. Erlaubt: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }

  const updatePayload: {
    status: ValidStatus
    admin_notes?: string | null
    result_template_id?: string | null
  } = { status: status as ValidStatus }

  if (admin_notes !== undefined) {
    updatePayload.admin_notes = typeof admin_notes === 'string' ? admin_notes || null : null
  }
  if (result_template_id !== undefined) {
    updatePayload.result_template_id = typeof result_template_id === 'string' ? result_template_id || null : null
  }

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('design_requests')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}
