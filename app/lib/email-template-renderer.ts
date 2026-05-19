export interface TemplateVars {
  restaurant_name?: string
  customer_name?: string
  logo_url?: string
  logo_block?: string
  discount_code?: string
  discount_block?: string
  discount_percent?: string
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
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) {
      result = result.replaceAll(`{{${key}}}`, value)
    }
  }
  // Remove any unreplaced discount block if no discount code provided
  if (!vars.discount_code) {
    result = result.replace(/<!--\s*discount[^>]*-->[\s\S]*?<\/td><\/tr>/i, '')
  }
  return result
}
