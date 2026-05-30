import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail } from '@/lib/marketing/sendEmail'
import { buildCampaignEmail } from '@/lib/marketing/campaignEmail'
import { generateDiscountCode } from '@/lib/marketing/generateDiscountCode'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
const FROM_EMAIL = process.env.RESEND_FROM ?? 'onboarding@resend.dev'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseAdmin()
  const today = new Date().toISOString().slice(0, 10)
  let enrolled = 0
  let sent = 0
  let skipped = 0

  // ── Phase 1: Neue Enrollments ─────────────────────────────────
  const { data: sequences } = await supabase
    .from('drip_sequences')
    .select('id, restaurant_id, trigger_days')
    .eq('enabled', true)

  for (const seq of sequences ?? []) {
    const cutoff = new Date(Date.now() - seq.trigger_days * 86400 * 1000).toISOString()

    const { data: candidates } = await supabase
      .from('marketing_subscribers')
      .select('id')
      .eq('restaurant_id', seq.restaurant_id)
      .not('opted_in_at', 'is', null)
      .is('unsubscribed_at', null)
      .not('last_order_at', 'is', null)
      .lte('last_order_at', cutoff)

    for (const sub of candidates ?? []) {
      const { data: existing } = await supabase
        .from('drip_enrollments')
        .select('id, completed_at')
        .eq('sequence_id', seq.id)
        .eq('subscriber_id', sub.id)
        .maybeSingle()

      if (existing) {
        if (!existing.completed_at) continue // already active
        // Re-enroll completed subscriber
        await supabase
          .from('drip_enrollments')
          .update({ current_step: 0, next_due_at: today, completed_at: null, enrolled_at: new Date().toISOString() })
          .eq('id', existing.id)
        enrolled++
      } else {
        await supabase
          .from('drip_enrollments')
          .insert({ sequence_id: seq.id, subscriber_id: sub.id, current_step: 0, next_due_at: today })
        enrolled++
      }
    }
  }

  // ── Phase 2: Fällige Steps versenden ──────────────────────────
  const { data: dueEnrollments } = await supabase
    .from('drip_enrollments')
    .select('id, sequence_id, subscriber_id, current_step')
    .is('completed_at', null)
    .lte('next_due_at', today)

  for (const enrollment of dueEnrollments ?? []) {
    const { data: steps } = await supabase
      .from('drip_steps')
      .select('*')
      .eq('sequence_id', enrollment.sequence_id)
      .order('position', { ascending: true })

    if (!steps || steps.length === 0) {
      await supabase
        .from('drip_enrollments')
        .update({ completed_at: new Date().toISOString(), stop_reason: 'completed' })
        .eq('id', enrollment.id)
      continue
    }

    if (enrollment.current_step >= steps.length) {
      await supabase
        .from('drip_enrollments')
        .update({ completed_at: new Date().toISOString(), stop_reason: 'completed' })
        .eq('id', enrollment.id)
      skipped++
      continue
    }

    const step = steps[enrollment.current_step]

    const { data: sub } = await supabase
      .from('marketing_subscribers')
      .select('id, email, name')
      .eq('id', enrollment.subscriber_id)
      .maybeSingle()

    if (!sub?.email) { skipped++; continue }

    const { data: sequence } = await supabase
      .from('drip_sequences')
      .select('restaurant_id')
      .eq('id', enrollment.sequence_id)
      .single()

    if (!sequence) { skipped++; continue }

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, slug, logo_url, primary_color')
      .eq('id', sequence.restaurant_id)
      .maybeSingle()

    if (!restaurant) { skipped++; continue }

    let code: string | null = null
    let expiresAt: Date | null = null

    if (step.discount_type && step.discount_value) {
      code = generateDiscountCode('EVT')
      expiresAt = new Date(Date.now() + (step.expires_days ?? 7) * 86400 * 1000)

      const { error: codeErr } = await supabase.from('discount_codes').insert({
        restaurant_id: restaurant.id,
        subscriber_id: sub.id,
        drip_step_id: step.id,
        code,
        discount_type: step.discount_type,
        discount_value: step.discount_value,
        expires_at: expiresAt.toISOString(),
      })
      if (codeErr) { skipped++; continue }
    }

    const discountLabel = step.discount_type && step.discount_value
      ? step.discount_type === 'percent' ? `${step.discount_value} % Rabatt` : `${step.discount_value} € Rabatt`
      : null

    const unsubToken = Buffer.from(`${sub.id}:unsub`).toString('base64url')
    const unsubscribeUrl = `${APP_URL}/unsubscribe?t=${unsubToken}`
    const ctaUrl = code ? `${APP_URL}/bestellen/${restaurant.slug}?code=${code}` : `${APP_URL}/bestellen/${restaurant.slug}`

    const { subject, html, text, headers } = buildCampaignEmail({
      customerName: sub.name,
      restaurantName: restaurant.name,
      restaurantLogoUrl: restaurant.logo_url,
      primaryColor: restaurant.primary_color ?? '#EA580C',
      subject: step.subject,
      headline: step.headline,
      bodyText: step.body_text,
      code,
      discountLabel,
      expiresAt,
      ctaUrl,
      unsubscribeUrl,
    })

    try {
      await sendEmail({
        restaurantId: restaurant.id,
        fromEmail: FROM_EMAIL,
        fromName: restaurant.name,
        toEmail: sub.email,
        toSubscriberId: sub.id,
        subject,
        html,
        text,
        headers,
        immediate: true,
      })
    } catch {
      skipped++
      continue
    }

    const isLastStep = enrollment.current_step >= steps.length - 1
    const nextStep = enrollment.current_step + 1
    const nextStepData = steps[nextStep]
    const nextDue = new Date(Date.now() + (nextStepData?.delay_days ?? 7) * 86400 * 1000).toISOString().slice(0, 10)

    await supabase
      .from('drip_enrollments')
      .update(
        isLastStep
          ? { current_step: nextStep, completed_at: new Date().toISOString(), stop_reason: 'completed' }
          : { current_step: nextStep, next_due_at: nextDue }
      )
      .eq('id', enrollment.id)

    sent++
  }

  return NextResponse.json({ enrolled, sent, skipped })
}
