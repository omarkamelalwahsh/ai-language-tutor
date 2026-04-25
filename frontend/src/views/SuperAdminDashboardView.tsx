import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings, ShieldAlert, Users, UsersRound, Server, LogOut,
  Plus, Sparkles, Cpu, MemoryStick, Activity, ShieldCheck,
  AlertTriangle, CheckCircle2, Clock, MoreVertical,
  ChevronRight, BarChart3, Database, Workflow
} from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip,
} from 'recharts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AdminTaskService, TaskStatus,
  TaskWithProfiles, TeamWithAdmin, SafetyLogEntry,
} from '../services/AdminTaskService';
import { useUserRole } from '../hooks/useUserRole';
import { AdminToastProvider, useAdminToast } from '../components/admin/AdminToast';
import { CreateTaskModal } from '../components/admin/CreateTaskModal';

// ============================================================================
// Visual constants (pixel-perfect to design)
// ============================================================================
const PAGE_BG = 'bg-[#0D0D12]';
const CARD_BG = 'bg-white/[0.02]';
const CARD_BORDER = 'border border-white/[0.05]';
const CARD = `${CARD_BG} ${CARD_BORDER} backdrop-blur-xl`;

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'Active',
  completed: 'Done',
};

const STATUS_TONE: Record<TaskStatus, string> = {
  pending: 'text-amber-400',
  in_progress: 'text-emerald-400',
  completed: 'text-cyan-400',
};

// Synthetic data — replace with live metrics when available
const GOAL_SPARK = [
  { v: 60 }, { v: 72 }, { v: 65 }, { v: 80 }, { v: 78 }, { v: 88 }, { v: 84 }, { v: 90 },
];
const SERVER_LOAD = [
  { t: '6h',  v: 320 }, { t: '8h',  v: 380 }, { t: '10h', v: 410 },
  { t: '12h', v: 520 }, { t: '14h', v: 480 }, { t: '16h', v: 600 },
  { t: '18h', v: 680 }, { t: '20h', v: 540 }, { t: '22h', v: 620 }, { t: '24h', v: 720 },
];

// ============================================================================
// Helpers
// ============================================================================
const fmtCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const profileLabel = (p: { full_name: string | null; email: string | null } | null | undefined, role?: number): string => {
  if (!p) return 'System';
  const name = p.full_name || p.email?.split('@')[0] || 'Unknown';
  const tag = role === 2 ? 'SuperAdmin' : role === 1 ? 'Admin' : '';
  return tag ? `${name} (${tag})` : name;
};

const fmtDeadline = (iso: string | null): string => {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return 'Overdue';
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  return `${hours}h`;
};

const fmtRelative = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
};

// ============================================================================
// Inner view (under toast provider)
// ============================================================================
const SuperAdminInner: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const queryClient = useQueryClient();
  const toast = useAdminToast();
  const { profile } = useUserRole();
  const [modalOpen, setModalOpen] = useState(false);

  // ----- Queries -------------------------------------------------------------
  const overviewQuery = useQuery({
    queryKey: ['superadmin', 'overview'],
    queryFn: () => AdminTaskService.getOverview(),
    refetchInterval: 30000,
  });

  const tasksQuery = useQuery({
    queryKey: ['superadmin', 'tasks'],
    queryFn: () => AdminTaskService.listTasksWithProfiles(),
  });

  const teamsQuery = useQuery({
    queryKey: ['superadmin', 'teams'],
    queryFn: () => AdminTaskService.listTeamsWithAdmin(),
  });

  const logsQuery = useQuery({
    queryKey: ['superadmin', 'logs'],
    queryFn: () => AdminTaskService.listSafetyLogs(6),
  });

  // Realtime
  useEffect(() => {
    const unsub = AdminTaskService.subscribeTasks({
      onInsert: () => {
        queryClient.invalidateQueries({ queryKey: ['superadmin', 'tasks'] });
        toast.push({ kind: 'info', title: 'New Task Created', body: 'A new mission protocol has been initialized.' });
      },
      onUpdate: () => queryClient.invalidateQueries({ queryKey: ['superadmin', 'tasks'] }),
      onDelete: () => queryClient.invalidateQueries({ queryKey: ['superadmin', 'tasks'] }),
    });
    return unsub;
  }, [queryClient, toast]);

  const overview = overviewQuery.data;
  const tasks = tasksQuery.data ?? [];
  const teams = teamsQuery.data ?? [];
  const logs = logsQuery.data ?? [];

  return (
    <div className={`flex h-screen w-full overflow-hidden ${PAGE_BG} text-slate-300 font-sans selection:bg-cyan-500/30`}>
      {/* Sidebar */}
      <aside className="w-20 flex-shrink-0 border-r border-white/[0.05] flex flex-col items-center py-8 gap-10 bg-black/40 backdrop-blur-3xl z-20">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-black shadow-[0_0_20px_rgba(255,255,255,0.15)]">
          <ShieldCheck size={24} />
        </div>
        <nav className="flex-1 flex flex-col gap-8">
          <SidebarIcon icon={<Settings size={22} />} />
          <SidebarIcon icon={<ShieldAlert size={22} />} />
          <SidebarIcon icon={<Users size={22} />} />
          <SidebarIcon icon={<UsersRound size={22} />} />
          <SidebarIcon icon={<Server size={22} />} />
        </nav>
        <button
          onClick={onLogout}
          className="p-3 text-slate-600 hover:text-white transition-all hover:scale-110 active:scale-95"
          aria-label="Logout"
        >
          <LogOut size={22} />
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-10 py-10 flex flex-col gap-8 relative">
        {/* Header */}
        <header className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-8 bg-cyan-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight uppercase">Infrastructure <span className="text-cyan-400">Command</span></h1>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mt-0.5">Super Admin Protocol v4.2.0</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-0.5">Authorized Operator</p>
              <p className="text-sm font-bold text-white tracking-tight">{profile?.full_name || profile?.email}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-[#0D0D12] rounded-[10px] flex items-center justify-center text-cyan-400 text-xs font-black">
                {(profile?.full_name || profile?.email || 'S')[0].toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-6 relative z-10">
          <StatCard
            label="Total Students"
            value={fmtCount(overview?.totalStudents ?? 0)}
            icon={<Users className="text-cyan-400" size={20} />}
            trend="+12% from last cycle"
          />
          <StatCard
            label="Total Admins"
            value={fmtCount(overview?.totalAdmins ?? 0)}
            icon={<ShieldCheck className="text-emerald-400" size={20} />}
            trend="Stable deployment"
          />
          <StatCard
            label="Online Status"
            value={`${overview?.onlineAdmins ?? 0} Active`}
            icon={<Activity className="text-amber-400" size={20} />}
            trend="Infrastructure healthy"
          />
        </div>

        {/* Top Content Row */}
        <div className="grid grid-cols-12 gap-6 relative z-10">
          {/* Left: AI Goal Completion */}
          <div className={`${CARD} col-span-8 p-8 rounded-[32px] flex flex-col gap-6 group hover:border-white/10 transition-all duration-500`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-xl tracking-tight">AI Goal Completion</h3>
                <p className="text-xs text-white/40 font-medium">Linguistic proficiency milestone tracking</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-[10px] font-bold text-white/60">
                <BarChart3 size={12} className="text-cyan-400" /> Real-time Telemetry
              </div>
            </div>

            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={GOAL_SPARK}>
                  <defs>
                    <linearGradient id="colorGoal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111114', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff', fontSize: '12px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="#22d3ee"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorGoal)"
                    animationDuration={2000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: Server Load */}
          <div className={`${CARD} col-span-4 p-8 rounded-[32px] flex flex-col gap-6 group hover:border-white/10 transition-all duration-500`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-xl tracking-tight">Server Load</h3>
                <p className="text-xs text-white/40 font-medium">Node processing capacity</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center text-white/20">
                <Server size={16} />
              </div>
            </div>

            <div className="flex-1 min-h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={SERVER_LOAD}>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111114', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff', fontSize: '12px' }}
                  />
                  <Area
                    type="stepAfter"
                    dataKey="v"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="#6366f1"
                    fillOpacity={0.1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-auto">
              <div className="bg-white/[0.03] border border-white/[0.05] p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-1">
                  <Cpu size={12} className="text-cyan-400" />
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">CPU</span>
                </div>
                <p className="text-xl font-bold text-white">42%</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.05] p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-1">
                  <MemoryStick size={12} className="text-purple-400" />
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">RAM</span>
                </div>
                <p className="text-xl font-bold text-white">1.8GB</p>
              </div>
            </div>
          </div>
        </div>

        {/* Task Center & Leaderboard */}
        <div className="grid grid-cols-12 gap-6 relative z-10">
          {/* Task Management Center */}
          <section className={`${CARD} col-span-8 p-8 rounded-[32px] flex flex-col gap-6 group hover:border-white/10 transition-all duration-500`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Workflow size={14} className="text-cyan-400" />
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Deployment Nexus</p>
                </div>
                <h3 className="text-white font-bold text-xl tracking-tight">Active Task Feed</h3>
              </div>
              <button
                onClick={() => setModalOpen(true)}
                className="bg-white text-black px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-400 transition-all hover:scale-105 active:scale-95 shadow-[0_10px_20px_rgba(255,255,255,0.1)] flex items-center gap-2"
              >
                <Plus size={14} /> Create New Task
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-2 max-h-[420px] custom-scrollbar">
              {tasksQuery.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
              ) : tasks.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center gap-4 bg-white/[0.01] border border-dashed border-white/10 rounded-3xl">
                  <Sparkles size={40} className="text-white/10" />
                  <div>
                    <p className="text-white/60 font-bold">No active protocols detected</p>
                    <p className="text-xs text-white/20 mt-1">Initialize a new mission to begin deployment</p>
                  </div>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {tasks.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </section>

          {/* Team Leaderboard */}
          <section className={`${CARD} col-span-4 p-8 rounded-[32px] flex flex-col gap-6 group hover:border-white/10 transition-all duration-500`}>
            <header>
              <div className="flex items-center gap-2 mb-1">
                <UsersRound size={14} className="text-emerald-400" />
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Efficiency Audit</p>
              </div>
              <h3 className="text-white font-bold text-xl tracking-tight">Team Performance</h3>
            </header>

            <div className="flex flex-col gap-4">
              {teamsQuery.isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <SkeletonLeaderboard key={i} />)
              ) : teams.length === 0 ? (
                <p className="text-center py-10 text-xs text-white/20">No active teams found</p>
              ) : (
                teams.map((team, idx) => (
                  <TeamPerformanceRow key={team.id} team={team} rank={idx + 1} />
                ))
              )}
            </div>

            <button className="mt-auto w-full py-4 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:border-white/20 transition-all">
              View Detailed Analytics
            </button>
          </section>
        </div>

        {/* Security Log */}
        <section className={`${CARD} p-8 rounded-[32px] flex flex-col gap-6 group hover:border-white/10 transition-all duration-500 relative overflow-hidden`}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h3 className="text-white font-bold text-xl tracking-tight">AI Safety & Blocked Queries</h3>
                <p className="text-xs text-white/40 font-medium italic">Linguistic integrity & policy violation monitor</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-white/20 text-[10px] font-black uppercase tracking-widest">
              <Database size={14} /> Analysis Engine Active
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {logsQuery.isLoading ? (
               Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-white/[0.02] rounded-2xl animate-pulse" />)
            ) : logs.length === 0 ? (
              <p className="col-span-2 text-center py-10 text-xs text-white/20 border border-dashed border-white/10 rounded-3xl">No safety violations detected in current uptime cycle</p>
            ) : (
              logs.map((log) => (
                <SafetyLogCard key={log.id} log={log} />
              ))
            )}
          </div>
        </section>

        {/* Modal */}
        <CreateTaskModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreated={(t) => toast.push({ kind: 'success', title: 'Dispatch Confirmed', body: `Task "${t.title}" is now active in the grid.` })}
        />

        {/* Decorative Background Glows */}
        <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none z-0" />
        <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none z-0" />
      </main>
    </div>
  );
};

// ============================================================================
// Subcomponents
// ============================================================================

const SidebarIcon = ({ icon }: { icon: React.ReactNode }) => (
  <div className="p-3 text-slate-600 hover:text-white transition-all cursor-pointer hover:bg-white/5 rounded-xl group relative">
    {icon}
    <div className="absolute left-full ml-4 px-2 py-1 bg-white text-black text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
      Node Access
    </div>
  </div>
);

const StatCard = ({ label, value, icon, trend }: { label: string; value: string; icon: React.ReactNode; trend: string }) => (
  <div className={`${CARD} p-7 rounded-[32px] group hover:border-white/10 transition-all duration-500 relative overflow-hidden`}>
    <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.01] group-hover:bg-cyan-500/[0.03] transition-colors rounded-bl-full pointer-events-none" />
    <div className="flex justify-between items-start mb-4 relative z-10">
      <div className="p-3 bg-white/[0.03] rounded-2xl group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <MoreVertical size={16} className="text-white/10 cursor-pointer hover:text-white/40 transition-colors" />
    </div>
    <div className="relative z-10">
      <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">{label}</p>
      <h4 className="text-3xl font-black text-white tracking-tighter">{value}</h4>
      <p className="text-[10px] font-bold text-emerald-400/60 mt-2 flex items-center gap-1.5 uppercase tracking-widest">
        <Sparkles size={10} /> {trend}
      </p>
    </div>
  </div>
);

const TaskRow = ({ task }: { task: TaskWithProfiles }) => (
  <motion.div
    layout
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    className="bg-white/[0.02] border border-white/[0.05] p-5 rounded-3xl flex items-center justify-between gap-6 hover:bg-white/[0.04] hover:border-white/10 transition-all group"
  >
    <div className="flex items-center gap-5 min-w-0 flex-1">
      <div className="w-14 h-14 bg-white/[0.03] rounded-2xl flex items-center justify-center border border-white/5 flex-shrink-0 group-hover:scale-105 transition-transform">
        {task.status === 'completed' ? (
          <CheckCircle2 size={24} className="text-cyan-400" />
        ) : task.status === 'in_progress' ? (
          <Activity size={24} className="text-emerald-400" />
        ) : (
          <Clock size={24} className="text-amber-400" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-white font-bold text-base truncate">{task.title}</p>
          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-white/5 border border-white/5 ${STATUS_TONE[task.status]}`}>
            {STATUS_LABEL[task.status]}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-1">
            <Users size={10} /> {profileLabel(task.assigned_admin, 1)}
          </p>
          <span className="w-1 h-1 rounded-full bg-white/10" />
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-1">
            <Clock size={10} /> {fmtDeadline(task.deadline)}
          </p>
        </div>
      </div>
    </div>

    <div className="flex items-center gap-2 flex-shrink-0">
      <button className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] text-white/40 hover:text-white hover:bg-white/[0.08] transition-all">
        <ChevronRight size={18} />
      </button>
    </div>
  </motion.div>
);

const TeamPerformanceRow = ({ team, rank }: { team: TeamWithAdmin; rank: number }) => (
  <div className="group">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-black text-white/20 w-4">0{rank}</span>
        <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center text-xs font-black text-white/60">
          {team.team_name[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate">{team.team_name}</p>
          <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{profileLabel(team.admin)}</p>
        </div>
      </div>
      <p className="text-xs font-black text-emerald-400">{team.performance}%</p>
    </div>
    <div className="w-full h-1 bg-white/[0.02] rounded-full overflow-hidden border border-white/5">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${team.performance}%` }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className="h-full bg-gradient-to-r from-cyan-600 to-emerald-500 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.3)]"
      />
    </div>
  </div>
);

const SafetyLogCard = ({ log }: { log: SafetyLogEntry }) => (
  <div className="bg-white/[0.02] border border-white/[0.05] p-5 rounded-3xl hover:bg-white/[0.04] transition-all flex flex-col gap-3 group relative overflow-hidden">
    <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/[0.01] group-hover:bg-red-500/[0.03] rounded-bl-full transition-colors pointer-events-none" />
    <div className="flex items-center justify-between relative z-10">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
        <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">{log.category || 'POLICY_VIOLATION'}</p>
      </div>
      <p className="text-[10px] font-bold text-white/20 uppercase">{fmtRelative(log.created_at)}</p>
    </div>
    <div className="relative z-10">
      <p className="text-xs text-white/80 font-medium leading-relaxed line-clamp-2 italic">
        "{log.ai_interpretation}"
      </p>
      <div className="flex items-center gap-2 mt-3">
        <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-white/40">
          {(log.user_name || 'U')[0]}
        </div>
        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Source: {log.user_name}</p>
      </div>
    </div>
  </div>
);

const SkeletonRow = () => (
  <div className="h-20 w-full bg-white/[0.02] border border-white/[0.05] rounded-3xl animate-pulse" />
);

const SkeletonLeaderboard = () => (
  <div className="space-y-2 animate-pulse">
    <div className="h-8 w-full bg-white/[0.02] rounded-xl" />
    <div className="h-1 w-full bg-white/[0.02] rounded-full" />
  </div>
);

// ============================================================================
// Public wrapper
// ============================================================================
export const SuperAdminDashboardView: React.FC<{ onLogout: () => void }> = ({ onLogout }) => (
  <AdminToastProvider>
    <SuperAdminInner onLogout={onLogout} />
  </AdminToastProvider>
);

export default SuperAdminDashboardView;
