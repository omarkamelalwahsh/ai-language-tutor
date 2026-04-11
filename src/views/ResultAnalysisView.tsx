import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, BarChart3, CheckCircle2, Zap, Target, BookOpen, Mic, PenTool, 
  Headphones, AlertTriangle, ShieldCheck, Map, Sparkles, Circle, Flag 
} from 'lucide-react';
import { AssessmentSessionResult, SkillAssessmentResult } from '../types/assessment';
import { supabase } from '../lib/supabaseClient';

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
  onContinue: () => void;
  onReview?: () => void;
}

export const ResultAnalysisView: React.FC<ResultAnalysisViewProps> = ({ 
  result, 
  assessmentOutcome, 
  isArchitecting = false,
  onContinue, 
  onReview 
}) => {
  const isSpeakingMissing = (result.skills.speaking?.evidenceCount ?? 0) === 0;
  const isWritingMissing = (result.skills.writing?.evidenceCount ?? 0) === 0;
  const isProvisional = isSpeakingMissing || isWritingMissing;

  const confidenceLabel = result.overall.confidence >= 0.8 ? `Confident ${result.overall.estimatedLevel}` :
                          result.overall.confidence >= 0.5 ? `Likely ${result.overall.estimatedLevel}` : 
                          `${result.overall.estimatedLevel} emerging`;

  const skills = useMemo(() => {
     return (Object.values(result.skills) as SkillAssessmentResult[]).sort((a, b) => {
       const scoreA = a.masteryScore ?? 0;
       const scoreB = b.masteryScore ?? 0;
       return scoreA - scoreB;
     });
  }, [result]);
  const strengths = useMemo(() => skills.flatMap(s => s.strengths).slice(0, 4), [skills]);
  const weaknesses = useMemo(() => skills.flatMap(s => s.weaknesses).slice(0, 4), [skills]);

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const staggerItem = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

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
            <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Estimated Level</p>
            <div className="flex items-center gap-4">
              <span className="text-7xl font-black text-indigo-600 tracking-tighter">{result.overall.estimatedLevel}</span>
              <div className="flex flex-col gap-1.5">
                <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-sm font-semibold border border-indigo-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> {confidenceLabel}
                </div>
                {isProvisional && (
                   <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-lg text-[10px] font-bold border border-amber-100 flex items-center gap-1.5 uppercase tracking-wider">
                     <AlertTriangle className="w-3 h-3" /> Provisional Result
                   </div>
                )}
              </div>
            </div>
            <p className="text-slate-600 leading-relaxed max-w-md pt-2">
              {result.overall.rationale[0] || 'You successfully completed the diagnostic evaluation.'}
            </p>
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
              {skills.map((skillRes: SkillAssessmentResult) => (
                  <div key={skillRes.skill}>
                    <div className="flex justify-between items-center mb-1.5 text-sm">
                      <div className="flex items-center gap-2 font-semibold text-slate-700 capitalize">
                        {skillIcons[skillRes.skill] || <Target className="w-4 h-4 text-slate-400" />} {skillRes.skill}
                      </div>
                      <span className="font-bold text-slate-900">{Math.round((skillRes.masteryScore ?? skillRes.confidence.score) * 100)}/100</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-800 rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.max(5, (skillRes.masteryScore ?? skillRes.confidence.score) * 100)}%` }} />
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="space-y-6">
            <div className="bg-emerald-50/50 rounded-3xl p-6 border border-emerald-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-100 blur-xl opacity-50 rounded-bl-full" />
              <h3 className="font-bold text-emerald-900 mb-4 flex items-center gap-2 relative z-10"><CheckCircle2 className="w-5 h-5" /> Detected Strengths</h3>
              <ul className="space-y-3 relative z-10">
                {(strengths.length > 0 ? strengths : ['Strong base foundation']).map((strength: string, i: number) => (
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
                {(weaknesses.length > 0 ? weaknesses : ['Pushing toward advanced benchmarks']).map((weakness: string, i: number) => (
                  <li key={i} className="flex gap-3 text-amber-800 text-sm font-medium leading-snug">
                    <span className="text-amber-500 font-bold shrink-0">↗</span> {weakness}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>

        {/* 🗺️ Learning Roadmap Section */}
        <RoadmapPreview isArchitecting={isArchitecting} />

        {/* Footer Action */}
        <motion.div variants={staggerItem} className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4 pb-12">
          <button 
            onClick={onReview || (() => {})}
            className="group flex items-center gap-3 bg-white hover:bg-slate-50 text-slate-900 px-8 py-4 rounded-2xl font-bold text-lg border border-slate-200 transition-all duration-300 shadow-sm active:scale-95"
          >
            Review My Answers
          </button>
          <button 
            onClick={onContinue}
            className="group flex items-center gap-3 bg-slate-900 hover:bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 shadow-xl hover:shadow-indigo-500/25 active:scale-95"
          >
            Review Learning Journey
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
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
