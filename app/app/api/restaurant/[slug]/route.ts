import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { data, error } = await supabaseAdmin
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (error || !data) {
    console.error('Restaurant lookup failed:', { slug, error: error?.message, code: error?.code })
    return NextResponse.json({ slug, error: error?.message }, { status: 404 })
  }

  return NextResponse.json(data)
}
