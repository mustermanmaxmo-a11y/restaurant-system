import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

function makeUserClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const token = auth?.replace('Bearer ', '').trim()
  if (!token) return { user: null, token: null }
  const client = makeUserClient(token)
  const { data: { user } } = await client.auth.getUser(token)
  return { user, token }
}

async function checkOwnership(userId: string, restaurantId: string) {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', userId)
    .maybeSingle()
  return !!data
}

// GET — list design requests for a restaurant
export async function GET(req: NextRequest) {
  const { user } = await getUser(req)
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id fehlt' }, { status: 400 })

  const isOwner = await checkOwnership(user.id, restaurantId)
  if (!isOwner) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('design_requests')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// POST — create a new design request
export async function POST(req: NextRequest) {
  const { user } = await getUser(req)
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const restaurantId = form.get('restaurant_id')
  if (typeof restaurantId !== 'string' || !restaurantId) {
    return NextResponse.json({ error: 'restaurant_id fehlt' }, { status: 400 })
  }

  const description = form.get('description')
  const descriptionStr = typeof description === 'string' ? description.trim() : null

  const screenshotFile = form.get('screenshot')
  const hasScreenshot = screenshotFile instanceof File && screenshotFile.size > 0

  const isOwner = await checkOwnership(user.id, restaurantId)
  if (!isOwner) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  let screenshotUrl: string | null = null

  if (hasScreenshot && screenshotFile instanceof File) {
    if (screenshotFile.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Bild zu groß (max. 8 MB)' }, { status: 400 })
    }
    if (!(ALLOWED_TYPES as readonly string[]).includes(screenshotFile.type)) {
      return NextResponse.json({ error: 'Nur JPEG, PNG oder WebP erlaubt' }, { status: 400 })
    }

    const timestamp = Date.now()
    const safeName = screenshotFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `design-requests/${restaurantId}/${timestamp}-${safeName}`

    const admin = createSupabaseAdmin()
    const arrayBuffer = await screenshotFile.arrayBuffer()
    const { error: uploadError } = await admin.storage
      .from('branding')
      .upload(storagePath, arrayBuffer, {
        contentType: screenshotFile.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: 'Upload fehlgeschlagen: ' + uploadError.message }, { status: 500 })
    }

    const { data: publicUrlData } = admin.storage.from('branding').getPublicUrl(storagePath)
    screenshotUrl = publicUrlData.publicUrl
  }

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('design_requests')
    .insert({
      restaurant_id: restaurantId,
      description: descriptionStr || null,
      screenshot_url: screenshotUrl,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data }, { status: 201 })
}
