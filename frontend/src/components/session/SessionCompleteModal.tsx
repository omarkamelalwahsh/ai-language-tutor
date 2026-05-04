import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, TrendingUp, Unlock, ArrowRight, X, Trophy, Zap } from 'lucide-react';
import type {
  SessionCompleteResponse,
  SkillPromotion,
  UnlockedJourneyStep,
} from '../../services/sessionService';

interface SessionCompleteModalProps {
  open: boolean;
  result: SessionCompleteResponse | null;
  onClose: () => void;
  onContinue?: () => void;
}

const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const cardVariants = {
  initial: { scale: 0.92, opacity: 0, y: 30 },
  animate: { scale: 1, opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
  exit: { scale: 0.95, opacity: 0, y: 10 },
};

const SessionCompleteModal: React.FC<SessionCompleteModalProps> = ({
  open,
  result,
  onClose,
  onContinue,
}) => {
  if (!result) return null;

  const promotions: SkillPromotion[] = result.skill_promotions || [];
  const unlocked: UnlockedJourneyStep | null = result.unlocked_journey_step || null;
  const tasks = result.tasks_recorded || 0;

  const totalCorrect = result.skill_summary
    ? Object.values(result.skill_summary).reduce(
        (acc: number, b: any) => acc + (b?.correct || 0),
        0
      )
    : 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            variants={cardVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl rounded-[2.5rem] bg-[#0F172A]/85 border border-white/10 shadow-2xl overflow-hidden backdrop-blur-2xl"
          >
            {/* Background accents */}
            <div className="absolute -top-32 -right-24 w-80 h-80 bg-indigo-500/30 blur-[140px] rounded-full pointer-events-none" />
            <div className="absolute -bottom-32 -left-24 w-80 h-80 bg-emerald-500/20 blur-[140px] rounded-full pointer-events-none" />

            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-5 right-5 z-10 p-2 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition"
            >
              <X size={16} />
            </button>

            <div className="relative z-10 p-8 sm:p-10">
              {/* Header */}
              <div className="flex items-center gap-4 mb-8">
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.1 }}
                  className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-indigo-500/30 border border-emerald-400/30"
                >
                  <Trophy className="w-7 h-7 text-emerald-300" />
                </motion.div>
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tight leading-none">
                    Session Synced
                  </h2>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-300/80 mt-2">
                    {tasks} tasks · {totalCorrect} correct
                  </p>
                </div>
              </div>

              {/* Skill Promotions */}
              {promotions.length > 0 ? (
                <div className="mb-7">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-300/70 mb-3 flex items-center gap-2">
                    <TrendingUp size={12} /> Level Up
                  </p>
                  <div className="space-y-2.5">
                    {promotions.map((p, i) => (
                      <motion.div
                        key={p.skill}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + i * 0.08 }}
                        className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/10"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-400/20">
                            <Sparkles size={14} className="text-emerald-300" />
                          </div>
                          <span className="text-white font-black tracking-tight capitalize">
                            {p.skill}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm font-black">
                          <span className="px-2.5 py-1 rounded-lg bg-white/5 text-white/40 line-through">
                            {p.before}
                          </span>
                          <ArrowRight size={14} className="text-emerald-400" />
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/20">
                            {p.after}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mb-7 p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                  <Zap size={14} className="text-indigo-300 shrink-0" />
                  <p className="text-sm text-white/60 font-medium leading-relaxed">
                    XP banked. Stay consistent — promotions trigger at <span className="text-white font-bold">80%</span> accuracy on a skill.
                  </p>
                </div>
              )}

              {/* Unlocked Journey Step */}
              {unlocked && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mb-8 relative p-5 rounded-3xl bg-gradient-to-br from-indigo-500/15 to-violet-500/10 border border-indigo-400/30 overflow-hidden"
                >
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/20 blur-[80px] rounded-full" />
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-300 mb-2 flex items-center gap-2 relative z-10">
                    <Unlock size={12} /> New Node Unlocked
                  </p>
                  <p className="text-white text-lg font-black tracking-tight leading-snug relative z-10">
                    {unlocked.title}
                  </p>
                  {unlocked.skill_focus && (
                    <p className="text-indigo-200/60 text-xs font-bold uppercase tracking-widest mt-1 relative z-10">
                      Focus · {unlocked.skill_focus}
                    </p>
                  )}
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    onContinue?.();
                    onClose();
                  }}
                  className="flex-[2] py-4 rounded-2xl bg-white text-slate-950 font-black text-sm uppercase tracking-widest hover:bg-slate-100 active:scale-[0.98] transition flex items-center justify-center gap-2 shadow-2xl shadow-white/5"
                >
                  Continue Journey <ArrowRight size={16} />
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white/70 font-black text-sm uppercase tracking-widest hover:bg-white/10 active:scale-[0.98] transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SessionCompleteModal;
