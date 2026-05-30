import crypto from 'crypto'

export interface RatingEmailInput {
  order: { id: string; customer_name?: string | null }
  restaurant: {
    name: string
    logo_url: string | null
    primary_color?: string | null
  }
  unsubscribeSecret: string
  appUrl: string
  /** Full unsubscribe URL (with token), used in footer + List-Unsubscribe header */
  unsubscribeUrl: string
}

export interface RatingEmailOutput {
  subject: string
  html: string
  text: string
  headers: Record<string, string>
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function computeStarToken(orderId: string, stars: number, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${orderId}:${stars}`).digest('hex').slice(0, 32)
}

export function buildRatingEmailHtml(input: RatingEmailInput): RatingEmailOutput {
  const { order, restaurant, unsubscribeSecret, appUrl, unsubscribeUrl } = input
  const customerName = order.customer_name?.trim() || ''
  const primary = restaurant.primary_color || '#EA580C'

  // 5 HMAC-tokenized star links → /api/feedback?o=...&s=N&t=...
  const starLinks = [1, 2, 3, 4, 5].map(n => {
    const t = computeStarToken(order.id, n, unsubscribeSecret)
    return `${appUrl}/api/feedback?o=${order.id}&s=${n}&t=${t}`
  })

  const starsHtml = starLinks.map(href =>
    `<a href="${href}" style="display:inline-block;padding:6px 8px;text-decoration:none;font-size:32px;line-height:1;color:#d4d4d8;">&#9733;</a>`
  ).join('')

  const logoHtml = restaurant.logo_url
    ? `<img src="${escapeHtml(restaurant.logo_url)}" alt="${escapeHtml(restaurant.name)}" style="max-height:48px;max-width:180px;display:block;margin:0 auto;">`
    : `<div style="font-size:20px;font-weight:700;color:#0a0a0a;">${escapeHtml(restaurant.name)}</div>`

  const subject = `Wie war's bei ${restaurant.name}? ⭐`

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:32px 48px 16px;text-align:center;">${logoHtml}</td></tr>
      <tr><td style="padding:8px 48px 16px;">
        <p style="margin:0;font-size:16px;color:#0a0a0a;line-height:1.5;">${customerName ? `Hallo ${escapeHtml(customerName)},` : 'Hallo,'}</p>
        <p style="margin:12px 0 0;font-size:16px;color:#0a0a0a;line-height:1.5;">danke für deinen Besuch bei <strong>${escapeHtml(restaurant.name)}</strong>! Mit einem Klick kannst du uns bewerten.</p>
      </td></tr>
      <tr><td style="padding:8px 48px 16px;">
        <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;padding:24px 20px;text-align:center;">
          <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:0.12em;">Wie war dein Erlebnis?</p>
          <div style="margin:0 0 8px;">${starsHtml}</div>
          <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">Ein Klick reicht — danach kannst du optional Feedback hinzufügen.</p>
        </div>
      </td></tr>
      <tr><td style="padding:16px 48px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.5;">
          Du bekommst diese Email weil du bei deiner Bestellung "Angebote per Email" aktiviert hast.<br>
          <a href="${escapeHtml(unsubscribeUrl)}" style="color:#71717a;text-decoration:underline;">Abmelden</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

  const text = `${customerName ? `Hallo ${customerName},` : 'Hallo,'}

danke für deinen Besuch bei ${restaurant.name}!

Bewerte uns mit einem Klick:
⭐ 1 Stern: ${starLinks[0]}
⭐⭐ 2 Sterne: ${starLinks[1]}
⭐⭐⭐ 3 Sterne: ${starLinks[2]}
⭐⭐⭐⭐ 4 Sterne: ${starLinks[3]}
⭐⭐⭐⭐⭐ 5 Sterne: ${starLinks[4]}

Abmelden: ${unsubscribeUrl}
`

  const headers: Record<string, string> = {
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
  // Suppress unused warning for primary
  void primary

  return { subject, html, text, headers }
}
