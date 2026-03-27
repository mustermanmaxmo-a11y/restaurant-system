import { NextRequest, NextResponse } from 'next/server'

// Auth-Check läuft direkt in den Admin-Pages (client-side)
// Middleware leitet nur durch und setzt keine Redirects
export async function proxy(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
