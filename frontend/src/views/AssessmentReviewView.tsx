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
  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-[0_0_15px_rgba(0,0,0,0.2)] ${
    isCorrect 
      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
  }`}>
    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isCorrect ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'}`} />
    <span className="text-[10px] font-black uppercase tracking-widest">{isCorrect ? 'Verified' : 'Flagged'}</span>
  </div>
);

const getBadgeStyles = (level?: string | any) => {
  const lvlStr = String(level || 'A1');
  if (lvlStr.includes('C')) return 'border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]';
  if (lvlStr.includes('B')) return 'border-cyan-500/50 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]';
  return 'border-indigo-500/50 text-indigo-400 shadow-[0_0_10px_rgba(79,70,229,0.2)]';
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
      <div className="min-h-screen bg-slate-50 py-12 px-4 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-700 animate-pulse">Loading Detailed Report...</h2>
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
    <div className="min-h-screen bg-[#020617] text-white py-16 px-4 md:px-8 relative overflow-x-hidden selection:bg-cyan-500/30 prestige-gpu">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[160px]" />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-emerald-600/5 rounded-full blur-[140px]" />
        {/* Noise Overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PScwIDAgMjAwIDIwMCcgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJz48ZmlsdGVyIGlkPSdub2lzZUZpbHRlcic+PGZlVHVyYnVsZW5jZSB0eXBlPSdmcmFjdGFsTm9pc2UnIGJhc2VGcmVxdWVuY3k9JzAuNjUnIG51bU9jdGF2ZXM9JzMnIHN0aXRjaFRpbGVzPSdzdGl0Y2gnLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0nMTAwJScgaGVpZ2h0PScxMDAlJyBmaWx0ZXI9J3VybCgjbm9pc2VGaWx0ZXIpJy8+PC9zdmc+')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:60px_60px]" />
      </div>

      <div className="w-full max-w-5xl mx-auto space-y-12 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
            <button 
              onClick={() => onBack ? onBack() : navigate(-1)}
              className="flex items-center gap-3 text-slate-500 hover:text-white font-black uppercase tracking-[0.2em] text-[10px] transition-all group"
            >
              <div className="p-2 bg-white/5 rounded-lg border border-white/10 group-hover:bg-indigo-600 transition-colors">
                <ArrowLeft className="w-4 h-4 text-white" />
              </div>
              Back to Analysis
            </button>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic">Diagnostic <span className="text-cyan-400">Log.</span></h1>
          </div>
          <div className="text-left md:text-right">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mb-1">Linguistic Search Records</p>
            <p className="text-2xl font-black text-white tracking-tight">{mappedList.length} <span className="text-slate-700">MODELS EVALUATED</span></p>
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
                className={`relative bg-slate-950/40 backdrop-blur-3xl rounded-[2.5rem] border overflow-hidden transition-all duration-500 group will-change-contents ${
                  isCorrect ? 'border-emerald-500/10 hover:border-emerald-500/30' : 'border-rose-500/10 hover:border-rose-500/30'
                }`}
              >
                {/* Status Indicator Bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors ${isCorrect ? 'bg-emerald-500/50' : 'bg-rose-500/50'}`} />

                {/* Card Header */}
                <div className="p-6 md:px-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-2xl border border-white/10">
                       <div className="text-indigo-400">{skillIcons[item.skill] || <BrainCircuit className="w-4 h-4" />}</div>
                       <span className="text-[10px] font-black uppercase tracking-[0.2em]">{item.skill}</span>
                    </div>
                    <div className={`px-4 py-1.5 rounded-xl border-2 bg-black/20 font-black text-xs transition-all ${badgeStyle}`}>
                       {item?.answer_level || 'A1'}
                    </div>
                    {item.score !== undefined && (
                      <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-black text-slate-300">
                        Score: <span className={item.score >= 0.5 ? 'text-emerald-400' : 'text-rose-400'}>{Math.round(item.score * 100)}%</span>
                      </div>
                    )}
                  </div>
                  <StatusGlowBadge isCorrect={isCorrect} />
                </div>
                
                {/* Content Body */}
                <div className="p-8 md:p-12 space-y-10">
                   
                   {(item.prompt || (item as any).stimulus) && (
                     <div className="space-y-4">
                       <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Diagnostic Stimulus</p>
                       <div className="relative">
                          {(item as any).stimulus && (
                            <div className="p-6 bg-white/5 border-l-4 border-indigo-500/50 rounded-r-2xl text-slate-300 text-lg italic leading-relaxed mb-4">
                              "{ (item as any).stimulus }"
                            </div>
                          )}
                          {item.prompt && <p className="text-white font-black text-2xl leading-tight tracking-tight">{item.prompt}</p>}
                       </div>
                     </div>
                   )}

                   {/* Response Visualization */}
                   <div className="grid md:grid-cols-2 gap-4">
                     <div className="relative group/response">
                        <div className="absolute inset-0 bg-cyan-500/5 blur-xl opacity-0 group-hover/response:opacity-100 transition-opacity" />
                        <div className="relative bg-black/40 p-8 rounded-[2rem] border border-white/5 shadow-inner ring-1 ring-white/5 h-full">
                          <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.4em] mb-4">Your Answer</p>
                          <p className="text-white font-bold text-xl leading-relaxed">
                            {item.user_answer || <span className="text-slate-700 italic">No output captured</span>}
                          </p>
                        </div>
                     </div>
                     {!isCorrect && item.correct_answer && (
                       <div className="relative bg-emerald-500/5 p-8 rounded-[2rem] border border-emerald-500/10 shadow-inner ring-1 ring-emerald-500/10 h-full">
                         <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em] mb-4">Correct Answer</p>
                         <p className="text-emerald-300 font-bold text-xl leading-relaxed italic">
                           "{item.correct_answer}"
                         </p>
                       </div>
                     )}
                   </div>

                   {/* AI Pedagogical Analysis */}
                   <div className="pt-10 border-t border-white/5">
                      <div className="flex items-start gap-6">
                        <div className={`w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center shadow-lg ${
                          isCorrect ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {isCorrect ? <CheckCircle2 className="w-7 h-7"/> : <AlertTriangle className="w-7 h-7"/>}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-[10px] uppercase font-black tracking-[0.4em] text-slate-500 mb-2">Pedagogical Calibration Analysis</h4>
                          <p className="text-slate-300 text-lg leading-relaxed font-medium max-w-3xl">
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
