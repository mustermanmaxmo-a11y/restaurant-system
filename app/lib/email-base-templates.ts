export type BaseTemplateName = 'birthday' | 'comeback' | 'seasonal' | 'loyalty' | 'general'

function wrap(body: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{restaurant_name}}</title>
</head>
<body style="margin:0;padding:0;background:#efefef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#efefef;padding:40px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.12);">
      ${body}
      <!-- Footer -->
      <tr><td style="padding:32px 48px;background:#f9f9f9;border-top:1px solid #ebebeb;text-align:center;">
        <p style="margin:0 0 8px;font-size:12px;color:#c0c0c0;line-height:1.8;">
          Du erhältst diese E-Mail, weil du Angebote von<br>
          <strong style="color:#aaaaaa;">{{restaurant_name}}</strong> abonniert hast.
        </p>
        <a href="{{unsubscribe_url}}" style="font-size:11px;color:#cccccc;text-decoration:underline;">Abmelden</a>
      </td></tr>
    </table>
    <!-- Bottom spacer -->
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="padding:20px 0;text-align:center;">
        <p style="margin:0;font-size:11px;color:#bbbbbb;">Powered by RestaurantOS</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

// Header with logo or restaurant name as fallback — receives {{logo_block}} pre-rendered
function header(color: string, emoji: string, tagline: string): string {
  return `
  <!-- Header -->
  <tr><td style="background:${color};padding:40px 48px 36px;text-align:center;">
    {{logo_block}}
    <p style="margin:16px 0 6px;font-size:32px;line-height:1;">${emoji}</p>
    <p style="margin:0;font-size:12px;font-weight:600;color:rgba(255,255,255,0.75);letter-spacing:2.5px;text-transform:uppercase;">${tagline}</p>
  </td></tr>`
}

function hero(): string {
  return `
  <!-- Hero -->
  <tr><td style="padding:52px 48px 36px;text-align:center;">
    <h2 style="margin:0 0 18px;font-size:30px;font-weight:800;color:#111111;line-height:1.15;letter-spacing:-0.5px;">{{hero_text}}</h2>
    <p style="margin:0;font-size:16px;color:#777777;line-height:1.75;max-width:400px;display:block;margin-left:auto;margin-right:auto;">{{body_text}}</p>
  </td></tr>`
}

function cta(color: string): string {
  return `
  <!-- CTA -->
  <tr><td style="padding:12px 48px 56px;text-align:center;">
    <a href="{{cta_url}}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:18px 48px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.2px;box-shadow:0 4px 16px rgba(0,0,0,0.15);">{{cta_text}}</a>
  </td></tr>`
}

const BIRTHDAY = (c: string) => wrap(`
  ${header(c, '🎂', 'Herzlichen Glückwunsch')}
  ${hero()}
  <!-- Discount Code -->
  {{discount_block}}
  ${cta(c)}
`)

const COMEBACK = (c: string) => wrap(`
  ${header(c, '💌', 'Wir vermissen dich')}
  ${hero()}
  <!-- Discount Code -->
  {{discount_block}}
  ${cta(c)}
`)

const SEASONAL = (c: string) => wrap(`
  ${header(c, '🌿', 'Saisonales Angebot')}
  <!-- Accent line -->
  <tr><td style="height:3px;background:linear-gradient(90deg,transparent,${c}55,transparent);"></td></tr>
  ${hero()}
  <!-- Discount Code -->
  {{discount_block}}
  ${cta(c)}
`)

const LOYALTY = (c: string) => wrap(`
  <!-- Header dark VIP -->
  <tr><td style="background:#1a1a1a;padding:40px 48px 36px;text-align:center;">
    {{logo_block}}
    <p style="margin:16px 0 6px;font-size:32px;line-height:1;">⭐</p>
    <p style="margin:0;font-size:12px;font-weight:700;color:${c};letter-spacing:3px;text-transform:uppercase;">Exklusiv für treue Gäste</p>
  </td></tr>
  ${hero()}
  <!-- Discount Code -->
  {{discount_block}}
  ${cta(c)}
`)

const GENERAL = (c: string) => wrap(`
  ${header(c, '🍽️', 'Nachricht von uns')}
  ${hero()}
  <!-- Discount Code -->
  {{discount_block}}
  ${cta(c)}
`)

export const DISCOUNT_BLOCK = (c: string) => `
  <tr><td style="padding:0 48px 40px;text-align:center;">
    <div style="background:#fafafa;border:2px dashed ${c};border-radius:14px;padding:24px 36px;display:inline-block;min-width:220px;">
      <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:#bbbbbb;text-transform:uppercase;letter-spacing:2.5px;">Dein Gutscheincode</p>
      <p style="margin:0;font-size:28px;font-weight:900;color:${c};letter-spacing:5px;font-family:'Courier New',Courier,monospace;">{{discount_code}}</p>
      <p style="margin:10px 0 0;font-size:13px;color:#999999;font-weight:500;">{{discount_percent}}% Rabatt auf deine Bestellung</p>
    </div>
  </td></tr>`

export function buildLogoBlock(logoUrl: string | null | undefined, restaurantName: string): string {
  if (logoUrl) {
    return `<img src="${logoUrl}" alt="${restaurantName}" height="52" style="max-width:180px;height:52px;object-fit:contain;display:block;margin:0 auto;">`
  }
  return `<p style="margin:0;font-size:13px;font-weight:700;color:rgba(255,255,255,0.9);letter-spacing:2px;text-transform:uppercase;">${restaurantName}</p>`
}

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
