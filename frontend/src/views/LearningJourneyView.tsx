import React, { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target, Sparkles, CheckCircle2, Lock, ArrowRight, Play, 
  BookOpen, Mic, PenTool, Headphones, Layers, Zap, 
  Brain, Focus, ChevronRight, Activity, MapPin, 
  ShieldCheck, AlertCircle, Info, TrendingUp
} from 'lucide-react';
import { learnerService, JourneyData, JourneyNode } from '../services/learnerService';

interface LearningJourneyViewProps {
  result?: any;
  onStartSession?: () => void;
  onViewDashboard?: () => void;
}

// ---------------------------------------------------------------------------
// CEFR Logic Helpers
// ---------------------------------------------------------------------------
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
type CefrLevel = typeof CEFR_LEVELS[number];

const getNextLevel = (current: string): string => {
  const clean = (current || 'A1').toUpperCase().trim().substring(0, 2);
  const idx = CEFR_LEVELS.indexOf(clean as CefrLevel);
  if (idx === -1) return 'A2';
  if (idx === CEFR_LEVELS.length - 1) return CEFR_LEVELS[idx];
  return CEFR_LEVELS[idx + 1];
};

const ADAPTIVE_INTERVENTIONS: any[] = [];

// ---------------------------------------------------------------------------
// Reusable Mini-Components
// ---------------------------------------------------------------------------

const Breadcrumb = ({ items }: { items: string[] }) => (
  <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4 bg-white dark:bg-gray-900/40 px-3 py-1.5 rounded-full border border-slate-200 dark:border-gray-800 backdrop-blur-sm self-start shadow-premium">
    {items.map((item, i) => (
      <React.Fragment key={item}>
        <span className={i === items.length - 1 ? 'text-blue-600 dark:text-indigo-400' : ''}>{item}</span>
        {i < items.length - 1 && <ChevronRight size={10} />}
      </React.Fragment>
    ))}
  </nav>
);

const SkillRing = ({ skill, percentage, color }: { skill: string, percentage: number, color: string, key?: number | string }) => {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2 group">
      <div className="relative flex items-center justify-center w-12 h-12">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="24" cy="24" r={radius} fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-100 dark:text-gray-800" />
          <motion.circle 
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            cx="24" cy="24" r={radius} fill="none" stroke={color} strokeWidth="4" 
            strokeDasharray={circumference} strokeLinecap="round" 
            style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
          />
        </svg>
        <span className="absolute text-[10px] font-black text-slate-900 dark:text-slate-50">{percentage}%</span>
      </div>
      <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-slate-300 transition-colors text-center">{skill}</span>
    </div>
  );
};

const CefrProgressBar = ({ currentLevel }: { currentLevel: string }) => {
  const levels = CEFR_LEVELS;
  const activeIndex = levels.indexOf(currentLevel as CefrLevel);
  const targetIndex = activeIndex + 1 < levels.length ? activeIndex + 1 : activeIndex;

  return (
    <div className="w-full max-w-2xl mt-8 px-4">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-slate-200 dark:bg-border -translate-y-1/2 z-0">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(activeIndex / (levels.length - 1)) * 100}%` }}
            transition={{ duration: 1.5, delay: 0.5 }}
            className="h-full bg-blue-600 dark:bg-gradient-to-r dark:from-blue-600 dark:to-indigo-500 shadow-premium dark:shadow-[0_0_15px_rgba(99,102,241,0.5)]" 
          />
        </div>
        {levels.map((level, idx) => {
          const isPast = idx < activeIndex;
          const isActive = idx === activeIndex;
          const isTarget = idx === targetIndex;
          return (
            <div key={level} className="relative z-10 flex flex-col items-center">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border-2 transition-all duration-500
                ${isPast ? 'bg-slate-100 dark:bg-indigo-900 border-slate-200 dark:border-indigo-500/50 text-slate-400 dark:text-indigo-300' : ''}
                ${isActive ? 'bg-blue-600 dark:bg-blue-600 border-blue-400 dark:border-indigo-400 text-white shadow-premium dark:shadow-[0_0_20px_rgba(99,102,241,0.4)] scale-110' : ''}
                ${isTarget && !isActive ? 'bg-white dark:bg-slate-900 border-blue-500/30 dark:border-indigo-500/30 text-blue-600 dark:text-indigo-400 ring-2 ring-blue-500/10 dark:ring-indigo-500/20' : ''}
                ${!isPast && !isActive && !isTarget ? 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 text-slate-500 dark:text-slate-400' : ''}
              `}>
                {level}
              </div>
              {isActive && (
                 <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute -top-7 text-[9px] uppercase tracking-widest font-black text-blue-600 dark:text-indigo-400">Current</motion.span>
               )}
              {isTarget && !isActive && (
                 <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute -top-7 text-[9px] uppercase tracking-widest font-black text-blue-600 dark:text-indigo-400">Target</motion.span>
               )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const WindingPath = () => {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
        {/* We use a complex Bezier curve for the winding path effect */}
        <path 
           d="M 280 0 C 280 150, 480 150, 480 300 C 480 450, 280 450, 280 600 C 280 750, 480 750, 480 900 C 480 1050, 280 1050, 280 1200"
           fill="none" 
           stroke="currentColor" 
           strokeWidth="8" 
           strokeLinecap="round"
           strokeDasharray="1 20"
           className="text-slate-200 dark:text-slate-800 hidden lg:block"
        />
        {/* Animated glow path */}
        <motion.path 
           initial={{ pathLength: 0 }}
           animate={{ pathLength: 1 }}
           transition={{ duration: 3, ease: "linear", repeat: Infinity }}
           d="M 280 0 C 280 150, 480 150, 480 300 C 480 450, 280 450, 280 600 C 280 750, 480 750, 480 900 C 480 1050, 280 1050, 280 1200"
           fill="none" 
           stroke="url(#glowGradient)" 
           strokeWidth="2" 
           strokeLinecap="round"
           className="opacity-20 hidden lg:block"
        />
        {/* Mobile vertical line fallback */}
        <line x1="50%" y1="0" x2="50%" y2="100%" stroke="currentColor" className="text-slate-200 dark:text-gray-800 lg:hidden" strokeWidth="4" strokeDasharray="8 8" />
        
        <defs>
          <linearGradient id="glowGradient" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#2563eb" offset="0%" />
            <stop stopColor="#5eead4" offset="50%" />
            <stop stopColor="#2563eb" offset="100%" />
          </linearGradient>
        </defs>
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export const LearningJourneyView: React.FC<LearningJourneyViewProps> = ({ result, onStartSession, onViewDashboard }) => {
  const [journeyData, setJourneyData] = useState<JourneyData | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const parseLinguisticContent = (content: string) => {
    if (!content) return "";
    const trimmed = content.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parsed.scenario || parsed.description || parsed.title || parsed.task || content;
      } catch (e) {
        return content;
      }
    }
    return content;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [j, d] = await Promise.all([
          learnerService.getJourney(),
          learnerService.getDashboard()
        ]);
        setJourneyData(j);
        setDashboardData(d);
      } catch (err) {
        console.error('[JourneyView] Fetch Error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const currentLevel = useMemo(() => {
    return (dashboardData?.profile?.current_level || result?.finalLevel || result?.overallLevel || 'A2').toUpperCase();
  }, [dashboardData, result]);

  const targetLevel = useMemo(() => getNextLevel(currentLevel), [currentLevel]);

  const nodes = journeyData?.nodes || [];
  const isCalibration = journeyData?.status === 'calibration' || nodes.length === 0;

  const getIcon = (type: string) => {
    switch(type.toLowerCase()) {
      case 'lesson': return Layers;
      case 'drill': return Zap;
      case 'audit': return ShieldCheck;
      case 'assessment': return Target;
      default: return BookOpen;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Activity size={40} className="text-indigo-500 animate-spin" />
          <p className="text-slate-500 font-bold uppercase tracking-widest animate-pulse">Architecting Roadmap...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-slate-50 font-sans selection:bg-blue-500/30 overflow-x-hidden transition-colors duration-300 flex flex-col md:flex-row">
      
      {/* --- Responsive Sidebar --- */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-slate-200 dark:border-gray-800 transform transition-transform duration-300 md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Brain className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tighter">AI TUTOR</h2>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Mastery Protocol</p>
            </div>
          </div>

          <nav className="flex-1 space-y-2">
             <button onClick={onViewDashboard} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-blue-50 dark:hover:bg-blue-600/10 hover:text-blue-600 transition-all">
                <Layers size={18} /> Dashboard
             </button>
             <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-lg">
                <Activity size={18} /> My Journey
             </button>
             <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                <Target size={18} /> Skills Matrix
             </button>
          </nav>

          <div className="mt-auto pt-6 border-t border-slate-100 dark:border-gray-800">
             <div className="flex items-center gap-3 px-2">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-gray-800 overflow-hidden">
                   <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${dashboardData?.profile?.name || 'User'}`} alt="Profile" />
                </div>
                <div className="flex-1 min-w-0">
                   <p className="text-sm font-bold truncate">{dashboardData?.profile?.name || 'Learner'}</p>
                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{currentLevel} Level</p>
                </div>
             </div>
          </div>
        </div>
        <button onClick={() => setIsSidebarOpen(false)} className="absolute top-6 -right-12 md:hidden w-10 h-10 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl flex items-center justify-center text-slate-500 shadow-xl">
           <ChevronRight size={20} className="rotate-180" />
        </button>
      </aside>

      {/* --- Main Dashboard Body --- */}
      <main className="flex-1 w-full min-w-0 overflow-y-auto overflow-x-hidden relative">
        <div className="md:hidden sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-slate-200 dark:border-gray-800 p-4 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <Brain size={24} className="text-blue-600" />
              <span className="font-black tracking-tighter">AI TUTOR</span>
           </div>
           <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-600 dark:text-slate-400">
              <Activity size={24} />
           </button>
        </div>

        <div className="absolute top-0 left-1/2 w-[100%] max-w-[1000px] h-[600px] bg-blue-600 dark:bg-blue-600/5 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-10 lg:py-16 relative z-10">
          
          <header className="flex flex-col mb-12 lg:mb-20">
            <div className="flex flex-wrap items-center gap-4 mb-8">
               <button 
                 onClick={onViewDashboard}
                 className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800/50 rounded-full backdrop-blur-sm transition active:scale-95 group shadow-premium"
               >
                  <ArrowRight size={12} className="rotate-180 group-hover:-translate-x-0.5 transition-transform" /> Back
               </button>
               <Breadcrumb items={['My Path', 'Current Journey']} />
            </div>
            
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 lg:gap-12">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex-1">
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter mb-4 text-slate-900 dark:text-slate-50 leading-[1.1]">
                  Bridging the Gap: <span className="text-blue-600 dark:text-indigo-400">{currentLevel}</span> <span className="opacity-50">→</span> <span className="text-blue-600 dark:text-indigo-400">{targetLevel}</span>
                </h1>
                <p className="text-sm sm:text-base md:text-lg text-slate-500 dark:text-slate-400 font-medium max-w-xl">
                  <span className="text-blue-500 font-bold dark:text-indigo-400">Consolidation & Fluency.</span> AI-architected transformation path balancing theoretical foundation with real-time error repair.
                </p>
              </motion.div>

               <div className="flex flex-wrap gap-3 sm:gap-4 shrink-0">
                  <SummaryBadge 
                    label="Progress" 
                    value={nodes.length > 0 ? `${Math.round((nodes.filter(n => n.status === 'completed').length / nodes.length) * 100)}%` : '0%'} 
                  />
                  <SummaryBadge 
                    label="Nodes" 
                    value={nodes.length > 0 ? `${nodes.filter(n => n.status === 'completed').length}/${nodes.length}` : '0/0'} 
                  />
                  <SummaryBadge label="Status" value={nodes.length > 0 ? 'On Track' : 'Calibrating'} active={nodes.length > 0} />
               </div>
            </div>

            <div className="w-full max-w-3xl">
               <CefrProgressBar currentLevel={currentLevel} />
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-12 lg:gap-20 items-start">
            
            <div className="relative min-h-[600px] lg:pt-10">
              <WindingPath />
              
              <div className="flex flex-col gap-16 md:gap-24 lg:gap-32 relative z-10">
                {isCalibration ? (
                  <div className="flex flex-col items-center justify-center text-center p-8 sm:p-16 bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-[2.5rem] md:rounded-[3rem] shadow-premium transition-colors duration-300">
                    <Brain size={60} className="text-blue-600 dark:text-indigo-400 mb-6 opacity-50" />
                    <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50 mb-2">Awaiting Diagnostic Signal</h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-md font-medium">Complete your first assessment to allow the 70B Model to architect your personalized linguistic trajectory.</p>
                    <button 
                      onClick={onStartSession}
                      className="mt-8 px-10 py-4 bg-blue-600 text-white font-black rounded-2xl hover:scale-105 transition shadow-premium flex items-center gap-3 uppercase tracking-widest text-xs"
                    >
                      Start Diagnostic <Sparkles size={16} />
                    </button>
                  </div>
                ) : (
                  nodes.map((node, i) => {
                    const isEven = i % 2 === 0;
                    const Icon = getIcon(node.type);
                    return (
                      <motion.div 
                        key={node.id}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        className={`flex flex-col items-center gap-6 md:gap-10 group w-full
                          ${isEven ? 'lg:flex-row lg:pl-12 xl:pl-20' : 'lg:flex-row-reverse lg:pr-12 xl:pr-20'}
                          ${node.status === 'locked' ? 'opacity-40 grayscale' : ''}
                        `}
                      >
                        <div className="shrink-0 relative">
                           {node.status === 'active' && (
                             <div className="absolute inset-0 bg-blue-500 dark:bg-indigo-500 rounded-[2rem] blur-[30px] opacity-20 dark:opacity-30 animate-pulse" />
                           )}
                           <div className={`
                             relative w-20 h-20 md:w-28 md:h-28 rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-center transition-all duration-500
                             ${node.status === 'completed' ? 'bg-slate-900 border border-emerald-500/30 shadow-inner' : ''}
                             ${node.status === 'active' ? 'bg-blue-600 dark:bg-blue-600 border-2 border-indigo-400 shadow-xl scale-110 z-20' : ''}
                             ${node.status === 'locked' ? 'bg-slate-950 border border-slate-800' : ''}
                           `}>
                             <div className="flex flex-col items-center">
                                {node.status === 'completed' && <CheckCircle2 size={32} className="text-emerald-400" />}
                                {node.status === 'active' && <Play size={32} className="text-white fill-white ml-1" />}
                                {node.status === 'locked' && <Lock size={24} className="text-slate-600" />}
                                <span className={`text-[9px] font-black uppercase mt-1 ${node.status === 'active' ? 'text-blue-100' : 'opacity-50'}`}>{node.type}</span>
                             </div>
                           </div>
                        </div>

                        <div className={`
                           max-w-sm w-full p-6 md:p-8 rounded-[2rem] bg-white dark:bg-gray-900 transition-colors duration-300 border border-slate-200 dark:border-slate-800 shadow-premium group-hover:shadow-xl relative
                           ${node.status === 'active' ? 'ring-1 ring-blue-500/30 dark:ring-indigo-500/30 bg-white dark:bg-slate-900/80' : ''}
                        `}>
                           <div className="flex justify-between items-start mb-3 md:mb-4 gap-4">
                              <h3 className="text-lg md:text-xl font-black tracking-tight text-slate-900 dark:text-slate-50 leading-snug">{parseLinguisticContent(node.title)}</h3>
                              {node.status === 'active' && <Sparkles size={16} className="text-amber-400 shrink-0 mt-1" />}
                           </div>
                           
                           <p className="text-[11px] md:text-xs text-slate-400 font-medium leading-relaxed mb-4">
                              {parseLinguisticContent(node.description)}
                           </p>

                           <div className="flex flex-wrap gap-2 mb-4 md:mb-6">
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-950/50 border border-slate-800 rounded-lg text-[9px] md:text-[10px] font-bold text-slate-500">
                                 <Icon size={12} /> {node.skill_focus.toUpperCase()}
                              </div>
                           </div>

                           {node.status === 'active' && (
                             <button 
                               onClick={onStartSession}
                               className="w-full py-3 bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] md:text-xs uppercase tracking-widest rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
                             >
                               Continue Journey <ArrowRight size={14} />
                             </button>
                           )}
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </div>
            </div>

            <aside className="flex flex-col gap-6 lg:sticky lg:top-12">
              <ContextCard 
                icon={<Brain className="text-blue-600 dark:text-indigo-400" />} 
                title="Adaptive Logic"
                content={dashboardData?.intelligence_feed?.action_plan || "Architecting your linguistic trajectory based on real-time diagnostic markers."}
                accent
              />

              <div className="bg-white dark:bg-[#0F172A]/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-[2.5rem] shadow-premium">
                 <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-8 flex items-center gap-2">
                   <Target size={16} className="text-blue-600 dark:text-indigo-400" /> Readiness Matrix
                 </h4>
                 <div className="grid grid-cols-3 gap-y-8 gap-x-4">
                    {dashboardData?.skills?.slice(0, 3).map((s: any, idx: number) => (
                      <SkillRing key={idx} skill={s.skillId || s.name || s.subject} percentage={s.currentScore || s.score} color={(s.currentScore || s.score) > 70 ? "#10B981" : (s.currentScore || s.score) > 40 ? "#F59E0B" : "#EF4444"} />
                    )) || (
                      <>
                        <SkillRing skill="Speaking" percentage={0} color="#10B981" />
                        <SkillRing skill="Writing" percentage={0} color="#F59E0B" />
                        <SkillRing skill="Listening" percentage={0} color="#EF4444" />
                      </>
                    )}
                 </div>
                 <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/50">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium italic leading-relaxed">
                      {dashboardData?.intelligence_feed?.recent_insights?.[0]?.insight || "Focus on current nodes to stabilize your next level readiness."}
                    </p>
                 </div>
              </div>

              {dashboardData?.kpis?.due_reviews > 0 && (
                <motion.div 
                   whileHover={{ y: -5 }}
                   className="bg-white dark:bg-[#0F172A]/80 border border-slate-200 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-premium cursor-pointer group"
                   onClick={onStartSession}
                >
                   <div className="flex justify-between items-center mb-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
                        <Zap className="text-amber-500 fill-amber-500" size={16} /> Due Review
                      </h4>
                      <span className="text-[10px] bg-amber-400/10 text-amber-500 px-2 py-0.5 rounded-md font-bold border border-amber-400/20">{dashboardData.kpis.due_reviews}</span>
                   </div>
                   <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed group-hover:text-blue-600 dark:group-hover:text-slate-200 transition">
                      Detected vocabulary decay in {dashboardData.kpis.due_reviews} items. Recommend a quick recall spurt.
                   </p>
                </motion.div>
              )}
            </aside>
          </div>

          <section className="mt-24 lg:mt-40 pt-16 lg:pt-20 border-t border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16">
              <div>
                <h3 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50 mb-8 flex items-center gap-3">
                   <MapPin className="text-indigo-400" /> Current Stop Goals
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {nodes.slice(0, 3).map((node) => (
                    <GoalItem key={node.id} title={parseLinguisticContent(node.title)} desc={parseLinguisticContent(node.description)} />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50 mb-8 flex items-center gap-3">
                   <Sparkles className="text-amber-400" /> Adaptive Interventions
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {ADAPTIVE_INTERVENTIONS.map(item => (
                     <div key={item.id} className="p-5 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 shadow-sm rounded-3xl hover:border-blue-500/30 transition-all group">
                        <div className="w-10 h-10 rounded-xl bg-slate-950 mb-4 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                           <item.icon size={20} className="text-indigo-400 group-hover:text-white" />
                        </div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-slate-50 mb-1">{item.title}</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{item.desc}</p>
                     </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <footer className="mt-24 py-12 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-6 opacity-40">
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-center sm:text-left">Learner Intelligence Protocol v3.1</span>
             <div className="flex gap-6">
                <TrendingUp size={16} />
                <Info size={16} />
                <ShieldCheck size={16} />
             </div>
          </footer>
        </div>
      </main>
    </div>
  );
};

// --- Sub-Components ---

const SummaryBadge = ({ label, value, active }: { label: string, value: string, active?: boolean }) => (
  <div className={`p-4 rounded-2xl border flex flex-col justify-center min-w-[120px] transition-all shadow-premium
    ${active ? 'bg-blue-50 dark:bg-blue-600/10 border-blue-200 dark:border-indigo-500/30' : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50'}
  `}>
    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{label}</span>
    <span className={`text-2xl font-black ${active ? 'text-blue-600 dark:text-indigo-400' : 'text-slate-900 dark:text-slate-50'}`}>{value}</span>
  </div>
);

const ContextCard = ({ icon, title, content, accent }: any) => (
  <div className={`
    p-8 rounded-[2.5rem] border shadow-premium dark:shadow-md relative overflow-hidden transition-all
    ${accent ? 'bg-blue-50 dark:bg-blue-600/10 border-blue-100 dark:border-indigo-500/20' : 'bg-white dark:bg-[#0F172A]/60 border-slate-200 dark:border-slate-800'}
  `}>
    <div className="absolute top-0 right-0 p-8 opacity-5">
       {React.cloneElement(icon, { size: 120 })}
    </div>
    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-2">
      {icon} {title}
    </h4>
    <p className="text-[15px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed relative z-10">
      {content}
    </p>
  </div>
);

const GoalItem = ({ title, desc }: any) => (
  <div className="flex gap-4 p-5 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 shadow-sm transition-colors duration-300 rounded-3xl group hover:border-slate-600 transition">
    <div className="mt-1">
      <div className="w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-indigo-500/10" />
    </div>
    <div>
      <h4 className="text-sm font-black text-slate-900 dark:text-slate-50 mb-1 group-hover:text-indigo-400 transition">{title}</h4>
      <p className="text-xs text-slate-500 font-medium leading-relaxed">{desc}</p>
    </div>
  </div>
);

export default LearningJourneyView;
