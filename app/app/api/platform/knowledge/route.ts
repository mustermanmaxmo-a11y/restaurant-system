import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const VALID_CATEGORIES = [
  'email-strategy',
  'seasonal',
  'psychology',
  'dsgvo',
  'trends',
] as const

async function requirePlatformOwner() {
  const supabase = await createSupabaseServerSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: 'unauthenticated' as const }
  const { data: isOwner } = await supabase.rpc('is_platform_owner')
  if (isOwner !== true) return { user: null, error: 'forbidden' as const }
  return { user, error: null }
}

export async function GET() {
  const { error } = await requirePlatformOwner()
  if (error === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (error === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createSupabaseAdmin()
  const { data: articles, error: dbError } = await supabase
    .from('marketing_knowledge')
    .select('*')
    .order('created_at', { ascending: false })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ articles: articles ?? [] })
}

export async function POST(request: NextRequest) {
  const { error } = await requirePlatformOwner()
  if (error === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (error === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { title, content, category, tags, language } = body

  if (!title || !content || !category) {
    return NextResponse.json({ error: 'title, content, and category are required' }, { status: 400 })
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: `category must be one of: ${VALID_CATEGORIES.join(' | ')}` },
      { status: 400 }
    )
  }

  const supabase = createSupabaseAdmin()
  const { data: article, error: dbError } = await supabase
    .from('marketing_knowledge')
    .insert({
      title,
      content,
      category,
      tags: tags ?? null,
      language: language ?? 'de',
    })
    .select('*')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ article })
}

export async function PATCH(request: NextRequest) {
  const { error } = await requirePlatformOwner()
  if (error === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (error === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { id, title, content, category, tags, language } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  if (category && !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: `category must be one of: ${VALID_CATEGORIES.join(' | ')}` },
      { status: 400 }
    )
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (title !== undefined) updates.title = title
  if (content !== undefined) updates.content = content
  if (category !== undefined) updates.category = category
  if (tags !== undefined) updates.tags = tags
  if (language !== undefined) updates.language = language

  const supabase = createSupabaseAdmin()
  const { data: article, error: dbError } = await supabase
    .from('marketing_knowledge')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ article })
}

export async function DELETE(request: NextRequest) {
  const { error } = await requirePlatformOwner()
  if (error === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (error === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Support both query param and request body
  const { searchParams } = new URL(request.url)
  let id = searchParams.get('id')

  if (!id) {
    const body = await request.json().catch(() => ({}))
    id = body.id ?? null
  }

  if (!id) return NextResponse.json({ error: 'id required (query param or body)' }, { status: 400 })

  const supabase = createSupabaseAdmin()
  const { error: dbError } = await supabase
    .from('marketing_knowledge')
    .delete()
    .eq('id', id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
