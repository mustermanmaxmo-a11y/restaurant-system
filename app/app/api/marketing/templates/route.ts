import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

async function getRestaurant(request: NextRequest) {
  const supabase = await createSupabaseServerSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 }
  const admin = createSupabaseAdmin()
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!restaurant) return { error: 'Restaurant not found', status: 403 }
  return { restaurantId: restaurant.id }
}

export async function GET(request: NextRequest) {
  const result = await getRestaurant(request)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  const { searchParams } = new URL(request.url)
  const triggerType = searchParams.get('trigger_type')

  const admin = createSupabaseAdmin()
  let query = admin
    .from('email_templates')
    .select('id, name, trigger_type, subject_template, body_html, is_active, created_by_ai, created_at')
    .eq('restaurant_id', result.restaurantId)
    .order('created_at', { ascending: false })

  if (triggerType) query = query.eq('trigger_type', triggerType)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data ?? [] })
}

export async function POST(request: NextRequest) {
  const result = await getRestaurant(request)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { name, trigger_type, subject_template, body_html, created_by_ai } = body
  if (!name || !subject_template || !body_html) {
    return NextResponse.json({ error: 'name, subject_template and body_html are required' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('email_templates')
    .insert({
      restaurant_id: result.restaurantId,
      name,
      trigger_type: trigger_type ?? 'manual',
      subject_template,
      body_html,
      created_by_ai: created_by_ai === true,
    })
    .select('id, name, trigger_type')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, template: data })
}

export async function PATCH(request: NextRequest) {
  const result = await getRestaurant(request)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const allowed = ['name', 'trigger_type', 'subject_template', 'body_html', 'is_active']
  const sanitized: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in updates) sanitized[key] = updates[key]
  }

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('email_templates')
    .update(sanitized)
    .eq('id', id)
    .eq('restaurant_id', result.restaurantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const result = await getRestaurant(request)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('email_templates')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', result.restaurantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
