export type BaseTemplateName = 'birthday' | 'comeback' | 'seasonal' | 'loyalty' | 'general'

function wrap(primaryColor: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{restaurant_name}}</title>
</head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
      ${body}
      <!-- Footer -->
      <tr><td style="padding:28px 40px;background:#f8f8f8;border-top:1px solid #ebebeb;text-align:center;">
        <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.8;">
          Du erhältst diese E-Mail, weil du Angebote von <strong style="color:#888;">{{restaurant_name}}</strong> abonniert hast.<br>
          <a href="{{unsubscribe_url}}" style="color:#aaaaaa;text-decoration:underline;">Abmelden</a>
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
  <tr><td style="background:${c};padding:48px 40px 36px;text-align:center;">
    <p style="margin:0 0 8px;font-size:52px;line-height:1;">🎂</p>
    <h1 style="margin:0;color:#ffffff;font-size:13px;font-weight:600;letter-spacing:3px;text-transform:uppercase;opacity:0.85;">{{restaurant_name}}</h1>
  </td></tr>
  <!-- Hero -->
  <tr><td style="padding:48px 40px 32px;text-align:center;">
    <h2 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#111111;line-height:1.2;">{{hero_text}}</h2>
    <p style="margin:0;font-size:16px;color:#666666;line-height:1.7;max-width:420px;margin-left:auto;margin-right:auto;">{{body_text}}</p>
  </td></tr>
  <!-- Discount Code -->
  {{discount_block}}
  <!-- CTA -->
  <tr><td style="padding:8px 40px 52px;text-align:center;">
    <a href="{{cta_url}}" style="display:inline-block;background:${c};color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.3px;">{{cta_text}}</a>
  </td></tr>
`)

const COMEBACK = (c: string) => wrap(c, `
  <!-- Header -->
  <tr><td style="background:${c};padding:48px 40px 36px;text-align:center;">
    <p style="margin:0 0 8px;font-size:48px;line-height:1;">💌</p>
    <h1 style="margin:0;color:#ffffff;font-size:13px;font-weight:600;letter-spacing:3px;text-transform:uppercase;opacity:0.85;">{{restaurant_name}}</h1>
  </td></tr>
  <!-- Hero -->
  <tr><td style="padding:48px 40px 32px;text-align:center;">
    <h2 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#111111;line-height:1.2;">{{hero_text}}</h2>
    <p style="margin:0;font-size:16px;color:#666666;line-height:1.7;max-width:420px;margin-left:auto;margin-right:auto;">{{body_text}}</p>
  </td></tr>
  <!-- Discount Code -->
  {{discount_block}}
  <!-- CTA -->
  <tr><td style="padding:8px 40px 52px;text-align:center;">
    <a href="{{cta_url}}" style="display:inline-block;background:${c};color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.3px;">{{cta_text}}</a>
  </td></tr>
`)

const SEASONAL = (c: string) => wrap(c, `
  <!-- Header -->
  <tr><td style="background:${c};padding:48px 40px 36px;text-align:center;">
    <p style="margin:0 0 8px;font-size:48px;line-height:1;">🌿</p>
    <h1 style="margin:0;color:#ffffff;font-size:13px;font-weight:600;letter-spacing:3px;text-transform:uppercase;opacity:0.85;">{{restaurant_name}}</h1>
  </td></tr>
  <!-- Divider accent -->
  <tr><td style="height:3px;background:linear-gradient(90deg,transparent,${c}66,transparent);"></td></tr>
  <!-- Hero -->
  <tr><td style="padding:48px 40px 32px;text-align:center;">
    <h2 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#111111;line-height:1.2;">{{hero_text}}</h2>
    <p style="margin:0;font-size:16px;color:#666666;line-height:1.7;max-width:420px;margin-left:auto;margin-right:auto;">{{body_text}}</p>
  </td></tr>
  <!-- Discount Code -->
  {{discount_block}}
  <!-- CTA -->
  <tr><td style="padding:8px 40px 52px;text-align:center;">
    <a href="{{cta_url}}" style="display:inline-block;background:${c};color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.3px;">{{cta_text}}</a>
  </td></tr>
`)

const LOYALTY = (c: string) => wrap(c, `
  <!-- Header -->
  <tr><td style="background:#111111;padding:48px 40px 36px;text-align:center;">
    <p style="margin:0 0 8px;font-size:48px;line-height:1;">⭐</p>
    <h1 style="margin:0;color:#ffffff;font-size:13px;font-weight:600;letter-spacing:3px;text-transform:uppercase;opacity:0.85;">{{restaurant_name}}</h1>
    <p style="margin:10px 0 0;color:${c};font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;">Exklusiv für treue Gäste</p>
  </td></tr>
  <!-- Hero -->
  <tr><td style="padding:48px 40px 32px;text-align:center;">
    <h2 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#111111;line-height:1.2;">{{hero_text}}</h2>
    <p style="margin:0;font-size:16px;color:#666666;line-height:1.7;max-width:420px;margin-left:auto;margin-right:auto;">{{body_text}}</p>
  </td></tr>
  <!-- Discount Code -->
  {{discount_block}}
  <!-- CTA -->
  <tr><td style="padding:8px 40px 52px;text-align:center;">
    <a href="{{cta_url}}" style="display:inline-block;background:${c};color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.3px;">{{cta_text}}</a>
  </td></tr>
`)

const GENERAL = (c: string) => wrap(c, `
  <!-- Header -->
  <tr><td style="background:${c};padding:40px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:13px;font-weight:600;letter-spacing:3px;text-transform:uppercase;opacity:0.85;">{{restaurant_name}}</h1>
  </td></tr>
  <!-- Hero -->
  <tr><td style="padding:48px 40px 32px;text-align:center;">
    <h2 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#111111;line-height:1.2;">{{hero_text}}</h2>
    <p style="margin:0;font-size:16px;color:#666666;line-height:1.7;max-width:420px;margin-left:auto;margin-right:auto;">{{body_text}}</p>
  </td></tr>
  <!-- Discount Code -->
  {{discount_block}}
  <!-- CTA -->
  <tr><td style="padding:8px 40px 52px;text-align:center;">
    <a href="{{cta_url}}" style="display:inline-block;background:${c};color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.3px;">{{cta_text}}</a>
  </td></tr>
`)

export const DISCOUNT_BLOCK = (c: string) => `
  <tr><td style="padding:0 40px 36px;text-align:center;">
    <div style="display:inline-block;background:#fafafa;border:2px dashed ${c};border-radius:12px;padding:20px 32px;min-width:200px;">
      <p style="margin:0 0 6px;font-size:10px;color:#aaaaaa;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Dein Rabattcode</p>
      <p style="margin:0;font-size:26px;font-weight:900;color:${c};letter-spacing:4px;font-family:'Courier New',monospace;">{{discount_code}}</p>
      <p style="margin:8px 0 0;font-size:13px;color:#888888;font-weight:500;">{{discount_percent}}% Rabatt auf deine Bestellung</p>
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
  return fn(primaryColor)
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
