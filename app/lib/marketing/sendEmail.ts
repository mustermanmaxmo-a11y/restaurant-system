import { Resend } from 'resend';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export interface QueueEmailInput {
  restaurantId: string;
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  toSubscriberId?: string | null;
  replyTo?: string;
  subject: string;
  html: string;
  /** Plain-text alternative body — improves deliverability and accessibility. */
  text?: string;
  /** Custom headers, e.g. List-Unsubscribe (RFC 8058). Stored as JSON in queue, passed to Resend on send. */
  headers?: Record<string, string>;
  campaignId?: string | null;
}

export interface ImmediateEmailInput extends QueueEmailInput {
  /** Send synchronously, bypassing the queue. Use only for user-blocking flows (verification, order confirmation). */
  immediate: true;
}

// Lazy: erst bei Bedarf instanziieren, damit `next build` ohne RESEND_API_KEY
// nicht beim Modul-Import wirft (Resend wirft im Konstruktor ohne Key).
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

function formatFrom(input: QueueEmailInput): string {
  return input.fromName ? `${input.fromName} <${input.fromEmail}>` : input.fromEmail;
}

export async function sendEmail(
  input: QueueEmailInput | ImmediateEmailInput
): Promise<{ queued: boolean; id?: string }> {
  if ('immediate' in input && input.immediate) {
    const result = await getResend().emails.send({
      from: formatFrom(input),
      to: input.toEmail,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
      headers: input.headers,
    });
    if (result.error) throw new Error(result.error.message);
    return { queued: false, id: result.data?.id };
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('email_send_queue')
    .insert({
      restaurant_id: input.restaurantId,
      from_email: input.fromEmail,
      from_name: input.fromName ?? null,
      to_email: input.toEmail,
      to_subscriber_id: input.toSubscriberId ?? null,
      reply_to: input.replyTo ?? null,
      subject: input.subject,
      html: input.html,
      text_body: input.text ?? null,
      headers: input.headers ?? null,
      campaign_id: input.campaignId ?? null,
      status: 'pending',
      next_retry_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw new Error(`queue insert failed: ${error.message}`);
  return { queued: true, id: data?.id };
}
