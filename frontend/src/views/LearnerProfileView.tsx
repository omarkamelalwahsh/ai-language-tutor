import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Brain, Target, Activity, AlertCircle, Zap, ShieldCheck, 
  ChevronRight, Calendar, TrendingUp, User, Clock, 
  CheckCircle2, AlertTriangle, ArrowRight, Gauge
} from 'lucide-react';
import { useLearnerProfile } from '../hooks/useLearnerProfile';
import { useNavigate } from 'react-router-dom';

// --- Sub-components for Clarity ---

const GlassCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <motion.div 
    whileHover={{ y: -5, transition: { duration: 0.2 } }}
    className={`bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-800 rounded-[2rem] p-8 shadow-premium dark:shadow-md relative overflow-hidden group transition-all duration-300 ${className}`}
  >
    {/* Ambient Glow */}
    <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[80px] group-hover:bg-blue-500/20 transition-colors" />
    {children}
  </motion.div>
);

const SkillCard = ({ skill }: { skill: any }) => (
  <GlassCard className="flex flex-col gap-6">
    <div className="flex justify-between items-start">
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/50 text-blue-600 dark:text-blue-400">
        <Target size={24} />
      </div>
      <div className="text-right">
        <span className={`text-[10px] uppercase font-black tracking-widest px-3 py-1 rounded-full border shadow-sm ${
          skill.stability === 'Stable' 
            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
            : 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-600 dark:text-amber-400'
        }`}>
          {skill.stability}
        </span>
      </div>
    </div>
    
    <div className="flex items-center gap-6">
      <div className="relative w-20 h-20 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-100 dark:text-gray-800" />
          <motion.circle 
            initial={{ strokeDashoffset: 226 }}
            animate={{ strokeDashoffset: 226 - (skill.score / 100) * 226 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            cx="40" cy="40" r="36" fill="none" stroke="#2563eb" strokeWidth="6" 
            strokeDasharray="226" strokeLinecap="round" 
            className="drop-shadow-[0_0_4px_rgba(37,99,235,0.2)]"
          />
        </svg>
        <span className="absolute text-xl font-black text-slate-900 dark:text-slate-50">{skill.score}%</span>
      </div>
      <div>
        <h3 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight">{skill.name}</h3>
        <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">{skill.level} Proficiency</p>
      </div>
    </div>

    <div className="space-y-3 mt-2">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-50/20">
            <span>Trend</span>
            <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <TrendingUp size={12} /> {skill.trend}
            </span>
        </div>
        <div className="w-full bg-slate-50 dark:bg-white/5 h-1.5 rounded-full overflow-hidden border border-slate-200/50 dark:border-transparent">
            <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${skill.confidence * 100}%` }}
                className="h-full bg-blue-600"
            />
        </div>
    </div>
  </GlassCard>
);

const ErrorCard = ({ error }: { error: any }) => (
    <div className="flex items-center justify-between p-6 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 rounded-3xl hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-all group/err shadow-premium">
        <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${
                error.severity === 'High' 
                    ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' 
                    : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}>
                <AlertCircle size={20} />
            </div>
            <div>
                <h4 className="text-slate-900 dark:text-slate-50 font-bold">{error.type}</h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest mt-1">{error.count} Occurrences</p>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border shadow-sm ${
                error.status === 'Improving' 
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/50 text-blue-600 dark:text-blue-400' 
                    : 'bg-slate-50 dark:bg-gray-800 border-slate-200 dark:border-gray-800 text-slate-400 dark:text-slate-400'
            }`}>
                {error.status}
            </span>
            <div className={`w-2 h-2 rounded-full ${
                error.severity === 'High' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
            }`} />
        </div>
    </div>
);

// --- Main View ---

export const LearnerProfileView: React.FC = () => {
  const { data, isLoading, error } = useLearnerProfile();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col items-center py-12 px-4 scroll-smooth transition-colors duration-300">
        <div className="flex flex-col items-center gap-6">
            <div className="relative">
                <Brain size={60} className="text-blue-600 dark:text-blue-400 animate-pulse" />
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl animate-pulse" />
            </div>
          <p className="text-slate-900 dark:text-slate-50/20 font-black uppercase tracking-[0.3em] animate-pulse">Syncing Neural Models...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex items-center justify-center p-8">
            <GlassCard className="max-w-md text-center">
                <AlertTriangle size={48} className="text-slate-500 dark:text-slate-400 mx-auto mb-6" />
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 mb-2">Sync Interrupted</h2>
                <p className="text-slate-400 dark:text-slate-500 mb-6">We couldn't reach your intelligence profile. Please check your connection.</p>
                <button onClick={() => window.location.reload()} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-2xl transition shadow-sm active:scale-95">Retry Sync</button>
            </GlassCard>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-slate-50 transition-colors duration-300 font-inter selection:bg-blue-500/30 overflow-x-hidden pb-40">
      
      {/* Ambient backgrounds */}
      <div className="fixed top-0 left-1/4 w-[1000px] h-[800px] bg-blue-600 dark:bg-blue-600/5 rounded-full blur-[150px] -translate-y-1/2 pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[800px] h-[600px] bg-blue-600/5 rounded-full blur-[150px] translate-y-1/2 pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 pt-12">
        
        {/* Navigation / Header */}
        <header className="flex items-center justify-between mb-16">
            <button 
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 group text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center group-hover:bg-slate-50 dark:group-hover:bg-white/10 transition-all shadow-premium">
                    <ArrowRight size={18} className="rotate-180" />
                </div>
                <span className="text-xs font-black uppercase tracking-widest">Dashboard</span>
            </button>

            <div className="flex items-center gap-6">
                <div className="text-right">
                    <p className="text-[10px] text-slate-400 dark:text-slate-50/20 uppercase font-black tracking-widest mb-1">Model State</p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 justify-end">
                        <CheckCircle2 size={14} /> Synchronized
                    </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-600 dark:bg-gradient-to-br dark:from-blue-500 dark:to-blue-700 p-[2px] shadow-premium">
                    <div className="w-full h-full bg-white dark:bg-gray-900 rounded-[14px] flex items-center justify-center">
                        <User size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                </div>
            </div>
        </header>

        {/* IDENTITY HERO */}
        <section className="mb-16">
            <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid lg:grid-cols-3 gap-8"
            >
                <GlassCard className="lg:col-span-2 flex flex-col md:flex-row gap-8 items-center bg-blue-50 dark:bg-blue-600/5 border-blue-100 dark:border-blue-500/10">
                    <div className="relative flex-shrink-0">
                        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white dark:border-blue-500/20 p-2 shadow-premium bg-white dark:bg-transparent">
                             <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${data.identity.name}&backgroundColor=transparent`} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-blue-600 p-2 rounded-xl shadow-lg border border-white/20">
                            <Zap size={16} className="text-white" fill="currentColor" />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-4xl font-black tracking-tighter">I'm {data.identity.name}</h1>
                            <span className="px-3 py-1 bg-white/10 rounded-lg text-[10px] font-black tracking-widest uppercase">Learner #01</span>
                        </div>
                        <p className="text-xl text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl font-medium">
                            {data.identity.summary}
                        </p>
                    </div>
                </GlassCard>

                <GlassCard className="flex flex-col justify-between">
                    <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-50/20 uppercase font-black tracking-[0.2em] mb-4">Neural Architecture</p>
                        <div className="flex items-end justify-between mb-2">
                            <span className="text-4xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">{data.identity.model_confidence}%</span>
                            <span className="text-xs text-slate-400 font-bold mb-1">Model Confidence</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-white/5 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-transparent">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${data.identity.model_confidence}%` }}
                                className="h-full bg-blue-600"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/5">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-50/30 flex items-center gap-2">
                            <Clock size={14} /> Refreshed {data.identity.last_updated}
                        </div>
                        <button className="flex items-center gap-2 text-xs font-black uppercase text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition shrink-0">
                            Re-Calibrate <ChevronRight size={14} />
                        </button>
                    </div>
                </GlassCard>
            </motion.div>
        </section>

        {/* 4-SKILL MODEL MATRIX */}
        <section className="mb-20">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-3 text-slate-900 dark:text-slate-50">
                    <Activity size={24} className="text-blue-600 dark:text-blue-400" /> Skill Model Matrix
                </h2>
                <div className="h-px bg-slate-200 dark:bg-white/5 flex-1 mx-8 hidden md:block" />
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest italic">Updated Real-time</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {data.skill_matrix.map((skill, idx) => (
                    <motion.div 
                        key={skill.name}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 * idx }}
                    >
                        <SkillCard skill={skill} />
                    </motion.div>
                ))}
            </div>
        </section>

        <div className="grid lg:grid-cols-2 gap-12 mb-20">
             {/* ERROR MODEL PATTERNS */}
            <section>
                 <div className="flex items-center gap-3 mb-8">
                    <h2 className="text-2xl font-black tracking-tight">Recurring Linguistic Habits</h2>
                    <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded-md text-[10px] font-black uppercase">Critical Tracking</span>
                </div>
                <GlassCard className="!p-0 border-none bg-transparent shadow-none">
                    <div className="flex flex-col gap-4">
                        {data.error_model.map((err, idx) => (
                            <motion.div 
                                key={err.type}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 + (idx * 0.1) }}
                            >
                                <ErrorCard error={err} />
                            </motion.div>
                        ))}
                    </div>
                </GlassCard>
            </section>

            {/* COGNITIVE STATE */}
            <section className="space-y-8">
                <GlassCard>
                    <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                        <Calendar size={20} className="text-blue-600 dark:text-blue-400" /> Retention Model Queue
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="p-6 bg-slate-50 dark:bg-white/[0.03] rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                            <p className="text-4xl font-black mb-1">{data.cognitive_state.retention_queue.due_count}</p>
                            <p className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-50/30 tracking-widest">Items Due Today</p>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-white/[0.03] rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                             <div className="flex -space-x-2 mb-3">
                                {data.cognitive_state.retention_queue.high_risk.map((item, i) => (
                                    <div key={item} className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black border-2 border-white dark:border-gray-900 bg-blue-600 text-white shadow-premium z-[${10-i}]`}>
                                        {item[0]}
                                    </div>
                                ))}
                             </div>
                            <p className="text-[10px] uppercase font-black text-rose-500 dark:text-rose-400 tracking-widest">Fragile items</p>
                        </div>
                    </div>
                    <p className="mt-6 text-sm text-slate-400 dark:text-slate-500 leading-relaxed font-medium">
                        Based on your current 88% model confidence, these items are entering the "Risk of Forgetting" zone.
                    </p>
                </GlassCard>

                <GlassCard>
                    <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                        <Zap size={20} className="text-amber-400" /> Pacing & Tolerance
                    </h3>
                    <div className="flex items-center gap-8 mb-6">
                        <div className="relative w-24 h-24 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="48" cy="48" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-gray-800" />
                                <motion.circle 
                                    initial={{ strokeDashoffset: 264 }}
                                    animate={{ strokeDashoffset: 264 - (data.cognitive_state.pacing.tolerance_score * 264) }}
                                    cx="48" cy="48" r="42" fill="none" stroke="#F59E0B" strokeWidth="8" 
                                    strokeDasharray="264" strokeLinecap="round" 
                                    className="drop-shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                                />
                            </svg>
                            <Gauge size={24} className="absolute text-amber-600 dark:text-amber-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-black mb-1">Optimal State</p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">{data.cognitive_state.pacing.session_advice}</p>
                        </div>
                    </div>
                </GlassCard>
            </section>
        </div>

      </div>

      {/* BEST NEXT MOVE - STICKY FOOTER */}
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-full max-w-4xl px-6 z-50">
        <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", damping: 20, stiffness: 100, delay: 1 }}
            className="group"
        >
            <div className="max-w-2xl mx-auto w-full bg-white dark:bg-gray-900 rounded-[2rem] p-6 shadow-2xl shadow-slate-200/80 dark:shadow-blue-500/10 border border-slate-200 dark:border-gray-800 flex items-center justify-between gap-6 relative overflow-hidden backdrop-blur-xl bg-white/95 dark:bg-gray-900/90">
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-blue-50 dark:bg-blue-900/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                
                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 dark:bg-slate-100 rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
                        <Sparkles className="text-blue-500 dark:text-blue-600 w-6 h-6" fill="currentColor" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">Recommended Activity</p>
                        <h4 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-50">{data.best_next_move}</h4>
                    </div>
                </div>

                <button 
                    onClick={() => navigate('/runtime')}
                    className="relative z-10 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:scale-105 active:scale-95 transition flex items-center gap-2 group/btn shadow-premium shrink-0"
                >
                    Start Session <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
            </div>
        </motion.div>
      </div>

    </div>
  );
};

const SummaryBadge = ({ label, value, active = false }: { label: string, value: string, active?: boolean }) => (
    <div className={`px-4 py-2 rounded-2xl border ${
        active ? 'bg-blue-500/20 border-blue-500/20 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-gray-800 border-slate-200 dark:border-gray-800 text-slate-500 dark:text-slate-400'
    }`}>
        <p className="text-[8px] font-black uppercase tracking-widest mb-0.5 opacity-50">{label}</p>
        <p className="text-sm font-black">{value}</p>
    </div>
);

const Sparkles = ({ className, fill }: { className?: string, fill?: string }) => (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill={fill} xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

export default LearnerProfileView;
