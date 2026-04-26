import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Eye, Loader2, ShieldAlert, MessageSquare, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AdminTaskService } from '../../services/AdminTaskService';

interface Props {
  open: boolean;
  memberId: string | null;
  memberName: string;
  onClose: () => void;
}

const fmtTime = (iso: string): string => {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

export const MemberDeepDiveModal: React.FC<Props> = ({ open, memberId, memberName, onClose }) => {
  // Audit the access the moment the modal opens for a real member.
  useEffect(() => {
    if (!open || !memberId) return;
    AdminTaskService.logAuditAction(
      memberId,
      `Admin accessed deep data of Member ${memberName} (${memberId})`
    );
  }, [open, memberId, memberName]);

  const diveQuery = useQuery({
    queryKey: ['team', 'deepDive', memberId],
    queryFn: () => AdminTaskService.getMemberDeepDive(memberId!, 50),
    enabled: !!memberId && open,
  });

  const entries = diveQuery.data ?? [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="relative w-full max-w-3xl max-h-[80vh] bg-[#0F1015] border border-white/[0.08] rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />

            <header className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-white/[0.05]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center text-purple-400">
                  <Eye size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-purple-400/70 uppercase tracking-widest flex items-center gap-1.5">
                    <ShieldAlert size={10} /> Tier 2 · Audited Deep Dive
                  </p>
                  <h2 className="text-white font-bold text-lg tracking-tight">{memberName}</h2>
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

            <div className="px-6 py-4 bg-amber-500/5 border-b border-amber-500/10">
              <p className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest flex items-center gap-1.5">
                <ShieldAlert size={10} />
                This access has been recorded in the system audit log.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {diveQuery.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-24 bg-white/[0.02] rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : diveQuery.isError ? (
                <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 text-red-400 text-sm font-bold">
                  Failed to load interaction data. {(diveQuery.error as Error).message}
                </div>
              ) : entries.length === 0 ? (
                <div className="py-12 text-center bg-white/[0.01] border border-dashed border-white/10 rounded-2xl">
                  <MessageSquare size={32} className="mx-auto text-white/20 mb-3" />
                  <p className="text-white/60 font-bold">No detailed interaction data yet</p>
                  <p className="text-xs text-white/30 mt-1">
                    Interaction logs will appear here once the member has activity recorded.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {entries.map((e) => (
                    <div
                      key={e.id}
                      className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400">
                          {e.category || 'general'}
                        </span>
                        <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                          {fmtTime(e.created_at)}
                        </span>
                      </div>
                      {e.ai_interpretation && (
                        <p className="text-sm text-white/80 italic leading-relaxed mb-2">
                          "{e.ai_interpretation}"
                        </p>
                      )}
                      {e.deep_insight && (
                        <div className="flex gap-2 items-start mt-2 pt-2 border-t border-white/5">
                          <Sparkles size={12} className="text-cyan-400 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-white/50 leading-relaxed">{e.deep_insight}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <footer className="px-6 py-4 border-t border-white/[0.05] flex justify-between items-center bg-black/20">
              <p className="text-[10px] text-white/30 uppercase tracking-widest">
                {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
              </p>
              <button
                onClick={onClose}
                className="bg-white/[0.05] border border-white/10 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/70 hover:bg-white/10 hover:text-white transition-all"
              >
                Close
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MemberDeepDiveModal;
