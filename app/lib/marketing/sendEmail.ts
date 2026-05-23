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
  campaignId?: string | null;
}

export interface ImmediateEmailInput extends QueueEmailInput {
  /** Send synchronously, bypassing the queue. Use only for user-blocking flows (verification, order confirmation). */
  immediate: true;
}

const resend = new Resend(process.env.RESEND_API_KEY);

function formatFrom(input: QueueEmailInput): string {
  return input.fromName ? `${input.fromName} <${input.fromEmail}>` : input.fromEmail;
}

export async function sendEmail(
  input: QueueEmailInput | ImmediateEmailInput
): Promise<{ queued: boolean; id?: string }> {
  if ('immediate' in input && input.immediate) {
    const result = await resend.emails.send({
      from: formatFrom(input),
      to: input.toEmail,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
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
      campaign_id: input.campaignId ?? null,
      status: 'pending',
      next_retry_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw new Error(`queue insert failed: ${error.message}`);
  return { queued: true, id: data?.id };
}
