import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const resend = new Resend(process.env.RESEND_API_KEY!)
const FROM = process.env.RESEND_FROM ?? 'onboarding@resend.dev'
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

type EmailType = 'reservation_guest' | 'reservation_status' | 'order_confirmation'

export async function POST(request: NextRequest) {
  // 30 emails per IP per hour
  const ip = getClientIp(request.headers)
  if (!await rateLimit(`email:${ip}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen.' }, { status: 429 })
  }

  // Shared secret — prevents open relay abuse
  const secret = request.headers.get('x-email-secret')
  if (secret !== process.env.EMAIL_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { type, to, data } = body as {
    type: EmailType
    to: string
    data: Record<string, unknown>
  }

  if (!to || !type) {
    return NextResponse.json({ error: 'Fehlende Parameter' }, { status: 400 })
  }

  if (!EMAIL_REGEX.test(to)) {
    return NextResponse.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400 })
  }

  let subject = ''
  let html = ''

  if (type === 'reservation_guest') {
    const raw = data as {
      restaurant_name: string
      customer_name: string
      date: string
      time_from: string
      guests: number
      table_label?: string
      note?: string
    }
    const restaurant_name = escapeHtml(raw.restaurant_name)
    const customer_name = escapeHtml(raw.customer_name)
    const date = escapeHtml(raw.date)
    const time_from = escapeHtml(raw.time_from)
    const guests = Number(raw.guests)
    const table_label = raw.table_label ? escapeHtml(raw.table_label) : null
    const note = raw.note ? escapeHtml(raw.note) : null

    const dateFormatted = new Date(date + 'T00:00:00').toLocaleDateString('de-DE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    subject = `Reservierungsanfrage bei ${restaurant_name} erhalten`
    html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
        <h2 style="color:#111;margin-bottom:4px">Danke, ${customer_name}!</h2>
        <p style="color:#555;margin-top:0">Deine Reservierungsanfrage bei <strong>${restaurant_name}</strong> ist eingegangen.</p>
        <div style="background:#f5f5f5;border-radius:12px;padding:20px;margin:24px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="color:#888;font-size:13px;padding:6px 0">Datum</td><td style="font-weight:600;font-size:14px">${dateFormatted}</td></tr>
            <tr><td style="color:#888;font-size:13px;padding:6px 0">Uhrzeit</td><td style="font-weight:600;font-size:14px">${time_from.slice(0, 5)} Uhr</td></tr>
            <tr><td style="color:#888;font-size:13px;padding:6px 0">Personen</td><td style="font-weight:600;font-size:14px">${guests}</td></tr>
            ${table_label ? `<tr><td style="color:#888;font-size:13px;padding:6px 0">Tisch</td><td style="font-weight:600;font-size:14px">${table_label}</td></tr>` : ''}
            ${note ? `<tr><td style="color:#888;font-size:13px;padding:6px 0">Notiz</td><td style="font-size:14px;font-style:italic">${note}</td></tr>` : ''}
          </table>
        </div>
      </div>
    `
  } else if (type === 'reservation_status') {
    const raw = data as {
      restaurant_name: string
      customer_name: string
      date: string
      time_from: string
      guests: number
      status: 'confirmed' | 'cancelled'
    }
    const restaurant_name = escapeHtml(raw.restaurant_name)
    const customer_name = escapeHtml(raw.customer_name)
    const date = escapeHtml(raw.date)
    const time_from = escapeHtml(raw.time_from)
    const guests = Number(raw.guests)
    const status = raw.status === 'confirmed' ? 'confirmed' : 'cancelled'
    const confirmed = status === 'confirmed'

    const dateFormatted = new Date(date + 'T00:00:00').toLocaleDateString('de-DE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    subject = confirmed
      ? `Reservierung bestätigt – ${restaurant_name}`
      : `Reservierung abgesagt – ${restaurant_name}`
    html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
        <div style="background:${confirmed ? '#ecfdf5' : '#fef2f2'};border-radius:12px;padding:16px 20px;margin-bottom:20px">
          <p style="margin:0;font-weight:700;color:${confirmed ? '#10b981' : '#ef4444'}">
            ${confirmed ? '✓ Reservierung bestätigt' : '✕ Reservierung abgesagt'}
          </p>
        </div>
        <p>Hallo ${customer_name},</p>
        <p style="color:#555">${confirmed
          ? `deine Reservierung bei <strong>${restaurant_name}</strong> wurde bestätigt.`
          : `leider müssen wir deine Reservierung bei <strong>${restaurant_name}</strong> absagen.`
        }</p>
        <div style="background:#f5f5f5;border-radius:12px;padding:20px;margin:20px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="color:#888;font-size:13px;padding:6px 0">Datum</td><td style="font-weight:600;font-size:14px">${dateFormatted}</td></tr>
            <tr><td style="color:#888;font-size:13px;padding:6px 0">Uhrzeit</td><td style="font-weight:600;font-size:14px">${time_from.slice(0, 5)} Uhr</td></tr>
            <tr><td style="color:#888;font-size:13px;padding:6px 0">Personen</td><td style="font-weight:600;font-size:14px">${guests}</td></tr>
          </table>
        </div>
      </div>
    `
  } else if (type === 'order_confirmation') {
    const raw = data as {
      restaurant_name: string
      customer_name: string
      order_type: 'delivery' | 'pickup'
      items: { name: string; qty: number; price: number }[]
      total: number
      delivery_address?: { street: string; city: string; zip: string }
    }
    const restaurant_name = escapeHtml(raw.restaurant_name)
    const customer_name = escapeHtml(raw.customer_name)
    const total = Number(raw.total)
    const items = raw.items.map(i => ({
      name: escapeHtml(i.name),
      qty: Number(i.qty),
      price: Number(i.price),
    }))

    const itemsHtml = items.map(i =>
      `<tr><td style="padding:6px 0;font-size:14px">${i.qty}× ${i.name}</td>
       <td style="padding:6px 0;font-size:14px;text-align:right">${(i.price * i.qty / 100).toFixed(2)} €</td></tr>`
    ).join('')

    subject = `Bestellung bestätigt – ${restaurant_name}`
    html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
        <h2>Bestellung eingegangen!</h2>
        <p style="color:#555">Hallo ${customer_name}, deine Bestellung bei <strong>${restaurant_name}</strong> wurde bestätigt.</p>
        <div style="background:#f5f5f5;border-radius:12px;padding:20px;margin:20px 0">
          <table style="width:100%;border-collapse:collapse">
            ${itemsHtml}
            <tr style="border-top:1px solid #ddd">
              <td style="padding:10px 0 0;font-weight:700">Gesamt</td>
              <td style="padding:10px 0 0;font-weight:700;text-align:right">${(total / 100).toFixed(2)} €</td>
            </tr>
          </table>
        </div>
        ${raw.order_type === 'delivery' && raw.delivery_address ? `
          <p style="color:#555;font-size:14px"><strong>Lieferadresse:</strong><br>
          ${escapeHtml(raw.delivery_address.street)}, ${escapeHtml(raw.delivery_address.zip)} ${escapeHtml(raw.delivery_address.city)}</p>
        ` : `<p style="color:#555;font-size:14px"><strong>Abholung</strong> im Restaurant</p>`}
      </div>
    `
  } else {
    return NextResponse.json({ error: 'Unbekannter Email-Typ' }, { status: 400 })
  }

  try {
    await resend.emails.send({ from: FROM, to, subject, html })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Email send error:', err)
    return NextResponse.json({ error: 'Email konnte nicht gesendet werden' }, { status: 500 })
  }
}
