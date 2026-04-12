import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Map as MapIcon, 
  BarChart3, 
  History, 
  Settings,
  Trophy,
  Zap,
  LogOut,
  Brain,
  AlertCircle,
  Clock,
  CheckCircle2,
  Lock,
  RefreshCcw,
  BookOpen,
  ChevronRight,
  Bell,
  Home,
  Database,
  ArrowRight,
  TrendingUp,
  Activity,
  Mic,
  Heart,
  X
} from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';

import { useSupabaseDashboard } from '../../hooks/useSupabaseDashboard';
import { AdvancedDashboardPayload } from '../../types/dashboard';
import { AssessmentSessionResult, AssessmentOutcome } from '../../types/assessment';

// --- Types ---
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
  A: number; // Actual score mapped
  B: number; // Target score mapped for overlay
  fullMark: number;
}

// ============================================================================
// MAIN COMPONENT EXCELLENCE
// ============================================================================
export const AdvancedDashboard: React.FC<AdvancedDashboardProps> = (props) => {
  const { result, onLogout } = props;
  const supabaseData = useSupabaseDashboard();
  const navigate = useNavigate();
  const location = useLocation();

  // Tab router
  const activeTab = useMemo(() => {
    const segments = location.pathname.split('/');
    const last = segments[segments.length - 1];
    if (['dashboard', 'home', ''].includes(last)) return 'home';
    if (['journey', 'path'].includes(last)) return 'journey';
    return last;
  }, [location.pathname]);

  const handleTabChange = (tabId: string) => {
    if (tabId === 'home') navigate('/dashboard');
    else navigate(`/dashboard/${tabId}`);
  };

  const isLoading = supabaseData.isLoading && !result;
  const fullName = supabaseData?.user?.fullName || 'Omar Kamel';

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-800 font-sans overflow-hidden relative">
      
      {/* Auto-Sync Banner */}
      <AnimatePresence>
        {supabaseData.isSyncing && (
           <motion.div 
             initial={{ opacity: 0, scale: 0.9, y: -20 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             exit={{ opacity: 0, scale: 0.9, y: -20 }}
             className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-white border border-slate-200 text-slate-700 px-6 py-2 rounded-full shadow-sm font-bold text-sm flex items-center gap-2"
           >
             <RefreshCcw className="w-4 h-4 text-blue-500 animate-spin" /> Syncing Real-time Profile...
           </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Sidebar - Dark Navy Enterprise Look */}
      <aside className="w-64 bg-[#0B1437] flex flex-col p-6 shrink-0 z-10 hidden md:flex rounded-br-3xl shadow-xl shadow-slate-200/50">
        <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer transition-transform hover:scale-105 active:scale-95" onClick={() => handleTabChange('home')}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
             <Trophy size={20} className="text-white" fill="currentColor" />
          </div>
          <div>
              <h1 className="text-xl font-black text-white leading-tight tracking-tight">
                Career Copilot
              </h1>
          </div>
        </div>
        
        <nav className="space-y-1.5 flex-1">
          <NavItem icon={<Home size={18}/>} label="Home" active={activeTab === 'home'} onClick={() => handleTabChange('home')} />
          <NavItem icon={<MapIcon size={18}/>} label="My Path" active={activeTab === 'journey'} onClick={() => handleTabChange('journey')}/>
          <NavItem icon={<BarChart3 size={18}/>} label="Analytics" active={activeTab === 'analytics'} onClick={() => handleTabChange('analytics')}/>
          <NavItem icon={<History size={18}/>} label="History" active={activeTab === 'history'} onClick={() => handleTabChange('history')}/>
          <NavItem icon={<BookOpen size={18}/>} label="Practice" active={activeTab === 'practice'} onClick={() => handleTabChange('practice')}/>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-700/50 space-y-1.5">
          <NavItem icon={<Settings size={18}/>} label="Settings" active={activeTab === 'settings'} onClick={() => handleTabChange('settings')}/>
          {onLogout && (
             <NavItem icon={<LogOut size={18}/>} label="Sign Out" onClick={onLogout} isDanger />
          )}
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <header className="h-[72px] bg-[#F8FAFC]/80 backdrop-blur-md flex items-center justify-between px-8 shrink-0 relative z-20">
           <div className="flex items-center gap-2 text-sm font-bold text-slate-400 capitalize bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
              <span className={`transition-colors cursor-pointer hover:text-slate-700 ${activeTab === 'home' ? 'text-slate-800' : ''}`} onClick={() => handleTabChange('home')}>
                 {activeTab === 'home' ? 'Home' : 'My Path'}
              </span>
              {activeTab !== 'home' && (
                 <>
                   <ChevronRight size={14} className="text-slate-300" />
                   <span className="text-slate-800">{activeTab === 'journey' ? 'Learning Journey Map' : activeTab}</span>
                 </>
              )}
           </div>
           
           <div className="flex items-center gap-4">
              <button className="relative p-2 bg-white rounded-full border border-slate-200 text-slate-400 hover:text-slate-600 transition shadow-sm hover:shadow active:scale-95">
                 <Bell size={18} />
                 <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
              </button>

              {/* Profile Info (Desktop) */}
              <div className="hidden md:block text-right">
                <p className="text-sm font-bold text-slate-900 leading-none">{fullName}</p>
                <p className="text-[10px] text-slate-500 uppercase font-black mt-1">
                  {supabaseData.profile?.currentLevel || 'A1'}
                </p>
              </div>

              <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm hover:shadow-md transition cursor-pointer">
                 <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${fullName}&backgroundColor=transparent`} alt="Profile" className="w-full h-full object-cover" />
              </div>

              {/* Robust Sign Out (Mobile Accessibility) */}
              <button 
                onClick={onLogout}
                className="p-2 ml-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-100 group shadow-sm active:scale-95"
                title="Sign Out"
              >
                <LogOut size={20} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
           </div>

        </header>

        {/* Scrollable Content Views */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-12 pt-2">
           <AnimatePresence mode="wait">
             <motion.div 
               key={activeTab}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               transition={{ duration: 0.2 }}
               className="h-full"
             >
                {activeTab === 'home' && <HomeTab {...props} />}
                {activeTab === 'journey' && <JourneyTab {...props} />}
                {activeTab === 'analytics' && <AnalyticsTab {...props} />}
                {activeTab === 'history' && <HistoryTab {...props} />}
                {activeTab === 'settings' && <SettingsTab {...props} />}
                {/* Fallbacks */}
                {['practice'].includes(activeTab) && (
                   <div className="h-full flex flex-col items-center justify-center text-slate-400">
                      <Zap className="w-12 h-12 mb-4 text-slate-200" />
                      <h2 className="text-xl font-bold text-slate-600">Module Restructuring</h2>
                      <p className="text-sm">The '{activeTab}' screen is being integrated into the new Vibe.</p>
                      <button onClick={() => handleTabChange('home')} className="mt-6 px-6 py-2 bg-blue-50 text-blue-600 font-bold rounded-lg hover:bg-blue-100 transition">Return Home</button>
                   </div>
                )}
             </motion.div>
           </AnimatePresence>
        </div>
      </main>
    </div>
  );
};


// ============================================================================
// SUB-COMPONENTS (TABS)
// ============================================================================

const HomeTab = ({ assessmentOutcome, onViewReview }: AdvancedDashboardProps) => {
    const supabaseData = useSupabaseDashboard();
    const profile = supabaseData?.profile || {};
    const currentLevel = assessmentOutcome?.finalLevel || profile.currentLevel || profile.overall_level || 'B1+';
    const points = profile.points || 190;
    const fullName = supabaseData?.user?.fullName || 'Omar Kamel';

    const skillData: SkillData[] = useMemo(() => {
      // 🎯 Prioritize actual in-memory assessment results (Post-completion)
      // then fall back to Supabase skills, then fallback to mockups.
      let sourceSkills = [];
      if (assessmentOutcome?.skillBreakdown) {
          sourceSkills = Object.entries(assessmentOutcome.skillBreakdown).map(([id, data]: [string, any]) => ({
              skillId: id,
              masteryScore: Math.round((data.score || data.confidence?.score || 0) * 100),
              confidence: data.confidence?.score || 0
          }));
      } else if (supabaseData.skills?.length > 0) {
          sourceSkills = supabaseData.skills;
      } else {
          sourceSkills = [
              { skillId: 'Speaking', masteryScore: 78, confidence: 0.8 },
              { skillId: 'Reading', masteryScore: 42, confidence: 0.4 },
              { skillId: 'Writing', masteryScore: 65, confidence: 0.6 },
              { skillId: 'Listening', masteryScore: 85, confidence: 0.9 },
          ];
      }

      return sourceSkills.map((s: any) => ({
        subject: s.skillId.charAt(0).toUpperCase() + s.skillId.slice(1),
        A: s.masteryScore,
        B: Math.min(100, s.masteryScore + 20),
        fullMark: 100
      }));
    }, [supabaseData.skills, assessmentOutcome]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-[1400px] mx-auto min-h-full">
            {/* Left Area (8/12) */}
            <div className="lg:col-span-8 flex flex-col gap-6">
                {/* Profile Card */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between relative overflow-hidden group hover:shadow-md transition duration-300">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                    
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="w-20 h-20 rounded-[1.25rem] bg-slate-50 overflow-hidden shadow-sm border border-slate-200 shrink-0">
                           <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${fullName}&backgroundColor=transparent`} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{fullName}</h2>
                            <div className="flex items-center gap-3 mt-2">
                               <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Level</span>
                               <span className="text-[11px] font-black text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md shadow-sm">{currentLevel}</span>
                               <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100 flex items-center gap-1">
                                  Total points <AlertCircle size={10} className="text-slate-400"/>
                               </span>
                            </div>
                        </div>
                    </div>

                    <div className="text-left sm:text-right mt-6 sm:mt-0 pt-6 sm:pt-0 border-t border-slate-100 sm:border-0 w-full sm:w-auto relative z-10">
                        <div className="flex flex-col sm:items-end gap-2">
                             <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total points</p>
                             <p className="text-5xl font-black text-slate-900 tracking-tighter mb-4">{points}</p>
                             <button 
                                onClick={onViewReview}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-indigo-600 text-white text-[11px] font-bold uppercase tracking-widest rounded-xl transition shadow-lg shadow-indigo-500/10 active:scale-95"
                             >
                                <History size={14} /> Review My Answers
                             </button>
                        </div>
                    </div>
                </div>

                {/* Skill Overview Radar */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 flex-1 flex flex-col min-h-[450px] relative group hover:shadow-md transition duration-300">
                    <div className="flex justify-between items-center mb-4 relative z-10">
                        <h3 className="text-xl font-bold text-slate-900">Skill Overview</h3>
                        <span className="text-[10px] bg-white border border-slate-200 px-3 py-1.5 rounded-full text-slate-500 font-bold uppercase tracking-wider shadow-sm">Confidence intervals</span>
                    </div>
                    
                    <div className="flex-1 min-h-[300px] -mt-4 relative z-0">
                       <ResponsiveContainer width="100%" height="100%">
                         <RadarChart cx="50%" cy="50%" outerRadius="70%" data={skillData}>
                           {/* Clean precise grid matching the Mockup */}
                           <PolarGrid stroke="#f1f5f9" strokeDasharray="4 4" />
                           <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }} />
                           {/* The main orange shape from Mockup 1 */}
                           <Radar name="Skills" dataKey="A" stroke="#f59e0b" strokeWidth={2} fill="#f59e0b" fillOpacity={0.35} />
                         </RadarChart>
                       </ResponsiveContainer>
                    </div>

                    <div className="mt-4 bg-amber-500 hover:bg-amber-600 transition-colors cursor-pointer rounded-2xl p-5 text-center shadow-md shadow-amber-500/20 relative z-10">
                        <span className="font-bold text-white text-[15px] tracking-wide inline-flex items-center gap-2">
                           <AlertCircle size={18} /> Level Gaps Detected: Focusing on Reading
                        </span>
                    </div>
                </div>
            </div>

            {/* Right Area (4/12) */}
            <div className="lg:col-span-4 flex flex-col h-full h-full">
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 flex-1 group hover:shadow-md transition duration-300 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 text-slate-300 hover:text-blue-500 transition-colors cursor-pointer">
                        <RefreshCcw size={16} />
                    </div>

                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-xl font-bold text-slate-900">Upcoming Tasks</h3>
                        <button className="text-sm text-blue-600 hover:text-blue-700 font-bold bg-blue-50 px-3 py-1 rounded-full transition-colors mr-6">See all</button>
                    </div>

                    <div className="space-y-4 relative z-10">
                        {/* Task Card 1 */}
                        <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow hover:border-slate-200 transition-all cursor-pointer group/card flex items-start gap-4">
                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0 border border-blue-100/50 group-hover/card:bg-blue-500 transition-colors">
                                <BookOpen size={20} className="fill-blue-500 text-transparent group-hover/card:fill-white" />
                            </div>
                            <div className="flex-1 mt-1">
                                <h4 className="font-bold text-slate-900 text-sm mb-1 group-hover/card:text-blue-600 transition-colors">B1 Reading: Tech News</h4>
                                <p className="text-xs text-slate-500 font-medium">B1 Reading Quiz</p>
                                <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                   <span className="text-blue-500 uppercase tracking-widest">Learn more</span> • 1 day ago
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-slate-200 group-hover/card:text-blue-500 group-hover/card:translate-x-1 transition-all mt-3" />
                        </div>
                        
                        {/* Task Card 2 */}
                        <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow hover:border-slate-200 transition-all cursor-pointer group/card flex items-start gap-4">
                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0 border border-blue-100/50 group-hover/card:bg-blue-500 transition-colors">
                                <Activity size={20} className="fill-blue-500 text-transparent group-hover/card:fill-white" />
                            </div>
                            <div className="flex-1 mt-1">
                                <h4 className="font-bold text-slate-900 text-sm mb-1 group-hover/card:text-blue-600 transition-colors">Vocabulary Quiz</h4>
                                <p className="text-xs text-slate-500 font-medium">Reads-in Vocabulary Quiz</p>
                            </div>
                            <ChevronRight size={18} className="text-slate-200 group-hover/card:text-blue-500 group-hover/card:translate-x-1 transition-all mt-3" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


const JourneyTab = ({ onStartSession }: AdvancedDashboardProps) => {
    const supabaseData = useSupabaseDashboard();
    const journeyNodes = supabaseData.persistedJourney?.nodes || [];
    const journeyTitle = supabaseData.persistedJourney?.journeyTitle || "Bridge to Mastery";
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-[1400px] mx-auto min-h-full">
             {/* Left Area (8/12) */}
             <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-10 min-h-[550px] relative overflow-hidden flex flex-col group hover:shadow-md transition duration-300">
                 
                 <div className="flex justify-between items-start mb-10 z-20 relative">
                     <div>
                         <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">{journeyTitle}</h2>
                         <p className="text-sm text-slate-500 font-medium">Your personalized AI-architected progression map.</p>
                     </div>
                     <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                         <MapIcon size={14} className="text-indigo-500" /> Dynamic Path
                     </div>
                 </div>

                 {/* Isometric Map Background Floor */}
                 <div className="absolute inset-0 z-0 flex items-center justify-center top-32 overflow-hidden">
                     <div className="w-[150%] h-[150%] origin-top">
                        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="opacity-30">
                            <defs>
                                <pattern id="isometricGrid" width="60" height="34.64" patternUnits="userSpaceOnUse" patternTransform="scale(1.5)">
                                <path d="M60 0L30 17.32M30 17.32L0 0M30 17.32V51.96" fill="none" stroke="#cbd5e1" strokeWidth="1" />
                                </pattern>
                            </defs>
                            {/* Perspective transform to simulate isometric floor */}
                            <g style={{ transform: 'rotateX(60deg) rotateZ(45deg)' }}>
                                <rect width="100%" height="100%" fill="url(#isometricGrid)" />
                            </g>
                        </svg>
                     </div>
                 </div>

                 {/* Simulated Hex Map Graph */}
                 <div className="flex-1 w-full relative z-10 flex items-center justify-center py-10">
                     <div className="relative w-full max-w-2xl h-80 bg-transparent flex items-center justify-center">
                         
                         {/* Network SVG Connections */}
                         <svg className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-sm" style={{ zIndex: -1 }}>
                             {journeyNodes.map((node, i) => {
                                 if (i === 0) return null;
                                 const x1 = 15 + (i-1) * 20;
                                 const y1 = (i-1) % 2 === 0 ? 35 : 65;
                                 const x2 = 15 + i * 20;
                                 const y2 = i % 2 === 0 ? 35 : 65;
                                 return (
                                   <line 
                                     key={`line-${i}`} 
                                     x1={`${x1}%`} y1={`${y1}%`} 
                                     x2={`${x2}%`} y2={`${y2}%`} 
                                     stroke={node.status === 'completed' || node.status === 'current' ? "#f59e0b" : "#cbd5e1"} 
                                     strokeWidth={node.status === 'completed' || node.status === 'current' ? "3" : "2"} 
                                     strokeDasharray={node.status === 'locked' ? "4 4" : "0"} 
                                   />
                                 );
                             })}
                         </svg>

                         {journeyNodes.length > 0 ? (
                             journeyNodes.map((node, i) => (
                                 <div key={node.id} className="absolute" style={{ top: `${i % 2 === 0 ? 35 : 65}%`, left: `${15 + i * 20}%` }}>
                                     <IsometricHexNode 
                                         status={node.status === 'completed' || node.status === 'current' ? 'active' : 'locked'} 
                                         label={node.title} 
                                         onClick={node.status !== 'locked' ? onStartSession : undefined} 
                                     />
                                 </div>
                             ))
                         ) : (
                             <div className="text-slate-400 font-bold animate-pulse text-sm">Architecting your path...</div>
                         )}
                     </div>
                 </div>

             </div>

             {/* Right Area (4/12) */}
             <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 h-full min-h-[500px] group hover:shadow-md transition duration-300 relative">
                 <div className="absolute bottom-6 right-6 text-slate-300 hover:text-blue-500 cursor-pointer transition">
                    <RefreshCcw size={18} />
                 </div>
                 
                 <h3 className="text-xl font-black text-slate-900 mb-8 tracking-tight">Parallel Progress</h3>
                 
                 <div className="space-y-5">
                    {/* Event Blocks styled precisely like Mockup 3 right pane */}
                     <EventLogItem 
                        icon={<Database size={16} className="text-slate-500" strokeWidth={2.5}/>} 
                        title="Database Sync" desc="in real time" 
                     />
                     <EventLogItem 
                        icon={<RefreshCcw size={16} className="text-amber-500" strokeWidth={2.5} />} 
                        title="State Update" desc="in real time" 
                     />
                     <EventLogItem 
                        icon={<BookOpen size={16} className="text-slate-400" strokeWidth={2.5}/>} 
                        title="Boiler page or assessments" desc="complete" 
                        blur 
                     />
                     <EventLogItem 
                        icon={<RefreshCcw size={16} className="text-amber-500" strokeWidth={2.5} />} 
                        title="State Update" desc="in real time" 
                     />
                 </div>
             </div>
        </div>
    );
};


const AnalyticsTab = ({ assessmentOutcome }: AdvancedDashboardProps) => {
    const supabaseData = useSupabaseDashboard();
    
    // Skill data same as HomeTab but visualized with a dual-radar overlay in Mockup
    const skillData: SkillData[] = useMemo(() => {
        const skills = supabaseData.skills?.length > 0 ? supabaseData.skills : [
            { skillId: 'Speaking', masteryScore: 78 },
            { skillId: 'Reading', masteryScore: 42 },
            { skillId: 'Writing', masteryScore: 65 },
            { skillId: 'Listening', masteryScore: 85 },
        ];
        return skills.map((s: any) => ({
          subject: s.skillId.charAt(0).toUpperCase() + s.skillId.slice(1),
          A: s.masteryScore,
          B: Math.min(100, s.masteryScore * 1.3), // Simulated Target overlay
          fullMark: 100
        }));
    }, [supabaseData.skills]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-[1400px] mx-auto min-h-full">
            {/* Split 1: Radar & Action Plan (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-6">
                {/* Radar */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 h-[380px] flex flex-col group hover:shadow-md transition">
                    <div className="flex justify-between items-center mb-2 z-10">
                        <h3 className="text-lg font-black text-slate-900">Skill Overview</h3>
                        <span className="text-[9px] bg-white border border-slate-200 px-3 py-1.5 rounded-full text-slate-500 font-bold uppercase tracking-wider shadow-sm">Confidence interval</span>
                    </div>
                    <div className="flex-1 -mt-6">
                       <ResponsiveContainer width="100%" height="100%">
                         <RadarChart cx="50%" cy="50%" outerRadius="65%" data={skillData}>
                           <PolarGrid stroke="#f1f5f9" strokeDasharray="3 3"/>
                           <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }} />
                           {/* Dual Radar Design from Mockup 4 */}
                           <Radar name="Skills" dataKey="B" stroke="#3b82f6" strokeWidth={1} fill="#3b82f6" fillOpacity={0.05} />
                           <Radar name="SkillsTarget" dataKey="A" stroke="#f59e0b" strokeWidth={2} fill="#f59e0b" fillOpacity={0.25} />
                         </RadarChart>
                       </ResponsiveContainer>
                    </div>
                </div>

                {/* Action Plan */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 flex-1 group hover:shadow-md transition relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                    
                    <h3 className="text-lg font-black text-slate-900 mb-4 tracking-tight">Action Plan</h3>
                    <p className="text-[13px] text-slate-500 leading-relaxed font-medium">
                        {supabaseData.errorProfile?.action_plan?.join(' ') || 
                        "Reading stananoo a evais of complex testoenal Al ethics, used land iomae funeliontat stralgnts trer erparstns and inilresical cenoncetcd. The seam is ethics caly stotementar, curter calurialors and some prasentatiwns."}
                    </p>
                </div>
            </div>

            {/* Split 2: Skill Deep Dive (5 cols) */}
            <div className="lg:col-span-5 flex flex-col h-full">
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 flex-1 group hover:shadow-md transition overflow-y-auto max-h-[600px] custom-scrollbar">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Skill Proficiency</h3>
                        <div className="p-1 px-3 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-blue-100 shadow-sm">
                            Real-time Signals
                        </div>
                    </div>
                    
                    <div className="space-y-6">
                        {(supabaseData.skills || []).length > 0 ? (
                           supabaseData.skills.map((skill: any) => (
                            <div key={skill.skillId} className="border-b border-slate-100 pb-6 last:border-0 group/skill">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover/skill:bg-blue-50 group-hover/skill:text-blue-500 transition-colors border border-slate-100">
                                            {skill.skillId === 'speaking' && <Mic size={18} />}
                                            {skill.skillId === 'listening' && <Activity size={18} />}
                                            {skill.skillId === 'reading' && <BookOpen size={18} />}
                                            {skill.skillId === 'writing' && <ArrowRight size={18} />}
                                            {!['speaking', 'listening', 'reading', 'writing'].includes(skill.skillId) && <Zap size={18} />}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-[15px] text-slate-900 leading-snug capitalize group-hover/skill:text-blue-600 transition-colors">
                                                {skill.skillId}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border 
                                                    ${skill.masteryScore > 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                                      skill.masteryScore > 40 ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                                                      'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                                    {skill.currentLevel || (skill.masteryScore > 80 ? 'B2' : skill.masteryScore > 50 ? 'B1' : 'A2')}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                                    {skill.masteryScore}% Mastery
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Stability</div>
                                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full border
                                            ${skill.status === 'stable' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                            {skill.status || 'stable'}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    {/* Progress Bar Container */}
                                    <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 shadow-inner">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${skill.masteryScore}%` }}
                                            className={`h-full transition-all duration-1000 
                                                ${skill.masteryScore > 70 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 
                                                  skill.masteryScore > 40 ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 
                                                  'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]'}`}
                                        />
                                    </div>
                                    
                                    {/* Weaknesses if any */}
                                    {(skill.weaknesses || []).length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {skill.weaknesses.slice(0, 2).map((w: string, idx: number) => (
                                                <span key={idx} className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md">
                                                    {w}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                           ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                                <Activity className="w-12 h-12 mb-4 opacity-20" />
                                <p className="text-sm font-medium">Syncing Skill Profile...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Split 3: Parallel Event Log (3 cols) */}
            <div className="lg:col-span-3 flex flex-col h-full">
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 flex-1 group hover:shadow-md transition relative">
                    <h3 className="text-xl font-black text-slate-900 mb-8 tracking-tight">Parallel Event Log</h3>
                    
                    <div className="space-y-6 relative ml-2 before:absolute before:inset-0 before:ml-[7px] before:-translate-x-px before:h-full before:w-[2px] before:bg-slate-100">
                        {/* Event 1 */}
                        <div className="flex gap-4 relative z-10 w-full group/event cursor-default">
                            <div className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-50 border-2 border-emerald-400 flex items-center justify-center text-emerald-500 mt-1 shadow-[0_0_8px_rgba(52,211,153,0.3)] group-hover/event:scale-110 transition">
                                <CheckCircle2 size={10} strokeWidth={4} />
                            </div>
                            <div>
                                <h4 className="text-[13px] font-bold text-slate-900 leading-tight">Saved Assessment</h4>
                                <p className="text-[11px] font-medium text-slate-500 mb-1.5">(RPC cast to Numeric)</p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">3 hours ago</p>
                            </div>
                        </div>
                        {/* Event 2 */}
                        <div className="flex gap-4 relative z-10 w-full group/event cursor-default">
                            <div className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-50 border-2 border-emerald-400 flex items-center justify-center text-emerald-500 mt-1 shadow-[0_0_8px_rgba(52,211,153,0.3)] group-hover/event:scale-110 transition">
                                <CheckCircle2 size={10} strokeWidth={4} />
                            </div>
                            <div>
                                <h4 className="text-[13px] font-bold text-slate-900 leading-tight">Updated B1 Reading Goal</h4>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-2">2 hours ago</p>
                            </div>
                        </div>
                        {/* Event 3 */}
                        <div className="flex gap-4 relative z-10 w-full group/event cursor-default">
                            <div className="flex-shrink-0 w-4 h-4 rounded-full bg-amber-50 border-2 border-amber-400 flex items-center justify-center text-amber-500 mt-1 shadow-[0_0_8px_rgba(251,191,36,0.3)] group-hover/event:scale-110 transition">
                                <Trophy size={10} strokeWidth={3} className="fill-amber-500" />
                            </div>
                            <div>
                                <h4 className="text-[13px] font-bold text-slate-900 leading-tight">Achievement Earned: Diagnostic Pioneer</h4>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-2">2 hours ago</p>
                            </div>
                        </div>
                    </div>

                    <div className="absolute bottom-6 right-6 text-slate-300 hover:text-blue-500 cursor-pointer transition">
                        <RefreshCcw size={16} />
                    </div>
                </div>
            </div>
        </div>
    )
}

const SettingsTab = ({  }: AdvancedDashboardProps) => {
    const supabaseData = useSupabaseDashboard();
    const profile = supabaseData.profile;
    const [isSaving, setIsSaving] = React.useState(false);
    
    const [settings, setSettings] = React.useState({
        why: profile?.learningGoal || 'casual',
        what: profile?.targetLanguage || 'English',
        how: profile?.focusSkills || ['speaking', 'listening'],
        interest: profile?.learningTopics || ['general'],
        pace: profile?.sessionIntensity || 'regular'
    });

    React.useEffect(() => {
        if (profile) {
            setSettings({
                why: profile.learningGoal || 'casual',
                what: profile.targetLanguage || 'English',
                how: profile.focusSkills || [],
                interest: profile.learningTopics || [],
                pace: profile.sessionIntensity || 'regular'
            });
        }
    }, [profile]);

    const handleSave = async () => {
        setIsSaving(true);
        const userId = localStorage.getItem('auth_user_id');
        if (!userId) return;

        try {
            const { supabase } = await import('../../lib/supabaseClient');
            const { error } = await supabase
                .from('learner_profiles')
                .update({
                    learning_goal: settings.why,
                    focus_skills: settings.how,
                    learning_topics: settings.interest,
                    session_intensity: settings.pace,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (error) throw error;
            if (supabaseData.refresh) supabaseData.refresh();
        } catch (err) {
            console.error('[Settings] Save Failed:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const SettingCard = ({ icon, label, title, subtitle, children }: { icon: any, label: string, title: string, subtitle: string, children: React.ReactNode }) => (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 flex flex-col group hover:shadow-md transition relative">
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                        {icon}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none">{label}</span>
                            <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none">{title}</h3>
                        </div>
                        <p className="text-sm text-slate-500 mt-1.5 font-medium">{subtitle}</p>
                    </div>
                </div>
            </div>
            {children}
        </div>
    );

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 pb-20">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Adaptive Profile</h2>
                    <p className="text-slate-500 font-medium">Fine-tune your learning engine across 5 dimensions.</p>
                </div>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition shadow-lg
                    ${isSaving 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/25 active:scale-95'}
                  `}
                >
                    {isSaving ? 'Syncing...' : 'Save Changes'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Goal (WHY) */}
                <SettingCard icon={<Trophy size={20} />} label="Goal" title="The WHY" subtitle="What is your ultimate objective?">
                    <select 
                        value={settings.why}
                        onChange={(e) => setSettings({...settings, why: e.target.value as any})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    >
                        <option value="casual">Casual Learner</option>
                        <option value="serious">Academic Performance</option>
                        <option value="professional">Professional Career</option>
                    </select>
                </SettingCard>

                {/* 2. Language (WHAT) */}
                <SettingCard icon={<Brain size={20} />} label="Language" title="The WHAT" subtitle="Your target language interface.">
                    <div className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-400 cursor-not-allowed flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-500" /> English (Standard)
                    </div>
                </SettingCard>

                {/* 3. Skill Focus (HOW) */}
                <SettingCard icon={<Activity size={20} />} label="Focus Skill" title="The HOW" subtitle="Select your training priorities.">
                    <div className="flex flex-wrap gap-2">
                        {['speaking', 'writing', 'listening', 'vocabulary'].map(skill => {
                            const isSelected = settings.how.includes(skill);
                            return (
                                <button
                                    key={skill}
                                    onClick={() => {
                                        const next = isSelected 
                                            ? settings.how.filter(s => s !== skill)
                                            : [...settings.how, skill];
                                        setSettings({...settings, how: next});
                                    }}
                                    className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition
                                        ${isSelected ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}
                                    `}
                                >
                                    {skill}
                                </button>
                            );
                        })}
                    </div>
                </SettingCard>

                {/* 4. Topics (INTEREST) */}
                <SettingCard icon={<Heart size={20} />} label="Topics" title="The INTEREST" subtitle="Subjects that keep you engaged.">
                   <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Interests</p>
                        <div className="flex flex-wrap gap-2">
                            {settings.interest.map(t => (
                                <span key={t} className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-600 border border-slate-200 shadow-sm flex items-center gap-1.5 capitalize">
                                    {t} <X size={10} className="text-slate-400 cursor-pointer" onClick={() => setSettings({...settings, interest: settings.interest.filter(i => i !== t)})} />
                                </span>
                            ))}
                            <button className="px-3 py-1 bg-white border border-slate-200 border-dashed rounded-lg text-[10px] font-bold text-blue-600 hover:bg-blue-50 transition">+ Add Topic</button>
                        </div>
                   </div>
                </SettingCard>

                {/* 5. Time (PACE) */}
                <div className="md:col-span-2">
                    <SettingCard icon={<Clock size={20} />} label="Time" title="The PACE" subtitle="Set your weekly intensity level.">
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { id: 'light', label: 'Light', desc: 'Social Pace' },
                                { id: 'regular', label: 'Regular', desc: 'Balanced growth' },
                                { id: 'intensive', label: 'Intensive', desc: 'Fast track' }
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setSettings({...settings, pace: opt.id as any})}
                                    className={`p-4 rounded-2xl border-2 transition text-left
                                        ${settings.pace === opt.id ? 'border-blue-500 bg-blue-50/30 shadow-md shadow-blue-500/10' : 'border-slate-50 bg-slate-50/50 hover:border-slate-200'}
                                    `}
                                >
                                    <h4 className={`font-black uppercase tracking-widest text-xs ${settings.pace === opt.id ? 'text-blue-600' : 'text-slate-600'}`}>
                                        {opt.label}
                                    </h4>
                                    <p className="text-[11px] text-slate-400 font-bold mt-1">{opt.desc}</p>
                                </button>
                            ))}
                        </div>
                    </SettingCard>
                </div>
            </div>
        </div>
    );
}

const HistoryTab = ({ assessmentOutcome, onViewHistoryReport }: AdvancedDashboardProps) => {
    const supabaseData = useSupabaseDashboard();
    const history = supabaseData.history || [];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-[1400px] mx-auto min-h-full">
            {/* Left Area: Chronological Log (8 cols) */}
            <div className="lg:col-span-8 flex flex-col gap-6 h-full">
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 flex-1 flex flex-col group hover:shadow-md transition">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Assessment History</h3>
                        <div className="flex items-center gap-2">
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{history.length} Sessions Found</span>
                             <div className="w-[1px] h-3 bg-slate-200" />
                             <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline transition">Export PDF</button>
                        </div>
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                        {history.length > 0 ? (
                            history.map((session: any) => (
                                <div key={session.id} className="p-5 rounded-2xl border border-slate-50 bg-slate-50/30 hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all group/session flex items-center justify-between cursor-default">
                                    <div className="flex items-center gap-5">
                                        <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center shadow-sm group-hover/session:border-blue-200 transition-colors">
                                            <span className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">
                                                {new Date(session.createdAt).toLocaleString('default', { month: 'short' })}
                                            </span>
                                            <span className="text-lg font-black text-slate-900 leading-none">
                                                {new Date(session.createdAt).getDate()}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-bold text-slate-900 text-[15px] leading-none">Diagnostic Assessment</h4>
                                                <span className="text-[10px] bg-blue-50 text-blue-600 font-black px-2 py-0.5 rounded border border-blue-100">
                                                    {session.overallLevel}
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-medium text-slate-400 italic">
                                                ID: {session.id.substring(0, 8)}... • {new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8">
                                        <div className="hidden md:flex flex-col items-end">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Confidence</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                                                    <div 
                                                        className="h-full bg-blue-500 rounded-full" 
                                                        style={{ width: `${(session.confidence || 0) * 100}%` }} 
                                                    />
                                                </div>
                                                <span className="text-xs font-bold text-slate-700">{Math.round((session.confidence || 0) * 100)}%</span>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={() => onViewHistoryReport && onViewHistoryReport(session.id)}
                                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm active:scale-95"
                                        >
                                            View Report
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="h-64 flex flex-col items-center justify-center text-slate-300">
                                <History size={48} strokeWidth={1.5} className="mb-4 opacity-20" />
                                <p className="text-sm font-bold uppercase tracking-widest">No history recorded yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Area: Highlights & Stats (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="bg-[#0B1437] rounded-3xl p-8 text-white relative overflow-hidden group hover:shadow-xl transition shadow-lg shadow-slate-200">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <TrendingUp size={80} />
                    </div>
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2 relative z-10">
                        <TrendingUp size={18} className="text-blue-400" /> Progress velocity
                    </h3>
                    
                    <div className="space-y-6 relative z-10">
                        <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Max Level Reached</p>
                            <p className="text-4xl font-black">{history[0]?.overallLevel || 'B1'}</p>
                        </div>
                        <div className="flex gap-10">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sessions</p>
                                <p className="text-2xl font-black">{history.length}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg Score</p>
                                <p className="text-2xl font-black">
                                    {history.length > 0 
                                        ? Math.round(history.reduce((a, b) => a + (b.confidence || 0), 0) / history.length * 100) 
                                        : 0}%
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-700/50 flex items-center justify-between relative z-10">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Database Sync: Active</span>
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 flex-1 group hover:shadow-md transition">
                    <h3 className="text-lg font-black text-slate-900 mb-6 tracking-tight">System Notice</h3>
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 border-dashed">
                        <p className="text-[13px] text-amber-800 font-medium leading-relaxed">
                            Assessment logs are retained for 90 days. For long-term tracking, please refer to the "Skill Proficiency" matrix in Analytics.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// MICRO-COMPONENTS
// ============================================================================

const IsometricHexNode = ({ status, label, onClick }: { status: 'active' | 'locked', label: string, onClick?: () => void }) => {
    const isLocked = status === 'locked';
    return (
        <div 
           className={`flex flex-col items-center gap-3 w-32 group transition-all duration-300 ${isLocked ? '' : 'cursor-pointer hover:-translate-y-2'}`}
           onClick={!isLocked ? onClick : undefined}
        >
           <div className={`relative w-[6.5rem] h-[6.5rem] flex items-center justify-center`}>
               {/* Base Floor Shadow to give 3D floating effect */}
               {!isLocked && <div className="absolute -bottom-4 w-12 h-3 bg-amber-900/10 rounded-full blur-md group-hover:scale-110 transition-transform" />}
               
               {/* 3D 3-layer Hexagon */}
               <div className="relative w-full h-full">
                  {/* Layer 1: Dark bottom shadow block */}
                  <div 
                     className={`absolute top-2 w-full h-full ${isLocked ? 'bg-slate-300' : 'bg-amber-600'} opacity-100`}
                     style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }} 
                  />
                  {/* Layer 2: Main Top block */}
                  <div 
                     className={`absolute top-0 w-full h-full flex flex-col items-center justify-center text-white
                       ${isLocked ? 'bg-[#1E293B]' : 'bg-gradient-to-br from-amber-400 to-amber-500 shadow-[inset_0_2px_10px_rgba(255,255,255,0.3)]'}
                     `}
                     style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
                  >
                      {/* Inner border illusion */}
                      <div className={`w-[96%] h-[96%] flex items-center justify-center ${isLocked ? 'bg-[#1e293b]' : 'bg-gradient-to-br from-amber-400 to-amber-500'}`} style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}>
                          {isLocked ? <Lock size={20} className="text-slate-400" /> : <BookOpen size={24} className="text-white drop-shadow-md" />}
                      </div>
                  </div>
               </div>
           </div>
           
           {/* Label Panel */}
           <div className={`px-3 py-1.5 rounded-lg border shadow-sm backdrop-blur-sm
              ${isLocked 
                 ? 'bg-white/80 border-slate-200 shadow-slate-200/50' 
                 : 'bg-white border-amber-100 shadow-amber-500/20'
              }
           `}>
              <span className={`text-[10px] font-black uppercase tracking-wider text-center leading-tight
                 ${isLocked ? 'text-slate-400' : 'text-amber-600'}
              `}>
                 {label}
              </span>
           </div>
        </div>
    );
}

const EventLogItem = ({ icon, title, desc, blur }: { icon: any, title: string, desc: string, blur?: boolean }) => (
    <div className={`flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow hover:border-slate-200 transition-all cursor-default ${blur ? 'opacity-40 grayscale blur-[0.5px]' : ''}`}>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] shrink-0">
            {icon}
        </div>
        <div className="flex-1 mt-0.5">
            <h4 className="font-bold text-slate-800 text-[13px] tracking-tight">{title}</h4>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mt-1">{desc}</p>
        </div>
    </div>
)

const NavItem = ({ icon, label, active = false, onClick, isDanger = false }: { icon: any, label: string, active?: boolean, onClick?: () => void, isDanger?: boolean }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all border font-bold text-[13px] ${
      active 
        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/50' 
        : isDanger
          ? 'text-rose-400 hover:bg-rose-500/10 border-transparent'
          : 'text-slate-400 hover:bg-[#1E293B] hover:text-white border-transparent'
    }`}
  >
    {icon}
    <span className="tracking-wide">{label}</span>
  </button>
);

const LoadingSkeleton = () => (
  <div className="h-screen w-full bg-[#F8FAFC] flex items-center justify-center">
    <div className="relative flex flex-col items-center">
      <div className="w-16 h-16 border-[5px] border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
      <div className="mt-6 text-xs text-slate-400 font-bold uppercase tracking-widest animate-pulse flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
         <Database size={14} className="text-blue-500" /> Restoring Workspace...
      </div>
    </div>
  </div>
);

export default AdvancedDashboard;
