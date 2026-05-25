import { Client } from '@upstash/qstash'

let _client: Client | null = null
function getClient(): Client {
  if (!_client) {
    const token = process.env.QSTASH_TOKEN
    if (!token) throw new Error('QSTASH_TOKEN not configured')
    _client = new Client({ token })
  }
  return _client
}

export interface PublishDelayedJobArgs {
  url: string
  body: Record<string, unknown>
  delaySeconds: number
  /** Optional dedup ID — QStash drops duplicate sends within ~24h window */
  dedupeId?: string
}

export type PublishResult =
  | { success: true; messageId: string }
  | { success: false; error: string }

export async function publishDelayedJob(args: PublishDelayedJobArgs): Promise<PublishResult> {
  try {
    const client = getClient()
    const res = await client.publishJSON({
      url: args.url,
      body: args.body,
      delay: args.delaySeconds,
      deduplicationId: args.dedupeId,
    })
    return { success: true, messageId: res.messageId }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'unknown' }
  }
}
