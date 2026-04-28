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
  learner_profile?: any;
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

export interface Team {
  id: string;
  team_name: string;
  admin_id: string | null;
  created_at: string;
}

export interface TaskWithProfiles extends AdminTask {
  assigned_admin?: AdminProfile | null;
  creator?: AdminProfile | null;
}

export interface TeamWithAdmin extends Team {
  admin?: AdminProfile | null;
  performance: number;
}

export interface SafetyLogEntry {
  id: string;
  category: string | null;
  ai_interpretation: string | null;
  created_at: string;
  user_name: string;
}

// ----- Service ----------------------------------------------------------
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
    return data as AdminProfile | null;
  },

  async listAdmins(): Promise<AdminProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 1)
      .order('full_name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as AdminProfile[];
  },

  async listTasks(): Promise<AdminTask[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as AdminTask[];
  },

  async createTask(input: {
    title: string;
    description?: string | null;
    assigned_to: string;
    deadline?: string | null;
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

    const { error: teamErr } = await supabase
      .from('teams')
      .update({ admin_id: userId })
      .eq('id', teamId);
    if (teamErr) throw teamErr;

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ is_team_leader: true, team_id: teamId })
      .eq('id', userId);
    if (profileErr) throw profileErr;
  },

  async listMyTeamBrief(targetTeamId?: string): Promise<{ team: Team | null; members: any[]; allTeams?: Team[] }> {
    const me = await AdminTaskService.getMyProfile();
    if (!me) return { team: null, members: [] };

    let effectiveTeamId = targetTeamId || me.team_id;
    let allTeams: Team[] = [];

    if (me.role === 2) {
      const { data: teams } = await supabase.from('teams').select('*').order('team_name');
      allTeams = teams || [];
      if (!effectiveTeamId && allTeams.length > 0) effectiveTeamId = allTeams[0].id;
    }

    if (!effectiveTeamId) return { team: null, members: [], allTeams };

    const [teamRes, membersRes] = await Promise.all([
      supabase.from('teams').select('*').eq('id', effectiveTeamId).maybeSingle(),
      supabase
        .from('profiles')
        .select('id, full_name, email, role, is_team_leader, last_seen_at, created_at')
        .eq('team_id', effectiveTeamId)
        .order('full_name', { ascending: true }),
    ]);

    if (teamRes.error) throw teamRes.error;
    if (membersRes.error) throw membersRes.error;

    const members = (membersRes.data ?? []) as any[];
    if (members.length === 0) return { team: teamRes.data, members: [], allTeams };

    const ids = members.map(m => m.id);
    
    // Fetch Learner Profiles and Skill States for everyone in the team at once
    const [lpRes, skillsRes] = await Promise.all([
      supabase.from('learner_profiles').select('*').in('id', ids),
      supabase.from('skill_states').select('*').in('user_id', ids)
    ]);

    const lpMap = new Map();
    (lpRes.data ?? []).forEach(lp => lpMap.set(lp.id, lp));

    const skillsMap = new Map();
    (skillsRes.data ?? []).forEach(s => {
      const cur = skillsMap.get(s.user_id) || [];
      cur.push(s);
      skillsMap.set(s.user_id, cur);
    });

    return {
      team: (teamRes.data ?? null) as Team | null,
      members: members.map(m => ({
        ...m,
        learner_profile: lpMap.get(m.id) || null,
        skills: skillsMap.get(m.id) || []
      })),
      allTeams
    };
  },

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

  async getMemberSkills(memberId: string): Promise<any> {
    const [skillsRes, profileRes] = await Promise.all([
      supabase.from('skill_states').select('*').eq('user_id', memberId),
      supabase.from('learner_profiles').select('*').eq('id', memberId).maybeSingle()
    ]);
    return {
      skills: skillsRes.data ?? [],
      profile: profileRes.data ?? null
    };
  },

  async logAuditAction(targetUserId: string, actionDetails: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const API_URL = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
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

  async getOverview(): Promise<{ totalStudents: number; totalAdmins: number; onlineAdmins: number }> {
    const { data: profiles, error } = await supabase.from('profiles').select('role, last_seen_at');
    if (error) throw error;

    const totalStudents = profiles.filter(p => p.role === 0).length;
    const totalAdmins = profiles.filter(p => p.role === 1 || p.role === 2).length;
    
    // Simple online heuristic: seen in last 5 minutes
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const onlineAdmins = profiles.filter(p => (p.role === 1 || p.role === 2) && p.last_seen_at && p.last_seen_at > fiveMinsAgo).length;

    return { totalStudents, totalAdmins, onlineAdmins };
  },

  async listTasksWithProfiles(): Promise<TaskWithProfiles[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assigned_admin:profiles!tasks_assigned_to_fkey(*),
        creator:profiles!tasks_created_by_fkey(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AdminTaskService] listTasksWithProfiles error:', error);
      throw error;
    }
    return (data || []) as TaskWithProfiles[];
  },

  async listTeamsWithAdmin(): Promise<TeamWithAdmin[]> {
    const { data, error } = await supabase
      .from('teams')
      .select(`
        *,
        admin:profiles!teams_admin_id_fkey(*)
      `)
      .order('team_name', { ascending: true });

    if (error) {
      console.error('[AdminTaskService] listTeamsWithAdmin error:', error);
      throw error;
    }

    // Add synthetic performance for the dashboard (can be replaced with real metrics later)
    return (data || []).map(t => ({
      ...t,
      performance: Math.floor(Math.random() * (98 - 85 + 1)) + 85 // Mock: 85% to 98%
    })) as TeamWithAdmin[];
  },

  async listSafetyLogs(limit = 10): Promise<SafetyLogEntry[]> {
    const { data: logs, error: logsError } = await supabase
      .from('user_error_analysis')
      .select('id, category, ai_interpretation, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (logsError) {
      console.error('[AdminTaskService] listSafetyLogs error:', logsError);
      throw logsError;
    }

    if (!logs || logs.length === 0) return [];

    const userIds = Array.from(new Set(logs.map(l => l.user_id).filter(Boolean)));
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    if (profilesError) {
      console.error('[AdminTaskService] listSafetyLogs profile fetch error:', profilesError);
      throw profilesError;
    }

    const profileMap = new Map(profiles?.map(p => [p.id, p]));

    return logs.map((log: any) => {
      const p = profileMap.get(log.user_id);
      return {
        id: log.id,
        category: log.category,
        ai_interpretation: log.ai_interpretation,
        created_at: log.created_at,
        user_name: p?.full_name || p?.email?.split('@')[0] || 'Unknown'
      };
    });
  },

  subscribeTasks(callbacks: { onInsert?: () => void; onUpdate?: () => void; onDelete?: () => void }) {
    const channel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          if (payload.eventType === 'INSERT' && callbacks.onInsert) callbacks.onInsert();
          if (payload.eventType === 'UPDATE' && callbacks.onUpdate) callbacks.onUpdate();
          if (payload.eventType === 'DELETE' && callbacks.onDelete) callbacks.onDelete();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
