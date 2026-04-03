import '@supabase/functions-js/edge-runtime.d.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM = Deno.env.get('RESEND_FROM') ?? 'onboarding@resend.dev'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend error: ${err}`)
  }
}

async function getRestaurantName(restaurantId: string): Promise<string> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/restaurants?id=eq.${restaurantId}&select=name`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  )
  const data = await res.json()
  return data[0]?.name ?? 'Das Restaurant'
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const { type, table, record, old_record } = payload

    // ── Neue Reservierung ──────────────────────────────────────────────
    if (table === 'reservations' && type === 'INSERT') {
      if (!record.customer_email) return new Response('no email', { status: 200 })

      const restaurantName = await getRestaurantName(record.restaurant_id)
      const dateFormatted = new Date(record.date + 'T00:00:00').toLocaleDateString('de-DE', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })

      await sendEmail(
        record.customer_email,
        `Reservierungsanfrage bei ${escapeHtml(restaurantName)} erhalten`,
        `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
          <h2>Danke, ${escapeHtml(record.customer_name)}!</h2>
          <p style="color:#555">Deine Reservierungsanfrage bei <strong>${escapeHtml(restaurantName)}</strong> ist eingegangen. Wir bestätigen sie so schnell wie möglich.</p>
          <div style="background:#f5f5f5;border-radius:12px;padding:20px;margin:24px 0">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="color:#888;font-size:13px;padding:6px 0">Datum</td><td style="font-weight:600;font-size:14px">${dateFormatted}</td></tr>
              <tr><td style="color:#888;font-size:13px;padding:6px 0">Uhrzeit</td><td style="font-weight:600;font-size:14px">${escapeHtml(record.time_from.slice(0, 5))} Uhr</td></tr>
              <tr><td style="color:#888;font-size:13px;padding:6px 0">Personen</td><td style="font-weight:600;font-size:14px">${record.guests}</td></tr>
              ${record.note ? `<tr><td style="color:#888;font-size:13px;padding:6px 0">Notiz</td><td style="font-size:14px;font-style:italic">${escapeHtml(record.note)}</td></tr>` : ''}
            </table>
          </div>
        </div>`
      )
    }

    // ── Reservierungsstatus geändert ───────────────────────────────────
    if (table === 'reservations' && type === 'UPDATE') {
      if (!record.customer_email) return new Response('no email', { status: 200 })
      if (old_record?.status === record.status) return new Response('no change', { status: 200 })
      if (!['confirmed', 'cancelled'].includes(record.status)) return new Response('irrelevant status', { status: 200 })

      const restaurantName = await getRestaurantName(record.restaurant_id)
      const confirmed = record.status === 'confirmed'
      const dateFormatted = new Date(record.date + 'T00:00:00').toLocaleDateString('de-DE', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })

      await sendEmail(
        record.customer_email,
        confirmed
          ? `Reservierung bestätigt – ${escapeHtml(restaurantName)}`
          : `Reservierung abgesagt – ${escapeHtml(restaurantName)}`,
        `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
          <div style="background:${confirmed ? '#ecfdf5' : '#fef2f2'};border-radius:12px;padding:16px 20px;margin-bottom:20px">
            <p style="margin:0;font-weight:700;color:${confirmed ? '#10b981' : '#ef4444'}">
              ${confirmed ? '✓ Reservierung bestätigt' : '✕ Reservierung abgesagt'}
            </p>
          </div>
          <p>Hallo ${escapeHtml(record.customer_name)},</p>
          <p style="color:#555">${confirmed
            ? `deine Reservierung bei <strong>${escapeHtml(restaurantName)}</strong> wurde bestätigt. Wir freuen uns auf deinen Besuch!`
            : `leider müssen wir deine Reservierung bei <strong>${escapeHtml(restaurantName)}</strong> absagen.`
          }</p>
          <div style="background:#f5f5f5;border-radius:12px;padding:20px;margin:20px 0">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="color:#888;font-size:13px;padding:6px 0">Datum</td><td style="font-weight:600;font-size:14px">${dateFormatted}</td></tr>
              <tr><td style="color:#888;font-size:13px;padding:6px 0">Uhrzeit</td><td style="font-weight:600;font-size:14px">${escapeHtml(record.time_from.slice(0, 5))} Uhr</td></tr>
              <tr><td style="color:#888;font-size:13px;padding:6px 0">Personen</td><td style="font-weight:600;font-size:14px">${record.guests}</td></tr>
            </table>
          </div>
        </div>`
      )
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('Edge Function error:', err)
    return new Response(String(err), { status: 500 })
  }
})
