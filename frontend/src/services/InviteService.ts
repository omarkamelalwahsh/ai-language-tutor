import { supabase } from '../lib/supabaseClient';

export interface TeamInvite {
  id: string;
  token: string;
  team_id: string;
  team_name?: string | null;
  role: 0 | 1;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
  used_at: string | null;
  used_by: string | null;
  note: string | null;
}

export interface InvitePeek {
  team_name: string;
  is_used: boolean;
  is_expired: boolean;
}

const INVITE_TOKEN_BYTES = 24;

const generateToken = (): string => {
  const bytes = new Uint8Array(INVITE_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  // base64url-style: A-Z a-z 0-9 - _
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export const buildInviteUrl = (token: string): string => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/register?token=${token}`;
};

export const InviteService = {
  /**
   * Generates a one-time invite link that, when consumed, assigns the new user
   * the specified role and attaches them to the specified team.
   * Root Admins can assign role 1 (Team Admin).
   * Team Admins should assign role 0 (Member) to their own team.
   */
  async createInvite(opts: {
    teamId: string;
    roleToAssign?: 0 | 1;
    expiresInDays?: number;
    note?: string;
  }): Promise<TeamInvite> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('UNAUTHENTICATED');

    const token = generateToken();
    const expires_at = opts.expiresInDays
      ? new Date(Date.now() + opts.expiresInDays * 86_400_000).toISOString()
      : null;

    const { data, error } = await supabase
      .from('team_invites')
      .insert({
        token,
        team_id: opts.teamId,
        role: opts.roleToAssign ?? 1,
        created_by: user.id,
        expires_at,
        note: opts.note ?? null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data as TeamInvite;
  },

  async listInvitesForTeam(teamId: string): Promise<TeamInvite[]> {
    const { data, error } = await supabase
      .from('team_invites')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as TeamInvite[];
  },

  async listAllInvites(): Promise<TeamInvite[]> {
    const [invitesRes, teamsRes] = await Promise.all([
      supabase.from('team_invites').select('*').order('created_at', { ascending: false }),
      supabase.from('teams').select('id, team_name'),
    ]);
    if (invitesRes.error) throw invitesRes.error;
    if (teamsRes.error) throw teamsRes.error;
    const teamNameById = new Map<string, string>();
    (teamsRes.data ?? []).forEach((t: any) => teamNameById.set(t.id, t.team_name));
    return (invitesRes.data ?? []).map((i: any) => ({
      ...i,
      team_name: teamNameById.get(i.team_id) ?? null,
    })) as TeamInvite[];
  },

  async revokeInvite(inviteId: string): Promise<void> {
    const { error } = await supabase
      .from('team_invites')
      .delete()
      .eq('id', inviteId);
    if (error) throw error;
  },

  /**
   * Public preview — exposed via SECURITY DEFINER RPC, callable by anon.
   */
  async peekInvite(token: string): Promise<InvitePeek | null> {
    const { data, error } = await supabase.rpc('peek_team_invite', { p_token: token });
    if (error) throw error;
    const rows = (data ?? []) as InvitePeek[];
    return rows[0] ?? null;
  },

  /**
   * Consumes the invite for the *currently authenticated* user.
   * Sets role=1 and attaches them to the invite's team. Marks invite used.
   */
  async consumeInvite(token: string): Promise<{ team_id: string; team_name: string }> {
    const { data, error } = await supabase.rpc('consume_team_invite', { p_token: token });
    if (error) throw error;
    const rows = (data ?? []) as Array<{ team_id: string; team_name: string; role: number }>;
    if (!rows.length) throw new Error('INVITE_RPC_EMPTY');
    return { team_id: rows[0].team_id, team_name: rows[0].team_name };
  },
};
