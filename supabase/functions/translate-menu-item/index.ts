import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const LANGS = ['en', 'es', 'it', 'tr', 'fr', 'pl', 'ru']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    const { item_id, name, description } = await req.json()
    if (!item_id || !name) {
      return new Response(JSON.stringify({ error: 'item_id and name are required' }), { status: 400 })
    }

    const prompt = `Translate this restaurant menu item into the following languages: ${LANGS.join(', ')}.

Name (German): "${name}"
Description (German): "${description || ''}"

Return ONLY a valid JSON object with this exact structure, no markdown, no explanation:
{
  "en": { "name": "...", "description": "..." },
  "es": { "name": "...", "description": "..." },
  "it": { "name": "...", "description": "..." },
  "tr": { "name": "...", "description": "..." },
  "fr": { "name": "...", "description": "..." },
  "pl": { "name": "...", "description": "..." },
  "ru": { "name": "...", "description": "..." }
}

Keep descriptions concise and appetizing. If description is empty, return empty string for all.`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!aiRes.ok) {
      const err = await aiRes.text()
      throw new Error(`Anthropic API error: ${err}`)
    }

    const aiData = await aiRes.json()
    const rawText = aiData.content[0].text.trim()

    // Strip markdown code fences if present
    const jsonText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const translations = JSON.parse(jsonText)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { error } = await supabase
      .from('menu_items')
      .update({ translations })
      .eq('id', item_id)

    if (error) throw error

    return new Response(JSON.stringify({ success: true, translations }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    console.error('translate-menu-item error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
