import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

function esc(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

function toCsv(rows: Record<string, unknown>[], cols: string[]): string {
  const header = cols.join(',')
  const body = rows.map(r => cols.map(c => esc(r[c])).join(',')).join('\n')
  return `${header}\n${body}`
}

export async function GET(req: NextRequest) {
  const { role } = await requirePlatformAccess()
  if (role === 'support') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const type = req.nextUrl.searchParams.get('type') ?? 'restaurants'
  const admin = createSupabaseAdmin()

  if (type === 'restaurants') {
    const { data } = await admin
      .from('restaurants')
      .select('id, name, slug, plan, active, owner_id, created_at, trial_ends_at, stripe_subscription_id, online_payments_enabled')
      .order('created_at', { ascending: false })
    const rows = (data ?? []) as Record<string, unknown>[]
    const cols = ['id', 'name', 'slug', 'plan', 'active', 'owner_id', 'created_at', 'trial_ends_at', 'stripe_subscription_id', 'online_payments_enabled']
    return new NextResponse(toCsv(rows, cols), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="restaurants_${new Date().toISOString().slice(0,10)}.csv"`,
      },
    })
  }

  if (type === 'orders') {
    const days = Number(req.nextUrl.searchParams.get('days') ?? '30')
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await (admin as any)
      .from('orders')
      .select('id, restaurant_id, table_number, total, status, created_at, updated_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
    const rows = (data ?? []) as Record<string, unknown>[]
    const cols = ['id', 'restaurant_id', 'table_number', 'total', 'status', 'created_at', 'updated_at']
    return new NextResponse(toCsv(rows, cols), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="orders_${days}d_${new Date().toISOString().slice(0,10)}.csv"`,
      },
    })
  }

  if (type === 'audit') {
    if (role !== 'owner' && role !== 'co_founder') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    const { data } = await (admin as any)
      .from('platform_audit_log')
      .select('id, actor_email, action, target_type, target_id, target_name, details, created_at')
      .order('created_at', { ascending: false })
      .limit(5000)
    const rows = ((data ?? []) as Record<string, unknown>[]).map(r => ({
      ...r,
      details: r.details ? JSON.stringify(r.details) : '',
    }))
    const cols = ['id', 'actor_email', 'action', 'target_type', 'target_id', 'target_name', 'details', 'created_at']
    return new NextResponse(toCsv(rows, cols), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit_log_${new Date().toISOString().slice(0,10)}.csv"`,
      },
    })
  }

  return NextResponse.json({ error: 'unknown type' }, { status: 400 })
}
