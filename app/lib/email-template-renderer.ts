export interface TemplateVars {
  restaurant_name?: string
  customer_name?: string
  logo_url?: string
  logo_block?: string
  discount_code?: string
  discount_block?: string
  discount_percent?: string
  rating_block?: string
  order_items_block?: string
  cta_url?: string
  cta_text?: string
  hero_text?: string
  body_text?: string
  unsubscribe_url?: string
  primary_color?: string
  [key: string]: string | undefined
}

export function renderEmailTemplate(html: string, vars: TemplateVars): string {
  let result = html
  // Optional blocks default to empty string when not provided — prevents stray placeholders
  const optionalBlocks = ['discount_block', 'rating_block', 'order_items_block']
  for (const block of optionalBlocks) {
    if (vars[block] === undefined) vars[block] = ''
  }
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) {
      result = result.replaceAll(`{{${key}}}`, value)
    }
  }
  return result
}
