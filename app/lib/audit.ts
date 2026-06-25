import { createSupabaseAdmin } from './supabase-admin'

type AuditParams = {
  actor_email: string
  action: string
  target_type?: string
  target_id?: string
  target_name?: string
  details?: Record<string, unknown>
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const admin = createSupabaseAdmin()
    await admin.from('platform_audit_log').insert(params)
  } catch {
    // audit failures must never break main flow
  }
}
