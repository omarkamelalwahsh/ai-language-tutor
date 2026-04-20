import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight, BarChart3, CheckCircle2, Zap, Target, BookOpen, Mic, PenTool,
  Headphones, AlertTriangle, ShieldCheck, Map, Sparkles, Circle, Flag, Info,
  RefreshCw
} from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import QuestionAnalysis from '../components/assessment/QuestionAnalysis';
import { AssessmentSessionResult, SkillAssessmentResult } from '../types/assessment';
import { supabase } from '../lib/supabaseClient';
import { normalizeBand } from '../lib/cefr-utils';
import { useData } from '../context/DataContext';

const skillIcons: Record<string, React.ReactNode> = {
  speaking: <Mic className="w-5 h-5 text-rose-500" />,
  writing: <PenTool className="w-5 h-5 text-purple-500" />,
  listening: <Headphones className="w-5 h-5 text-green-500" />,
  vocabulary: <BookOpen className="w-5 h-5 text-amber-500" />,
  reading: <BookOpen className="w-5 h-5 text-blue-500" />,
  grammar: <PenTool className="w-5 h-5 text-violet-500" />,
};

interface ResultAnalysisViewProps {
  result: AssessmentSessionResult;
  assessmentOutcome?: any;
  isArchitecting?: boolean;
  onContinue: (summary?: any) => void;
  onReview?: () => void;
}

// --- Custom Cybernetic Atoms ---

const MasteryBadge = ({ level, label, arLabel, confidence }: { level: string, label: string, arLabel: string, confidence: number }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="relative group cursor-default"
  >
    <div className="absolute inset-0 bg-blue-500/10 dark:bg-cyan-500/20 rounded-[2.5rem] blur-2xl group-hover:bg-blue-500/20 dark:group-hover:bg-cyan-500/40 transition-all" />
    <div className="relative bg-white dark:bg-gray-900/60 border border-slate-200 dark:border-gray-800 rounded-[2.5rem] p-8 text-center overflow-hidden shadow-premium">
      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 dark:bg-cyan-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 dark:text-cyan-400 mb-2">Core Mastery</p>
      <h3 className="text-8xl font-black text-slate-900 dark:text-slate-50 leading-none tracking-tighter shadow-sm dark:shadow-none">
        {level}
      </h3>
      <div className="mt-4 space-y-1">
        <p className="text-xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight">{label}</p>
        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{arLabel}</p>
      </div>
      
      {/* Confidence Bar */}
      <div className="mt-8 flex items-center justify-center gap-3">
         <div className="flex-1 h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${confidence * 100}%` }}
              className="h-full bg-blue-600 transition-all"
            />
         </div>
         <span className="text-[10px] font-black text-blue-600 dark:text-cyan-400">{Math.round(confidence * 100)}% DETECTED</span>
      </div>
    </div>
  </motion.div>
);

const ChasingLightButton = ({ children, loading, onClick, className = "", variant = "cyan" }: { children: React.ReactNode, loading?: boolean, onClick?: () => void, className?: string, variant?: 'cyan' | 'blue' }) => {
  const colors = {
    cyan: "bg-[conic-gradient(from_90deg_at_50%_50%,#00FFFF_0%,#4F46E5_50%,#00FFFF_100%)]",
    blue: "bg-[conic-gradient(from_90deg_at_50%_50%,#2563eb_0%,#60a5fa_50%,#2563eb_100%)]"
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`relative group p-[2px] rounded-2xl overflow-hidden transition-all active:scale-95 ${className}`}
    >
      <div className={`absolute inset-[-1000%] animate-[spin_4s_linear_infinite] ${colors[variant === 'cyan' ? 'cyan' : 'blue']} opacity-30 group-hover:opacity-100 transition-opacity`} />
      <div className={`relative w-full h-full bg-slate-50 dark:bg-gray-950/80 backdrop-blur-xl rounded-[14px] px-8 py-5 flex items-center justify-center gap-3 border border-slate-200 dark:border-gray-800 group-hover:bg-white dark:bg-gray-900/40 transition-colors duration-300`}>
        {loading ? (
          <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
        ) : (
          <span className="text-slate-900 dark:text-slate-50 font-black uppercase tracking-[0.2em] shadow-sm dark:shadow-md flex items-center gap-3">
            {children}
          </span>
        )}
      </div>
    </button>
  );
};

export const ResultAnalysisView: React.FC<ResultAnalysisViewProps> = ({
  result,
  assessmentOutcome,
  isArchitecting = false,
  onContinue,
  onReview
}) => {
  const { user } = useData() as any;
  const [report, setReport] = useState<any>(assessmentOutcome?.aiAnalysis || null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeProgress, setFinalizeProgress] = useState(0);

  // 1. DYNAMIC DATA SOURCES (In-memory for instant reflection)
  const history = assessmentOutcome?.history || [];
  const totalPoints = history.filter((h: any) => h.correct).length * 100;

  useEffect(() => {
    if (!report && assessmentOutcome?.aiAnalysis) {
      setReport(assessmentOutcome.aiAnalysis);
    }
  }, [report, assessmentOutcome]);

  const isSpeakingMissing = (result.skills.speaking?.evidenceCount ?? 0) === 0;
  const isWritingMissing = (result.skills.writing?.evidenceCount ?? 0) === 0;
  const isProvisional = isSpeakingMissing || isWritingMissing;

  const confidenceLabel = (result?.overall?.confidence ?? 0) >= 0.8 ? `Confident ${result?.overall?.estimatedLevel ?? '?'}` :
    (result?.overall?.confidence ?? 0) >= 0.5 ? `Likely ${result?.overall?.estimatedLevel ?? '?'}` :
      `${result?.overall?.estimatedLevel ?? '?'} emerging`;

  // 2. Local Skill Logic
  const BATTERY_SKILLS = ['reading', 'listening', 'grammar', 'vocabulary', 'writing', 'speaking'];

  const skills = useMemo(() => {
    return [...(Object.values(result?.skills || {}) as SkillAssessmentResult[])]
      .filter(s => BATTERY_SKILLS.includes(s.skill))
      .sort((a, b) => (a.masteryScore ?? 0) - (b.masteryScore ?? 0));
  }, [result]);

  const strengths = useMemo(() => skills.flatMap(s => s.strengths).slice(0, 4), [skills]);
  const weaknesses = useMemo(() => skills.flatMap(s => s.weaknesses).slice(0, 4), [skills]);

  // 🔥 INSTANT RADAR: Derived from assessmentResult props
  const radarData = useMemo(() => {
    return BATTERY_SKILLS.map(s => {
      const skillRes = result?.skills?.[s.toLowerCase()] as SkillAssessmentResult;
      const pct = skillRes ? Math.round(((skillRes.masteryScore ?? skillRes.confidence?.score) || 0.5) * 100) : 50;
      return {
        subject: s.charAt(0).toUpperCase() + s.slice(1),
        A: pct,
        fullMark: 100
      };
    });
  }, [result]);
  const [nodes, setNodes] = useState<any[]>([]);

  // 3. Fetch Journey Nodes (for Roadmap)
  useEffect(() => {
    const fetchJourney = async () => {
      if (!user?.id) return;
      try {
        const { data: journeyRow } = await supabase
          .from('learning_journeys')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!journeyRow) return;

        const { data, error } = await supabase
          .from('journey_steps')
          .select('*')
          .eq('journey_id', journeyRow.id)
          .order('order_index', { ascending: true });

        if (!error && data) setNodes(data);
      } catch (err) {
        console.error('Failed to fetch journey steps:', err);
      }
    };
    fetchJourney();
  }, [user?.id]);

  // 4. Dynamic Mappings
  const levelNames: Record<string, { en: string, ar: string }> = {
    'A1': { en: 'Beginner', ar: 'مبتدئ' },
    'A2': { en: 'Elementary', ar: 'فوق المبتدئ' },
    'B1': { en: 'Intermediate', ar: 'متوسط' },
    'B1+': { en: 'Independent User', ar: 'مستقل (B1+)' },
    'B2': { en: 'Upper Intermediate', ar: 'فوق المتوسط' },
    'C1': { en: 'Advanced', ar: 'متقدم' },
    'C2': { en: 'Proficiency', ar: 'خبير / طلاقة' },
  };

  const rawLevel = result?.overall?.estimatedLevel || 'A1';
  const levelInfo = levelNames[rawLevel] || levelNames[normalizeBand(rawLevel)] || { en: 'Learning', ar: 'متعلم' };

  const handleFinalize = async () => {
    if (isFinalizing) return;
    setIsFinalizing(true);
    try {
      const { AssessmentSaveService } = await import('../services/AssessmentSaveService');
      const timer = setInterval(() => {
        setFinalizeProgress(prev => (prev < 90 ? prev + Math.random() * 15 : prev));
      }, 400);
      const res = await AssessmentSaveService.finalizeFullDiagnostic(assessmentOutcome, assessmentOutcome?.aiAnalysis);
      clearInterval(timer);
      setFinalizeProgress(100);
      setTimeout(() => onContinue(res), 600);
    } catch (err) {
      console.error("Finalization failed:", err);
      setIsFinalizing(false);
      setFinalizeProgress(0);
      onContinue();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-slate-50 selection:bg-cyan-500/30 overflow-x-hidden prestige-gpu transition-colors duration-300">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600 dark:bg-blue-600/10 rounded-full blur-[160px]" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-600/5 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PScwIDAgMjAwIDIwMCcgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJz48ZmlsdGVyIGlkPSdub2lzZUZpbHRlcic+PGZlVHVyYnVsZW5jZSB0eXBlPSdmcmFjdGFsTm9pc2UnIGJhc2VGcmVxdWVuY3k9JzAuNjUnIG51bU9jdGF2ZXM9JzMnIHN0aXRjaFRpbGVzPSdzdGl0Y2gnLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0nMTAwJScgaGVpZ2h0PScxMDAlJyBmaWx0ZXI9J3VybCgjbm9pc2VGaWx0ZXIpJy8+PC9zdmc+')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      {/* 🚀 Header */}
      <div className="w-full relative z-10 border-b border-white/5 bg-slate-950/20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white dark:bg-blue-600 rounded-xl flex items-center justify-center shadow-premium dark:shadow-[0_0_20px_rgba(79,70,229,0.3)] border border-slate-200 dark:border-transparent">
              <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tighter uppercase text-slate-900 dark:text-slate-50">Unified Mastery Analysis</h1>
              <p className="text-[10px] font-black tracking-[0.3em] text-slate-400 dark:text-slate-500 uppercase">Quantified Linguistic Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
             <div className="text-right hidden md:block">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Protocol Version</p>
               <p className="text-xs font-bold text-slate-900 dark:text-slate-50 uppercase tracking-widest">3.1 - Career Copilot</p>
             </div>
             <motion.div 
               animate={{ opacity: [0.5, 1, 0.5] }}
               transition={{ duration: 2, repeat: Infinity }}
               className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full"
             >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Sync Active</span>
             </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 relative z-10">
        <div className="grid lg:grid-cols-[400px_1fr] gap-12 items-start">

          {/* ================= LEFT COLUMN (PROFILE) ================= */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <MasteryBadge 
              level={rawLevel}
              label={levelInfo.en}
              arLabel={levelInfo.ar}
              confidence={result?.overall?.confidence ?? 0}
            />

            {/* Radar Analysis */}
            <div className="bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-800 rounded-[2.5rem] p-8 relative overflow-hidden h-[480px] shadow-premium">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">Skill Calibration</h3>
                <BarChart3 className="text-blue-600 dark:text-blue-400 w-4 h-4" />
              </div>
              
              <div className="h-full w-full -mt-10">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.05)" />
                    <PolarAngleAxis 
                      dataKey="subject" 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} 
                    />
                    <Radar
                      name="Learner"
                      dataKey="A"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      fill="#3B82F6"
                      fillOpacity={0.2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Skill Legend */}
              <div className="absolute bottom-10 left-8 right-8 grid grid-cols-2 gap-4">
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="text-[10px] font-black text-slate-500 uppercase">Peak Performance</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-[10px] font-black text-slate-500 uppercase">Growth Potential</span>
                 </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-white dark:bg-gray-900/5 border border-slate-200 dark:border-gray-800 rounded-3xl p-6 text-center group hover:bg-white/10 transition-all">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Diagnostic Points</p>
                  <p className="text-2xl font-black text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]">{totalPoints}</p>
               </div>
               <div className="bg-white dark:bg-gray-900/5 border border-slate-200 dark:border-gray-800 rounded-3xl p-6 text-center group hover:bg-white/10 transition-all">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Success Rate</p>
                  <p className="text-2xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">{Math.round((history.filter((h:any)=>h.correct).length / Math.max(1, history.length)) * 100)}%</p>
               </div>
            </div>
          </motion.div>

          {/* ================= RIGHT COLUMN (JOURNEY) ================= */}
          <div className="space-y-8">
            <div className="bg-white dark:bg-slate-950/40 backdrop-blur-3xl border border-slate-200 dark:border-white/10 rounded-[3rem] p-10 md:p-14 relative overflow-hidden shadow-premium">
               {/* Roadmap Header */}
               <div className="mb-14 flex items-center justify-between relative z-10">
                 <div>
                   <h3 className="text-3xl font-black tracking-tighter uppercase text-slate-900 dark:text-transparent dark:bg-gradient-to-r dark:from-white dark:to-slate-500 dark:bg-clip-text">Journey Roadmap</h3>
                   <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.4em] mt-1">AI Optimized Trajectory</p>
                 </div>
                 <Sparkles className="text-blue-500 dark:text-cyan-400 w-8 h-8 animate-pulse" />
               </div>

               <div className="relative z-10 py-10">
                  {/* Path Connector SVG */}
                  <div className="absolute inset-0 pointer-events-none opacity-20">
                     <svg className="w-full h-full" viewBox="0 0 400 600">
                        <motion.path
                          d="M 200 600 L 300 480 L 100 360 L 300 240 L 200 120"
                          fill="none"
                          stroke="url(#pathGradient)"
                          strokeWidth="2"
                          strokeDasharray="6 6"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 2.5, ease: "easeInOut" }}
                        />
                        <defs>
                          <linearGradient id="pathGradient" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="0%" stopColor="#00FFFF" />
                             <stop offset="100%" stopColor="#4F46E5" />
                          </linearGradient>
                        </defs>
                     </svg>
                  </div>

                  <div className="space-y-16">
                    {/* Final Mastery Node */}
                    <div className="flex justify-center -mb-8">
                       <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white dark:bg-gray-900 border-2 border-cyan-500/50 p-6 rounded-[2rem] shadow-[0_0_30px_rgba(0,255,255,0.2)] text-center w-64 relative group"
                       >
                         <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-cyan-500 text-slate-950 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                           End Goal
                         </div>
                         <h4 className="font-black text-slate-900 dark:text-slate-50 text-xl">C2 TOTAL MASTERY</h4>
                         <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mt-1">Native Proficiency</p>
                       </motion.div>
                    </div>

                    <div className="space-y-24">
                      {RoadmapSteps(nodes, isArchitecting)}
                    </div>

                    {/* Start Node */}
                    <div className="flex justify-center -mt-8">
                        <div className="bg-blue-600 dark:bg-blue-600 p-6 rounded-[2rem] shadow-premium dark:shadow-[0_0_40px_rgba(79,70,229,0.3)] text-center w-72 border-b-4 border-blue-800 dark:border-slate-950/30">
                         <h4 className="font-black text-white text-xl uppercase italic tracking-tighter">Diagnostic Origin</h4>
                         <p className="text-[10px] font-black text-blue-100 dark:text-slate-400 uppercase tracking-widest mt-1">Initial Level: {normalizeBand(result?.overall?.estimatedLevel || 'A1')}</p>
                       </div>
                    </div>
                  </div>
               </div>

               {/* CTA Area */}
               <div className="mt-20 pt-16 border-t border-white/5 flex flex-col md:flex-row gap-6 relative z-10">
                  <ChasingLightButton
                    onClick={handleFinalize}
                    loading={isFinalizing}
                    variant="cyan"
                    className="flex-1"
                  >
                    <Target size={20} />
                    {isFinalizing ? 'CALIBRATING...' : 'Initialize Full Dashboard'}
                  </ChasingLightButton>
                  
                  <ChasingLightButton
                    onClick={() => onReview ? onReview() : document.getElementById('question-analysis')?.scrollIntoView({ behavior: 'smooth' })}
                    variant="blue"
                    className="flex-1"
                  >
                    <RefreshCw size={20} />
                    Review All Answers
                  </ChasingLightButton>
               </div>
               
               <p className="text-center text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mt-8 italic">
                 Click above to finalize your linguistic twin profile.
               </p>
            </div>

            {/* Skill focus area */}
            <div className="grid md:grid-cols-2 gap-6">
                {(report?.growth_areas || weaknesses).slice(0, 2).map((area: string, i: number) => (
                  <div key={i} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/5 p-6 rounded-[2rem] flex items-center gap-6 group hover:border-blue-500/30 dark:hover:border-cyan-500/30 transition-all shadow-premium">
                     <div className="w-12 h-12 bg-blue-50 dark:bg-white/5 rounded-2xl flex items-center justify-center text-blue-600 dark:text-cyan-400 group-hover:bg-blue-600 dark:group-hover:bg-cyan-500 group-hover:text-white dark:group-hover:text-slate-950 transition-all">
                        <Sparkles size={24} />
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Growth Vector {i+1}</p>
                        <h4 className="text-sm font-black text-slate-900 dark:text-slate-50">{area}</h4>
                     </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Question Analysis (Hidden but available via scroll) */}
        <div id="question-analysis" className="mt-32">
           <div className="flex items-center gap-6 mb-12">
              <h2 className="text-4xl font-black tracking-tighter uppercase italic">Raw Diagnostic Log</h2>
              <div className="h-px flex-1 bg-white/5" />
           </div>
           <QuestionAnalysis questions={report?.question_analysis} />
        </div>
      </div>
    </div>
  );
};

// ================= HELPER COMPONENTS =================

const RoadmapSteps = (nodes: any[], isArchitecting: boolean) => {
  const steps = isArchitecting || nodes.length === 0
    ? [
      { title: 'Advanced negotiation strategies', icon: <Zap />, align: 'left' },
      { title: 'Lead international presentations', icon: <Mic />, align: 'right' },
      { title: 'Advanced Business English', icon: <BookOpen />, align: 'left' }
    ]
    : nodes.slice(0, 4).map((n, i) => ({
      title: n.title,
      icon: [<Zap />, <Mic />, <BookOpen />, <PenTool />][i % 4],
      align: i % 2 === 0 ? 'right' : 'left'
    }));

  return (
    <div className="flex flex-col gap-24 relative">
       {steps.map((step, i) => (
        <div key={i} className={`flex w-full ${step.align === 'left' ? 'justify-start' : 'justify-end'} relative`}>
          <motion.div
            initial={{ opacity: 0, x: step.align === 'left' ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.2 }}
            className="bg-white dark:bg-slate-950/60 backdrop-blur-2xl border border-slate-200 dark:border-white/10 p-6 rounded-[2rem] flex items-center gap-6 w-80 group hover:border-blue-500/30 dark:hover:border-cyan-500/30 transition-all shadow-premium"
          >
            <div className="w-14 h-14 bg-blue-50 dark:bg-white/5 rounded-2xl flex items-center justify-center text-blue-600 dark:text-cyan-400 shrink-0 group-hover:bg-blue-600 dark:group-hover:bg-cyan-500 group-hover:text-white dark:group-hover:text-slate-900 transition-all">
              {React.cloneElement(step.icon as any, { size: 24 })}
            </div>
            <div className="text-left overflow-hidden">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">MILESTONE {i + 1}</p>
              <h5 className="text-sm font-black text-slate-900 dark:text-slate-50 line-clamp-2 leading-tight uppercase tracking-tighter">{step.title}</h5>
            </div>
          </motion.div>
        </div>
      ))}
    </div>
  );
};

export default ResultAnalysisView;
