import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const ALLOWED_UPLOAD_TYPES = ['hero', 'logo', 'gallery'] as const

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const token = auth?.replace('Bearer ', '').trim()
  if (!token) return { user: null }
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { data: { user } } = await client.auth.getUser(token)
  return { user }
}

async function checkOwnership(userId: string, restaurantId: string): Promise<boolean> {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', userId)
    .maybeSingle()
  return !!data
}

// POST — upload hero image or logo
export async function POST(req: NextRequest) {
  const { user } = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const restaurantId = form.get('restaurant_id')
  const file = form.get('file')
  const uploadType = form.get('type')

  if (typeof restaurantId !== 'string' || !restaurantId) {
    return NextResponse.json({ error: 'restaurant_id erforderlich' }, { status: 400 })
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Datei erforderlich' }, { status: 400 })
  }
  if (
    typeof uploadType !== 'string' ||
    !(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(uploadType)
  ) {
    return NextResponse.json({ error: 'type muss "hero", "logo" oder "gallery" sein' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Datei zu groß (max. 8 MB)' }, { status: 400 })
  }
  if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: 'Nur JPEG, PNG oder WebP erlaubt' }, { status: 400 })
  }

  const isOwner = await checkOwnership(user.id, restaurantId)
  if (!isOwner) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const timestamp = Date.now()
  const storagePath = uploadType === 'gallery'
  ? `landing-pages/${restaurantId}/gallery/${timestamp}.${ext}`
  : `landing-pages/${restaurantId}/${uploadType}-${timestamp}.${ext}`

  const admin = createSupabaseAdmin()
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await admin.storage
    .from('branding')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    console.error('landing-page upload error:', uploadError)
    return NextResponse.json({ error: 'Upload fehlgeschlagen: ' + uploadError.message }, { status: 500 })
  }

  const { data: urlData } = admin.storage.from('branding').getPublicUrl(storagePath)
  return NextResponse.json({ url: urlData.publicUrl })
}
