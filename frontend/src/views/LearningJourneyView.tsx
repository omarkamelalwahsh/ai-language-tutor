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

const ADAPTIVE_INTERVENTIONS = [
  { id: 1, title: 'Grammar Repair Pack', desc: 'Auto-injected due to Past Tense instability.', icon: ShieldCheck },
  { id: 2, title: 'Retention Booster', desc: 'Smart recall for 12 critical vocab items.', icon: Zap },
  { id: 3, title: 'Accent Neutralizer', desc: 'Focusing on phoneme /θ/ based on latest recording.', icon: Mic }
];

// ---------------------------------------------------------------------------
// Reusable Mini-Components
// ---------------------------------------------------------------------------

const Breadcrumb = ({ items }: { items: string[] }) => (
  <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 bg-slate-900/40 px-3 py-1.5 rounded-full border border-slate-800/50 backdrop-blur-sm self-start">
    {items.map((item, i) => (
      <React.Fragment key={item}>
        <span className={i === items.length - 1 ? 'text-indigo-400' : ''}>{item}</span>
        {i < items.length - 1 && <ChevronRight size={10} />}
      </React.Fragment>
    ))}
  </nav>
);

const SkillRing = ({ skill, percentage, color }: { skill: string, percentage: number, color: string }) => {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2 group">
      <div className="relative flex items-center justify-center w-12 h-12">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="24" cy="24" r={radius} fill="none" stroke="#1E293B" strokeWidth="4" />
          <motion.circle 
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            cx="24" cy="24" r={radius} fill="none" stroke={color} strokeWidth="4" 
            strokeDasharray={circumference} strokeLinecap="round" 
            style={{ filter: `drop-shadow(0 0 4px ${color}80)` }}
          />
        </svg>
        <span className="absolute text-[10px] font-black text-slate-200">{percentage}%</span>
      </div>
      <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 group-hover:text-slate-300 transition-colors text-center">{skill}</span>
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
        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-slate-800 -translate-y-1/2 z-0">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(activeIndex / (levels.length - 1)) * 100}%` }}
            transition={{ duration: 1.5, delay: 0.5 }}
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]" 
          />
        </div>
        {levels.map((level, idx) => {
          const isPast = idx < activeIndex;
          const isActive = idx === activeIndex;
          const isTarget = idx === targetIndex;
          return (
            <div key={level} className="relative z-10 flex flex-col items-center">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border-2 transition-all duration-500
                ${isPast ? 'bg-indigo-900 border-indigo-500/50 text-indigo-300' : ''}
                ${isActive ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] scale-110' : ''}
                ${isTarget && !isActive ? 'bg-slate-900 border-indigo-500/30 text-indigo-400 ring-2 ring-indigo-500/20' : ''}
                ${!isPast && !isActive && !isTarget ? 'bg-[#0F172A] border-slate-800 text-slate-600' : ''}
              `}>
                {level}
              </div>
              {isActive && (
                 <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute -top-7 text-[9px] uppercase tracking-widest font-black text-indigo-400">Current</motion.span>
               )}
              {isTarget && !isActive && (
                 <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute -top-7 text-[9px] uppercase tracking-widest font-black text-indigo-400">Target</motion.span>
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
           stroke="#1E293B" 
           strokeWidth="8" 
           strokeLinecap="round"
           strokeDasharray="1 20"
           className="hidden lg:block"
        />
        {/* Animated glow path */}
        <motion.path 
           initial={{ pathLength: 0 }}
           animate={{ pathLength: 1 }}
           transition={{ duration: 3, ease: "linear", repeat: Infinity }}
           d="M 280 0 C 280 150, 480 150, 480 300 C 480 450, 280 450, 280 600 C 280 750, 480 750, 480 900 C 480 1050, 280 1050, 280 1200"
           fill="none" 
           stroke="url(#glowGradient)" 
           strokeWidth="4" 
           strokeLinecap="round"
           className="opacity-30 hidden lg:block"
        />
        {/* Mobile vertical line fallback */}
        <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#1E293B" strokeWidth="4" strokeDasharray="8 8" className="lg:hidden" />
        
        <defs>
          <linearGradient id="glowGradient" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#4F46E5" offset="0%" />
            <stop stopColor="#818CF8" offset="50%" />
            <stop stopColor="#4F46E5" offset="100%" />
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
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Activity size={40} className="text-indigo-500 animate-spin" />
          <p className="text-slate-500 font-bold uppercase tracking-widest animate-pulse">Architecting Roadmap...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-slate-200 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      
      {/* Ambient backgrounds */}
      <div className="fixed top-0 left-1/2 w-[1000px] h-[600px] bg-indigo-600/5 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      
      <div className="max-w-[1400px] mx-auto px-4 sm:px-12 py-12 relative z-10">
        
        {/* --- Header Section (The Hero) --- */}
        <header className="flex flex-col mb-20">
          <div className="flex items-center gap-4 mb-4">
             <button 
               onClick={onViewDashboard}
               className="flex items-center gap-2 px-4 py-1.5 bg-slate-900/60 hover:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400 border border-slate-800/50 rounded-full backdrop-blur-sm transition active:scale-95 group"
             >
                <ArrowRight size={12} className="rotate-180 group-hover:-translate-x-0.5 transition-transform" /> Back to Dashboard
             </button>
             <Breadcrumb items={['My Path', 'Current Journey']} />
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4">
                Bridge from <span className="text-indigo-400">{currentLevel}</span> to <span className="text-indigo-400">{targetLevel}</span>
              </h1>
              <p className="text-lg text-slate-400 font-medium max-w-xl">
                AI-architected transformation path balancing theoretical foundation with real-time error repair.
              </p>
            </motion.div>

            <div className="flex flex-wrap gap-4">
               <SummaryBadge label="Progress" value="68%" />
               <SummaryBadge label="Stop" value="12/18" />
               <SummaryBadge label="Status" value="On Track" active />
            </div>
          </div>

          <CefrProgressBar currentLevel={currentLevel} />
        </header>

        {/* --- Core Content Grid --- */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-20 items-start">
          
          {/* Main Roadmap */}
          <div className="relative min-h-[1200px] pt-10">
            <WindingPath />
            
            <div className="flex flex-col gap-32 relative z-10">
              {isCalibration ? (
                <div className="flex flex-col items-center justify-center text-center p-12 bg-slate-900/40 border border-slate-800 rounded-[3rem] mt-20">
                  <Brain size={60} className="text-indigo-400 mb-6 opacity-50" />
                  <h3 className="text-2xl font-black text-white mb-2">Awaiting Diagnostic Signal</h3>
                  <p className="text-slate-400 max-w-md">Complete your first assessment to allow the 70B Model to architect your personalized linguistic trajectory.</p>
                  <button 
                    onClick={onStartSession}
                    className="mt-8 px-8 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-500 transition shadow-xl"
                  >
                    Start Diagnostic
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
                      className={`flex flex-col md:flex-row items-center gap-10 group
                        ${isEven ? 'lg:flex-row lg:ml-20' : 'lg:flex-row-reverse lg:mr-20'}
                        ${node.status === 'locked' ? 'opacity-40 grayscale' : ''}
                      `}
                    >
                      {/* Node Visual Bubble */}
                      <div className="relative">
                         {node.status === 'active' && (
                           <div className="absolute inset-0 bg-indigo-500 rounded-[2rem] blur-[30px] opacity-30 animate-pulse" />
                         )}
                         <div className={`
                           relative w-20 h-20 md:w-28 md:h-28 rounded-[2.5rem] flex items-center justify-center transition-all duration-500
                           ${node.status === 'completed' ? 'bg-slate-900 border border-emerald-500/30' : ''}
                           ${node.status === 'active' ? 'bg-indigo-600 border-2 border-indigo-400 shadow-2xl scale-110 z-20' : ''}
                           ${node.status === 'locked' ? 'bg-slate-950 border border-slate-800' : ''}
                         `}>
                           <div className="flex flex-col items-center">
                              {node.status === 'completed' && <CheckCircle2 size={32} className="text-emerald-400" />}
                              {node.status === 'active' && <Play size={32} className="text-white fill-white ml-1" />}
                              {node.status === 'locked' && <Lock size={24} className="text-slate-600" />}
                              <span className="text-[9px] font-black uppercase mt-1 opacity-50">{node.type}</span>
                           </div>
                         </div>
                      </div>

                      {/* Node Details Card */}
                      <div className={`
                         max-w-sm w-full bg-[#0F172A]/40 backdrop-blur-xl border border-slate-800/50 p-6 rounded-3xl hover:bg-slate-900/60 transition group-hover:border-slate-700
                         ${node.status === 'active' ? 'ring-1 ring-indigo-500/30 bg-slate-900/80 shadow-2xl' : ''}
                      `}>
                         <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-black tracking-tight text-white">{parseLinguisticContent(node.title)}</h3>
                            {node.status === 'active' && <Sparkles size={16} className="text-amber-400 drop-shadow-glow" />}
                         </div>
                         
                         <p className="text-xs text-slate-400 font-medium leading-relaxed mb-4">
                            {parseLinguisticContent(node.description)}
                         </p>

                         <div className="flex flex-wrap gap-2 mb-6">
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-950/50 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-500">
                               <Icon size={12} /> {node.skill_focus.toUpperCase()}
                            </div>
                         </div>

                         {node.status === 'active' && (
                           <button 
                             onClick={onStartSession}
                             className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
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

          {/* Right Context Rail */}
          <aside className="sticky top-12 flex flex-col gap-6">
            
            <ContextCard 
              icon={<Brain className="text-indigo-400" />} 
              title="Adaptive Logic"
              content={dashboardData?.intelligence_feed?.action_plan || "Architecting your linguistic trajectory based on real-time diagnostic markers."}
              accent
            />

            <div className="bg-[#0F172A]/60 backdrop-blur-xl border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl">
               <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-8 flex items-center gap-2">
                 <Target size={16} className="text-indigo-400" /> Readiness Matrix
               </h4>
               <div className="grid grid-cols-3 gap-y-8 gap-x-4">
                  {dashboardData?.skills?.slice(0, 3).map((s: any) => (
                    <SkillRing key={s.name} skill={s.name} percentage={s.score} color={s.score > 70 ? "#10B981" : s.score > 40 ? "#F59E0B" : "#EF4444"} />
                  )) || (
                    <>
                      <SkillRing skill="Speaking" percentage={0} color="#10B981" />
                      <SkillRing skill="Writing" percentage={0} color="#F59E0B" />
                      <SkillRing skill="Listening" percentage={0} color="#EF4444" />
                    </>
                  )}
               </div>
               <div className="mt-8 pt-8 border-t border-slate-800/50">
                  <p className="text-xs text-slate-400 font-medium italic">
                    Focus on Listening exercises in the next 3 nodes to stabilize B1 readiness.
                  </p>
               </div>
            </div>

            <motion.div 
               whileHover={{ y: -5 }}
               className="bg-[#0F172A]/80 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl cursor-pointer group"
               onClick={onStartSession}
            >
               <div className="flex justify-between items-center mb-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <Zap className="text-amber-400 fill-amber-400" size={16} /> Due Review
                  </h4>
                  <span className="text-[10px] bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded-md font-bold border border-amber-400/20">12 Item Bloom</span>
               </div>
               <p className="text-sm text-slate-400 font-medium leading-relaxed group-hover:text-slate-200 transition">
                  Detected vocabulary decay in 12 key B1 lexemes. Recommend 5-min recall spurt.
               </p>
            </motion.div>

          </aside>
        </div>

        {/* --- Bottom Insights (New Section) --- */}
        <section className="mt-40 pt-20 border-t border-slate-800">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            
            <div>
              <h3 className="text-2xl font-black tracking-tight text-white mb-8 flex items-center gap-3">
                 <MapPin className="text-indigo-400" /> Current Stop Goals
              </h3>
              <div className="space-y-4">
                <GoalItem title="Complex Sentiment Analysis" desc="Ability to identify sarcasm and nuance in native dialogue." />
                <GoalItem title="Hedging with Conditionals" desc="Mastering 'might have' and 'could have' for polite uncertainty." />
                <GoalItem title="Narrative Fluency" desc="Connecting 3+ distinct events into a cohesive spoken summary." />
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-black tracking-tight text-white mb-8 flex items-center gap-3">
                 <Sparkles className="text-amber-400" /> Adaptive Interventions
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {ADAPTIVE_INTERVENTIONS.map(item => (
                   <div key={item.id} className="p-5 bg-slate-900 border border-slate-800 rounded-3xl hover:border-slate-700 transition">
                      <div className="w-10 h-10 rounded-xl bg-slate-950 mb-4 flex items-center justify-center">
                         <item.icon size={20} className="text-indigo-400" />
                      </div>
                      <h4 className="text-sm font-black text-white mb-1">{item.title}</h4>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{item.desc}</p>
                   </div>
                ))}
              </div>
            </div>

          </div>
        </section>

      </div>

      {/* Decorative footer elements */}
      <footer className="w-full py-12 px-12 border-t border-slate-900 flex justify-between items-center opacity-30">
         <span className="text-[10px] font-black uppercase tracking-[0.2em]">Learner Intelligence Protocol v3.1</span>
         <div className="flex gap-6">
            <TrendingUp size={16} />
            <Info size={16} />
         </div>
      </footer>
    </div>
  );
};

// --- Sub-Components ---

const SummaryBadge = ({ label, value, active }: { label: string, value: string, active?: boolean }) => (
  <div className={`p-4 rounded-2xl border flex flex-col justify-center min-w-[120px] transition-all
    ${active ? 'bg-indigo-600/10 border-indigo-500/30 ring-1 ring-indigo-500/20' : 'bg-slate-900 border-slate-800'}
  `}>
    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{label}</span>
    <span className={`text-2xl font-black ${active ? 'text-indigo-400' : 'text-white'}`}>{value}</span>
  </div>
);

const ContextCard = ({ icon, title, content, accent }: any) => (
  <div className={`
    p-8 rounded-[2.5rem] border shadow-2xl relative overflow-hidden transition-all
    ${accent ? 'bg-indigo-600/10 border-indigo-500/20' : 'bg-[#0F172A]/60 border-slate-800'}
  `}>
    <div className="absolute top-0 right-0 p-8 opacity-5">
       {React.cloneElement(icon, { size: 120 })}
    </div>
    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
      {icon} {title}
    </h4>
    <p className="text-[15px] font-medium text-slate-300 leading-relaxed relative z-10">
      {content}
    </p>
  </div>
);

const GoalItem = ({ title, desc }: any) => (
  <div className="flex gap-4 p-5 bg-slate-900 border border-slate-800 rounded-3xl group hover:border-slate-600 transition">
    <div className="mt-1">
      <div className="w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-indigo-500/10" />
    </div>
    <div>
      <h4 className="text-sm font-black text-white mb-1 group-hover:text-indigo-400 transition">{title}</h4>
      <p className="text-xs text-slate-500 font-medium leading-relaxed">{desc}</p>
    </div>
  </div>
);
