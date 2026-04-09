import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, CheckCircle2, XCircle, BrainCircuit, Mic, PenTool, Headphones, BookOpen, AlertCircle, AlertTriangle, MessageSquare
} from 'lucide-react';
import { TaskEvaluation } from '../types/assessment';

interface ExternalResponse {
  question_id: string;
  user_answer: string;
  is_correct: boolean;
  cefr_level: string;
  ai_feedback_text: string;
  skill: string;
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

const getBadgeColor = (level?: string) => {
  if (!level) return 'bg-slate-100 text-slate-700 border-slate-200';
  if (level.includes('C')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (level.includes('B')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (level.includes('A')) return 'bg-red-100 text-red-800 border-red-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

export const AssessmentReviewView: React.FC<AssessmentReviewViewProps> = ({ evaluations, assessmentId, onBack }) => {
  const navigate = useNavigate();
  const [dbResponses, setDbResponses] = useState<ExternalResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [useLocal, setUseLocal] = useState(true);

  useEffect(() => {
    if (assessmentId) {
      const fetchDb = async () => {
        setIsLoading(true);
        try {
          const res = await fetch(`/api/assessments/${assessmentId}/responses`);
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
      fetchDb();
    }
  }, [assessmentId]);

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
  const mappedList = useLocal ? evaluations.map(ev => ({
    question_id: ev.taskId,
    skill: ev.skill || 'grammar',
    user_answer: ev.rawSignals?.answer || ev.reviewData?.userAnswer || '',
    is_correct: ev.reviewData?.result === 'correct',
    cefr_level: ev.reviewData?.answerLevel || ev.difficulty || 'A1',
    ai_feedback_text: ev.reviewData?.explanation.whyCorrect || ev.reviewData?.explanation.whatWentWrong || "Automated Review",
    prompt: ev.rawSignals?.prompt as string | undefined || ev.reviewData?.prompt
  })) : dbResponses;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <button 
            onClick={() => onBack ? onBack() : navigate(-1)}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors group"
          >
            <div className="p-2 bg-white rounded-lg border border-slate-200 group-hover:bg-slate-100">
              <ArrowLeft className="w-5 h-5" />
            </div>
            Back to Dashboard
          </button>
          <div className="text-right">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Assessment Report</h1>
            <p className="text-sm text-slate-500 font-medium mt-1 uppercase tracking-widest">{mappedList.length} Questions Evaluated</p>
          </div>
        </div>

        {/* Question List */}
        <motion.div 
          variants={staggerContainer} 
          initial="hidden" 
          animate="show" 
          className="space-y-6"
        >
          {mappedList.map((item, idx) => {
            const isCorrect = item.is_correct;
            const badgeClass = getBadgeColor(item.cefr_level);

            return (
              <motion.div 
                key={item.question_id + idx} 
                variants={staggerItem}
                className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-md shadow-slate-200/50 hover:shadow-xl transition-all group"
              >
                {/* Header Banner */}
                <div className={`p-5 flex items-center justify-between border-b ${isCorrect ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                  <div className="flex gap-4 items-center flex-wrap">
                    <span className="flex gap-1.5 items-center text-xs font-black uppercase tracking-widest bg-slate-900 text-white px-3 py-1.5 rounded-full shadow-sm">
                      {skillIcons[item.skill] || <BrainCircuit className="w-3.5 h-3.5" />} {item.skill}
                    </span>
                    <div className="flex gap-1.5 items-center bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Demonstrated Level:</span>
                       <span className={`text-xs font-black px-2 py-0.5 rounded border ${badgeClass}`}>{item.cefr_level}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">
                     <span className={`text-[10px] font-black uppercase tracking-widest ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                       {isCorrect ? 'Correct' : 'Needs Work'}
                     </span>
                     {isCorrect ? <CheckCircle2 className="w-4 h-4 text-emerald-500"/> : <XCircle className="w-4 h-4 text-rose-500"/>}
                  </div>
                </div>
                
                {/* Detailed Analysis Area */}
                <div className="p-6 md:p-8 space-y-6">
                   
                   {item.prompt && (
                     <div className="space-y-2">
                       <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Question Context</p>
                       <p className="text-slate-800 font-bold text-lg leading-snug">{item.prompt}</p>
                     </div>
                   )}

                   <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-inner group-hover:bg-white transition-colors duration-500 ring-1 ring-black/5 relative">
                     <div className="absolute top-0 right-8 -mt-3 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full shadow-sm">
                        Learner Response
                     </div>
                     <p className="text-slate-900 font-bold text-[16px] leading-relaxed pt-2">"{item.user_answer}"</p>
                   </div>

                   {/* AI Explanation Injection */}
                   <div className="mt-6 pt-6 border-t border-slate-100">
                     <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-xl mt-1 shrink-0 ${isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          {isCorrect ? <CheckCircle2 className="w-5 h-5"/> : <AlertTriangle className="w-5 h-5"/>}
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Pedagogical Analysis</p>
                          <p className="text-slate-700 text-base leading-relaxed font-medium">
                            {item.ai_feedback_text}
                          </p>
                        </div>
                     </div>
                   </div>

                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
};
