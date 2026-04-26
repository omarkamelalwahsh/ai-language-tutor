import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Users, Crown, Loader2, Search, Trash2,
  UserPlus, UserMinus, ChevronDown, Sparkles, ShieldCheck,
  Link2, Copy, Check,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AdminTaskService, AdminProfile, TeamWithAdmin,
} from '../../services/AdminTaskService';
import { SuperAdminService } from '../../services/SuperAdminService';
import { InviteService, buildInviteUrl, TeamInvite } from '../../services/InviteService';
import { useAdminToast } from './AdminToast';
import { DeleteTeamModal } from './DeleteTeamModal';

// Visual tokens matching SuperAdminDashboardView
const CARD = 'bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl';

const TeamsHubView: React.FC = () => {
  const qc = useQueryClient();
  const toast = useAdminToast();

  // ── Local state ─────────────────────────────────────────────────────
  const [newTeamName, setNewTeamName] = useState('');
  const [leaderSearch, setLeaderSearch] = useState('');
  const [selectedTeamForLeader, setSelectedTeamForLeader] = useState('');
  const [selectedLeaderUser, setSelectedLeaderUser] = useState('');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamWithAdmin | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null);
  const [inviteTarget, setInviteTarget] = useState<TeamWithAdmin | null>(null);
  const [generatedInvite, setGeneratedInvite] = useState<TeamInvite | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────
  const teamsQuery = useQuery({
    queryKey: ['superadmin', 'teams'],
    queryFn: () => AdminTaskService.listTeamsWithAdmin(),
  });

  const usersQuery = useQuery({
    queryKey: ['superadmin', 'users'],
    queryFn: () => SuperAdminService.getAllUsers(),
  });

  const membersQuery = useQuery({
    queryKey: ['superadmin', 'teamMembers', expandedTeamId],
    queryFn: () => AdminTaskService.getTeamMembers(expandedTeamId!),
    enabled: !!expandedTeamId,
  });

  const teams = teamsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const admins = users.filter(u => u.role >= 1);
  const members = membersQuery.data ?? [];

  // Filtered admins for leader search
  const filteredAdmins = admins.filter(a => {
    const s = leaderSearch.toLowerCase();
    return (a.full_name?.toLowerCase().includes(s) || a.email?.toLowerCase().includes(s));
  });

  // ── Mutations ───────────────────────────────────────────────────────
  const createTeamMut = useMutation({
    mutationFn: (name: string) => AdminTaskService.createTeam(name),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ['superadmin', 'teams'] });
      toast.push({ kind: 'success', title: 'Team Created', body: `"${t.team_name}" is now active.` });
      setNewTeamName('');
    },
    onError: (e: any) => toast.push({ kind: 'error', title: 'Creation Failed', body: e.message }),
  });

  const assignLeaderMut = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      AdminTaskService.assignTeamLeader(teamId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin', 'teams'] });
      qc.invalidateQueries({ queryKey: ['superadmin', 'users'] });
      toast.push({ kind: 'success', title: 'Leader Assigned', body: 'Team leader updated successfully.' });
      setSelectedLeaderUser('');
      setSelectedTeamForLeader('');
    },
    onError: (e: any) => toast.push({ kind: 'error', title: 'Assignment Failed', body: e.message }),
  });

  const addMemberMut = useMutation({
    mutationFn: ({ userId, teamId }: { userId: string; teamId: string }) =>
      AdminTaskService.addMemberToTeam(userId, teamId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin', 'teams'] });
      qc.invalidateQueries({ queryKey: ['superadmin', 'teamMembers'] });
      toast.push({ kind: 'success', title: 'Member Added', body: 'User added to team.' });
      setAddMemberTeamId(null);
      setMemberSearch('');
    },
    onError: (e: any) => toast.push({ kind: 'error', title: 'Add Failed', body: e.message }),
  });

  const removeMemberMut = useMutation({
    mutationFn: (userId: string) => AdminTaskService.removeMemberFromTeam(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin', 'teams'] });
      qc.invalidateQueries({ queryKey: ['superadmin', 'teamMembers'] });
      toast.push({ kind: 'success', title: 'Member Removed', body: 'User removed from team.' });
    },
  });

  const createInviteMut = useMutation({
    mutationFn: (teamId: string) => InviteService.createInvite({ teamId, expiresInDays: 7 }),
    onSuccess: (invite) => {
      setGeneratedInvite(invite);
      setCopied(false);
    },
    onError: (e: any) => toast.push({ kind: 'error', title: 'Invite Failed', body: e.message }),
  });

  const openInviteFor = (team: TeamWithAdmin) => {
    setInviteTarget(team);
    setGeneratedInvite(null);
    setCopied(false);
    createInviteMut.mutate(team.id);
  };

  const closeInvite = () => {
    setInviteTarget(null);
    setGeneratedInvite(null);
    setCopied(false);
  };

  const copyInviteUrl = async () => {
    if (!generatedInvite) return;
    try {
      await navigator.clipboard.writeText(buildInviteUrl(generatedInvite.token));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.push({ kind: 'error', title: 'Copy Failed', body: 'Could not access clipboard.' });
    }
  };

  // Users available to add (not already in this team)
  const availableUsers = users.filter(u => {
    if (expandedTeamId && u.team_id === expandedTeamId) return false;
    const s = memberSearch.toLowerCase();
    return (u.full_name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s));
  });

  return (
    <>
      <div className="flex flex-col gap-8">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-cyan-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight uppercase">
              Teams <span className="text-cyan-400">Hub</span>
            </h2>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mt-0.5">
              Department & Team Management Console
            </p>
          </div>
        </div>

        {/* ── Row 1: Create Team + Assign Leader ──────────── */}
        <div className="grid grid-cols-12 gap-6">
          {/* Create Team */}
          <div className={`${CARD} col-span-5 p-8 rounded-[32px] flex flex-col gap-5 group hover:border-white/10 transition-all duration-500`}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Plus size={14} className="text-cyan-400" />
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">New Department</p>
              </div>
              <h3 className="text-white font-bold text-xl tracking-tight">Create Team</h3>
            </div>

            <div className="flex gap-3">
              <input
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                placeholder="Engineering, Sales, Design…"
                className="flex-1 bg-black/40 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/15 focus:outline-none focus:border-cyan-400/40 transition-all"
                onKeyDown={e => { if (e.key === 'Enter' && newTeamName.trim()) createTeamMut.mutate(newTeamName); }}
              />
              <button
                onClick={() => { if (newTeamName.trim()) createTeamMut.mutate(newTeamName); }}
                disabled={!newTeamName.trim() || createTeamMut.isPending}
                className="bg-white text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-400 transition-all hover:scale-105 active:scale-95 shadow-[0_10px_20px_rgba(255,255,255,0.1)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {createTeamMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Create
              </button>
            </div>
          </div>

          {/* Assign Leader */}
          <div className={`${CARD} col-span-7 p-8 rounded-[32px] flex flex-col gap-5 group hover:border-white/10 transition-all duration-500`}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Crown size={14} className="text-amber-400" />
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Leadership Assignment</p>
              </div>
              <h3 className="text-white font-bold text-xl tracking-tight">Assign Team Leader</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] font-black uppercase text-white/30 tracking-widest mb-2 block">Team</span>
                <select
                  value={selectedTeamForLeader}
                  onChange={e => setSelectedTeamForLeader(e.target.value)}
                  className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400/40 transition-all appearance-none cursor-pointer"
                >
                  <option value="" className="bg-[#0F1015]">Select team…</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id} className="bg-[#0F1015]">{t.team_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-white/30 tracking-widest mb-2 block">Leader (Admin)</span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                  <input
                    value={leaderSearch}
                    onChange={e => { setLeaderSearch(e.target.value); setSelectedLeaderUser(''); }}
                    placeholder="Search admin…"
                    className="w-full bg-black/40 border border-white/[0.06] rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder:text-white/15 focus:outline-none focus:border-cyan-400/40 transition-all"
                  />
                </div>
                {leaderSearch && !selectedLeaderUser && (
                  <div className="mt-1 bg-[#0F1015] border border-white/10 rounded-xl max-h-40 overflow-y-auto">
                    {filteredAdmins.length === 0 ? (
                      <p className="p-3 text-xs text-white/30">No admins found</p>
                    ) : filteredAdmins.slice(0, 6).map(a => (
                      <button
                        key={a.id}
                        onClick={() => { setSelectedLeaderUser(a.id); setLeaderSearch(a.full_name || a.email || ''); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-[10px] font-black text-white/40">
                          {(a.full_name || 'U')[0].toUpperCase()}
                        </div>
                        {a.full_name || a.email}
                        <span className="text-[9px] ml-auto font-black uppercase tracking-widest text-cyan-400/60">
                          {a.role === 2 ? 'Super' : 'Admin'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => { if (selectedTeamForLeader && selectedLeaderUser) assignLeaderMut.mutate({ teamId: selectedTeamForLeader, userId: selectedLeaderUser }); }}
              disabled={!selectedTeamForLeader || !selectedLeaderUser || assignLeaderMut.isPending}
              className="self-end bg-amber-500/10 border border-amber-500/20 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-amber-400 hover:bg-amber-500 hover:text-black disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {assignLeaderMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Crown size={14} />}
              Promote to Leader
            </button>
          </div>
        </div>

        {/* ── Row 2: Team Overview Cards ──────────────────── */}
        <section className={`${CARD} p-8 rounded-[32px] flex flex-col gap-6 group hover:border-white/10 transition-all duration-500 relative overflow-hidden`}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />

          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users size={14} className="text-emerald-400" />
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Organization Map</p>
              </div>
              <h3 className="text-white font-bold text-xl tracking-tight">Team Overview</h3>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-[10px] font-bold text-white/60">
              <Sparkles size={12} className="text-cyan-400" /> {teams.length} Active Teams
            </div>
          </div>

          {teamsQuery.isLoading ? (
            <div className="grid grid-cols-3 gap-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-48 bg-white/[0.02] rounded-3xl animate-pulse border border-white/[0.03]" />
              ))}
            </div>
          ) : teams.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center gap-4 bg-white/[0.01] border border-dashed border-white/10 rounded-3xl">
              <Users size={40} className="text-white/10" />
              <div>
                <p className="text-white/60 font-bold">No teams created yet</p>
                <p className="text-xs text-white/20 mt-1">Create your first team above to get started</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-5">
              <AnimatePresence>
                {teams.map(team => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    isExpanded={expandedTeamId === team.id}
                    onToggle={() => setExpandedTeamId(prev => prev === team.id ? null : team.id)}
                    onDelete={() => setDeleteTarget(team)}
                    onInvite={() => openInviteFor(team)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* ── Row 3: Expanded Team Members Panel ─────────── */}
        <AnimatePresence>
          {expandedTeamId && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`${CARD} p-8 rounded-[32px] flex flex-col gap-6 overflow-hidden`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-cyan-400/70 uppercase tracking-widest">
                    {teams.find(t => t.id === expandedTeamId)?.team_name} — Members
                  </p>
                  <h3 className="text-white font-bold text-lg tracking-tight">Team Roster</h3>
                </div>
                <button
                  onClick={() => setAddMemberTeamId(addMemberTeamId ? null : expandedTeamId)}
                  className="bg-white/[0.03] border border-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white hover:border-white/20 transition-all flex items-center gap-2"
                >
                  <UserPlus size={14} /> Add Member
                </button>
              </div>

              {/* Add Member Search */}
              <AnimatePresence>
                {addMemberTeamId && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4"
                  >
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                      <input
                        value={memberSearch}
                        onChange={e => setMemberSearch(e.target.value)}
                        placeholder="Search users to add…"
                        className="w-full bg-black/40 border border-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/15 focus:outline-none focus:border-cyan-400/40 transition-all"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {availableUsers.slice(0, 8).map(u => (
                        <button
                          key={u.id}
                          onClick={() => addMemberMut.mutate({ userId: u.id, teamId: expandedTeamId! })}
                          disabled={addMemberMut.isPending}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left"
                        >
                          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-white/40 border border-white/5">
                            {(u.full_name || 'U')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white/80 font-medium truncate">{u.full_name || 'Anonymous'}</p>
                            <p className="text-[10px] text-white/30">{u.email}</p>
                          </div>
                          <UserPlus size={14} className="text-cyan-400/60" />
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Member List */}
              {membersQuery.isLoading ? (
                <div className="h-20 bg-white/[0.02] rounded-2xl animate-pulse" />
              ) : members.length === 0 ? (
                <p className="text-center py-10 text-xs text-white/20 border border-dashed border-white/10 rounded-2xl">
                  No members in this team yet
                </p>
              ) : (
                <div className="space-y-2">
                  {members.map(m => (
                    <div key={m.id} className="flex items-center gap-4 bg-white/[0.02] border border-white/[0.05] p-4 rounded-2xl hover:bg-white/[0.04] transition-all group/member">
                      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-xs font-black text-white/40 border border-white/5">
                        {(m.full_name || 'U')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-bold truncate">{m.full_name || 'Anonymous'}</p>
                        <p className="text-[10px] text-white/30">{m.email}</p>
                      </div>
                      {(m as any).is_team_leader && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center gap-1">
                          <Crown size={10} /> Leader
                        </span>
                      )}
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${
                        m.role === 2 ? 'text-purple-400 border-purple-500/20 bg-purple-500/5' :
                        m.role === 1 ? 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5' :
                        'text-slate-400 border-white/10 bg-white/5'
                      }`}>
                        {m.role === 2 ? 'SUPER' : m.role === 1 ? 'ADMIN' : 'STUDENT'}
                      </span>
                      <button
                        onClick={() => removeMemberMut.mutate(m.id)}
                        disabled={removeMemberMut.isPending}
                        className="p-2 text-white/10 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover/member:opacity-100"
                      >
                        <UserMinus size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* Delete Team Modal */}
      <DeleteTeamModal
        open={!!deleteTarget}
        team={deleteTarget}
        allTeams={teams}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => toast.push({ kind: 'success', title: 'Team Deleted', body: 'Team has been permanently removed.' })}
      />

      {/* Invite Link Modal */}
      <AnimatePresence>
        {inviteTarget && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={closeInvite} />
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="relative w-full max-w-lg bg-[#0F1015] border border-white/[0.08] rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.6)] overflow-hidden"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

              <header className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-white/[0.05]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center justify-center text-cyan-400">
                    <Link2 size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-cyan-400/70 uppercase tracking-widest">Team Admin Invite</p>
                    <h2 className="text-white font-bold text-lg tracking-tight">{inviteTarget.team_name}</h2>
                  </div>
                </div>
                <button
                  onClick={closeInvite}
                  className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Sparkles size={16} />
                </button>
              </header>

              <div className="px-6 py-5 flex flex-col gap-4">
                {createInviteMut.isPending && (
                  <div className="flex items-center justify-center gap-3 py-8 text-white/40">
                    <Loader2 size={18} className="animate-spin" />
                    <span className="text-sm font-bold">Generating one-time invite link…</span>
                  </div>
                )}

                {generatedInvite && (
                  <>
                    <p className="text-xs text-white/50 leading-relaxed">
                      Share this link with the new Team Admin. When they sign up, they'll be
                      automatically assigned the <span className="text-cyan-400 font-bold">Team Admin</span> role
                      and added to <span className="text-white font-bold">{inviteTarget.team_name}</span>.
                    </p>

                    <div className="bg-black/40 border border-white/10 rounded-xl p-3 flex items-center gap-2">
                      <code className="flex-1 text-xs text-cyan-300 font-mono truncate select-all">
                        {buildInviteUrl(generatedInvite.token)}
                      </code>
                      <button
                        onClick={copyInviteUrl}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                          copied
                            ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                            : 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500 hover:text-black'
                        }`}
                      >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[10px] font-bold uppercase tracking-widest">
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                        <p className="text-white/30 mb-0.5">Role on accept</p>
                        <p className="text-cyan-400">Team Admin</p>
                      </div>
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                        <p className="text-white/30 mb-0.5">Expires</p>
                        <p className="text-white/80">
                          {generatedInvite.expires_at
                            ? new Date(generatedInvite.expires_at).toLocaleDateString()
                            : 'Never'}
                        </p>
                      </div>
                    </div>

                    <p className="text-[10px] text-white/30 italic">
                      One-time use. The link is invalidated after the first signup.
                    </p>
                  </>
                )}

                {createInviteMut.isError && (
                  <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-2.5 text-red-400 text-xs font-bold">
                    {(createInviteMut.error as Error)?.message || 'Failed to generate invite.'}
                  </div>
                )}
              </div>

              <footer className="px-6 py-4 border-t border-white/[0.05] flex justify-end bg-black/20">
                <button
                  onClick={closeInvite}
                  className="bg-white/[0.05] border border-white/10 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/70 hover:bg-white/10 hover:text-white transition-all"
                >
                  Done
                </button>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// ─── Team Card ──────────────────────────────────────────────────────────
const TeamCard: React.FC<{
  team: TeamWithAdmin;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onInvite: () => void;
}> = ({ team, isExpanded, onToggle, onDelete, onInvite }) => (
  <motion.div
    layout
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className={`bg-white/[0.02] border rounded-3xl p-6 flex flex-col gap-4 hover:bg-white/[0.04] transition-all cursor-pointer group relative overflow-hidden ${
      isExpanded ? 'border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.05)]' : 'border-white/[0.05]'
    }`}
    onClick={onToggle}
  >
    <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/[0.02] group-hover:bg-cyan-500/[0.04] rounded-bl-full transition-colors pointer-events-none" />

    {/* Header */}
    <div className="flex items-center justify-between relative z-10">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/10 flex items-center justify-center text-cyan-400 text-base font-black group-hover:scale-110 transition-transform">
          {team.team_name[0]?.toUpperCase()}
        </div>
        <div>
          <p className="text-white font-bold text-sm">{team.team_name}</p>
          <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
            ID: {team.id.slice(0, 8)}
          </p>
        </div>
      </div>
      <ChevronDown
        size={16}
        className={`text-white/20 transition-transform ${isExpanded ? 'rotate-180 text-cyan-400' : ''}`}
      />
    </div>

    {/* Leader */}
    <div className="flex items-center gap-2 relative z-10">
      {team.admin ? (
        <>
          <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Crown size={10} className="text-amber-400" />
          </div>
          <p className="text-xs text-white/60 font-medium truncate">
            {team.admin.full_name || team.admin.email}
          </p>
        </>
      ) : (
        <p className="text-xs text-white/20 italic">No leader assigned</p>
      )}
    </div>

    {/* Stats Row */}
    <div className="flex items-center justify-between relative z-10">
      <div className="flex items-center gap-1.5 text-white/40">
        <Users size={12} />
        <span className="text-xs font-bold">{team.member_count}</span>
        <span className="text-[10px] text-white/20">members</span>
      </div>
      <span className="text-xs font-black text-emerald-400">{team.performance}%</span>
    </div>

    {/* Performance Bar */}
    <div className="w-full h-1 bg-white/[0.03] rounded-full overflow-hidden border border-white/5 relative z-10">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${team.performance}%` }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className="h-full bg-gradient-to-r from-cyan-600 to-emerald-500 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.3)]"
      />
    </div>

    {/* Top-right action cluster */}
    <div className="absolute top-4 right-4 flex items-center gap-1 z-10">
      <button
        onClick={e => { e.stopPropagation(); onInvite(); }}
        className="p-2 text-white/0 group-hover:text-white/20 hover:!text-cyan-400 hover:bg-cyan-400/10 rounded-lg transition-all"
        title="Invite Team Admin"
      >
        <Link2 size={14} />
      </button>
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        className="p-2 text-white/0 group-hover:text-white/20 hover:!text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
        title="Delete team"
      >
        <Trash2 size={14} />
      </button>
    </div>
  </motion.div>
);

export { TeamsHubView };
export default TeamsHubView;
