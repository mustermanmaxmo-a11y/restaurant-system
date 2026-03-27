import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase-middleware'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createMiddlewareClient(request, response)

  const { data: { session } } = await supabase.auth.getSession()

  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')

  // /admin/* ohne Session → Owner-Login
  if (isAdminRoute && !session) {
    return NextResponse.redirect(new URL('/owner-login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
