import { NextResponse } from 'next/server'
import { getLegalDocument } from '@/lib/legal'

export const dynamic = 'force-dynamic'

export async function GET() {
  const content = await getLegalDocument('cookie_banner')
  return NextResponse.json({ content: content ?? '' })
}
