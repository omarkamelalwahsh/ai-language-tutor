import { supabase } from '../lib/supabaseClient';

// ----- Constants --------------------------------------------------------
/** The root super-admin email — immutable at both DB and UI layers. */
export const ROOT_ADMIN_EMAIL = 'omaralwahsh8719@gmail.com';

// ----- Types ------------------------------------------------------------
export type UserRole = 0 | 1 | 2; // 0=Student, 1=Admin, 2=SuperAdmin
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface AdminProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  team_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  last_seen_at?: string | null;
  is_team_leader?: boolean;
}

export interface TeamMemberBrief {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  is_team_leader: boolean;
  last_seen_at: string | null;
  created_at: string;
}

export interface MemberDeepDiveEntry {
  id: string;
  category: string | null;
  ai_interpretation: string | null;
  deep_insight: string | null;
  created_at: string;
}

export interface AdminTask {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  created_by: string | null;
  status: TaskStatus;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface SuperAdminCounts {
  totalStudents: number;
  activeAdmins: number;
}

export interface SuperAdminOverview {
  totalStudents: number;
  totalAdmins: number;
  onlineAdmins: number;          // admins with updated_at within last 15min
}

export interface TaskWithProfiles extends AdminTask {
  assigned_admin: AdminProfile | null;
  creator: AdminProfile | null;
}

export interface TeamWithAdmin {
  id: string;
  team_name: string;
  admin_id: string | null;
  created_at: string;
  admin: AdminProfile | null;
  member_count: number;
  performance: number;          // 0-100 placeholder/derived metric
}

export interface SafetyLogEntry {
  id: string;
  user_id: string | null;
  user_name: string | null;
  category: string | null;
  ai_interpretation: string | null;
  deep_insight: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  team_name: string;
  admin_id: string | null;
  created_at: string;
}

// ----- Profiles ---------------------------------------------------------
export const AdminTaskService = {
  async getMyProfile(): Promise<AdminProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[AdminTaskService] getMyProfile DB error:', error);
      return null;
    }
    
    console.log('[AdminTaskService] Found profile for:', user.id, 'Role:', data?.role);
    return data as AdminProfile | null;
  },

  // SuperAdmin only (RLS enforces)
  async listAdmins(): Promise<AdminProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 1)
      .order('full_name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as AdminProfile[];
  },

  async getCounts(): Promise<SuperAdminCounts> {
    const [students, admins] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 0),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 1),
    ]);
    if (students.error) throw students.error;
    if (admins.error) throw admins.error;
    return {
      totalStudents: students.count ?? 0,
      activeAdmins: admins.count ?? 0,
    };
  },

  async getOverview(): Promise<SuperAdminOverview> {
    // Fifteen-minute online window — heuristic since we have no last_seen column
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const [students, admins, online] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 0),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 1),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 1).gte('updated_at', since),
    ]);
    if (students.error) throw students.error;
    if (admins.error) throw admins.error;
    if (online.error) throw online.error;
    return {
      totalStudents: students.count ?? 0,
      totalAdmins: admins.count ?? 0,
      onlineAdmins: online.count ?? 0,
    };
  },

  /**
   * Fetch all tasks plus assigned-admin and creator profile records, joined client-side
   * to avoid relying on PostgREST FK alias names.
   */
  async listTasksWithProfiles(): Promise<TaskWithProfiles[]> {
    const [tasksRes, profilesRes] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ]);
    if (tasksRes.error) throw tasksRes.error;
    if (profilesRes.error) throw profilesRes.error;

    const profilesById = new Map<string, AdminProfile>();
    (profilesRes.data ?? []).forEach((p: any) => profilesById.set(p.id, p as AdminProfile));

    return (tasksRes.data ?? []).map((t: any) => ({
      ...(t as AdminTask),
      assigned_admin: t.assigned_to ? profilesById.get(t.assigned_to) ?? null : null,
      creator: t.created_by ? profilesById.get(t.created_by) ?? null : null,
    }));
  },

  /**
   * Teams with their admin profile + member count + a derived performance metric:
   * completion ratio of tasks assigned to the team's admin.
   */
  async listTeamsWithAdmin(): Promise<TeamWithAdmin[]> {
    const [teamsRes, profilesRes, tasksRes] = await Promise.all([
      supabase.from('teams').select('*').order('team_name', { ascending: true }),
      supabase.from('profiles').select('*'),
      supabase.from('tasks').select('id, assigned_to, status'),
    ]);
    if (teamsRes.error) throw teamsRes.error;
    if (profilesRes.error) throw profilesRes.error;
    if (tasksRes.error) throw tasksRes.error;

    const profilesById = new Map<string, AdminProfile>();
    (profilesRes.data ?? []).forEach((p: any) => profilesById.set(p.id, p as AdminProfile));

    const memberCountByTeam = new Map<string, number>();
    (profilesRes.data ?? []).forEach((p: any) => {
      if (!p.team_id) return;
      memberCountByTeam.set(p.team_id, (memberCountByTeam.get(p.team_id) ?? 0) + 1);
    });

    // Performance: completed-task ratio per admin
    const tasksByAdmin = new Map<string, { total: number; completed: number }>();
    (tasksRes.data ?? []).forEach((t: any) => {
      if (!t.assigned_to) return;
      const cur = tasksByAdmin.get(t.assigned_to) ?? { total: 0, completed: 0 };
      cur.total += 1;
      if (t.status === 'completed') cur.completed += 1;
      tasksByAdmin.set(t.assigned_to, cur);
    });

    return (teamsRes.data ?? []).map((team: any) => {
      const admin = team.admin_id ? profilesById.get(team.admin_id) ?? null : null;
      const stats = team.admin_id ? tasksByAdmin.get(team.admin_id) : undefined;
      const performance = stats && stats.total > 0
        ? Math.round((stats.completed / stats.total) * 100)
        : 0;
      return {
        id: team.id,
        team_name: team.team_name,
        admin_id: team.admin_id,
        created_at: team.created_at,
        admin,
        member_count: memberCountByTeam.get(team.id) ?? 0,
        performance,
      };
    });
  },

  async listSafetyLogs(limit = 8): Promise<SafetyLogEntry[]> {
    // Pull recent error_analysis rows; enrich with profile names
    const [errRes, profilesRes] = await Promise.all([
      supabase
        .from('user_error_analysis')
        .select('id, user_id, category, ai_interpretation, deep_insight, created_at')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase.from('profiles').select('id, full_name, email'),
    ]);
    if (errRes.error) throw errRes.error;
    if (profilesRes.error) throw profilesRes.error;

    const nameById = new Map<string, string>();
    (profilesRes.data ?? []).forEach((p: any) => {
      nameById.set(p.id, p.full_name || p.email || p.id.slice(0, 8));
    });
    return (errRes.data ?? []).map((e: any) => ({
      id: e.id,
      user_id: e.user_id,
      user_name: e.user_id ? nameById.get(e.user_id) ?? null : null,
      category: e.category,
      ai_interpretation: e.ai_interpretation,
      deep_insight: e.deep_insight,
      created_at: e.created_at,
    }));
  },

  // ----- Tasks ----------------------------------------------------------
  // SuperAdmin: sees all (RLS).  Admin: sees only assigned to them (RLS).
  async listTasks(): Promise<AdminTask[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as AdminTask[];
  },

  async listMyAssignedTasks(): Promise<AdminTask[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as AdminTask[];
  },

  async createTask(input: {
    title: string;
    description?: string | null;
    assigned_to: string;          // admin's UUID
    deadline?: string | null;     // ISO string
  }): Promise<AdminTask> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('UNAUTHORIZED');
    const payload = {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      assigned_to: input.assigned_to,
      created_by: user.id,
      status: 'pending' as TaskStatus,
      deadline: input.deadline || null,
    };
    const { data, error } = await supabase
      .from('tasks')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return data as AdminTask;
  },

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<AdminTask> {
    const { data, error } = await supabase
      .from('tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select('*')
      .single();
    if (error) throw error;
    return data as AdminTask;
  },

  // ----- Realtime -------------------------------------------------------
  /**
   * Subscribe to changes on the tasks table.  Returns an unsubscribe fn.
   * Caller can pass a `filter` (eg `assigned_to=eq.<uuid>`) for scoped streams.
   */
  subscribeTasks(opts: {
    filter?: string;
    onInsert?: (t: AdminTask) => void;
    onUpdate?: (t: AdminTask) => void;
    onDelete?: (t: AdminTask) => void;
  }): () => void {
    const channelName = `tasks-${opts.filter ?? 'all'}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    const config: any = { event: '*', schema: 'public', table: 'tasks' };
    if (opts.filter) config.filter = opts.filter;

    channel
      .on('postgres_changes', config, (payload: any) => {
        if (payload.eventType === 'INSERT') opts.onInsert?.(payload.new as AdminTask);
        else if (payload.eventType === 'UPDATE') opts.onUpdate?.(payload.new as AdminTask);
        else if (payload.eventType === 'DELETE') opts.onDelete?.(payload.old as AdminTask);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  // ----- Teams ----------------------------------------------------------

  async createTeam(teamName: string): Promise<Team> {
    const { data, error } = await supabase
      .from('teams')
      .insert({ team_name: teamName.trim() })
      .select('*')
      .single();
    if (error) throw error;
    return data as Team;
  },

  async deleteTeam(teamId: string): Promise<void> {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);
    if (error) throw error;
  },

  async getTeamMembers(teamId: string): Promise<AdminProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('team_id', teamId)
      .order('full_name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as AdminProfile[];
  },

  async assignTeamLeader(teamId: string, userId: string): Promise<void> {
    // 1. Clear previous leader for this team
    const { data: currentTeam } = await supabase
      .from('teams')
      .select('admin_id')
      .eq('id', teamId)
      .single();

    if (currentTeam?.admin_id) {
      await supabase
        .from('profiles')
        .update({ is_team_leader: false })
        .eq('id', currentTeam.admin_id);
    }

    // 2. Set the new leader
    const { error: teamErr } = await supabase
      .from('teams')
      .update({ admin_id: userId })
      .eq('id', teamId);
    if (teamErr) throw teamErr;

    // 3. Mark the user as team leader and assign them to the team
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ is_team_leader: true, team_id: teamId })
      .eq('id', userId);
    if (profileErr) throw profileErr;
  },

  async addMemberToTeam(userId: string, teamId: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ team_id: teamId })
      .eq('id', userId);
    if (error) throw error;
  },

  async removeMemberFromTeam(userId: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ team_id: null, is_team_leader: false })
      .eq('id', userId);
    if (error) throw error;
  },

  async reassignTeamMembers(fromTeamId: string, toTeamId: string | null): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ team_id: toTeamId, is_team_leader: false })
      .eq('team_id', fromTeamId);
    if (error) throw error;
  },

  // ----- Team Admin: scoped Brief / Deep Dive ---------------------------
  /**
   * Tier 1 — Brief view of the caller's team. RLS scopes profile rows
   * to the caller's team_id (or all rows for SuperAdmin).
   */
  async listMyTeamBrief(): Promise<{ team: Team | null; members: TeamMemberBrief[] }> {
    const me = await AdminTaskService.getMyProfile();
    if (!me?.team_id) return { team: null, members: [] };

    const [teamRes, membersRes] = await Promise.all([
      supabase.from('teams').select('*').eq('id', me.team_id).maybeSingle(),
      supabase
        .from('profiles')
        .select('id, full_name, email, role, is_team_leader, last_seen_at, created_at')
        .eq('team_id', me.team_id)
        .order('full_name', { ascending: true }),
    ]);

    if (teamRes.error) throw teamRes.error;
    if (membersRes.error) throw membersRes.error;

    return {
      team: (teamRes.data ?? null) as Team | null,
      members: (membersRes.data ?? []) as TeamMemberBrief[],
    };
  },

  /**
   * Tier 2 — Deep Dive on a specific team member. Pulls the member's
   * detailed interaction data (error analysis: questions, AI interpretation,
   * insights). RLS rejects access if the target is not in the caller's team.
   */
  async getMemberDeepDive(memberId: string, limit = 50): Promise<MemberDeepDiveEntry[]> {
    const { data, error } = await supabase
      .from('user_error_analysis')
      .select('id, category, ai_interpretation, deep_insight, created_at')
      .eq('user_id', memberId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as MemberDeepDiveEntry[];
  },

  /** Updates the caller's own last_seen_at. Safe to call on every session start. */
  async bumpLastSeen(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', user.id);
  },

  /** Logs an action for Tier 2 auditing (e.g., Deep Dive view) */
  async logAuditAction(targetUserId: string, actionDetails: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    // As per requirement: "POST request to /api/audit-logs to record that Admin [X] accessed Member [Y]'s data."
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
    
    try {
      await fetch(`${API_URL}/audit-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          admin_id: session.user.id,
          target_user_id: targetUserId,
          action: actionDetails
        })
      });
    } catch (e) {
      console.error('Failed to log audit action via API', e);
    }
  },
};
