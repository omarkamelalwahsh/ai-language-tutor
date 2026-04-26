import { supabase } from '../lib/supabaseClient';

export type AuditAction =
  | 'deep_dive_view'
  | 'role_change'
  | 'team_change'
  | 'invite_consumed'
  | 'invite_created'
  | 'invite_revoked';

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: number | null;
  action: AuditAction;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export const AuditService = {
  /**
   * Records an action performed by the current user.
   * RLS: actor_id must equal auth.uid(), so we always pull it server-side.
   */
  async log(input: {
    action: AuditAction;
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // silent no-op when unauthenticated; RLS would reject anyway

    const { error } = await supabase.from('audit_logs').insert({
      actor_id: user.id,
      actor_email: user.email ?? null,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      metadata: input.metadata ?? null,
    });

    if (error) console.warn('[AuditService] log failed:', error.message);
  },

  /** Root Admin only — RLS enforced. */
  async list(opts: { limit?: number; action?: AuditAction } = {}): Promise<AuditLogEntry[]> {
    let q = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 50);
    if (opts.action) q = q.eq('action', opts.action);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as AuditLogEntry[];
  },
};
