import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Users, Crown, Eye, Loader2, Activity, Clock, Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AdminTaskService } from '../../services/AdminTaskService';
import { MemberDeepDiveModal } from './MemberDeepDiveModal';

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

export const TeamBriefPanel: React.FC = () => {
  const [diveTarget, setDiveTarget] = useState<{ id: string; name: string } | null>(null);

  const briefQuery = useQuery({
    queryKey: ['team', 'brief'],
    queryFn: () => AdminTaskService.listMyTeamBrief(),
  });

  const team = briefQuery.data?.team;
  const members = briefQuery.data?.members ?? [];
  const onlineCount = members.filter(m => isOnline(m.last_seen_at)).length;

  return (
    <>
      <section className="bg-[#111114] border border-slate-800 rounded-3xl p-8 flex flex-col gap-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center text-cyan-400">
              <Users size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-bold text-xl tracking-tight">
                  {team?.team_name ?? 'My Team'}
                </h3>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  Tier 1 · Brief
                </span>
              </div>
              <p className="text-xs text-white/40 font-medium">
                Member roster · activity overview
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white/[0.03] border border-white/5 px-3 py-2 rounded-xl">
              <div className="text-[9px] font-black text-white/30 uppercase tracking-widest">Members</div>
              <div className="text-white font-bold text-lg">{members.length}</div>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/20 px-3 py-2 rounded-xl">
              <div className="text-[9px] font-black text-emerald-400/70 uppercase tracking-widest">Online (15m)</div>
              <div className="text-emerald-400 font-bold text-lg">{onlineCount}</div>
            </div>
          </div>
        </header>

        {briefQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-white/[0.02] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : briefQuery.isError ? (
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 text-red-400 text-sm font-bold">
            Failed to load team. {(briefQuery.error as Error).message}
          </div>
        ) : !team ? (
          <div className="py-12 text-center bg-white/[0.01] border border-dashed border-white/10 rounded-2xl">
            <Shield size={32} className="mx-auto text-white/20 mb-3" />
            <p className="text-white/60 font-bold">You are not assigned to a team yet</p>
            <p className="text-xs text-white/30 mt-1">Ask the Root Admin to assign you to a team.</p>
          </div>
        ) : members.length === 0 ? (
          <div className="py-12 text-center bg-white/[0.01] border border-dashed border-white/10 rounded-2xl">
            <Users size={32} className="mx-auto text-white/20 mb-3" />
            <p className="text-white/60 font-bold">No members in this team</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((m) => {
              const online = isOnline(m.last_seen_at);
              return (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/[0.02] border border-slate-800 hover:border-cyan-500/20 hover:bg-white/[0.04] p-4 rounded-2xl flex items-center gap-4 transition-all group"
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-xs font-black text-white/60">
                      {(m.full_name || m.email || 'U')[0].toUpperCase()}
                    </div>
                    {online && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#111114] rounded-full shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-bold text-sm truncate">
                        {m.full_name || 'Anonymous'}
                      </p>
                      {m.is_team_leader && (
                        <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center gap-1">
                          <Crown size={9} /> Lead
                        </span>
                      )}
                      <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                        m.role === 2 ? 'text-purple-400 border-purple-500/20 bg-purple-500/5' :
                        m.role === 1 ? 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5' :
                        'text-slate-400 border-white/10 bg-white/5'
                      }`}>
                        {m.role === 2 ? 'Super' : m.role === 1 ? 'Admin' : 'Student'}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/30 truncate">{m.email}</p>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                    <Clock size={10} />
                    {fmtRelative(m.last_seen_at)}
                  </div>

                  <button
                    onClick={() => setDiveTarget({ id: m.id, name: m.full_name || m.email || 'member' })}
                    className="bg-purple-500/10 border border-purple-500/20 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-purple-400 hover:bg-purple-500 hover:text-white transition-all flex items-center gap-1.5 opacity-0 group-hover:opacity-100"
                    title="Open Tier 2 Deep Dive (audited)"
                  >
                    <Eye size={12} /> Deep Dive
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-white/20 italic flex items-center gap-1.5 pt-2 border-t border-white/5">
          <Activity size={10} /> Tier 1 view is unaudited. Opening a member's Deep Dive logs an audit entry.
        </p>
      </section>

      <MemberDeepDiveModal
        open={!!diveTarget}
        memberId={diveTarget?.id ?? null}
        memberName={diveTarget?.name ?? ''}
        onClose={() => setDiveTarget(null)}
      />
    </>
  );
};

export default TeamBriefPanel;
