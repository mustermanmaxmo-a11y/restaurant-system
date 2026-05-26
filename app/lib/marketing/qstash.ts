// QStash wrapper — uses direct fetch instead of @upstash/qstash SDK.
// The SDK's publishJSON in v2.11+ produces a request shape that QStash
// rejects with HTTP 400 in our setup (likely delay-format or URL-encoding
// mismatch). Direct fetch with the documented headers (Upstash-Delay:
// "60s" format, Upstash-Deduplication-Id) works reliably and returns 201.

export interface PublishDelayedJobArgs {
  url: string
  body: Record<string, unknown>
  delaySeconds: number
  /** Optional dedup ID — QStash drops duplicate sends within ~24h window */
  dedupeId?: string
}

export type PublishResult =
  | { success: true; messageId: string }
  | { success: false; error: string; status?: number }

export async function publishDelayedJob(args: PublishDelayedJobArgs): Promise<PublishResult> {
  const token = process.env.QSTASH_TOKEN
  if (!token) return { success: false, error: 'QSTASH_TOKEN not configured' }

  const qstashUrl = process.env.QSTASH_URL || 'https://qstash.upstash.io'
  const publishUrl = `${qstashUrl}/v2/publish/${args.url}`

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Upstash-Delay': `${args.delaySeconds}s`,
  }
  if (args.dedupeId) {
    headers['Upstash-Deduplication-Id'] = args.dedupeId
  }

  try {
    const res = await fetch(publishUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(args.body),
    })

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '')
      return {
        success: false,
        error: `QStash returned ${res.status}: ${errorBody || res.statusText}`,
        status: res.status,
      }
    }

    const data = (await res.json().catch(() => ({}))) as { messageId?: string }
    if (!data.messageId) {
      return { success: false, error: 'QStash response missing messageId' }
    }
    return { success: true, messageId: data.messageId }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'fetch_failed' }
  }
}
