export type BaseTemplateName = 'birthday' | 'comeback' | 'seasonal' | 'loyalty' | 'general'

// Shared wrapper — table-based for email client compatibility
function wrap(primaryColor: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{restaurant_name}}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      ${body}
      <!-- Footer -->
      <tr><td style="padding:24px 32px;background:#fafafa;border-top:1px solid #eeeeee;text-align:center;">
        <p style="margin:0;font-size:12px;color:#999999;line-height:1.6;">
          Du erhältst diese E-Mail, weil du Angebote von <strong>{{restaurant_name}}</strong> abonniert hast.<br>
          <a href="{{unsubscribe_url}}" style="color:${primaryColor};text-decoration:none;">Abmelden</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

const BIRTHDAY = (c: string) => wrap(c, `
  <!-- Header -->
  <tr><td style="background:${c};padding:40px 32px;text-align:center;">
    <p style="margin:0;font-size:48px;line-height:1;">🎂</p>
    <h1 style="margin:12px 0 0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">{{restaurant_name}}</h1>
  </td></tr>
  <!-- Hero -->
  <tr><td style="padding:40px 32px 24px;text-align:center;">
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#1a1a1a;">{{hero_text}}</h2>
    <p style="margin:0;font-size:16px;color:#555555;line-height:1.6;">{{body_text}}</p>
  </td></tr>
  <!-- Discount Code -->
  {{discount_block}}
  <!-- CTA -->
  <tr><td style="padding:8px 32px 40px;text-align:center;">
    <a href="{{cta_url}}" style="display:inline-block;background:${c};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:700;">{{cta_text}}</a>
  </td></tr>
`)

const COMEBACK = (c: string) => wrap(c, `
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,${c},${c}cc);padding:40px 32px;text-align:center;">
    <p style="margin:0;font-size:40px;line-height:1;">💌</p>
    <h1 style="margin:12px 0 0;color:#ffffff;font-size:24px;font-weight:800;">{{restaurant_name}}</h1>
  </td></tr>
  <!-- Hero -->
  <tr><td style="padding:40px 32px 24px;text-align:center;">
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#1a1a1a;">{{hero_text}}</h2>
    <p style="margin:0;font-size:16px;color:#555555;line-height:1.6;">{{body_text}}</p>
  </td></tr>
  {{discount_block}}
  <tr><td style="padding:8px 32px 40px;text-align:center;">
    <a href="{{cta_url}}" style="display:inline-block;background:${c};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:700;">{{cta_text}}</a>
  </td></tr>
`)

const SEASONAL = (c: string) => wrap(c, `
  <!-- Header -->
  <tr><td style="background:${c};padding:40px 32px;text-align:center;">
    <p style="margin:0;font-size:40px;line-height:1;">🌿</p>
    <h1 style="margin:12px 0 0;color:#ffffff;font-size:24px;font-weight:800;">{{restaurant_name}}</h1>
  </td></tr>
  <!-- Divider -->
  <tr><td style="height:4px;background:linear-gradient(90deg,${c}33,${c},${c}33);"></td></tr>
  <!-- Hero -->
  <tr><td style="padding:40px 32px 24px;text-align:center;">
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#1a1a1a;">{{hero_text}}</h2>
    <p style="margin:0;font-size:16px;color:#555555;line-height:1.6;">{{body_text}}</p>
  </td></tr>
  {{discount_block}}
  <tr><td style="padding:8px 32px 40px;text-align:center;">
    <a href="{{cta_url}}" style="display:inline-block;background:${c};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:700;">{{cta_text}}</a>
  </td></tr>
`)

const LOYALTY = (c: string) => wrap(c, `
  <!-- Header -->
  <tr><td style="background:#1a1a1a;padding:40px 32px;text-align:center;">
    <p style="margin:0;font-size:40px;line-height:1;">⭐</p>
    <h1 style="margin:12px 0 0;color:#ffffff;font-size:24px;font-weight:800;">{{restaurant_name}}</h1>
    <p style="margin:8px 0 0;color:${c};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Exklusiv für treue Gäste</p>
  </td></tr>
  <!-- Hero -->
  <tr><td style="padding:40px 32px 24px;text-align:center;">
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#1a1a1a;">{{hero_text}}</h2>
    <p style="margin:0;font-size:16px;color:#555555;line-height:1.6;">{{body_text}}</p>
  </td></tr>
  {{discount_block}}
  <tr><td style="padding:8px 32px 40px;text-align:center;">
    <a href="{{cta_url}}" style="display:inline-block;background:${c};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:700;">{{cta_text}}</a>
  </td></tr>
`)

const GENERAL = (c: string) => wrap(c, `
  <!-- Header -->
  <tr><td style="background:${c};padding:32px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;">{{restaurant_name}}</h1>
  </td></tr>
  <!-- Hero -->
  <tr><td style="padding:40px 32px 24px;text-align:center;">
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#1a1a1a;">{{hero_text}}</h2>
    <p style="margin:0;font-size:16px;color:#555555;line-height:1.6;">{{body_text}}</p>
  </td></tr>
  {{discount_block}}
  <tr><td style="padding:8px 32px 40px;text-align:center;">
    <a href="{{cta_url}}" style="display:inline-block;background:${c};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:700;">{{cta_text}}</a>
  </td></tr>
`)

const DISCOUNT_BLOCK = (c: string) => `
  <tr><td style="padding:0 32px 24px;text-align:center;">
    <div style="display:inline-block;border:2px dashed ${c};border-radius:8px;padding:12px 24px;">
      <p style="margin:0 0 4px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;">Ihr Rabattcode</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:${c};letter-spacing:3px;">{{discount_code}}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#999;">{{discount_percent}}% Rabatt auf Ihre Bestellung</p>
    </div>
  </td></tr>`

const TEMPLATES: Record<BaseTemplateName, (color: string) => string> = {
  birthday: BIRTHDAY,
  comeback: COMEBACK,
  seasonal: SEASONAL,
  loyalty: LOYALTY,
  general: GENERAL,
}

export function getBaseTemplate(name: BaseTemplateName, primaryColor: string): string {
  const fn = TEMPLATES[name] ?? TEMPLATES.general
  const html = fn(primaryColor)
  return html.replace('{{discount_block}}', DISCOUNT_BLOCK(primaryColor))
}

export function getBaseTemplateForTrigger(triggerType: string, primaryColor: string): string {
  const map: Record<string, BaseTemplateName> = {
    birthday: 'birthday',
    inactivity_14d: 'comeback',
    seasonal: 'seasonal',
    post_order: 'general',
    scheduled: 'general',
    manual: 'general',
  }
  return getBaseTemplate(map[triggerType] ?? 'general', primaryColor)
}
