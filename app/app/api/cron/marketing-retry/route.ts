import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

// Exponential-ish backoff: 1m, 5m, 25m, 2h05
const BACKOFF_SECONDS = [60, 300, 1500, 7500]
const MAX_ATTEMPTS = 4
// Resend free tier ~100 emails/day; paid 100/sec. Batch of 50 per 5-min cron = 600/hour max.
const BATCH_SIZE = 50

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseAdmin()
  const resend = new Resend(process.env.RESEND_API_KEY)
  const nowIso = new Date().toISOString()

  const { data: due, error: dueErr } = await supabase
    .from('email_send_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('next_retry_at', nowIso)
    .order('next_retry_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (dueErr) {
    return NextResponse.json({ error: dueErr.message }, { status: 500 })
  }
  if (!due || due.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let sent = 0
  let failed = 0
  let retried = 0

  for (const row of due) {
    // Atomic claim — second concurrent cron would return 0 rows here and skip
    const { data: claimed, error: claimErr } = await supabase
      .from('email_send_queue')
      .update({ status: 'sending' })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id')
      .single()
    if (claimErr || !claimed) continue

    try {
      const result = await resend.emails.send({
        from: row.from_name ? `${row.from_name} <${row.from_email}>` : row.from_email,
        to: row.to_email,
        subject: row.subject,
        html: row.html,
        replyTo: row.reply_to ?? undefined,
      })
      if (result.error) throw new Error(result.error.message)

      await supabase
        .from('email_send_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
        .eq('id', row.id)
      sent++
    } catch (e) {
      const attempts = row.attempts + 1
      const message = e instanceof Error ? e.message : String(e)

      if (attempts >= MAX_ATTEMPTS) {
        await supabase
          .from('email_send_queue')
          .update({ status: 'failed', attempts, last_error: message })
          .eq('id', row.id)
        failed++
      } else {
        const delaySec = BACKOFF_SECONDS[attempts - 1] ?? BACKOFF_SECONDS[BACKOFF_SECONDS.length - 1]
        const nextRetry = new Date(Date.now() + delaySec * 1000).toISOString()
        await supabase
          .from('email_send_queue')
          .update({ status: 'pending', attempts, last_error: message, next_retry_at: nextRetry })
          .eq('id', row.id)
        retried++
      }
    }
  }

  return NextResponse.json({ processed: due.length, sent, failed, retried })
}
