export interface CampaignEmailInput {
  customerName: string | null
  restaurantName: string
  restaurantLogoUrl: string | null
  primaryColor: string
  subject: string
  headline: string
  bodyText: string
  code: string | null
  discountLabel: string | null   // z.B. "10 % Rabatt" oder "5 € Rabatt" oder null
  expiresAt: Date | null
  ctaUrl: string
  unsubscribeUrl: string
}

export interface CampaignEmailOutput {
  subject: string
  html: string
  text: string
  headers: Record<string, string>
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function buildCampaignEmail(input: CampaignEmailInput): CampaignEmailOutput {
  const {
    customerName, restaurantName, restaurantLogoUrl, primaryColor,
    subject, headline, bodyText, code, discountLabel, expiresAt,
    ctaUrl, unsubscribeUrl,
  } = input

  const greeting = customerName ? `Hallo ${escapeHtml(customerName)},` : 'Hallo,'

  const logoHtml = restaurantLogoUrl
    ? `<img src="${escapeHtml(restaurantLogoUrl)}" alt="${escapeHtml(restaurantName)}" style="max-height:48px;max-width:180px;display:block;margin:0 auto;">`
    : `<div style="font-size:20px;font-weight:700;color:#0a0a0a;">${escapeHtml(restaurantName)}</div>`

  const codeHtml = code ? `
      <tr><td style="padding:8px 48px 4px;text-align:center;">
        <div style="border:2px dashed #d4d4d8;border-radius:12px;padding:16px;display:inline-block;min-width:200px;">
          <p style="margin:0;font-size:1.4rem;font-weight:800;letter-spacing:0.15em;color:#0a0a0a;font-family:monospace;">${escapeHtml(code)}</p>
        </div>
        ${expiresAt ? `<p style="margin:8px 0 0;font-size:12px;color:#71717a;">Gültig bis ${formatDate(expiresAt)}</p>` : ''}
      </td></tr>` : ''

  const discountBadge = discountLabel
    ? `<p style="margin:0 0 12px;font-size:1.1rem;font-weight:800;color:${escapeHtml(primaryColor)};">${escapeHtml(discountLabel)}</p>`
    : ''

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:32px 48px 16px;text-align:center;">${logoHtml}</td></tr>
      <tr><td style="padding:8px 48px;text-align:center;">
        <h1 style="margin:0;font-size:1.7rem;font-weight:800;color:#0a0a0a;line-height:1.2;">${escapeHtml(headline)}</h1>
      </td></tr>
      <tr><td style="padding:12px 48px 8px;text-align:center;">
        <p style="margin:0 0 4px;font-size:15px;color:#0a0a0a;">${greeting}</p>
        ${discountBadge}
        <p style="margin:0;font-size:15px;color:#52525b;line-height:1.6;">${escapeHtml(bodyText)}</p>
      </td></tr>
      ${codeHtml}
      <tr><td style="padding:20px 48px 32px;text-align:center;">
        <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${escapeHtml(primaryColor)};color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:1rem;">Jetzt einlösen →</a>
      </td></tr>
      <tr><td style="padding:16px 48px 24px;text-align:center;border-top:1px solid #f4f4f5;">
        <p style="margin:0;font-size:12px;color:#a1a1aa;">
          Du bekommst diese Email weil du unsere Angebote abonniert hast.<br>
          <a href="${escapeHtml(unsubscribeUrl)}" style="color:#71717a;text-decoration:underline;">Abmelden</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

  const codeText = code
    ? `\nDein Code: ${code}${expiresAt ? `\nGültig bis: ${formatDate(expiresAt)}` : ''}\n`
    : ''

  const text = `${greeting}\n\n${headline}\n\n${bodyText}${codeText}\n${ctaUrl}\n\nAbmelden: ${unsubscribeUrl}`

  return {
    subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}
