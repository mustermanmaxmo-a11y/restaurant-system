// Brand-synced email template system.
// 3 fully-built visual styles (modern-classic, elegant-gold, warm-trattoria).
// Other design packages fall back to modern-classic until their style is built.

export type EmailStyle =
  | 'modern-classic'
  | 'elegant-gold'
  | 'minimalist-light'
  | 'bold-street'
  | 'warm-trattoria'
  | 'zen-garden'
  | 'biergarten-fresh'
  | 'neon-nights'

export type TriggerType =
  | 'birthday'
  | 'inactivity_14d'
  | 'seasonal'
  | 'loyalty'
  | 'post_order'
  | 'scheduled'
  | 'manual'

// Legacy aliases used by old code
export type BaseTemplateName = 'birthday' | 'comeback' | 'seasonal' | 'loyalty' | 'general'

// ─── Visual tokens per style ──────────────────────────────────────────────────

interface StyleTokens {
  pageBg: string
  cardBg: string
  cardShadow: string
  cardRadius: string
  containerWidth: number
  sidePadding: number
  fontFamily: string
  fontFamilyHeading: string
  textColor: string
  headingColor: string
  mutedColor: string
  borderColor: string
  hairlineColor: string
  headingSize: number
  headingWeight: number
  headingLetterSpacing: string
  bodySize: number
  bodyLineHeight: number
  labelTransform: 'uppercase' | 'none'
  labelLetterSpacing: string
  labelSize: number
  labelWeight: number
  buttonRadius: string
  buttonPadding: string
  buttonWeight: number
  buttonShadow: string
  discountCardBg: string
  discountCardBorder: string
  discountCardRadius: string
  discountAccentStyle: 'left-bar' | 'border' | 'chalk'
  discountCodeSize: number
  discountCodeLetterSpacing: string
  discountCodeFont: string
  footerStyle: 'minimal' | 'fine' | 'warm'
}

const TOKENS: Record<EmailStyle, StyleTokens> = {
  'modern-classic': {
    pageBg: '#f4f4f5',
    cardBg: '#ffffff',
    cardShadow: '0 2px 12px rgba(0,0,0,0.04)',
    cardRadius: '16px',
    containerWidth: 560,
    sidePadding: 48,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontFamilyHeading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    textColor: '#3f3f46',
    headingColor: '#0a0a0a',
    mutedColor: '#71717a',
    borderColor: '#e4e4e7',
    hairlineColor: '#e4e4e7',
    headingSize: 32,
    headingWeight: 700,
    headingLetterSpacing: '-0.02em',
    bodySize: 16,
    bodyLineHeight: 1.65,
    labelTransform: 'uppercase',
    labelLetterSpacing: '0.12em',
    labelSize: 11,
    labelWeight: 700,
    buttonRadius: '12px',
    buttonPadding: '16px 32px',
    buttonWeight: 600,
    buttonShadow: '0 4px 12px rgba(0,0,0,0.08)',
    discountCardBg: '#fafafa',
    discountCardBorder: '#e4e4e7',
    discountCardRadius: '12px',
    discountAccentStyle: 'left-bar',
    discountCodeSize: 24,
    discountCodeLetterSpacing: '0.15em',
    discountCodeFont: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    footerStyle: 'minimal',
  },
  'elegant-gold': {
    pageBg: '#0a0a0a',
    cardBg: '#111111',
    cardShadow: '0 0 0 1px rgba(212,175,55,0.15)',
    cardRadius: '4px',
    containerWidth: 560,
    sidePadding: 56,
    fontFamily: 'Georgia, "Times New Roman", "Source Serif Pro", serif',
    fontFamilyHeading: 'Georgia, "Times New Roman", "Playfair Display", serif',
    textColor: '#a3a3a3',
    headingColor: '#fafafa',
    mutedColor: '#737373',
    borderColor: '#262626',
    hairlineColor: '#d4af37',
    headingSize: 38,
    headingWeight: 400,
    headingLetterSpacing: '-0.01em',
    bodySize: 16,
    bodyLineHeight: 1.75,
    labelTransform: 'uppercase',
    labelLetterSpacing: '0.32em',
    labelSize: 10,
    labelWeight: 500,
    buttonRadius: '0',
    buttonPadding: '18px 40px',
    buttonWeight: 500,
    buttonShadow: 'none',
    discountCardBg: '#0a0a0a',
    discountCardBorder: '#d4af37',
    discountCardRadius: '2px',
    discountAccentStyle: 'border',
    discountCodeSize: 26,
    discountCodeLetterSpacing: '0.3em',
    discountCodeFont: 'Georgia, "Times New Roman", serif',
    footerStyle: 'fine',
  },
  'warm-trattoria': {
    pageBg: '#faf6f0',
    cardBg: '#fffaf2',
    cardShadow: '0 4px 16px rgba(120,53,15,0.06)',
    cardRadius: '20px',
    containerWidth: 560,
    sidePadding: 44,
    fontFamily: '"Crimson Text", Georgia, "Times New Roman", serif',
    fontFamilyHeading: '"Playfair Display", Georgia, serif',
    textColor: '#57534e',
    headingColor: '#451a03',
    mutedColor: '#a8a29e',
    borderColor: '#e7d4be',
    hairlineColor: '#d6b88c',
    headingSize: 36,
    headingWeight: 700,
    headingLetterSpacing: '-0.015em',
    bodySize: 17,
    bodyLineHeight: 1.7,
    labelTransform: 'uppercase',
    labelLetterSpacing: '0.18em',
    labelSize: 11,
    labelWeight: 600,
    buttonRadius: '999px',
    buttonPadding: '16px 36px',
    buttonWeight: 700,
    buttonShadow: '0 6px 20px rgba(194,107,55,0.25)',
    discountCardBg: '#fef3e8',
    discountCardBorder: '#d6b88c',
    discountCardRadius: '14px',
    discountAccentStyle: 'chalk',
    discountCodeSize: 26,
    discountCodeLetterSpacing: '0.2em',
    discountCodeFont: '"Playfair Display", Georgia, serif',
    footerStyle: 'warm',
  },
  // Fallbacks: reuse modern-classic until dedicated styles ship
  'minimalist-light': null as unknown as StyleTokens,
  'bold-street': null as unknown as StyleTokens,
  'zen-garden': null as unknown as StyleTokens,
  'biergarten-fresh': null as unknown as StyleTokens,
  'neon-nights': null as unknown as StyleTokens,
}

function tokensFor(style: EmailStyle): StyleTokens {
  return TOKENS[style] ?? TOKENS['modern-classic']
}

// ─── Mapping: design_package → EmailStyle ─────────────────────────────────────

const PACKAGE_TO_STYLE: Record<string, EmailStyle> = {
  'modern-classic': 'modern-classic',
  'elegant-gold': 'elegant-gold',
  'minimalist-light': 'minimalist-light',
  'bold-street': 'bold-street',
  'warm-trattoria': 'warm-trattoria',
  'zen-garden': 'zen-garden',
  'biergarten-fresh': 'biergarten-fresh',
  'neon-nights': 'neon-nights',
}

export function resolveEmailStyle(opts: {
  designPackage?: string | null
  emailStyleOverride?: string | null
  templateStyle?: string | null
}): EmailStyle {
  if (opts.templateStyle && (opts.templateStyle in TOKENS)) return opts.templateStyle as EmailStyle
  if (opts.emailStyleOverride && (opts.emailStyleOverride in TOKENS)) return opts.emailStyleOverride as EmailStyle
  if (opts.designPackage && opts.designPackage in PACKAGE_TO_STYLE) return PACKAGE_TO_STYLE[opts.designPackage]
  return 'modern-classic'
}

export const AVAILABLE_STYLES: { id: EmailStyle; label: string; ready: boolean }[] = [
  { id: 'modern-classic', label: 'Modern Classic', ready: true },
  { id: 'elegant-gold', label: 'Elegant Gold', ready: true },
  { id: 'warm-trattoria', label: 'Warm Trattoria', ready: true },
  { id: 'minimalist-light', label: 'Minimalist Light (folgt)', ready: false },
  { id: 'bold-street', label: 'Bold Street (folgt)', ready: false },
  { id: 'zen-garden', label: 'Zen Garden (folgt)', ready: false },
  { id: 'biergarten-fresh', label: 'Biergarten Fresh (folgt)', ready: false },
  { id: 'neon-nights', label: 'Neon Nights (folgt)', ready: false },
]

// ─── Email context ────────────────────────────────────────────────────────────

export interface EmailContext {
  restaurantName: string
  logoUrl?: string | null
  customerName?: string | null
  primaryColor: string                // brand accent (button bg, accent bar)
  triggerLabel?: string               // e.g. "Birthday", "Wir vermissen dich"
  heroText: string                    // H1
  bodyText: string                    // Body paragraph(s)
  ctaText: string
  ctaUrl: string
  discountCode?: string
  discountPercent?: string | number
  ratingBaseUrl?: string              // base URL; star N is appended as &s=N
  orderItems?: Array<{ name: string; qty: number; price?: number }>
  unsubscribeUrl: string
  addressLine?: string | null         // city or full restaurant address
}

// ─── Block builders (token-driven, work across all styles) ────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function headerBlock(t: StyleTokens, ctx: EmailContext): string {
  const logo = ctx.logoUrl
    ? `<img src="${ctx.logoUrl}" alt="${escapeHtml(ctx.restaurantName)}" height="44" style="max-width:200px;height:44px;object-fit:contain;display:block;margin:0 auto;">`
    : `<p style="margin:0;font-size:14px;font-weight:600;color:${t.headingColor};letter-spacing:${t.labelLetterSpacing};text-transform:${t.labelTransform};">${escapeHtml(ctx.restaurantName)}</p>`
  return `
  <tr><td style="padding:40px ${t.sidePadding}px 24px;text-align:center;">
    ${logo}
  </td></tr>
  <tr><td style="padding:0 ${t.sidePadding}px;">
    <div style="height:1px;background:${t.hairlineColor};opacity:0.4;"></div>
  </td></tr>`
}

function heroBlock(t: StyleTokens, ctx: EmailContext): string {
  const greeting = ctx.customerName
    ? `<p style="margin:0 0 12px;font-size:${t.bodySize}px;color:${t.mutedColor};">Hallo ${escapeHtml(ctx.customerName)},</p>`
    : ''
  const label = ctx.triggerLabel
    ? `<p style="margin:0 0 14px;font-size:${t.labelSize}px;font-weight:${t.labelWeight};color:${ctx.primaryColor};letter-spacing:${t.labelLetterSpacing};text-transform:${t.labelTransform};">${escapeHtml(ctx.triggerLabel)}</p>`
    : ''
  return `
  <tr><td style="padding:48px ${t.sidePadding}px 24px;">
    ${greeting}
    ${label}
    <h1 style="margin:0 0 20px;font-size:${t.headingSize}px;font-weight:${t.headingWeight};color:${t.headingColor};letter-spacing:${t.headingLetterSpacing};line-height:1.15;font-family:${t.fontFamilyHeading};">
      ${escapeHtml(ctx.heroText)}
    </h1>
    <div style="font-size:${t.bodySize}px;color:${t.textColor};line-height:${t.bodyLineHeight};">
      ${ctx.bodyText.split(/\n\n+/).map(p => `<p style="margin:0 0 12px;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('')}
    </div>
  </td></tr>`
}

function discountBlock(t: StyleTokens, ctx: EmailContext): string {
  if (!ctx.discountCode) return ''
  const code = escapeHtml(ctx.discountCode)
  const pct = ctx.discountPercent != null ? `${ctx.discountPercent}% Rabatt auf deine Bestellung` : 'Gutscheincode'
  let cardStyle = ''
  if (t.discountAccentStyle === 'left-bar') {
    cardStyle = `background:${t.discountCardBg};border-left:4px solid ${ctx.primaryColor};border-radius:0 ${t.discountCardRadius} ${t.discountCardRadius} 0;`
  } else if (t.discountAccentStyle === 'border') {
    cardStyle = `background:${t.discountCardBg};border:1px solid ${t.discountCardBorder};border-radius:${t.discountCardRadius};`
  } else {
    // chalk
    cardStyle = `background:${t.discountCardBg};border:2px dashed ${t.discountCardBorder};border-radius:${t.discountCardRadius};`
  }
  return `
  <tr><td style="padding:8px ${t.sidePadding}px 16px;">
    <div style="${cardStyle}padding:22px 26px;">
      <p style="margin:0 0 8px;font-size:${t.labelSize}px;font-weight:${t.labelWeight};color:${t.mutedColor};text-transform:${t.labelTransform};letter-spacing:${t.labelLetterSpacing};">Dein Gutscheincode</p>
      <p style="margin:0 0 6px;font-size:${t.discountCodeSize}px;font-weight:700;color:${t.headingColor};letter-spacing:${t.discountCodeLetterSpacing};font-family:${t.discountCodeFont};">${code}</p>
      <p style="margin:0;font-size:${t.bodySize - 3}px;color:${t.mutedColor};">${escapeHtml(pct)}</p>
    </div>
  </td></tr>`
}

function ratingBlock(t: StyleTokens, ctx: EmailContext): string {
  if (!ctx.ratingBaseUrl) return ''
  const stars = [1, 2, 3, 4, 5]
    .map(n => `<a href="${ctx.ratingBaseUrl}${n}" style="display:inline-block;padding:6px 8px;text-decoration:none;font-size:32px;line-height:1;color:#d4d4d8;">&#9733;</a>`)
    .join('')
  return `
  <tr><td style="padding:8px ${t.sidePadding}px 16px;">
    <div style="background:${t.discountCardBg};border:1px solid ${t.borderColor};border-radius:${t.discountCardRadius};padding:24px 20px;text-align:center;">
      <p style="margin:0 0 10px;font-size:${t.labelSize}px;font-weight:${t.labelWeight};color:${t.mutedColor};text-transform:${t.labelTransform};letter-spacing:${t.labelLetterSpacing};">Wie war dein Erlebnis?</p>
      <div style="margin:0 0 8px;">${stars}</div>
      <p style="margin:0;font-size:${t.bodySize - 3}px;color:${t.mutedColor};line-height:1.5;">Ein Klick reicht — danach kannst du optional Feedback hinzufügen.</p>
    </div>
  </td></tr>`
}

function orderItemsBlock(t: StyleTokens, ctx: EmailContext): string {
  if (!ctx.orderItems || ctx.orderItems.length === 0) return ''
  const items = ctx.orderItems.slice(0, 3).map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${t.borderColor};">
        <span style="display:inline-block;min-width:30px;color:${t.mutedColor};font-weight:600;">${item.qty}×</span>
        <span style="color:${t.headingColor};font-weight:500;">${escapeHtml(item.name)}</span>
      </td>
    </tr>`).join('')
  return `
  <tr><td style="padding:8px ${t.sidePadding}px 16px;">
    <p style="margin:0 0 10px;font-size:${t.labelSize}px;font-weight:${t.labelWeight};color:${t.mutedColor};text-transform:${t.labelTransform};letter-spacing:${t.labelLetterSpacing};">Deine letzte Bestellung</p>
    <table style="width:100%;border-collapse:collapse;font-size:${t.bodySize}px;font-family:${t.fontFamily};">
      ${items}
    </table>
  </td></tr>`
}

function ctaBlock(t: StyleTokens, ctx: EmailContext): string {
  return `
  <tr><td style="padding:24px ${t.sidePadding}px 12px;text-align:center;">
    <a href="${ctx.ctaUrl}" style="display:inline-block;background:${ctx.primaryColor};color:#ffffff;text-decoration:none;padding:${t.buttonPadding};border-radius:${t.buttonRadius};font-size:${t.bodySize - 1}px;font-weight:${t.buttonWeight};letter-spacing:0.02em;box-shadow:${t.buttonShadow};">${escapeHtml(ctx.ctaText)}</a>
  </td></tr>`
}

function footerBlock(t: StyleTokens, ctx: EmailContext): string {
  const address = ctx.addressLine ? `<p style="margin:0 0 6px;font-size:12px;color:${t.mutedColor};">${escapeHtml(ctx.addressLine)}</p>` : ''
  let copy = ''
  if (t.footerStyle === 'warm') {
    copy = `<p style="margin:0 0 8px;font-size:12px;color:${t.mutedColor};font-style:italic;">Mit Liebe gemacht von ${escapeHtml(ctx.restaurantName)}</p>`
  } else if (t.footerStyle === 'fine') {
    copy = `<p style="margin:0 0 8px;font-size:11px;color:${t.mutedColor};letter-spacing:0.15em;text-transform:uppercase;">${escapeHtml(ctx.restaurantName)}</p>`
  }
  return `
  <tr><td style="padding:32px ${t.sidePadding}px 40px;text-align:center;border-top:1px solid ${t.borderColor};">
    ${copy}
    ${address}
    <p style="margin:8px 0 0;font-size:11px;color:${t.mutedColor};line-height:1.6;">
      Du erhältst diese Email, weil du Updates von ${escapeHtml(ctx.restaurantName)} abonniert hast.<br>
      <a href="${ctx.unsubscribeUrl}" style="color:${t.mutedColor};text-decoration:underline;">Vom Newsletter abmelden</a>
    </p>
  </td></tr>`
}

// ─── Shell + assembly ─────────────────────────────────────────────────────────

function shell(t: StyleTokens, ctx: EmailContext, inner: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(ctx.restaurantName)}</title>
</head>
<body style="margin:0;padding:0;background:${t.pageBg};font-family:${t.fontFamily};color:${t.textColor};-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${t.pageBg};padding:40px 16px;">
  <tr><td align="center">
    <table width="${t.containerWidth}" cellpadding="0" cellspacing="0" role="presentation" style="max-width:${t.containerWidth}px;width:100%;background:${t.cardBg};border-radius:${t.cardRadius};overflow:hidden;box-shadow:${t.cardShadow};">
      ${inner}
    </table>
  </td></tr>
</table>
</body>
</html>`
}

export function buildEmail(style: EmailStyle, trigger: TriggerType, ctx: EmailContext): string {
  const t = tokensFor(style)
  const parts: string[] = [headerBlock(t, ctx), heroBlock(t, ctx)]
  if (trigger === 'post_order' && ctx.orderItems && ctx.orderItems.length > 0) parts.push(orderItemsBlock(t, ctx))
  if (ctx.discountCode) parts.push(discountBlock(t, ctx))
  if (trigger === 'post_order' && ctx.ratingBaseUrl) parts.push(ratingBlock(t, ctx))
  parts.push(ctaBlock(t, ctx))
  parts.push(footerBlock(t, ctx))
  return shell(t, ctx, parts.join(''))
}

// ─── HTML → plain text (deliverability) ───────────────────────────────────────

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ─── Legacy compat (still used by automation-run / templates POST) ────────────

export function buildLogoBlock(logoUrl: string | null | undefined, restaurantName: string): string {
  if (logoUrl) {
    return `<img src="${logoUrl}" alt="${escapeHtml(restaurantName)}" height="44" style="max-width:200px;height:44px;object-fit:contain;display:block;margin:0 auto;">`
  }
  return `<p style="margin:0;font-size:14px;font-weight:600;color:#0a0a0a;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(restaurantName)}</p>`
}

// Legacy DISCOUNT_BLOCK — returns string with {{discount_code}} / {{discount_percent}} placeholders
export const DISCOUNT_BLOCK = (color: string): string => `
  <tr><td style="padding:8px 48px 16px;">
    <div style="background:#fafafa;border-left:4px solid ${color};border-radius:0 12px 12px 0;padding:22px 26px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:0.12em;">Dein Gutscheincode</p>
      <p style="margin:0 0 6px;font-size:24px;font-weight:700;color:#0a0a0a;letter-spacing:0.15em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">{{discount_code}}</p>
      <p style="margin:0;font-size:13px;color:#71717a;">{{discount_percent}}% Rabatt auf deine Bestellung</p>
    </div>
  </td></tr>`

/**
 * Legacy entry-point. Returns a HTML shell with `{{placeholders}}` to be rendered
 * by renderEmailTemplate. Used by templates POST when creating templates with the
 * old structured-fields API. New code should call buildEmail() instead.
 */
export function getBaseTemplate(name: BaseTemplateName, primaryColor: string, style?: EmailStyle | null): string {
  const t = tokensFor(style ?? 'modern-classic')
  const triggerLabelMap: Record<BaseTemplateName, string> = {
    birthday: 'Happy Birthday',
    comeback: 'Wir vermissen dich',
    seasonal: 'Saisonales Angebot',
    loyalty: 'Exklusiv für treue Gäste',
    general: '',
  }
  const triggerLabel = triggerLabelMap[name]
  const labelHtml = triggerLabel
    ? `<p style="margin:0 0 14px;font-size:${t.labelSize}px;font-weight:${t.labelWeight};color:${primaryColor};letter-spacing:${t.labelLetterSpacing};text-transform:${t.labelTransform};">${triggerLabel}</p>`
    : ''
  const inner = `
  <tr><td style="padding:40px ${t.sidePadding}px 24px;text-align:center;">{{logo_block}}</td></tr>
  <tr><td style="padding:0 ${t.sidePadding}px;"><div style="height:1px;background:${t.hairlineColor};opacity:0.4;"></div></td></tr>
  <tr><td style="padding:48px ${t.sidePadding}px 24px;">
    ${labelHtml}
    <h1 style="margin:0 0 20px;font-size:${t.headingSize}px;font-weight:${t.headingWeight};color:${t.headingColor};letter-spacing:${t.headingLetterSpacing};line-height:1.15;font-family:${t.fontFamilyHeading};">{{hero_text}}</h1>
    <div style="font-size:${t.bodySize}px;color:${t.textColor};line-height:${t.bodyLineHeight};">
      <p style="margin:0;">{{body_text}}</p>
    </div>
  </td></tr>
  {{discount_block}}
  {{rating_block}}
  <tr><td style="padding:24px ${t.sidePadding}px 12px;text-align:center;">
    <a href="{{cta_url}}" style="display:inline-block;background:${primaryColor};color:#ffffff;text-decoration:none;padding:${t.buttonPadding};border-radius:${t.buttonRadius};font-size:${t.bodySize - 1}px;font-weight:${t.buttonWeight};letter-spacing:0.02em;box-shadow:${t.buttonShadow};">{{cta_text}}</a>
  </td></tr>
  <tr><td style="padding:32px ${t.sidePadding}px 40px;text-align:center;border-top:1px solid ${t.borderColor};">
    <p style="margin:0;font-size:11px;color:${t.mutedColor};line-height:1.6;">
      Du erhältst diese Email, weil du Updates von {{restaurant_name}} abonniert hast.<br>
      <a href="{{unsubscribe_url}}" style="color:${t.mutedColor};text-decoration:underline;">Vom Newsletter abmelden</a>
    </p>
  </td></tr>`
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{restaurant_name}}</title></head>
<body style="margin:0;padding:0;background:${t.pageBg};font-family:${t.fontFamily};color:${t.textColor};-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${t.pageBg};padding:40px 16px;">
  <tr><td align="center">
    <table width="${t.containerWidth}" cellpadding="0" cellspacing="0" role="presentation" style="max-width:${t.containerWidth}px;width:100%;background:${t.cardBg};border-radius:${t.cardRadius};overflow:hidden;box-shadow:${t.cardShadow};">
      ${inner}
    </table>
  </td></tr>
</table>
</body>
</html>`
}

export function getBaseTemplateForTrigger(
  triggerType: string,
  primaryColor: string,
  style?: EmailStyle | null,
): string {
  const map: Record<string, BaseTemplateName> = {
    birthday: 'birthday',
    inactivity_14d: 'comeback',
    seasonal: 'seasonal',
    post_order: 'general',
    scheduled: 'general',
    manual: 'general',
    loyalty: 'loyalty',
  }
  return getBaseTemplate(map[triggerType] ?? 'general', primaryColor, style ?? null)
}
