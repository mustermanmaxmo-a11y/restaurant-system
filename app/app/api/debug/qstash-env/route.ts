import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Debug endpoint — TEMPORARY, remove after diagnosing QSTASH_TOKEN issue.
// Returns first/last chars + length of process.env.QSTASH_TOKEN so we can
// see exactly what Vercel's runtime has, without leaking the full token.
export async function GET() {
  const t = process.env.QSTASH_TOKEN
  const url = process.env.QSTASH_URL
  const cur = process.env.QSTASH_CURRENT_SIGNING_KEY
  const nxt = process.env.QSTASH_NEXT_SIGNING_KEY

  function reveal(v: string | undefined) {
    if (!v) return { present: false }
    return {
      present: true,
      length: v.length,
      first10: v.slice(0, 10),
      last5: v.slice(-5),
      hasLeadingWhitespace: /^\s/.test(v),
      hasTrailingWhitespace: /\s$/.test(v),
      hasQuotes: v.startsWith('"') || v.endsWith('"'),
      startsWithEy: v.startsWith('ey'),
    }
  }

  return NextResponse.json({
    QSTASH_TOKEN: reveal(t),
    QSTASH_URL: reveal(url),
    QSTASH_CURRENT_SIGNING_KEY: reveal(cur),
    QSTASH_NEXT_SIGNING_KEY: reveal(nxt),
    runtime: 'nodejs',
    note: 'Temporary debug endpoint. Will be removed after diagnostics.',
  })
}
