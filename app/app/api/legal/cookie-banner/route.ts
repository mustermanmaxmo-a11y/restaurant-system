import { NextResponse } from 'next/server'
import { getLegalDocument } from '@/lib/legal'

export async function GET() {
  const content = await getLegalDocument('cookie_banner')
  return NextResponse.json({ content: content ?? '' }, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  })
}
