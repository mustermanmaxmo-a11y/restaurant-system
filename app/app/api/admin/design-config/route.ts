import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function PATCH(request: NextRequest) {
  // Auth via Bearer token
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  // Parse body
  let body: { restaurant_id?: string; design_config?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { restaurant_id, design_config } = body

  if (typeof restaurant_id !== 'string' || !restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id erforderlich' }, { status: 400 })
  }
  if (!design_config || typeof design_config !== 'object') {
    return NextResponse.json({ error: 'design_config erforderlich' }, { status: 400 })
  }

  // Ownership check via admin client
  const supabaseAdmin = createSupabaseAdmin()
  const { data: restaurant } = await supabaseAdmin
    .from('restaurants')
    .select('id, owner_id')
    .eq('id', restaurant_id)
    .single()
  if (!restaurant || restaurant.owner_id !== user.id) {
    return NextResponse.json({ error: 'Restaurant nicht gefunden' }, { status: 404 })
  }

  // Extract legacy columns from design_config for backward compat
  const legacyColumns: Record<string, unknown> = {}
  const legacyKeys = [
    'primary_color',
    'bg_color',
    'surface_color',
    'header_color',
    'button_color',
    'card_color',
    'text_color',
    'font_pair',
    'layout_variant',
  ]
  for (const key of legacyKeys) {
    if (key in design_config) {
      legacyColumns[key] = design_config[key]
    }
  }

  const { error } = await supabaseAdmin
    .from('restaurants')
    .update({
      design_config,
      ...legacyColumns,
    })
    .eq('id', restaurant_id)

  if (error) {
    console.error('design-config update failed:', error)
    return NextResponse.json({ error: 'Design-Konfiguration konnte nicht gespeichert werden' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
