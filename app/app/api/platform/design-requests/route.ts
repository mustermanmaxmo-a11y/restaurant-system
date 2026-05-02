import { NextResponse } from 'next/server'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export const dynamic = 'force-dynamic'

// POST — Restaurant-Admin legt neue Anfrage an
export async function POST(req: Request) {
  const supabase = await createSupabaseServerSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { message, restaurant_id } = body

  if (!message || typeof message !== 'string' || message.trim().length < 10) {
    return NextResponse.json({ error: 'Beschreibung zu kurz (min. 10 Zeichen).' }, { status: 400 })
  }
  if (!restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id fehlt.' }, { status: 400 })
  }

  // Sicherstellen dass Restaurant dem User gehört
  const { data: resto } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('id', restaurant_id)
    .eq('owner_id', user.id)
    .single()

  if (!resto) return NextResponse.json({ error: 'Kein Zugriff auf dieses Restaurant.' }, { status: 403 })

  // Prüfen ob bereits eine offene Anfrage existiert
  const { data: existing } = await supabase
    .from('design_requests')
    .select('id, status')
    .eq('restaurant_id', restaurant_id)
    .in('status', ['pending', 'in_progress'])
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Es existiert bereits eine offene Anfrage.', existing }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('design_requests')
    .insert({ restaurant_id, user_id: user.id, message: message.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Benachrichtigung an Platform-Owner
  try {
    const admin = createSupabaseAdmin()
    const { data: settings } = await admin
      .from('platform_settings')
      .select('notification_email')
      .single()
    const notifyEmail = settings?.notification_email
    if (notifyEmail) {
      const resend = new Resend(process.env.RESEND_API_KEY!)
      const FROM = process.env.RESEND_FROM ?? 'onboarding@resend.dev'
      const restaurantName = escapeHtml((resto as { id: string; name?: string }).name ?? restaurant_id)
      const safeMessage = escapeHtml(message.trim())
      await resend.emails.send({
        from: FROM,
        to: notifyEmail,
        subject: `Neue Design-Anfrage: ${restaurantName}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
            <h2 style="margin-bottom:4px">Neue Design-Anfrage</h2>
            <p style="color:#555;margin-top:0">Restaurant: <strong>${restaurantName}</strong></p>
            <div style="background:#f5f5f5;border-radius:12px;padding:20px;margin:20px 0">
              <p style="margin:0;font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap">${safeMessage}</p>
            </div>
            <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/platform/design-requests"
               style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
              Anfrage ansehen →
            </a>
          </div>
        `,
      })
    }
  } catch (emailErr) {
    console.error('Design-Anfrage Benachrichtigung fehlgeschlagen:', emailErr)
    // Insert war erfolgreich — keinen Fehler zurückgeben
  }

  return NextResponse.json({ ok: true, data })
}

// PATCH — Platform Owner aktualisiert Status einer Anfrage
export async function PATCH(req: Request) {
  const supabase = await createSupabaseServerSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data: isOwner } = await supabase.rpc('is_platform_owner')
  if (isOwner !== true) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { id, status, admin_note } = body

  if (!id) return NextResponse.json({ error: 'id fehlt.' }, { status: 400 })
  if (!['pending', 'in_progress', 'done'].includes(status)) {
    return NextResponse.json({ error: 'Ungültiger Status.' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('design_requests')
    .update({ status, admin_note: admin_note ?? null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}
