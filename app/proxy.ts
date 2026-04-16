import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase-middleware'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // /platform/* und /api/platform/* — nur platform_owner
  if (pathname.startsWith('/platform') || pathname.startsWith('/api/platform')) {
    const response = NextResponse.next({ request })
    const supabase = createMiddlewareClient(request, response)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const loginUrl = new URL('/owner-login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const { data: isOwner } = await supabase.rpc('is_platform_owner')
    if (isOwner !== true) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    return response
  }

  // /admin/* — eingeloggte Restaurant-Owner (setup bleibt offen für Stripe-Redirect)
  if (pathname.startsWith('/admin') && pathname !== '/admin/setup' && !pathname.startsWith('/auth')) {
    const response = NextResponse.next()
    const supabase = createMiddlewareClient(request, response)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      const loginUrl = new URL('/owner-login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/platform/:path*', '/api/platform/:path*'],
}
