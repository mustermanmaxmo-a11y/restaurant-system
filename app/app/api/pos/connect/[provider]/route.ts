import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

// OAuth-Konfiguration pro Anbieter
const OAUTH_CONFIG: Record<string, {
  authUrl: string
  clientIdEnv: string
  scope: string
}> = {
  sumup: {
    authUrl: 'https://api.sumup.com/authorize',
    clientIdEnv: 'SUMUP_CLIENT_ID',
    scope: 'payments:history',
  },
  zettle: {
    authUrl: 'https://oauth.zettle.com/oauth/authorize',
    clientIdEnv: 'ZETTLE_CLIENT_ID',
    scope: 'READ:PURCHASE',
  },
  square: {
    authUrl: 'https://connect.squareup.com/oauth2/authorize',
    clientIdEnv: 'SQUARE_APP_ID',
    scope: 'PAYMENTS_READ',
  },
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const config = OAUTH_CONFIG[provider]
  if (!config) {
    return NextResponse.redirect(new URL('/admin/integrations?status=error', request.url))
  }

  const clientId = process.env[config.clientIdEnv]
  if (!clientId) {
    console.error(`Missing env var: ${config.clientIdEnv}`)
    return NextResponse.redirect(new URL('/admin/integrations?status=error', request.url))
  }

  // Session prüfen: Nur eingeloggte Owner können verbinden
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  // state = zufälliger Token gegen CSRF, wird in DB kurzzeitig gespeichert
  const state = randomBytes(16).toString('hex')
  const statePayload = Buffer.from(JSON.stringify({ provider, state })).toString('base64url')

  // state in DB als kurzlebiges Token speichern (expires in 10 min)
  await supabase.from('pos_oauth_states').upsert({
    state: statePayload,
    provider,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  })

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/pos/callback/${provider}`
  const params_q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scope,
    state: statePayload,
  })

  return NextResponse.redirect(`${config.authUrl}?${params_q.toString()}`)
}
