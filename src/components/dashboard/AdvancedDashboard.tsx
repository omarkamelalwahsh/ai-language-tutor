import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Map as MapIcon, 
  BarChart3, 
  History, 
  Settings,
  Trophy,
  Zap,
  LogOut,
  Brain,
  AlertCircle
} from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';

import { useSupabaseDashboard } from '../../hooks/useSupabaseDashboard';
import { AdvancedDashboardPayload } from '../../types/dashboard';
import { AssessmentSessionResult, AssessmentOutcome } from '../../types/assessment';

interface AdvancedDashboardProps {
  result?: AssessmentSessionResult | null;
  dashboardData: AdvancedDashboardPayload;
  assessmentOutcome?: AssessmentOutcome | null;
  onStartSession: () => void;
  onNavigateLeaderboard: () => void;
  onViewReview: () => void;
  onViewHistoryReport?: (id: string) => void;
  onLogout?: () => void;
  isArchitecting?: boolean;
}

interface SkillData {
  subject: string;
  A: number;
  fullMark: number;
}

export const AdvancedDashboard: React.FC<AdvancedDashboardProps> = ({
  result, dashboardData, assessmentOutcome, onStartSession, onLogout 
}) => {
  const supabaseData = useSupabaseDashboard();
  const navigate = useNavigate();
  const location = useLocation();

  // Handle active tab
  const activeTab = useMemo(() => {
    const segments = location.pathname.split('/');
    const last = segments[segments.length - 1];
    return (last === 'dashboard' || !last) ? 'dashboard' : last;
  }, [location.pathname]);

  const handleTabChange = (tabId: string) => {
    if (tabId === 'dashboard') {
      navigate('/dashboard');
    } else {
      navigate(`/dashboard/${tabId}`);
    }
  };

  const isLoading = supabaseData.isLoading && !result;

  // Sync real data:
  const profile = supabaseData?.profile || {};
  const currentLevel = assessmentOutcome?.finalLevel || profile.currentLevel || profile.overall_level || 'B1';
  const points = profile.points || 0;
  const fullName = supabaseData?.user?.fullName || 'Learner';

  const skillData: SkillData[] = useMemo(() => {
    const skills = supabaseData.skills?.length > 0 ? supabaseData.skills : [];
    if (skills.length === 0) {
       // Mock fallback if empty
       return [
        { subject: 'Speaking', A: 95, fullMark: 100 },
        { subject: 'Listening', A: 70, fullMark: 100 },
        { subject: 'Reading', A: 40, fullMark: 100 },
        { subject: 'Writing', A: 60, fullMark: 100 },
       ];
    }
    return skills.map((s: any) => ({
      subject: s.skillId.charAt(0).toUpperCase() + s.skillId.slice(1),
      A: s.masteryScore,
      fullMark: 100
    }));
  }, [supabaseData.skills]);

  const journeyNodes = useMemo(() => {
      const nodes = dashboardData?.journey?.nodes || [];
      if (nodes.length === 0) {
          // Fake nodes for empty state
          return [
              { id: '1', title: 'Basics', status: 'completed' },
              { id: '2', title: 'Contextual Reading', status: 'current' },
              { id: '3', title: 'Advanced Grammar', status: 'locked' },
              { id: '4', title: 'Fluency Lab', status: 'locked' }
          ];
      }
      return nodes;
  }, [dashboardData?.journey?.nodes]);

  const bridgeDelta = supabaseData.errorProfile?.bridge_delta || "Bridge to next level";
  const criticalInsight = supabaseData.errorProfile?.action_plan?.[0] || 
        "Reading A2 detected as bottleneck. We've optimized your path to include C1-level audio with transcript-matching tasks.";


  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="flex h-screen bg-[#0a0e17] text-slate-200 font-sans overflow-hidden relative">
      {/* Circuit Breaker Overlay */}
      <AnimatePresence>
        {supabaseData.isSyncing && (
           <motion.div 
             initial={{ opacity: 0, y: -20 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -20 }}
             className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-orange-500 text-white px-6 py-2 rounded-full shadow-lg font-bold flex items-center gap-2"
           >
             <Zap className="w-4 h-4 animate-pulse" /> Data Syncing...
           </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Sidebar */}
      <aside className="w-64 bg-[#0f172a] border-r border-slate-800 flex flex-col p-6 shrink-0 z-10 hidden md:flex">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <Zap size={20} className="text-white" fill="white" />
          </div>
          <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent leading-tight tracking-tight">
                AI Tutor
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{currentLevel} Program</p>
          </div>
        </div>
        
        <nav className="space-y-2 flex-1">
          <NavItem icon={<LayoutDashboard size={20}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} />
          <NavItem icon={<MapIcon size={20}/>} label="My Path" active={activeTab === 'journey'} onClick={() => handleTabChange('journey')}/>
          <NavItem icon={<BarChart3 size={20}/>} label="Analytics" active={activeTab === 'analytics'} onClick={() => handleTabChange('analytics')}/>
          <NavItem icon={<History size={20}/>} label="History" active={activeTab === 'history'} onClick={() => handleTabChange('history')}/>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800 space-y-2">
          <NavItem icon={<Settings size={20}/>} label="Settings" active={activeTab === 'settings'} onClick={() => handleTabChange('settings')}/>
          {onLogout && (
             <NavItem icon={<LogOut size={20}/>} label="Sign Out" onClick={onLogout} isDanger />
          )}
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <main className="flex-1 overflow-y-auto relative p-4 md:p-8">
        {/* Mobile Tab Bar */}
        <div className="flex md:hidden items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide border-b border-slate-800 shrink-0">
            <button onClick={() => handleTabChange('dashboard')} className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold ${activeTab === 'dashboard' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'text-slate-400 border border-slate-800'}`}>Dashboard</button>
            <button onClick={() => handleTabChange('journey')} className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold ${activeTab === 'journey' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'text-slate-400 border border-slate-800'}`}>My Path</button>
            <button onClick={() => handleTabChange('analytics')} className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold ${activeTab === 'analytics' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'text-slate-400 border border-slate-800'}`}>Analytics</button>
            {onLogout && <button onClick={onLogout} className="px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold border border-rose-500/30 text-rose-400 ml-auto">Sign Out</button>}
        </div>

        {/* Top Header */}
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white">Welcome back, {fullName}!</h2>
            <p className="text-slate-400 text-sm mt-1">Your <span className="text-orange-400 font-bold">{currentLevel} Roadmap</span> is active.</p>
          </div>
          <div className="flex gap-4 items-center shrink-0">
             <div className="bg-[#1e293b] px-4 py-2 rounded-full border border-orange-500/30 flex items-center gap-2 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                <Trophy size={18} className="text-orange-400" />
                <span className="font-bold text-orange-400">{points} Points</span>
             </div>
             <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-amber-300 p-[2px] hidden sm:block">
                <div className="w-full h-full rounded-full bg-[#0a0e17] flex items-center justify-center overflow-hidden border-2 border-[#0a0e17]">
                   <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${fullName}&backgroundColor=transparent`} alt="Profile" />
                </div>
             </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
          {/* Left: The Hexagonal Map (My Path) */}
          <section className="col-span-1 lg:col-span-8 bg-[#0f172a]/50 rounded-3xl border border-slate-800 p-6 md:p-8 md:min-h-[450px] relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
            
            <div className="flex flex-wrap justify-between items-center gap-4 mb-10 relative z-10">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Learning Journey Map</h3>
                <p className="text-sm text-slate-400">Your tailored progression based on errors.</p>
              </div>
              <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-full text-indigo-400 font-bold uppercase tracking-widest shrink-0">
                Diagnostic Path: {bridgeDelta}
              </span>
            </div>
            
            {/* Hexagon Grid Dynamic Mapper */}
            <div className="relative flex-1 flex justify-center items-center h-64 min-h-[300px] z-10">
              <div className="flex flex-wrap justify-center gap-4 md:gap-8 max-w-2xl mx-auto">
                 {journeyNodes.map((n: any, idx: number) => {
                     const statusMap: any = {
                         completed: 'complete',
                         current: 'active',
                         locked: 'locked'
                     };
                     const s = statusMap[n.status] || 'locked';
                     // Alternate layout nicely
                     const isBumped = idx % 2 !== 0;
                     return (
                         <div key={n.id || idx} className={`transition-all ${isBumped ? 'mt-8 md:mt-12' : ''}`}>
                             <HexNode status={s} label={n.title} />
                         </div>
                     );
                 })}
              </div>
            </div>

            <div className="mt-auto flex justify-center pt-8 z-10">
              <button onClick={onStartSession} className="group relative inline-flex items-center justify-center px-8 py-3.5 font-bold text-white transition-all duration-200 bg-orange-500 border border-transparent rounded-full hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.5)] active:scale-95">
                 Continue Journey
                 <Zap className="ml-2 w-4 h-4 group-hover:fill-current" />
              </button>
            </div>
          </section>

          {/* Right: Skill Radar (Intelligence Panel) */}
          <section className="col-span-1 lg:col-span-4 flex flex-col gap-6">
            <div className="bg-[#0f172a]/80 backdrop-blur-sm rounded-3xl border border-slate-800 p-6 flex-1 shadow-lg shadow-black/20">
                <div className="flex items-center gap-2 mb-6">
                    <Brain className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-lg font-bold text-white">Skill Intelligence</h3>
                </div>
                <div className="h-56 -ml-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={skillData}>
                      <PolarGrid stroke="#1e293b" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} />
                      <Radar
                        name="Skills"
                        dataKey="A"
                        stroke="#f97316"
                        strokeWidth={2}
                        fill="#f97316"
                        fillOpacity={0.3}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-orange-500" />
                  <p className="text-[10px] text-orange-400 font-black uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                      <AlertCircle className="w-3 h-3" /> Critical Insight
                  </p>
                  <p className="text-sm text-slate-300 leading-relaxed font-medium">
                    {criticalInsight}
                  </p>
                </div>
            </div>

            {/* Quick Stats or Next Objective */}
            <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900/80 rounded-3xl border border-indigo-500/20 p-6 relative overflow-hidden shadow-lg shadow-black/20">
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
               <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-4">Focus Area</h3>
               
               <div className="space-y-3 relative z-10">
                   {(supabaseData.focusAreas || ["Advanced Conditional Statements", "Irregular Past Participles"]).slice(0, 2).map((area: string, i: number) => (
                       <div key={i} className="bg-[#0f172a]/80 p-3 rounded-xl border border-indigo-500/20 flex items-start gap-3">
                           <div className="mt-1 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)] shrink-0" />
                           <span className="text-sm text-indigo-50 font-medium">{area}</span>
                       </div>
                   ))}
               </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

// --- Sub-components ---

const HexNode = ({ status, label }: { status: 'complete' | 'active' | 'locked', label: string }) => {
  const variants = {
    complete: "bg-orange-500 border-orange-400 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]",
    active: "bg-[#0a0e17] border-orange-500 text-orange-500 shadow-[0_0_25px_rgba(249,115,22,0.3)] animate-[pulse_3s_ease-in-out_infinite]",
    locked: "bg-slate-800/50 border-slate-700 text-slate-500"
  };

  const hexStyle = {
      clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)"
  };

  return (
    <div className="flex flex-col items-center gap-3 w-20">
      <div 
         className={`w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center transition-all duration-300 ${status === 'active' ? 'scale-110' : 'hover:scale-105'}`}
      >
          <div 
              className={`w-full h-full flex items-center justify-center ${variants[status]}`}
              style={hexStyle}
          >
             <div className="w-full h-full flex items-center justify-center scale-[0.8] bg-[#0a0e17]" style={hexStyle}>
                <div className={`w-full h-full flex items-center justify-center ${status === 'complete' ? 'bg-orange-500' : status === 'active' ? 'bg-orange-500/10' : 'bg-slate-800/80'}`}>
                    {status === 'complete' && <Trophy size={20} className="text-white" />}
                    {status === 'active' && <Zap size={20} className="text-orange-500 fill-orange-500" />}
                </div>
             </div>
          </div>
      </div>
      <span className={`text-[10px] sm:text-xs font-bold text-center leading-tight ${status === 'locked' ? 'text-slate-600' : status === 'active' ? 'text-orange-400' : 'text-slate-300'}`}>
        {label}
      </span>
    </div>
  );
};

const NavItem = ({ icon, label, active = false, onClick, isDanger = false }: { icon: any, label: string, active?: boolean, onClick?: () => void, isDanger?: boolean }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${
      active 
        ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-[inset_0_0_10px_rgba(249,115,22,0.05)]' 
        : isDanger
          ? 'text-rose-500 hover:bg-rose-500/10 border border-transparent'
          : 'text-slate-400 hover:bg-slate-800/80 hover:text-white border border-transparent'
    }`}
  >
    {icon}
    <span className="font-bold text-sm tracking-wide">{label}</span>
  </button>
);

const LoadingSkeleton = () => (
  <div className="h-screen w-full bg-[#0a0e17] flex items-center justify-center">
    <div className="relative flex flex-col items-center">
      <div className="w-16 h-16 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
      <div className="mt-6 text-[10px] text-orange-500 font-bold uppercase tracking-widest animate-pulse flex items-center gap-2">
         <Zap size={14} className="fill-orange-500" /> Booting AI Engine...
      </div>
    </div>
  </div>
);

export default AdvancedDashboard;
