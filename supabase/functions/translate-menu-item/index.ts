import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const LANGS = ['en', 'es', 'it', 'tr', 'fr', 'pl', 'ru']

function sanitize(str: string, maxLen: number): string {
  return str.replace(/[\r\n"\\]/g, ' ').slice(0, maxLen)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    // Auth: verify caller is a logged-in user
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await userSupabase.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { item_id, name, description } = await req.json()
    if (!item_id || !name) {
      return new Response(JSON.stringify({ error: 'item_id and name are required' }), { status: 400 })
    }

    // Authorization: verify the item belongs to this user's restaurant
    const { data: item } = await userSupabase
      .from('menu_items')
      .select('id, restaurant_id, restaurants!inner(owner_id)')
      .eq('id', item_id)
      .single()

    if (!item) {
      return new Response(JSON.stringify({ error: 'Item not found' }), { status: 404 })
    }

    const restaurant = Array.isArray(item.restaurants) ? item.restaurants[0] : item.restaurants
    if (!restaurant || restaurant.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    }

    // Sanitize inputs before including in prompt
    const safeName = sanitize(name, 200)
    const safeDesc = sanitize(description || '', 500)

    const prompt = `Translate this restaurant menu item into the following languages: ${LANGS.join(', ')}.

Name (German): "${safeName}"
Description (German): "${safeDesc}"

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

    // Use service role for the actual update (ownership already verified above)
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
