import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, Loader2, Users, ArrowRight } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminTaskService, TeamWithAdmin } from '../../services/AdminTaskService';

interface Props {
  open: boolean;
  team: TeamWithAdmin | null;
  allTeams: TeamWithAdmin[];
  onClose: () => void;
  onDeleted?: () => void;
}

export const DeleteTeamModal: React.FC<Props> = ({ open, team, allTeams, onClose, onDeleted }) => {
  const queryClient = useQueryClient();
  const [targetTeamId, setTargetTeamId] = useState<string>('__unassign__');

  const otherTeams = allTeams.filter(t => t.id !== team?.id);
  const hasMembers = (team?.member_count ?? 0) > 0;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!team) return;

      // Step 1: Reassign or unassign members if any
      if (hasMembers) {
        const dest = targetTeamId === '__unassign__' ? null : targetTeamId;
        await AdminTaskService.reassignTeamMembers(team.id, dest);
      }

      // Step 2: Delete the team
      await AdminTaskService.deleteTeam(team.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'teams'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'users'] });
      onDeleted?.();
      onClose();
    },
  });

  if (!team) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* backdrop */}
          <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

          {/* dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="relative w-full max-w-md bg-[#0F1015] border border-white/[0.08] rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.6)] overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />

            <header className="px-6 pt-6 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center text-red-500">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-red-400/70 uppercase tracking-widest">Safety Protocol</p>
                  <h2 className="text-white font-bold text-lg tracking-tight">Delete Team</h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </header>

            <div className="px-6 pb-6 flex flex-col gap-5">
              {/* Team Info */}
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/10 flex items-center justify-center text-cyan-400 text-lg font-black">
                  {team.team_name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-bold">{team.team_name}</p>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-white/30 uppercase tracking-widest mt-0.5">
                    <span className="flex items-center gap-1"><Users size={10} /> {team.member_count} members</span>
                    {team.admin && <span>Leader: {team.admin.full_name || team.admin.email}</span>}
                  </div>
                </div>
              </div>

              {/* Warning + Reassignment */}
              {hasMembers ? (
                <>
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
                    <p className="text-amber-400 text-xs font-bold flex items-center gap-2 mb-1">
                      <AlertTriangle size={14} /> Active Members Detected
                    </p>
                    <p className="text-white/50 text-[11px] leading-relaxed">
                      This team has <span className="text-white font-bold">{team.member_count}</span> active member(s).
                      Choose where to reassign them before deletion.
                    </p>
                  </div>

                  <label className="block">
                    <span className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-2 block flex items-center gap-2">
                      <ArrowRight size={10} /> Reassign Members To
                    </span>
                    <select
                      value={targetTeamId}
                      onChange={(e) => setTargetTeamId(e.target.value)}
                      className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400/40 transition-all appearance-none cursor-pointer"
                    >
                      <option value="__unassign__" className="bg-[#0F1015]">
                        Unassign all (no team)
                      </option>
                      {otherTeams.map(t => (
                        <option key={t.id} value={t.id} className="bg-[#0F1015]">
                          {t.team_name} ({t.member_count} members)
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
                  <p className="text-emerald-400 text-xs font-bold">
                    No active members — safe to delete immediately.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-white/[0.03] border border-white/[0.06] py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white/60 hover:bg-white/[0.06] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="flex-1 bg-red-500/10 border border-red-500/30 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-red-400 hover:bg-red-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                  {hasMembers ? 'Reassign & Delete' : 'Delete Team'}
                </button>
              </div>

              {deleteMutation.isError && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-2.5 text-red-400 text-xs font-bold">
                  {(deleteMutation.error as Error)?.message || 'Failed to delete team'}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DeleteTeamModal;
