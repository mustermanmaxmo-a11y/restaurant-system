import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const TOKEN_ENDPOINTS: Record<string, {
  tokenUrl: string
  clientIdEnv: string
  clientSecretEnv: string
}> = {
  sumup: {
    tokenUrl: 'https://api.sumup.com/token',
    clientIdEnv: 'SUMUP_CLIENT_ID',
    clientSecretEnv: 'SUMUP_CLIENT_SECRET',
  },
  zettle: {
    tokenUrl: 'https://oauth.zettle.com/oauth/token',
    clientIdEnv: 'ZETTLE_CLIENT_ID',
    clientSecretEnv: 'ZETTLE_CLIENT_SECRET',
  },
  square: {
    tokenUrl: 'https://connect.squareup.com/oauth2/token',
    clientIdEnv: 'SQUARE_APP_ID',
    clientSecretEnv: 'SQUARE_APP_SECRET',
  },
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const config = TOKEN_ENDPOINTS[provider]
  const redirectBase = new URL('/admin/integrations', request.url)

  if (!config) {
    redirectBase.searchParams.set('status', 'error')
    return NextResponse.redirect(redirectBase)
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code || !state) {
    redirectBase.searchParams.set('status', 'error')
    return NextResponse.redirect(redirectBase)
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // State validieren (CSRF-Schutz)
  const { data: stateRow } = await supabaseAdmin
    .from('pos_oauth_states')
    .select('provider, expires_at')
    .eq('state', state)
    .single()

  if (!stateRow || stateRow.provider !== provider || new Date(stateRow.expires_at) < new Date()) {
    await supabaseAdmin.from('pos_oauth_states').delete().eq('state', state)
    redirectBase.searchParams.set('status', 'error')
    return NextResponse.redirect(redirectBase)
  }
  // State verbraucht → löschen
  await supabaseAdmin.from('pos_oauth_states').delete().eq('state', state)

  // Eingeloggten Restaurant-Owner ermitteln
  const cookieStore = await cookies()
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { session } } = await supabaseUser.auth.getSession()
  if (!session) {
    redirectBase.searchParams.set('status', 'error')
    return NextResponse.redirect(redirectBase)
  }
  const { data: restaurant } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('owner_id', session.user.id)
    .single()
  if (!restaurant) {
    redirectBase.searchParams.set('status', 'error')
    return NextResponse.redirect(redirectBase)
  }

  // Access Token holen
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/pos/callback/${provider}`
  const tokenRes = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env[config.clientIdEnv]!,
      client_secret: process.env[config.clientSecretEnv]!,
    }).toString(),
  })

  if (!tokenRes.ok) {
    redirectBase.searchParams.set('status', 'error')
    return NextResponse.redirect(redirectBase)
  }

  const tokenData = await tokenRes.json()
  const accessToken: string = tokenData.access_token
  const refreshToken: string | undefined = tokenData.refresh_token

  if (!accessToken) {
    redirectBase.searchParams.set('status', 'error')
    return NextResponse.redirect(redirectBase)
  }

  // Token speichern (upsert bei Reconnect)
  await supabaseAdmin.from('pos_connections').upsert({
    restaurant_id: restaurant.id,
    provider,
    access_token: accessToken,
    refresh_token: refreshToken ?? null,
    connected_at: new Date().toISOString(),
  }, { onConflict: 'restaurant_id,provider' })

  redirectBase.searchParams.set('status', 'connected')
  redirectBase.searchParams.set('provider', provider)
  return NextResponse.redirect(redirectBase)
}
