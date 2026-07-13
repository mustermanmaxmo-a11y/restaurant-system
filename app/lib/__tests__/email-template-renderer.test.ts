import { describe, it, expect } from 'vitest'
import { renderEmailTemplate } from '@/lib/email-template-renderer'

describe('renderEmailTemplate', () => {
  it('ersetzt einen einfachen Platzhalter', () => {
    expect(renderEmailTemplate('Hallo {{customer_name}}!', { customer_name: 'Anna' }))
      .toBe('Hallo Anna!')
  })

  it('ersetzt ALLE Vorkommen desselben Platzhalters (replaceAll)', () => {
    const html = '{{restaurant_name}} — willkommen bei {{restaurant_name}}'
    expect(renderEmailTemplate(html, { restaurant_name: 'Pizza Roma' }))
      .toBe('Pizza Roma — willkommen bei Pizza Roma')
  })

  it('ersetzt mehrere verschiedene Variablen zusammen', () => {
    const html = '{{customer_name}} bei {{restaurant_name}}: {{cta_text}}'
    const out = renderEmailTemplate(html, {
      customer_name: 'Ben', restaurant_name: 'Sushi Bar', cta_text: 'Jetzt bestellen',
    })
    expect(out).toBe('Ben bei Sushi Bar: Jetzt bestellen')
  })

  it('setzt optionale Blöcke auf leer, wenn nicht angegeben (keine Rest-Platzhalter)', () => {
    const html = 'A{{discount_block}}B{{rating_block}}C{{order_items_block}}D'
    expect(renderEmailTemplate(html, {})).toBe('ABCD')
  })

  it('nutzt den Wert eines optionalen Blocks, wenn angegeben', () => {
    expect(renderEmailTemplate('X{{discount_block}}Y', { discount_block: '-10%' }))
      .toBe('X-10%Y')
  })

  it('lässt nicht bereitgestellte Nicht-Block-Platzhalter unverändert stehen', () => {
    // Doku des Ist-Verhaltens: nur übergebene (und die 3 optionalen Block-)Keys werden ersetzt.
    expect(renderEmailTemplate('Hallo {{customer_name}}', {}))
      .toBe('Hallo {{customer_name}}')
  })

  it('unterstützt beliebige Custom-Keys über die Index-Signatur', () => {
    expect(renderEmailTemplate('Code: {{promo}}', { promo: 'SUMMER26' }))
      .toBe('Code: SUMMER26')
  })

  it('gibt unverändertes HTML zurück, wenn keine Platzhalter vorkommen', () => {
    expect(renderEmailTemplate('<p>Statischer Text</p>', { customer_name: 'egal' }))
      .toBe('<p>Statischer Text</p>')
  })
})
