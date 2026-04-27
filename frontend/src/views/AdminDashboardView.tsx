import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, LogOut, ChevronDown, MessageSquare, TrendingUp,
  Shield, Loader2, ShieldAlert, Zap, User as UserIcon
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { AdminTaskService, TeamMemberBrief } from '../services/AdminTaskService';
import { MemberDeepDiveModal } from '../components/admin/MemberDeepDiveModal';
import { TeamAdminInviteModal } from '../components/admin/TeamAdminInviteModal';
import { AdminToastProvider } from '../components/admin/AdminToast';
import { useData } from '../context/DataContext';
import ThemeToggle from '../components/ThemeToggle';

/* ─── constants ─────────────────────────────────────────────────────── */
const TEAL = '#0ED0CD';

const CEFR = (v: number) =>
  v >= 90 ? 'C2' : v >= 75 ? 'C1' : v >= 60 ? 'B2' : v >= 45 ? 'B1' : v >= 25 ? 'A2' : 'A1';

const seed = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return (offset: number) => {
    const x = Math.sin(h + offset) * 10000;
    return Math.abs(x - Math.floor(x));
  };
};

const fmtRel = (iso: string | null) => {
  if (!iso) return 'N/A';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return 'just now';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const isOnline = (iso: string | null): boolean => {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 15 * 60 * 1000;
};

/* ─── SVG ring ──────────────────────────────────────────────────────── */
const Ring: React.FC<{ value: number; size?: number; sw?: number }> = ({
  value, size = 56, sw = 4,
}) => {
  const r = (size - sw) / 2;
  const c = r * 2 * Math.PI;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r}
          stroke="#27272a" strokeWidth={sw} fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r}
          stroke={TEAL} strokeWidth={sw} fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (value / 100) * c }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${TEAL}80)` }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white">
        {value}%
      </span>
    </div>
  );
};

/* ─── segmented bar ─────────────────────────────────────────────────── */
const SegBar: React.FC<{ label: string; value: number; extra?: string }> = ({
  label, value, extra,
}) => (
  <div className="space-y-1">
    <div className="flex justify-between text-[10px] font-bold">
      <span className="text-zinc-400 uppercase tracking-widest">{label} {value}%</span>
      {extra && <span className="text-zinc-500">{extra}</span>}
    </div>
    <div className="relative h-[6px] rounded-full bg-zinc-800 overflow-hidden">
      <motion.div className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${TEAL}, #06b6d4)` }}
        initial={{ width: 0 }} animate={{ width: `${value}%` }}
        transition={{ duration: 0.8 }}
      />
      {/* ticks */}
      {[...Array(6)].map((_, i) => (
        <div key={i} className="absolute top-0 h-full w-px bg-zinc-700/60"
          style={{ left: `${((i + 1) / 7) * 100}%` }} />
      ))}
    </div>
    <div className="flex justify-between text-[7px] text-zinc-600 font-bold px-0.5">
      {['C2.1','C2.2','C2.3','C2.4','C2.5'].map(s => <span key={s}>{s}</span>)}
    </div>
  </div>
);

/* ─── User Card ─────────────────────────────────────────────────────── */
const UserCard: React.FC<{
  member: any;
  isExpanded: boolean;
  onToggle: () => void;
  onDeepDive: (id: string, name: string) => void;
}> = ({ member, isExpanded, onToggle, onDeepDive }) => {
  const online = isOnline(member.last_seen_at);
  const displayName = member.full_name || member.email?.split('@')[0] || 'User';

  const lp = member.learner_profile;
  const overallLevel = lp?.current_proficiency_level || lp?.overall_level || 'A1';
  // Fallback map for percentage display
  const levelToNum = (lvl: string) => {
    if (lvl.includes('C2')) return 95;
    if (lvl.includes('C1')) return 80;
    if (lvl.includes('B2')) return 65;
    if (lvl.includes('B1')) return 50;
    if (lvl.includes('A2')) return 30;
    return 15;
  };
  const mastery = levelToNum(overallLevel);

  const logQ = useQuery({
    queryKey: ['member-log', member.id],
    queryFn: () => AdminTaskService.getMemberDeepDive(member.id, 1),
    enabled: isExpanded,
  });
  
  const log = logQ.data?.[0];
  const dbSkills = member.skills || [];
  
  // Define the 6 standard skills from the screenshot
  const skillCategories = [
    { key: 'reading', label: 'Reading' },
    { key: 'listening', label: 'Listening' },
    { key: 'grammar', label: 'Grammar' },
    { key: 'vocabulary', label: 'Vocabulary' },
    { key: 'writing', label: 'Writing' },
    { key: 'speaking', label: 'Speaking' },
  ];

  // Map DB data to these categories
  const mappedSkills = skillCategories.map(cat => {
    // Fuzzy matching for skill names
    const dbSkill = dbSkills.find((s: any) => 
      s.skill.toLowerCase().includes(cat.key) || cat.key.includes(s.skill.toLowerCase())
    );

    // Resolution logic: Try new decoupled field, then fallback to legacy fields
    const resolvedLevel = dbSkill?.current_level || dbSkill?.level || dbSkill?.current_proficiency_level || 'A1';

    return {
      ...cat,
      level: resolvedLevel,
      xp: dbSkill?.xp_points || 0,
      percent: levelToNum(resolvedLevel)
    };
  });

  return (
    <motion.div
      layout
      className={`
        relative overflow-hidden rounded-[32px] border transition-all duration-700
        ${isExpanded ? 'border-teal-500/40 bg-white dark:bg-zinc-950/90 shadow-[0_0_80px_rgba(14,208,205,0.08)]' 
                     : 'border-slate-200 dark:border-zinc-800/60 bg-white/60 dark:bg-zinc-900/40 hover:border-teal-500/30 hover:bg-white dark:hover:bg-zinc-900/60'}
        backdrop-blur-2xl
      `}
    >
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-500/[0.03] blur-[120px] pointer-events-none"
          />
        )}
      </AnimatePresence>

      <div className={`p-8 ${isExpanded ? 'lg:p-10' : ''}`}>
        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-6 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-5">
            <div className="relative group">
              <div className="w-16 h-16 rounded-[22px] bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center shadow-sm dark:shadow-2xl transition-all group-hover:border-teal-500/50">
                <UserIcon size={28} className="text-teal-600 dark:text-teal-400" />
              </div>
              {online && (
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-[3px] border-white dark:border-zinc-950 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              )}
            </div>
            
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {displayName}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-black text-teal-600 dark:text-teal-500/80 uppercase tracking-[0.2em]">
                  {member.role === 1 ? 'Command' : 'Operative'}
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-zinc-700" />
                <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">Level {overallLevel}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {!isExpanded && (
               <div className="hidden sm:flex flex-col items-end mr-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 px-2.5 py-1 rounded-lg border border-emerald-500/10">
                    Active
                  </span>
               </div>
            )}
            
            <div className="relative">
               <Ring value={mastery} size={isExpanded ? 72 : 64} />
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <span className="text-[10px] font-black text-slate-900 dark:text-white">{mastery}%</span>
               </div>
            </div>
            
            <button className="w-12 h-12 flex items-center justify-center text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-all bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-2xl">
              <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ type: 'spring', damping: 15 }}>
                 <ChevronDown size={22} />
              </motion.div>
            </button>
          </div>
        </div>

        {/* ── Expanded Content ── */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-12 pt-10 border-t border-slate-100 dark:border-zinc-800/40"
            >
              <div className="space-y-12">
                {/* Skill Grid */}
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.4em] mb-6 flex items-center gap-3">
                    Skill Mastery
                    <div className="h-px flex-1 bg-slate-100 dark:bg-zinc-900" />
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {mappedSkills.map((s) => (
                      <div key={s.key} className="group bg-slate-50 dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-800/40 rounded-3xl p-6 transition-all hover:border-teal-500/20 dark:hover:bg-zinc-900/50">
                         <div className="flex justify-between items-center mb-4">
                           <span className="text-sm font-black text-slate-800 dark:text-zinc-100 tracking-tight">{s.label}</span>
                           <span className="text-xs font-black text-teal-600 dark:text-teal-400 bg-teal-500/5 px-2 py-0.5 rounded-md border border-teal-500/10">{s.level}</span>
                         </div>
                         <div className="relative h-2 bg-slate-200 dark:bg-zinc-950 rounded-full overflow-hidden mb-3">
                           <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${s.percent}%` }}
                             className="absolute inset-y-0 left-0 bg-gradient-to-r from-teal-600 to-cyan-400 shadow-[0_0_12px_rgba(20,184,166,0.4)]" 
                           />
                         </div>
                         <div className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                           XP: <span className="text-slate-600 dark:text-zinc-300 ml-1">{s.xp}</span>
                         </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Section */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-8">
                    <div className="bg-slate-50 dark:bg-zinc-900/40 rounded-[28px] p-6 border border-slate-200 dark:border-zinc-800/40 h-full">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-[10px] font-black text-teal-600 dark:text-teal-500 uppercase tracking-widest">
                          <MessageSquare size={14} />
                          Latest AI Insight
                        </div>
                        <Zap size={14} className="text-slate-300 dark:text-zinc-700" />
                      </div>
                      {logQ.isLoading ? (
                         <div className="animate-pulse h-4 bg-slate-200 dark:bg-zinc-800 rounded w-3/4" />
                      ) : (
                        <p className="text-sm text-slate-600 dark:text-zinc-300 font-medium italic leading-relaxed">
                          "{log?.ai_interpretation || 'Analysis pending next operative interaction cycle.'}"
                        </p>
                      )}
                      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center text-[9px] font-bold text-slate-400 dark:text-zinc-600 uppercase tracking-widest">
                        <span>Verified {log ? fmtRel(log.created_at) : 'N/A'}</span>
                        <Shield size={12} className="opacity-30" />
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-4 flex items-stretch">
                    <button 
                      onClick={() => onDeepDive(member.id, displayName)}
                      className="group w-full rounded-[28px] bg-slate-900 dark:bg-zinc-900 border border-slate-800 dark:border-zinc-800 hover:border-teal-500/50 hover:bg-teal-500/5 transition-all flex flex-col items-center justify-center p-6 gap-4"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-slate-800 dark:bg-zinc-950 border border-slate-700 dark:border-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Shield size={24} className="text-teal-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Tier 2 Deep Dive</p>
                        <p className="text-[8px] font-bold text-slate-500 dark:text-zinc-500 mt-1 uppercase tracking-widest">Full Performance Audit</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

/* ─── Main View ─────────────────────────────────────────────────────── */
const AdminDashboardInner: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const { user } = useData() as any;
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [diveTarget, setDiveTarget] = useState<{ id: string; name: string } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const briefQ = useQuery({
    queryKey: ['team', 'brief', selectedTeamId],
    queryFn: () => AdminTaskService.listMyTeamBrief(selectedTeamId || undefined),
  });

  const team = briefQ.data?.team;
  const members = (briefQ.data?.members ?? []).filter(m => m.id !== user?.id);
  const allTeams = briefQ.data?.allTeams || [];
  const isSuperAdmin = user?.user_metadata?.role === 2 || user?.app_metadata?.role === 2; // Heuristic, or use profile

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#06080c] text-slate-900 dark:text-white transition-colors duration-500 selection:bg-teal-500/30 font-inter">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-teal-500/[0.03] dark:bg-teal-500/[0.03] blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-cyan-500/[0.02] dark:bg-cyan-500/[0.02] blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.8)] animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-teal-600 dark:text-teal-500/60">
                System Operational · Node Alpha
              </p>
            </div>
            <h1 className="text-4xl font-black tracking-tight flex items-center gap-4">
              {team?.team_name || 'Fleet Overview'}
              <span className="text-slate-300 dark:text-zinc-800">/</span>
              <span className="text-slate-500 dark:text-zinc-500 text-lg font-medium">{members.length} Members</span>
            </h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            {isSuperAdmin && allTeams.length > 0 && (
              <div className="relative">
                <select 
                  value={selectedTeamId || ''} 
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="appearance-none bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl px-6 py-3.5 pr-12 text-[11px] font-black uppercase tracking-widest text-teal-600 dark:text-teal-400 focus:outline-none focus:border-teal-500/50 transition-all cursor-pointer shadow-xl"
                >
                  {allTeams.map(t => (
                    <option key={t.id} value={t.id}>{t.team_name}</option>
                  ))}
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-zinc-500">
                  <ChevronDown size={14} />
                </div>
              </div>
            )}

            <button onClick={() => setInviteOpen(true)}
              className="group relative overflow-hidden px-8 py-3.5 rounded-2xl bg-teal-500 text-white dark:text-black text-[11px] font-black uppercase tracking-[0.15em] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_rgba(20,184,166,0.2)]">
              <span className="relative z-10 flex items-center gap-2">
                <Plus size={16} strokeWidth={3} /> Recruit Member
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </button>

            <ThemeToggle />
            
            <button onClick={onLogout}
              className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:border-red-500/20 transition-all shadow-xl">
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {briefQ.isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <Loader2 size={40} className="animate-spin text-teal-500" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600">Synchronizing Data Streams...</p>
          </div>
        ) : members.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-32 bg-white dark:bg-zinc-900/20 rounded-[40px] border border-slate-200 dark:border-zinc-800/40 border-dashed"
          >
             <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-zinc-800/50 flex items-center justify-center mb-6 border border-slate-200 dark:border-zinc-700/50">
               <UserIcon size={32} className="text-slate-400 dark:text-zinc-600" />
             </div>
             <p className="font-bold text-slate-600 dark:text-zinc-400 mb-2">Sector Unoccupied</p>
             <p className="text-xs text-slate-400 dark:text-zinc-600">No team members identified in this sector. Deploy recruitment protocols.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {members.map((member, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                key={member.id}
                className={selectedMember === member.id ? 'col-span-full' : 'col-span-1'}
              >
                <UserCard
                  member={member}
                  isExpanded={selectedMember === member.id}
                  onToggle={() => {
                    const next = selectedMember === member.id ? null : member.id;
                    setSelectedMember(next);
                    if (next) {
                      AdminTaskService.logAuditAction(next, `Visual audit: ${member.full_name || member.email}`);
                    }
                  }}
                  onDeepDive={(id, name) => setDiveTarget({ id, name })}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <MemberDeepDiveModal open={!!diveTarget} memberId={diveTarget?.id ?? null}
        memberName={diveTarget?.name ?? ''} onClose={() => setDiveTarget(null)} />
      <TeamAdminInviteModal open={inviteOpen} teamId={team?.id ?? null}
        onClose={() => setInviteOpen(false)} />
    </div>
  );
};

const AdminDashboardView: React.FC<{ onLogout: () => void }> = ({ onLogout }) => (
  <AdminToastProvider>
    <AdminDashboardInner onLogout={onLogout} />
  </AdminToastProvider>
);

export default AdminDashboardView;
