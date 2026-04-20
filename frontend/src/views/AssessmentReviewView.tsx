import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, CheckCircle2, XCircle, BrainCircuit, Mic, PenTool, Headphones, BookOpen, AlertCircle, AlertTriangle, MessageSquare
} from 'lucide-react';
import { TaskEvaluation } from '../types/assessment';
import { useData } from '../context/DataContext';

interface ExternalResponse {
  question_id: string;
  user_answer: string;
  is_correct: boolean;
  answer_level: string;
  explanation: any; // Can be string or JSONB
  skill: string;
  score?: number;
  correct_answer?: string;
  // Fallbacks if mapped from external DB join
  prompt?: string;
}

interface AssessmentReviewViewProps {
  evaluations: TaskEvaluation[];
  assessmentId?: string;
  onBack: () => void;
}

const skillIcons: Record<string, React.ReactNode> = {
  speaking: <Mic className="w-4 h-4" />,
  writing: <PenTool className="w-4 h-4" />,
  listening: <Headphones className="w-4 h-4" />,
  vocabulary: <BookOpen className="w-4 h-4" />,
  reading: <BookOpen className="w-4 h-4" />,
  grammar: <BrainCircuit className="w-4 h-4" />,
};

// --- Custom Components for Technical Prestige ---

const StatusGlowBadge = ({ isCorrect }: { isCorrect: boolean }) => (
  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
    isCorrect 
      ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-sm' 
      : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 shadow-sm'
  }`}>
    <div className={`w-2 h-2 rounded-full ${isCorrect ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`} />
    <span className="text-[10px] font-black uppercase tracking-[0.2em]">{isCorrect ? 'Verified' : 'Review'}</span>
  </div>
);

const getBadgeStyles = (level?: string | any) => {
  const lvlStr = String(level || 'A1');
  if (lvlStr.includes('C')) return 'border-emerald-200 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 shadow-sm';
  if (lvlStr.includes('B')) return 'border-blue-200 dark:border-blue-500/50 text-blue-600 dark:text-blue-500 bg-blue-50 dark:bg-blue-500/10 shadow-sm';
  return 'border-slate-200 dark:border-slate-500/50 text-slate-500 dark:text-slate-400 bg-white dark:bg-transparent shadow-sm';
};

export const AssessmentReviewView: React.FC<AssessmentReviewViewProps> = ({ evaluations, assessmentId, onBack }) => {
  const navigate = useNavigate();
  const { user, assessmentOutcome } = useData() as any;
  const [dbResponses, setDbResponses] = useState<ExternalResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [useLocal, setUseLocal] = useState(!assessmentId || assessmentId === 'latest');

  useEffect(() => {
    if (assessmentId) {
      const fetchDb = async () => {
        setIsLoading(true);
        try {
          // Pass userId if latest is requested
          const url = assessmentId === 'latest' 
            ? `/api/assessments/latest/responses?userId=${user?.id}`
            : `/api/assessments/${assessmentId}/responses`;

          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data.responses && data.responses.length > 0) {
              setDbResponses(data.responses);
              setUseLocal(false);
            }
          }
        } catch (e) {
          console.warn("Failed to fetch cloud report.", e);
        } finally {
          setIsLoading(false);
        }
      };
      
      // Only fetch if we have an ID or we are resolving the latest for a user
      if (assessmentId !== 'latest' || user?.id) {
        fetchDb();
      }
    }
  }, [assessmentId, user?.id]);

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const staggerItem = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col items-center justify-center text-slate-900 dark:text-slate-50">
        <div className="w-12 h-12 border-4 border-blue-100 dark:border-blue-900/30 border-t-blue-600 rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-700 dark:text-slate-400 animate-pulse">Loading Detailed Report...</h2>
      </div>
    );
  }

  // Determine what list to render
  // Build local mapped list from answerHistory (which HAS the actual user answers)
  // combined with taskEvaluations (which has AI feedback)
  const answerHistory = assessmentOutcome?.answerHistory || [];
  const mappedList: ExternalResponse[] = useLocal 
    ? answerHistory.map((record: any, idx: number) => {
        // Match evaluation by index (same order as answerHistory)
        const ev = evaluations[idx] || {};
        const rawEval = (ev as any);
        
        // Extract feedback from the raw evaluation (LLM response)
        let explanation = 'Automated Review';
        if (rawEval?.feedback) explanation = rawEval.feedback;
        else if (rawEval?.reasoning_summary) explanation = rawEval.reasoning_summary;
        else if (rawEval?.note) explanation = rawEval.note;
        
        return {
          question_id: record.questionId || record.taskId || `q-${idx}`,
          skill: record.skill || 'general',
          user_answer: record.answer || '',
          is_correct: record.correct ?? record.isCorrect ?? false,
          answer_level: record.answerLevel || record.questionLevel || record.level || 'A1',
          score: record.score ?? 0,
          correct_answer: record.correctAnswer || '',
          explanation,
          prompt: record.prompt || '',
        };
      })
    : dbResponses;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-slate-50 py-16 px-4 md:px-8 relative overflow-x-hidden selection:bg-blue-500/30 transition-colors duration-300">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[600px] bg-blue-100 dark:bg-blue-600/10 rounded-full blur-[160px]" />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-100 dark:bg-cyan-600/5 rounded-full blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:60px_60px]" />
      </div>

      <div className="w-full max-w-5xl mx-auto space-y-12 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-white/5 pb-10">
          <div className="space-y-6">
            <button 
              onClick={() => onBack ? onBack() : navigate(-1)}
              className="flex items-center gap-3 text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-white font-black uppercase tracking-[0.2em] text-[10px] transition-all group bg-white dark:bg-white/5 px-4 py-2 rounded-xl shadow-premium border border-slate-200 dark:border-transparent"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Assessment
            </button>
            <h1 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-slate-50 tracking-tighter uppercase italic">Diagnostic <span className="text-blue-600 dark:text-blue-400">Log.</span></h1>
          </div>
          <div className="text-left md:text-right">
            <p className="text-[10px] text-slate-400 dark:text-slate-600 font-black uppercase tracking-[0.4em] mb-1">Search Records</p>
            <p className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">{mappedList.length} <span className="text-slate-300 dark:text-slate-700">MODELS</span></p>
          </div>
        </div>

        {/* Question List */}
        <motion.div 
          variants={staggerContainer} 
          initial="hidden" 
          animate="show" 
          className="space-y-8 will-change-transform" // Hardware acceleration
        >
          {mappedList.map((item, idx) => {
            const isCorrect = item.is_correct;
            const badgeStyle = getBadgeStyles(item.answer_level);

            return (
              <motion.div 
                key={item.question_id + idx} 
                variants={staggerItem}
                className={`relative bg-white dark:bg-gray-900/40 backdrop-blur-3xl rounded-[3rem] border overflow-hidden transition-all duration-500 group shadow-premium ${
                  isCorrect ? 'border-emerald-100 hover:border-emerald-300 dark:border-emerald-500/10 dark:hover:border-emerald-500/30' : 'border-rose-100 hover:border-rose-300 dark:border-rose-500/10 dark:hover:border-rose-500/30'
                }`}
              >
                {/* Status Indicator Bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors ${isCorrect ? 'bg-emerald-500/50' : 'bg-rose-500/50'}`} />

                {/* Card Header */}
                <div className="p-8 md:px-12 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3 px-5 py-2.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm transition-all duration-300 group-hover:bg-slate-50">
                       <div className="text-blue-600 dark:text-blue-400">{skillIcons[item.skill] || <BrainCircuit className="w-4 h-4" />}</div>
                       <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800 dark:text-slate-200">{item.skill}</span>
                    </div>
                    <div className={`px-5 py-2.5 rounded-2xl border font-black text-xs transition-all duration-300 ${badgeStyle}`}>
                       {item?.answer_level || 'A1'}
                    </div>
                    {item.score !== undefined && (
                      <div className="px-5 py-2.5 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-black text-slate-500 dark:text-slate-300 shadow-sm">
                        Score <span className={item.score >= 0.5 ? 'text-emerald-500' : 'text-rose-500'}>{Math.round(item.score * 100)}%</span>
                      </div>
                    )}
                  </div>
                  <StatusGlowBadge isCorrect={isCorrect} />
                </div>
                
                {/* Content Body */}
                <div className="p-8 md:p-12 space-y-10">
                   
                   {(item.prompt || (item as any).stimulus) && (
                     <div className="space-y-4">
                       <p className="text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-[0.3em]">Diagnostic Stimulus</p>
                       <div className="relative">
                          {(item as any).stimulus && (
                            <div className="p-6 bg-slate-100 dark:bg-white/5 border-l-4 border-blue-600 dark:border-blue-400 rounded-r-2xl text-slate-600 dark:text-slate-300 text-lg italic leading-relaxed mb-4">
                              "{ (item as any).stimulus }"
                            </div>
                          )}
                          {item.prompt && <p className="text-slate-900 dark:text-slate-50 font-black text-2xl leading-tight tracking-tight">{item.prompt}</p>}
                       </div>
                     </div>
                   )}

                   {/* Response Visualization */}
                   <div className="grid md:grid-cols-2 gap-6">
                     <div className="relative group/response">
                        <div className="relative bg-slate-50 dark:bg-black/40 p-8 md:p-10 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-inner transition-all duration-300 group-hover/response:bg-white h-full">
                          <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.4em] mb-4">Output Captured</p>
                          <p className="text-slate-900 dark:text-slate-50 font-black text-xl leading-relaxed">
                            {item.user_answer || <span className="text-slate-400 italic">Unprocessed</span>}
                          </p>
                        </div>
                     </div>
                     {!isCorrect && item.correct_answer && (
                       <div className="relative bg-emerald-50 content-[''] p-8 md:p-10 rounded-[2.5rem] border border-emerald-100 dark:bg-emerald-500/5 dark:border-emerald-500/10 shadow-inner h-full">
                         <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.4em] mb-4">Target Model</p>
                         <p className="text-emerald-700 dark:text-emerald-300 font-bold text-xl leading-relaxed italic">
                           "{item.correct_answer}"
                         </p>
                       </div>
                     )}
                   </div>

                   {/* AI Pedagogical Analysis */}
                   <div className="pt-10 border-t border-slate-100 dark:border-white/5">
                      <div className="flex items-start gap-8">
                        <div className={`w-16 h-16 rounded-[1.5rem] shrink-0 flex items-center justify-center shadow-premium ${
                          isCorrect ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                        }`}>
                          {isCorrect ? <CheckCircle2 size={32}/> : <AlertTriangle size={32}/>}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-[10px] uppercase font-black tracking-[0.4em] text-slate-400 mb-2">Pedagogical Synthesis Analysis</h4>
                          <p className="text-slate-700 dark:text-slate-300 text-xl leading-relaxed font-black tracking-tight max-w-4xl">
                            {typeof item.explanation === 'object' 
                              ? (item.explanation.note || JSON.stringify(item.explanation)) 
                              : item.explanation}
                          </p>
                        </div>
                      </div>
                   </div>
                </div>

                {/* Subtle Scan Line Effect (Hover) */}
                <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-10 transition-opacity bg-[linear-gradient(transparent_0%,rgba(0,255,255,0.1)_50%,transparent_100%)] bg-[size:100%_4px] animate-[pulse_2s_infinite]" />
              </motion.div>
            );
          })}
        </motion.div>

        {/* Footer */}
        <div className="pt-20 pb-10 text-center">
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-[1em] mb-4 animation-pulse">End of Diagnostic Record</p>
            <div className="h-px w-24 bg-white/5 mx-auto" />
        </div>
      </div>
    </div>
  );
};

export default AssessmentReviewView;
