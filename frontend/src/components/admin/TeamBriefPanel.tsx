import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Users, Crown, Eye, Activity, Clock, Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AdminTaskService } from '../../services/AdminTaskService';
import { MemberDeepDiveModal } from './MemberDeepDiveModal';
import { TeamAdminInviteModal } from './TeamAdminInviteModal';
import { useUserRole } from '../../hooks/useUserRole';

const fmtRelative = (iso: string | null): string => {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

const isOnline = (iso: string | null): boolean => {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 15 * 60 * 1000;
};

// Muted background badge styles — light bg + dark text in light mode, dark bg + light text in dark mode
const ROLE_BADGE: Record<number, string> = {
  2: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30',
  1: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30',
  0: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-300 dark:border-zinc-700',
};

const ROLE_LABEL: Record<number, string> = { 2: 'Super', 1: 'Admin', 0: 'Student' };

export const TeamBriefPanel: React.FC = () => {
  const [diveTarget, setDiveTarget] = useState<{ id: string; name: string } | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const { role } = useUserRole();

  const briefQuery = useQuery({
    queryKey: ['team', 'brief'],
    queryFn: () => AdminTaskService.listMyTeamBrief(),
  });

  const team = briefQuery.data?.team;
  const members = briefQuery.data?.members ?? [];
  const onlineCount = members.filter(m => isOnline(m.last_seen_at)).length;

  return (
    <>
      <section
        className="relative overflow-hidden rounded-3xl
                   bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md
                   border border-white/20 dark:border-zinc-800/50
                   shadow-sm dark:shadow-[0_0_20px_rgba(0,0,0,0.5)]
                   p-8 flex flex-col gap-6"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

        <header className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-sm">
              <Users size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-zinc-900 dark:text-zinc-50 font-bold text-xl tracking-tight">
                  {team?.team_name ?? 'My Team'}
                </h3>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-cyan-100 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30">
                  Tier 1 · Brief
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                Member roster · activity overview
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {(role === 1 || role === 2) && team && (
              <button
                onClick={() => setInviteModalOpen(true)}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500
                           px-4 py-2.5 rounded-xl text-[10px] font-black text-white uppercase tracking-widest
                           transition-all flex items-center gap-2
                           shadow-sm hover:shadow-[0_0_20px_rgba(6,182,212,0.35)]"
              >
                + Invite Member
              </button>
            )}
            <div className="bg-zinc-100/70 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-xl">
              <div className="text-[9px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Members</div>
              <div className="text-zinc-900 dark:text-zinc-50 font-bold text-lg">{members.length}</div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-3 py-2 rounded-xl">
              <div className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Online (15m)</div>
              <div className="text-emerald-700 dark:text-emerald-400 font-bold text-lg">{onlineCount}</div>
            </div>
          </div>
        </header>

        {briefQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-zinc-100 dark:bg-zinc-800/40 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : briefQuery.isError ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 text-red-600 dark:text-red-400 text-sm font-bold">
            Failed to load team. {(briefQuery.error as Error).message}
          </div>
        ) : !team ? (
          <div className="py-12 text-center bg-zinc-50/70 dark:bg-zinc-900/40 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
            <Shield size={32} className="mx-auto text-zinc-400 dark:text-zinc-600 mb-3" />
            <p className="text-zinc-700 dark:text-zinc-300 font-bold">You are not assigned to a team yet</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">Ask the Root Admin to assign you to a team.</p>
          </div>
        ) : members.length === 0 ? (
          <div className="py-12 text-center bg-zinc-50/70 dark:bg-zinc-900/40 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
            <Users size={32} className="mx-auto text-zinc-400 dark:text-zinc-600 mb-3" />
            <p className="text-zinc-700 dark:text-zinc-300 font-bold">No members in this team</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
            {members.map((m, idx) => {
              const online = isOnline(m.last_seen_at);
              return (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 flex items-center gap-4 transition-all group
                              border-b last:border-b-0 border-zinc-200 dark:border-zinc-800
                              hover:bg-cyan-50/60 dark:hover:bg-cyan-500/5
                              ${idx % 2 === 0
                                ? 'bg-white dark:bg-transparent'
                                : 'bg-zinc-100/50 dark:bg-zinc-900/30'}`}
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs font-black text-zinc-700 dark:text-zinc-200">
                      {(m.full_name || m.email || 'U')[0].toUpperCase()}
                    </div>
                    {online && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3" aria-label="Online">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 dark:opacity-50 animate-ping" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white dark:border-zinc-900 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-zinc-900 dark:text-zinc-50 font-bold text-sm truncate">
                        {m.full_name || 'Anonymous'}
                      </p>
                      {m.is_team_leader && (
                        <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 flex items-center gap-1">
                          <Crown size={9} /> Lead
                        </span>
                      )}
                      <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${ROLE_BADGE[m.role] ?? ROLE_BADGE[0]}`}>
                        {ROLE_LABEL[m.role] ?? 'Student'}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{m.email}</p>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                    <Clock size={10} />
                    {fmtRelative(m.last_seen_at)}
                  </div>

                  <button
                    onClick={() => setDiveTarget({ id: m.id, name: m.full_name || m.email || 'member' })}
                    className="bg-purple-100 text-purple-700 border border-purple-200
                               dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30
                               px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest
                               hover:bg-purple-600 hover:text-white hover:border-purple-600
                               dark:hover:bg-purple-500 dark:hover:text-white
                               transition-all flex items-center gap-1.5
                               opacity-0 group-hover:opacity-100"
                    title="Open Tier 2 Deep Dive (audited)"
                  >
                    <Eye size={12} /> Deep Dive
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-zinc-500 dark:text-zinc-500 italic flex items-center gap-1.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <Activity size={10} /> Tier 1 view is unaudited. Opening a member's Deep Dive logs an audit entry.
        </p>
      </section>

      <MemberDeepDiveModal
        open={!!diveTarget}
        memberId={diveTarget?.id ?? null}
        memberName={diveTarget?.name ?? ''}
        onClose={() => setDiveTarget(null)}
      />

      <TeamAdminInviteModal
        open={inviteModalOpen}
        teamId={team?.id ?? null}
        onClose={() => setInviteModalOpen(false)}
      />
    </>
  );
};

export default TeamBriefPanel;
