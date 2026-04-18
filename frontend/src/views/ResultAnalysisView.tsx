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

  const confidenceLabel = result.overall.confidence >= 0.8 ? `Confident ${result.overall.estimatedLevel}` :
    result.overall.confidence >= 0.5 ? `Likely ${result.overall.estimatedLevel}` :
      `${result.overall.estimatedLevel} emerging`;

  // 2. Local Skill Logic
  const BATTERY_SKILLS = ['reading', 'listening', 'grammar', 'vocabulary', 'writing', 'speaking'];

  const skills = useMemo(() => {
    return [...(Object.values(result.skills) as SkillAssessmentResult[])]
      .filter(s => BATTERY_SKILLS.includes(s.skill))
      .sort((a, b) => (a.masteryScore ?? 0) - (b.masteryScore ?? 0));
  }, [result]);

  const strengths = useMemo(() => skills.flatMap(s => s.strengths).slice(0, 4), [skills]);
  const weaknesses = useMemo(() => skills.flatMap(s => s.weaknesses).slice(0, 4), [skills]);

  // 🔥 INSTANT RADAR: Derived from assessmentResult props
  const radarData = useMemo(() => {
    return BATTERY_SKILLS.map(s => {
      const skillRes = result.skills[s.toLowerCase()] as SkillAssessmentResult;
      const pct = skillRes ? Math.round(((skillRes.masteryScore ?? skillRes.confidence.score) || 0.5) * 100) : 50;
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
    'B2': { en: 'Upper Intermediate', ar: 'فوق المتوسط' },
    'C1': { en: 'Advanced', ar: 'متقدم' },
    'C2': { en: 'Proficiency', ar: 'خبير' },
  };

  const levelInfo = levelNames[normalizeBand(result.overall.estimatedLevel)] || { en: 'Learning', ar: 'متعلم' };

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
    <div className="min-h-screen bg-[#F8FAFC] pb-20 selection:bg-indigo-100">
      {/* 🚀 Header Banner */}
      <div className="w-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] py-6 px-8 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />
        <h1 className="text-2xl md:text-3xl font-black text-white relative z-10 tracking-tight">
          Career Copilot - Unified Mastery Path
        </h1>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-10">
        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-8">

          {/* ================= LEFT COLUMN ================= */}
          <div className="space-y-8">

            {/* User Profile Summary */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-indigo-900/5 border border-slate-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                <Target size={120} />
              </div>

              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center border-4 border-white shadow-md">
                  <Zap className="w-8 h-8 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Career Copilot</h2>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Linguistic Profile</p>
                </div>
              </div>

              {/* Level Card */}
              <div className="bg-white rounded-3xl p-6 border-2 border-slate-50 shadow-inner mb-6 relative">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Current Level:</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-6xl font-black text-slate-900 leading-none">{normalizeBand(result.overall.estimatedLevel)}</span>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-indigo-600">{levelInfo.en}</span>
                        <span className="text-xs font-bold text-slate-400">({levelInfo.ar})</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-1.5 h-16 bg-slate-100 rounded-full relative overflow-hidden">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${result.overall.confidence * 100}%` }}
                      className="absolute bottom-0 w-full bg-indigo-500 rounded-full"
                    />
                  </div>
                </div>
              </div>

              {/* Point Summary */}
              <div className="flex items-center justify-between px-2 mb-8">
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-bold text-sm">Point Summary:</span>
                  <div className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-3 py-1.5 rounded-full border border-amber-100">
                    <Zap size={14} className="fill-amber-500" />
                    <span className="font-black">{totalPoints}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-50 text-indigo-500 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-tight">تصميم</span>
                  <span className="bg-slate-100 text-slate-400 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-tight">متوسط</span>
                </div>
              </div>

              {/* Focus Skills */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-2 mb-4">Focus Skills:</h3>
                <div className="grid grid-cols-2 gap-4">
                  {(report?.growth_areas || weaknesses).slice(0, 4).map((area: string, i: number) => {
                    const icons = [<BookOpen />, <Mic />, <Zap />, <PenTool />];
                    return (
                      <div key={i} className="flex flex-col items-center text-center p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 hover:border-indigo-300 transition-colors">
                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-500 mb-3">
                          {React.cloneElement(icons[i % 4] as any, { size: 20 })}
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 leading-tight">{area}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid gap-3 mt-10">
                <button
                  onClick={handleFinalize}
                  disabled={isFinalizing}
                  className="w-full bg-[#3B82F6] hover:bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Map size={20} />
                  <span>{isFinalizing ? 'Architecting...' : 'Start Your Journey (Dashboard)'}</span>
                </button>
                <button
                  onClick={() => onReview ? onReview() : document.getElementById('question-analysis')?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full bg-white hover:bg-slate-50 text-[#1E293B] font-black py-4 rounded-2xl border-2 border-slate-100 flex items-center justify-center gap-3 transition-all active:scale-95"
                >
                  <RefreshCw size={20} />
                  <span>View Completed Answers (Review)</span>
                </button>
              </div>
              <p className="text-[10px] text-center text-slate-400 font-bold mt-4 uppercase tracking-widest">Click to proceed or review your answers</p>
            </div>

          </div>

          {/* ================= RIGHT COLUMN (ROADMAP) ================= */}
          <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-xl shadow-indigo-900/5 border border-slate-100 flex flex-col items-center">

            <div className="text-center mb-12">
              <h2 className="text-2xl font-black text-slate-900 mb-2">Career Copilot's Journey Roadmap</h2>
              <div className="h-1.5 w-20 bg-indigo-600 rounded-full mx-auto" />
            </div>

            <div className="relative w-full max-w-lg">
              {/* Path Connector SVG */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minHeight: '600px' }}>
                <path
                  d="M 50% 100% C 50% 80%, 90% 80%, 90% 60% S 10% 40%, 10% 20% S 50% 20%, 50% 0"
                  stroke="#E2E8F0"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray="8 8"
                />
                <motion.path
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                  d="M 50 550 L 350 450 L 50 350 L 350 250 L 200 100" // Simplified for logic
                  className="hidden md:block"
                  stroke="rgba(79, 70, 229, 0.1)"
                  strokeWidth="80"
                  fill="none"
                />
              </svg>

              <div className="flex flex-col gap-10 relative z-10 w-full">

                {/* 🌟 FINAL MASTER NODE */}
                <div className="flex justify-center mb-4">
                  <div className="bg-white border-2 border-indigo-100 p-6 rounded-3xl shadow-lg text-center w-56 relative group">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-amber-400 text-white p-2 rounded-full shadow-lg">
                      <Sparkles size={20} />
                    </div>
                    <h4 className="font-black text-slate-900 text-lg">Final C2 Mastery</h4>
                    <p className="text-xs font-bold text-emerald-500 uppercase tracking-tighter">Mastery Achieved</p>
                  </div>
                </div>

                <div className="space-y-16">
                  {RoadmapSteps(nodes, isArchitecting)}
                </div>

                {/* 📍 START NODE */}
                <div className="flex justify-center mt-4">
                  <div className="bg-slate-900 p-6 rounded-3xl shadow-2xl text-center w-64 border-b-4 border-indigo-500">
                    <h4 className="font-black text-white text-lg">Current {normalizeBand(result.overall.estimatedLevel)} Mastery</h4>
                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">(Current {normalizeBand(result.overall.estimatedLevel)} Level)</p>
                  </div>
                </div>

              </div>

              <p className="text-xs text-center text-slate-400 font-bold mt-12 uppercase tracking-widest">
                Mastery Progress from {normalizeBand(result.overall.estimatedLevel)} to Final C2
              </p>
            </div>
          </div>

        </div>

        {/* Question Analysis Footer */}
        <div id="question-analysis" className="mt-20">
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

  return steps.map((step, i) => (
    <div key={i} className={`flex w-full ${step.align === 'left' ? 'justify-start' : 'justify-end'} relative`}>
      <motion.div
        initial={{ opacity: 0, x: step.align === 'left' ? -20 : 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.2 }}
        className="bg-white border-2 border-slate-50 p-4 rounded-3xl shadow-sm flex items-center gap-4 w-64 group hover:border-indigo-100 transition-colors"
      >
        <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
          {step.icon}
        </div>
        <div className="text-left overflow-hidden">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">Zig-Zag Point {i + 1}</p>
          <h5 className="text-xs font-black text-slate-800 line-clamp-2 leading-tight">{step.title}</h5>
        </div>
      </motion.div>
    </div>
  ));
};
