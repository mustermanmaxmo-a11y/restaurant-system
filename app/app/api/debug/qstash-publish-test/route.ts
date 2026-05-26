import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Debug endpoint — TEMPORARY. Tries a real QStash publish using direct fetch
// (bypassing the SDK) so we can capture the exact error response from QStash.
export async function GET() {
  const token = process.env.QSTASH_TOKEN
  const qstashUrl = process.env.QSTASH_URL || 'https://qstash.upstash.io'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  if (!token) {
    return NextResponse.json({ error: 'QSTASH_TOKEN missing' }, { status: 500 })
  }

  const destinationUrl = `${appUrl}/api/jobs/send-rating-email`
  const publishUrl = `${qstashUrl}/v2/publish/${destinationUrl}`

  // Make direct request — capture EVERYTHING
  let qstashResponse: {
    status: number
    statusText: string
    body: string
    headers: Record<string, string>
  } = { status: 0, statusText: '', body: '', headers: {} }

  try {
    const res = await fetch(publishUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Upstash-Delay': '60s',
        'Upstash-Deduplication-Id': `debug-test-${Date.now()}`,
      },
      body: JSON.stringify({ debug: 'test', timestamp: Date.now() }),
    })

    const text = await res.text()
    const headerObj: Record<string, string> = {}
    res.headers.forEach((v, k) => { headerObj[k] = v })

    qstashResponse = {
      status: res.status,
      statusText: res.statusText,
      body: text,
      headers: headerObj,
    }
  } catch (e) {
    return NextResponse.json({
      error: 'fetch_failed',
      detail: e instanceof Error ? e.message : 'unknown',
    }, { status: 500 })
  }

  return NextResponse.json({
    request: {
      publishUrl,
      destinationUrl,
      method: 'POST',
      delay: '60s',
    },
    response: qstashResponse,
  })
}
