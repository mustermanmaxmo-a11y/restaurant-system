import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase-middleware'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect all /admin routes except /admin/setup (reached after Stripe redirect)
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
  matcher: ['/admin/:path*'],
}
