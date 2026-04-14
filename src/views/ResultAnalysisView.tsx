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
  const [loading, setLoading] = useState(true);
  const [dbLogs, setDbLogs] = useState<any[]>([]);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeProgress, setFinalizeProgress] = useState(0);
  const [fetchError, setFetchError] = useState(false);

  // 1. Fetch Latest Logs (MCQ Scoring Source)
  useEffect(() => {
    const fetchLatestSessionLogs = async () => {
      if (!user?.id) return;
      
      console.log(`🚀 [Diagnostic] Current User Session ID: ${user.id}`);
      setLoading(true);
      setFetchError(false);
      
      try {
        const { data, error } = await supabase
          .from('assessment_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(40); // Latest battery

        if (error) throw error;
        
        if (data && data.length > 0) {
          console.log(`✅ [Diagnostic] Fetched ${data.length} logs for real-time calculation.`);
          setDbLogs(data);
        } else {
          console.warn('[Diagnostic] No logs found in DB for this user.');
          setFetchError(true);
        }
      } catch (err) {
        console.error('[Diagnostic] Failed to fetch session logs:', err);
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchLatestSessionLogs();
  }, [user?.id]);

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

  // 2. Local MCQ Calculation Logic
  const BATTERY_SKILLS = ['reading', 'listening', 'grammar', 'vocabulary', 'writing', 'speaking'];
  
  const skills = useMemo(() => {
     return [...(Object.values(result.skills) as SkillAssessmentResult[])]
       .filter(s => BATTERY_SKILLS.includes(s.skill))
       .sort((a, b) => (a.masteryScore ?? 0) - (b.masteryScore ?? 0));
  }, [result]);

  const strengths = useMemo(() => skills.flatMap(s => s.strengths).slice(0, 4), [skills]);
  const weaknesses = useMemo(() => skills.flatMap(s => s.weaknesses).slice(0, 4), [skills]);

  // 🔥 POWERFUL RADAR MAPPING: Uses DB logs for live accuracy
  const radarData = useMemo(() => {
    if (dbLogs.length > 0) {
      // Aggregate from real DB logs
      const stats: Record<string, { correct: number, total: number }> = {};
      dbLogs.forEach(entry => {
        const s = entry.skill?.toLowerCase();
        if (!stats[s]) stats[s] = { correct: 0, total: 0 };
        stats[s].total++;
        if (entry.is_correct) stats[s].correct++;
      });

      return BATTERY_SKILLS.map(s => {
        const skillStats = stats[s] || { correct: 0, total: 0 };
        const pct = skillStats.total > 0 ? Math.round((skillStats.correct / skillStats.total) * 100) : 50; 
        return {
          subject: s.charAt(0).toUpperCase() + s.slice(1),
          A: pct,
          fullMark: 100
        };
      });
    }

    // Fallback to local session result if DB is pending
    return skills.map(s => ({
      subject: s.skill.charAt(0).toUpperCase() + s.skill.slice(1),
      A: Math.round(((s.masteryScore ?? s.confidence.score) || 0.5) * 100),
      fullMark: 100
    }));
  }, [dbLogs, skills]);

  const handleFinalize = async () => {
    if (isFinalizing) return;
    setIsFinalizing(true);
    
    try {
      // Import service dynamically
      const { AssessmentSaveService } = await import('../services/AssessmentSaveService');
      
      // Simulate progress for UX
      const timer = setInterval(() => {
        setFinalizeProgress(prev => (prev < 90 ? prev + Math.random() * 15 : prev));
      }, 400);

      const result = await AssessmentSaveService.finalizeFullDiagnostic(
        assessmentOutcome,
        assessmentOutcome?.aiAnalysis
      );

      clearInterval(timer);
      setFinalizeProgress(100);
      
      // Short delay to show 100% completion
      setTimeout(() => {
        onContinue(result);
      }, 600);
      
    } catch (err) {
      console.error("Finalization failed:", err);
      setIsFinalizing(false);
      setFinalizeProgress(0);
      // Fallback to basic continue if critical error
      onContinue();
    }
  };

  const handleReviewScroll = () => {
    const el = document.getElementById('question-analysis');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    if (onReview) onReview();
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const staggerItem = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

  if (loading && !isArchitecting) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="relative">
          <motion.div 
            animate={{ rotate: 360 }} 
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="w-24 h-24 rounded-[2.5rem] bg-indigo-600 flex items-center justify-center"
          >
            <Sparkles className="text-white w-10 h-10" />
          </motion.div>
          <div className="absolute inset-0 border-4 border-indigo-100 rounded-[2.5rem] animate-pulse" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900">Crunching Real-time Results...</h2>
          <p className="text-slate-500 font-medium max-w-xs">Connecting to secure instance and calculating linguistic mapping.</p>
        </div>
      </div>
    );
  }

  if (fetchError && dbLogs.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900">Analysis Delayed</h2>
          <p className="text-slate-500 font-medium">We couldn't retrieve your latest session logs. This can happen if the background sync is still running.</p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all"
        >
          <RefreshCw className="w-5 h-5" /> Retry Fetch
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 selection:bg-indigo-500/30 font-sans text-slate-900 flex flex-col items-center">
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="w-full max-w-4xl space-y-8">
        
        {/* Header Section */}
        <motion.div variants={staggerItem} className="text-center space-y-4 pt-8">
          <div className="inline-flex items-center gap-2 bg-indigo-100/50 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-bold border border-indigo-200">
            <BarChart3 className="w-4 h-4" /> Assessment Analysis
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Your Linguistic Profile</h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto font-medium">
            Based on your responses, we've analyzed your capabilities to pinpoint your exact placement.
          </p>
        </motion.div>

        {/* Assessment Integrity Notice (Conditional) */}
        {isProvisional && (
          <motion.div variants={staggerItem} className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 flex gap-4 items-start shadow-sm shadow-indigo-100">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-indigo-900 font-bold mb-1">Provisional Proficiency Detected</h3>
              <p className="text-indigo-800 text-sm leading-relaxed">
                We've estimated your overall proficiency as <strong>{result.overall.estimatedLevel}</strong> based on your strong performance in {skills.filter(s => (s.evidenceCount ?? 0) > 0).map(s => s.skill).join(', ')}. 
                However, because <strong>{isSpeakingMissing ? 'Speaking' : ''}{isSpeakingMissing && isWritingMissing ? ' and ' : ''}{isWritingMissing ? 'Writing' : ''}</strong> {isSpeakingMissing && isWritingMissing ? 'were' : 'was'} not fully tested, this result is marked as provisional.
              </p>
            </div>
          </motion.div>
        )}

        {/* Overall Level Panel */}
        <motion.div variants={staggerItem} className="bg-white rounded-[2rem] p-8 md:p-10 border border-slate-200 shadow-xl shadow-slate-200/40 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60" />
          
          <div className="relative z-10 flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Current Level</p>
              {!report && (
                <div className="flex items-center gap-1.5 bg-indigo-500/10 text-indigo-600 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin-slow" /> AI Analyzing...
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-7xl font-black text-indigo-600 tracking-tighter">{normalizeBand(result.overall.estimatedLevel)}</span>
              <div className="flex flex-col gap-1.5">
                <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg text-sm font-bold border border-emerald-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> {confidenceLabel}
                </div>
                {isProvisional && (
                   <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-lg text-[10px] font-black border border-amber-200 flex items-center gap-1.5 uppercase tracking-wider shadow-sm">
                     <Target className="w-3 h-3" /> Estimated from MCQs
                   </div>
                )}
              </div>
            </div>
            <div className="space-y-2 pt-2">
              {result.overall.rationale.map((r, i) => (
                <p key={i} className={`text-slate-600 leading-relaxed max-w-md ${i === 0 ? 'font-semibold' : 'text-sm'}`}>
                  {r}
                </p>
              ))}
              {result.overall.rationale.length === 0 && (
                <p className="text-slate-600 leading-relaxed max-w-md">
                  You successfully completed the diagnostic evaluation.
                </p>
              )}
            </div>
          </div>
          
          <div className="relative z-10 w-full md:w-auto flex-shrink-0 flex items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-32 h-32 rounded-full border-[8px] border-indigo-50 flex items-center justify-center relative">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="50%" cy="50%" r="42%" className="stroke-indigo-600 fill-none" strokeWidth="8" strokeDasharray="250" strokeDashoffset={250 - (250 * (result.overall.confidence * 100)) / 100} strokeLinecap="round" />
              </svg>
              <div className="text-center">
                <span className="block text-2xl font-black text-slate-800">{Math.round(result.overall.confidence * 100)}%</span>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Confidence</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Breakdown Grid */}
        <motion.div variants={staggerItem} className="grid md:grid-cols-2 gap-6">
          
          {/* Skills Breakdown */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Target className="w-5 h-5 text-indigo-500" /> Skill Breakdown</h3>
            <div className="space-y-4">
              {report?.skill_breakdown ? (
                Object.entries(report.skill_breakdown).map(([skill, details]: [string, any]) => (
                  <div key={skill} className="group p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-center mb-1 text-sm">
                      <div className="flex items-center gap-2 font-bold text-slate-800 capitalize">
                         {skillIcons[skill.toLowerCase()] || <Target size={16} className="text-slate-400" />} {skill}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed italic">"{details.ai_insight}"</p>
                  </div>
                ))
              ) : (
                skills.map((skillRes: SkillAssessmentResult) => (
                  <div key={skillRes.skill}>
                    <div className="flex justify-between items-center mb-1.5 text-sm">
                      <div className="flex items-center gap-2 font-semibold text-slate-700 capitalize">
                        {skillIcons[skillRes.skill] || <Target className="w-4 h-4 text-slate-400" />} {skillRes.skill}
                      </div>
                      <span className="font-bold text-slate-900">{Math.round(((skillRes.masteryScore ?? skillRes.confidence.score) > 1 ? (skillRes.masteryScore ?? skillRes.confidence.score) : (skillRes.masteryScore ?? skillRes.confidence.score) * 100))}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-800 rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.max(5, ((skillRes.masteryScore ?? skillRes.confidence.score) > 1 ? (skillRes.masteryScore ?? skillRes.confidence.score) : (skillRes.masteryScore ?? skillRes.confidence.score) * 100))}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="space-y-6">
            <div className="bg-emerald-50/50 rounded-3xl p-6 border border-emerald-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-100 blur-xl opacity-50 rounded-bl-full" />
              <h3 className="font-bold text-emerald-900 mb-4 flex items-center gap-2 relative z-10"><CheckCircle2 className="w-5 h-5" /> Detected Strengths</h3>
              <ul className="space-y-3 relative z-10">
                {(report?.strengths || strengths).map((strength: string, i: number) => (
                  <li key={i} className="flex gap-3 text-emerald-800 text-sm font-medium leading-snug">
                    <span className="text-emerald-500 font-bold shrink-0">✓</span> {strength}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-amber-50/50 rounded-3xl p-6 border border-amber-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-amber-100 blur-xl opacity-50 rounded-bl-full" />
              <h3 className="font-bold text-amber-900 mb-4 flex items-center gap-2 relative z-10"><Zap className="w-5 h-5" /> Growth Areas</h3>
              <ul className="space-y-3 relative z-10">
                {(report?.growth_areas || weaknesses).map((weakness: string, i: number) => (
                  <li key={i} className="flex gap-3 text-amber-800 text-sm font-medium leading-snug">
                    <span className="text-amber-500 font-bold shrink-0">↗</span> {weakness}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Section 4: Visual Error Profile (Radar Chart) */}
        <motion.div variants={staggerItem} className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
           <div className="flex flex-col md:flex-row items-center gap-10">
              <div className="w-full md:w-1/2 h-[300px] min-h-[300px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                       <PolarGrid stroke="#E2E8F0" />
                       <PolarAngleAxis dataKey="subject" tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }} />
                       <Radar
                          name="Mastery"
                          dataKey="A"
                          stroke="#4F46E5"
                          strokeWidth={3}
                          fill="#4F46E5"
                          fillOpacity={0.15}
                       />
                    </RadarChart>
                 </ResponsiveContainer>
              </div>
              
              <div className="w-full md:w-1/2 space-y-6">
                 <div>
                    <h3 className="text-xl font-black text-slate-900 mb-2 flex items-center gap-2">
                       <Zap className="w-5 h-5 text-amber-500" /> Error Distribution
                    </h3>
                    <p className="text-sm text-slate-500 font-medium">Your mastery vs. error density across the 8-skill linguistic spectrum.</p>
                 </div>
                                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Top Accuracy</p>
                       <p className="text-lg font-bold text-emerald-600">{[...radarData].sort((a,b) => b.A - a.A)[0]?.subject || 'N/A'}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Needs Focus</p>
                       <p className="text-lg font-bold text-rose-600">{[...radarData].sort((a,b) => a.A - b.A)[0]?.subject || 'N/A'}</p>
                    </div>
                 </div>
                 
                 <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">AI Recommendation</p>
                    <p className="text-sm text-indigo-900 font-medium leading-relaxed">
                       Focus on stabilizing your {[...radarData].sort((a,b) => a.A - b.A)[0]?.subject || 'weaker'} skills before attempting C1 level nuances.
                    </p>
                 </div>
              </div>
           </div>
        </motion.div>

        {/* 🗺️ Learning Roadmap Section */}
        <RoadmapPreview isArchitecting={isArchitecting} />

        {/* Section 5: Question-by-Question Analysis */}
        <motion.div variants={staggerItem}>
           <QuestionAnalysis questions={report?.question_analysis} />
        </motion.div>

        {/* Footer Action */}
        <motion.div variants={staggerItem} className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4 pb-12">
          <button 
            onClick={handleReviewScroll}
            className="group flex items-center gap-3 bg-white hover:bg-slate-50 text-slate-900 px-8 py-4 rounded-2xl font-bold text-lg border border-slate-200 transition-all duration-300 shadow-sm active:scale-95"
          >
            Review My Answers
          </button>
          <button 
            onClick={handleFinalize}
            disabled={isFinalizing}
            className={`group relative flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 shadow-xl overflow-hidden ${
              isFinalizing 
                ? 'bg-slate-800 text-slate-300 cursor-wait' 
                : 'bg-slate-900 hover:bg-indigo-600 text-white hover:shadow-indigo-500/25 active:scale-95'
            }`}
          >
            {isFinalizing && (
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${finalizeProgress}%` }}
                className="absolute inset-0 bg-indigo-500/20"
              />
            )}
            <span className="relative z-10 flex items-center gap-3">
              {isFinalizing ? (
                <>
                  <Sparkles className="w-5 h-5 animate-spin" />
                  Architecting Path... {Math.round(finalizeProgress)}%
                </>
              ) : (
                <>
                  Start Learning Journey
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </span>
          </button>
        </motion.div>
        
      </motion.div>
    </div>
  );
};

const RoadmapPreview: React.FC<{ isArchitecting: boolean }> = ({ isArchitecting }) => {
  const [nodes, setNodes] = useState<any[]>([]);

  useEffect(() => {
    if (!isArchitecting) {
      const fetchJourney = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: journey } = await supabase.from('learning_journeys').select('id').eq('user_id', user.id).maybeSingle();
        if (journey) {
          const { data: steps } = await supabase.from('journey_steps').select('*').eq('journey_id', journey.id).order('order_index', { ascending: true });
          if (steps) setNodes(steps);
        }
      };
      fetchJourney();
    }
  }, [isArchitecting]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-lg relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Map className="w-5 h-5 text-indigo-500" /> Your Personalized Roadmap
          </h3>
          <p className="text-slate-500 text-sm font-medium">AI-architected path based on your performance summary.</p>
        </div>
        {isArchitecting && (
           <div className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold animate-pulse">
             <Sparkles className="w-4 h-4" /> AI ARCHITECTING...
           </div>
        )}
      </div>

      <div className="relative">
        {/* Connection Line */}
        <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-slate-100" />

        <div className="space-y-6 relative">
          <AnimatePresence mode="popLayout">
            {isArchitecting || nodes.length === 0 ? (
              [1, 2, 3].map(i => (
                <div key={i} className="flex gap-4 animate-pulse opacity-40">
                  <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-slate-200 rounded w-1/4" />
                    <div className="h-3 bg-slate-100 rounded w-3/4" />
                  </div>
                </div>
              ))
            ) : (
              nodes.slice(0, 4).map((node, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={node.id} 
                  className="flex gap-4 group"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${i === 0 ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white border-slate-200 text-slate-400 group-hover:border-indigo-300'}`}>
                    {i === 0 ? <Sparkles className="w-5 h-5" /> : i === nodes.length - 1 ? <Flag className="w-5 h-5" /> : <Circle className="w-5 h-5 fill-current opacity-20" />}
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-bold text-sm ${i === 0 ? 'text-indigo-900' : 'text-slate-700'}`}>{node.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-1">{node.description}</p>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {!isArchitecting && nodes.length > 4 && (
        <div className="mt-6 pt-4 border-t border-slate-50 text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">+ {nodes.length - 4} more specialized milestones</span>
        </div>
      )}
    </motion.div>
  );
};
