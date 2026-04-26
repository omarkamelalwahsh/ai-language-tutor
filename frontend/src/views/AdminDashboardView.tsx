import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Users, CheckCircle, Shield, LogOut, Upload, FileText, ChevronRight, Brain,
  MoreVertical, Zap, BookOpen, ClipboardList, Sparkles, Database, MessageSquare,
  Loader2, Clock, AlertCircle,
} from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  LineChart, Line, XAxis, YAxis, Tooltip,
} from 'recharts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminTaskService, AdminTask, TaskStatus } from '../services/AdminTaskService';
import { useUserRole } from '../hooks/useUserRole';
import { AdminToastProvider, useAdminToast } from '../components/admin/AdminToast';
import { TeamBriefPanel } from '../components/admin/TeamBriefPanel';

// ----- Constants & helpers -----------------------------------------------
const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
};

const STATUS_TONE: Record<TaskStatus, string> = {
  pending: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  in_progress: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  completed: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
};

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  pending: 'in_progress',
  in_progress: 'completed',
  completed: 'pending',
};

const SPARKLINE = [
  { value: 40 }, { value: 65 }, { value: 45 }, { value: 90 }, { value: 70 }, { value: 85 },
];

// Static brain matrix (skill nodes) - placeholder pending live skill data
const BRAIN_MATRIX_SKILLS = [
  { subject: 'Grammar',   A: 85, level: 'B2', cpu: 72, ram: 1.4 },
  { subject: 'Vocabulary',A: 70, level: 'B1', cpu: 64, ram: 1.1 },
  { subject: 'Speaking',  A: 90, level: 'B2', cpu: 81, ram: 1.7 },
  { subject: 'Listening', A: 65, level: 'A2', cpu: 58, ram: 0.9 },
  { subject: 'Syntax',    A: 80, level: 'B2', cpu: 70, ram: 1.3 },
  { subject: 'Fluency',   A: 75, level: 'B1', cpu: 67, ram: 1.2 },
];

// Placeholder timeline data - replace with real logs later
const STUDENT_GOAL_TIMELINE = [
  { day: 'Mon', mastery: 62 }, { day: 'Tue', mastery: 65 },
  { day: 'Wed', mastery: 70 }, { day: 'Thu', mastery: 68 },
  { day: 'Fri', mastery: 78 }, { day: 'Sat', mastery: 81 }, { day: 'Sun', mastery: 85 },
];

const fmtDeadline = (iso: string | null): string => {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return 'Overdue';
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  return `${hours}h`;
};

// Placeholder RAG handler - to be wired to pgvector ingestion endpoint
const handleRAGUpload = async (payload: { kind: 'pdf' | 'text'; data: File | string }) => {
  console.log('[RAG] Ingest queued:', payload.kind, payload.data instanceof File ? payload.data.name : `${(payload.data as string).length} chars`);
  // TODO: POST to /api/rag/ingest -> embed via pgvector
  return new Promise((res) => setTimeout(res, 600));
};

type AdminTab = 'tasks' | 'team';

// ============================================================================
// Inner view (consumes toast context)
// ============================================================================
const AdminDashboardInner: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const queryClient = useQueryClient();
  const toast = useAdminToast();
  const { profile, role } = useUserRole();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('team');
  const seenTaskIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => { setMounted(true); }, []);

  // ----- Tasks query (RLS scopes to this admin) ---------------------------
  const tasksQuery = useQuery({
    queryKey: ['admin', 'myTasks', profile?.id],
    queryFn: () => AdminTaskService.listMyAssignedTasks(),
    enabled: !!profile?.id,
  });

  const tasks = tasksQuery.data ?? [];
  const myAssignedCount = useMemo(
    () => tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
    [tasks],
  );

  // Seed the seen-set once on first successful load so we only toast for *new* inserts
  useEffect(() => {
    if (tasksQuery.isSuccess && seenTaskIdsRef.current.size === 0) {
      tasks.forEach(t => seenTaskIdsRef.current.add(t.id));
    }
  }, [tasksQuery.isSuccess, tasks]);

  // ----- Realtime subscription (only tasks assigned to me) ----------------
  useEffect(() => {
    if (!profile?.id) return;
    const unsubscribe = AdminTaskService.subscribeTasks({
      filter: `assigned_to=eq.${profile.id}`,
      onInsert: (t) => {
        if (seenTaskIdsRef.current.has(t.id)) return;
        seenTaskIdsRef.current.add(t.id);
        toast.push({
          kind: 'info',
          title: 'New task assigned',
          body: t.title,
        });
        queryClient.invalidateQueries({ queryKey: ['admin', 'myTasks'] });
      },
      onUpdate: () => queryClient.invalidateQueries({ queryKey: ['admin', 'myTasks'] }),
      onDelete: () => queryClient.invalidateQueries({ queryKey: ['admin', 'myTasks'] }),
    });
    return unsubscribe;
  }, [profile?.id, queryClient, toast]);

  // ----- Status mutation --------------------------------------------------
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      AdminTaskService.updateTaskStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'myTasks'] });
      const prev = queryClient.getQueryData<AdminTask[]>(['admin', 'myTasks', profile?.id]);
      queryClient.setQueryData<AdminTask[]>(['admin', 'myTasks', profile?.id], (old) =>
        old?.map(t => (t.id === id ? { ...t, status } : t)) ?? [],
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['admin', 'myTasks', profile?.id], ctx.prev);
      toast.push({ kind: 'error', title: 'Update failed', body: 'Status change rejected by server.' });
    },
    onSuccess: (data) => {
      toast.push({ kind: 'success', title: 'Status updated', body: STATUS_LABEL[data.status] });
    },
  });

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0D0D12] text-slate-400 flex font-sans selection:bg-blue-500/30 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-20 border-r border-slate-800 flex flex-col items-center py-8 gap-10 bg-black/20">
        <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center border border-blue-500/20 text-blue-500 mb-4 shadow-[0_0_20px_rgba(37,99,235,0.1)]">
          <Shield size={20} />
        </div>
        <nav className="flex-1 flex flex-col gap-8">
          <SidebarIcon
            icon={<Users size={22} />}
            active={activeTab === 'team'}
            onClick={() => setActiveTab('team')}
            tooltip="My Team"
          />
          <SidebarIcon
            icon={<ClipboardList size={22} />}
            active={activeTab === 'tasks'}
            onClick={() => setActiveTab('tasks')}
            tooltip="My Tasks"
          />
          <SidebarIcon icon={<Brain size={22} />} tooltip="Brain Matrix" />
          <SidebarIcon icon={<MessageSquare size={22} />} tooltip="RAG" />
        </nav>
        <button onClick={onLogout} className="p-3 text-slate-600 hover:text-white transition-colors" aria-label="Logout">
          <LogOut size={22} />
        </button>
      </aside>

      <main className="flex-1 p-8 flex flex-col gap-6 overflow-y-auto">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]" />
            <h1 className="text-2xl font-bold text-white tracking-tight">
              AI <span className="text-blue-500">ADMIN</span> CORE
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Operator</p>
              <p className="text-xs text-white/80 font-bold truncate max-w-[200px]">{profile?.full_name || profile?.email || '—'}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-black">
              {(profile?.full_name || profile?.email || 'A').charAt(0).toUpperCase()}
            </div>
            {role === 2 && <span className="text-[9px] uppercase tracking-widest bg-amber-500/10 text-amber-400 px-2 py-1 rounded-md border border-amber-500/20 font-black">Super Admin</span>}
          </div>
        </header>

        {activeTab === 'team' ? (
          <TeamBriefPanel />
        ) : (
        <>
        {/* Top KPI row */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="My Assigned Tasks"
            sublabel="Pending + In Progress"
            value={tasksQuery.isLoading ? '…' : myAssignedCount}
            icon={<ClipboardList size={18} />}
          />
          <StatCard
            label="AVG Student Mastery"
            value="85%"
            chart={<MiniSparkline color="#3b82f6" />}
          />
          <StatCard
            label="Active Missions"
            value={tasksQuery.isLoading ? '…' : tasks.filter(t => t.status === 'in_progress').length}
            icon={<BookOpen size={18} />}
          />
          <StatCard
            label="Completed (this period)"
            value={tasksQuery.isLoading ? '…' : tasks.filter(t => t.status === 'completed').length}
            chart={<MiniSparkline color="#10b981" />}
          />
        </div>

        {/* Core grid */}
        <div className="grid grid-cols-12 gap-6 flex-1">
          {/* Tasks (live) */}
          <section className="col-span-7 bg-[#111114] border border-slate-800 rounded-3xl p-8 flex flex-col gap-6 shadow-xl">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold text-xl tracking-tight">Mission Protocols</h3>
                <p className="text-xs text-white/40 font-medium">My assigned tasks · synced from Super Admin</p>
              </div>
              <button className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/20" aria-label="More"><MoreVertical size={20} /></button>
            </div>

            <div className="space-y-3">
              {tasksQuery.isLoading && <SkeletonRow />}
              {tasksQuery.isError && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 flex items-center gap-3 text-red-400">
                  <AlertCircle size={18} />
                  <span className="text-sm font-bold">Failed to load tasks. Check connection.</span>
                </div>
              )}
              {tasksQuery.isSuccess && tasks.length === 0 && (
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 text-center">
                  <ClipboardList className="mx-auto mb-2 text-white/20" size={28} />
                  <p className="text-sm text-white/50 font-bold">No tasks assigned yet</p>
                  <p className="text-xs text-white/30 mt-1">When a Super Admin assigns work, it will appear here in real time.</p>
                </div>
              )}
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onCycleStatus={() => statusMutation.mutate({ id: task.id, status: NEXT_STATUS[task.status] })}
                  onSelectStatus={(s) => statusMutation.mutate({ id: task.id, status: s })}
                  isUpdating={statusMutation.isPending && statusMutation.variables?.id === task.id}
                />
              ))}
            </div>
          </section>

          {/* Brain Matrix */}
          <section className="col-span-5 bg-[#111114] border border-slate-800 rounded-3xl p-8 flex flex-col gap-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none" />

            <header className="flex justify-between items-center relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex items-center justify-center text-blue-500 font-black text-lg shadow-[0_0_15px_rgba(59,130,246,0.1)]">B2</div>
                <div>
                  <h3 className="text-white font-bold text-xl tracking-tight">Brain Profile Matrix</h3>
                  <p className="text-xs text-white/40 font-medium">Neural Skill Analysis</p>
                </div>
              </div>
            </header>

            <div className="h-[260px] w-full min-h-[260px] relative z-10">
              <ResponsiveContainer width="100%" height="100%" debounce={100}>
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={BRAIN_MATRIX_SKILLS}>
                  <PolarGrid stroke="rgba(255,255,255,0.05)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700 }} />
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload?.length) return null;
                      const d = payload[0].payload as typeof BRAIN_MATRIX_SKILLS[0];
                      return (
                        <div className="bg-[#0D0D12] border border-slate-700 rounded-xl px-3 py-2 shadow-xl text-[11px]">
                          <p className="text-white font-bold uppercase tracking-widest">{d.subject}</p>
                          <p className="text-white/60">CPU: <span className="text-blue-400 font-bold">{d.cpu}%</span></p>
                          <p className="text-white/60">RAM: <span className="text-emerald-400 font-bold">{d.ram}GB</span></p>
                          <p className="text-white/60">Skill: <span className="text-amber-400 font-bold">{d.A}%</span></p>
                        </div>
                      );
                    }}
                  />
                  <Radar name="skill" dataKey="A" stroke="#3b82f6" strokeWidth={2} fill="#3b82f6" fillOpacity={0.15} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-3 relative z-10">
              {BRAIN_MATRIX_SKILLS.map(skill => (
                <div key={skill.subject} className="bg-white/[0.02] border border-slate-800 p-3 rounded-xl flex flex-col items-center justify-center gap-1 group hover:border-blue-500/30 transition-colors">
                  <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">{skill.subject}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{skill.A}%</span>
                    <span className="text-[9px] font-black text-blue-500/60 uppercase italic">{skill.level}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Goal Timeline */}
        <section className="bg-[#111114] border border-slate-800 rounded-3xl p-8 flex flex-col gap-4 shadow-xl">
          <div className="flex justify-between items-end">
            <div>
              <h3 className="text-white font-bold text-xl tracking-tight">Student Goal Timeline</h3>
              <p className="text-xs text-white/40 font-medium">7-day mastery trajectory · placeholder data</p>
            </div>
          </div>
          <div className="h-48 w-full min-h-[192px]">
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
              <LineChart data={STUDENT_GOAL_TIMELINE}>
                <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: '#0D0D12', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="mastery" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* RAG Knowledge Base Entry */}
        <RAGIngestionPanel />
        </> /* end tasks tab */
        )}
      </main>
    </div>
  );
};

// ============================================================================
// Subcomponents
// ============================================================================
const TaskRow: React.FC<{
  task: AdminTask;
  onCycleStatus: () => void;
  onSelectStatus: (s: TaskStatus) => void;
  isUpdating: boolean;
}> = ({ task, onCycleStatus, onSelectStatus, isUpdating }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white/[0.02] border border-slate-800 p-5 rounded-2xl flex items-center justify-between gap-4 group hover:bg-white/[0.04] transition-all"
  >
    <div className="flex items-center gap-4 min-w-0 flex-1">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${STATUS_TONE[task.status]} flex-shrink-0`}>
        {task.status === 'completed' ? <CheckCircle size={20} /> : task.status === 'in_progress' ? <Zap size={20} /> : <Clock size={20} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-white font-bold text-sm truncate">{task.title}</p>
        {task.description && <p className="text-white/40 text-[11px] font-medium truncate">{task.description}</p>}
        <div className="flex items-center gap-3 mt-1">
          <p className="text-white/30 text-[10px] uppercase tracking-widest font-mono">due {fmtDeadline(task.deadline)}</p>
          {task.deadline && <span className="text-white/20">·</span>}
          <p className="text-white/30 text-[10px] uppercase tracking-widest font-mono">id {task.id.slice(0, 8)}</p>
        </div>
      </div>
    </div>

    <div className="flex items-center gap-3 flex-shrink-0">
      <select
        value={task.status}
        disabled={isUpdating}
        onChange={(e) => onSelectStatus(e.target.value as TaskStatus)}
        className={`bg-black/40 border rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest focus:outline-none cursor-pointer ${STATUS_TONE[task.status]}`}
      >
        <option value="pending">Pending</option>
        <option value="in_progress">In Progress</option>
        <option value="completed">Completed</option>
      </select>
      <button
        onClick={onCycleStatus}
        disabled={isUpdating}
        className="text-[10px] font-black text-blue-500 uppercase hover:text-blue-400 tracking-widest disabled:opacity-50 flex items-center gap-1"
        title="Advance status"
      >
        {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}
        Next
      </button>
    </div>
  </motion.div>
);

const SkeletonRow: React.FC = () => (
  <div className="bg-white/[0.02] border border-slate-800 p-5 rounded-2xl flex items-center gap-4 animate-pulse">
    <div className="w-12 h-12 rounded-xl bg-white/5" />
    <div className="flex-1 space-y-2">
      <div className="h-3 w-1/2 bg-white/5 rounded" />
      <div className="h-2 w-1/3 bg-white/5 rounded" />
    </div>
  </div>
);

const RAGIngestionPanel: React.FC = () => {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onPasteSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await handleRAGUpload({ kind: 'text', data: text });
      setFeedback('✓ Linguistic data queued for vector embedding');
      setText('');
    } finally {
      setSubmitting(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubmitting(true);
    try {
      await handleRAGUpload({ kind: 'pdf', data: file });
      setFeedback(`✓ ${file.name} queued for ingestion`);
    } finally {
      setSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  return (
    <section className="bg-[#111114] border border-slate-800 rounded-3xl p-8 flex flex-col gap-6 shadow-xl overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-white font-bold text-xl tracking-tight">RAG Knowledge Base Entry</h3>
          <p className="text-xs text-white/40 font-medium italic">Feed linguistic patterns into the pgvector embedding store</p>
        </div>
        <div className="flex items-center gap-2 text-blue-400 text-[10px] font-black uppercase tracking-widest">
          <Database size={14} /> pgvector
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase text-white/30 tracking-widest flex items-center gap-2">
            <FileText size={12} /> Paste Raw Linguistic Data
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste corpus here..."
            className="w-full bg-black/20 border border-slate-800 rounded-2xl p-5 h-32 text-xs text-white focus:outline-none focus:border-blue-500/40 resize-none transition-all placeholder:text-white/10"
          />
          <button
            onClick={onPasteSubmit}
            disabled={!text.trim() || submitting}
            className="bg-blue-600/10 border border-blue-500/20 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-blue-400 hover:bg-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
          >
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Embed Text
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <label className="border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center p-6 hover:bg-white/[0.01] hover:border-blue-500/30 transition-all cursor-pointer group">
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={onFileChange} disabled={submitting} />
            <Upload className="text-white/20 group-hover:text-blue-500 mb-2 transition-all group-hover:scale-110" />
            <p className="text-[11px] font-black text-white/30 uppercase tracking-widest group-hover:text-white/60 transition-all">Upload PDF Protocol</p>
          </label>
          <button
            disabled={submitting}
            className="w-full bg-blue-600/5 border border-blue-500/10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-blue-500/80 hover:bg-blue-600/10 hover:text-blue-400 transition-all disabled:opacity-40"
          >
            Define Target Learning Nodes &rarr;
          </button>
        </div>
      </div>

      {feedback && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-emerald-400 text-xs font-bold">{feedback}</div>
      )}
    </section>
  );
};

const SidebarIcon = ({
  icon,
  active,
  onClick,
  tooltip,
}: {
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  tooltip?: string;
}) => (
  <div
    onClick={onClick}
    className={`p-3 rounded-xl transition-all cursor-pointer group relative ${
      active
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
        : 'text-slate-600 hover:text-white hover:bg-white/5'
    }`}
  >
    {icon}
    {tooltip && (
      <div className="absolute left-full ml-3 px-2 py-1 bg-white text-black text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
        {tooltip}
      </div>
    )}
  </div>
);

const StatCard = ({ label, sublabel, value, icon, chart }: { label: string; sublabel?: string; value: any; icon?: React.ReactNode; chart?: React.ReactNode }) => (
  <div className="bg-[#111114] border border-slate-800 p-6 rounded-3xl flex flex-col gap-1 shadow-lg relative overflow-hidden group">
    <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.01] group-hover:bg-blue-500/[0.02] transition-colors rounded-bl-full pointer-events-none" />
    <div className="flex justify-between items-start mb-2 relative z-10">
      <div className="space-y-0.5">
        <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">{label}</p>
        {sublabel && <p className="text-[9px] text-white/10 font-bold uppercase">{sublabel}</p>}
      </div>
      <div className="text-white/10 group-hover:text-blue-500/40 transition-colors">{icon}</div>
    </div>
    <div className="flex items-end justify-between mt-auto relative z-10">
      <h4 className="text-3xl font-bold text-white tracking-tighter">{value}</h4>
      {chart && <div className="w-20 h-10">{chart}</div>}
    </div>
  </div>
);

const MiniSparkline = ({ color }: { color: string }) => (
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={SPARKLINE}>
      <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fillOpacity={0.1} fill={color} />
    </AreaChart>
  </ResponsiveContainer>
);

// ============================================================================
// Public wrapper (provides toast context)
// ============================================================================
export const AdminDashboardView: React.FC<{ onLogout: () => void }> = ({ onLogout }) => (
  <AdminToastProvider>
    <AdminDashboardInner onLogout={onLogout} />
  </AdminToastProvider>
);

export default AdminDashboardView;
