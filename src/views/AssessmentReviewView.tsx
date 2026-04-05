import React from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, CheckCircle2, XCircle, HelpCircle, 
  Mic, PenTool, Headphones, BookOpen, BrainCircuit, Activity,
  Zap, AlertCircle, Lightbulb, BarChart2, Brain
} from 'lucide-react';
import { TaskEvaluation, AssessmentQuestion } from '../types/assessment';
import { QUESTION_BANK } from '../data/assessment-questions';

interface AssessmentReviewViewProps {
  evaluations: TaskEvaluation[];
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

const skillColors: Record<string, string> = {
  speaking: 'bg-rose-50 text-rose-600 border-rose-100',
  writing: 'bg-purple-50 text-purple-600 border-purple-100',
  listening: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  vocabulary: 'bg-amber-50 text-amber-600 border-amber-100',
  reading: 'bg-blue-50 text-blue-600 border-blue-100',
  grammar: 'bg-indigo-50 text-indigo-600 border-indigo-100',
};

export const AssessmentReviewView: React.FC<AssessmentReviewViewProps> = ({ evaluations, onBack }) => {
  
  const getQuestion = (id: string): AssessmentQuestion | undefined => {
    return QUESTION_BANK.find(q => q.id === id);
  };

  const renderCorrectAnswer = (ev: TaskEvaluation, legacy?: AssessmentQuestion) => {
    const raw = ev.rawSignals || {};
    const answerKey = (raw.answerKey as any) || legacy?.correctAnswer || legacy?.acceptedAnswers;
    
    if (!answerKey) return null;

    // Handle new dynamic bank structure (Nested Object)
    let displayValue: any = answerKey;
    let isMCQ = false;

    if (typeof answerKey === 'object' && answerKey !== null) {
      if ('value' in answerKey) {
        displayValue = answerKey.value;
        if (answerKey.type === 'mcq' && displayValue?.options && displayValue?.correct_index !== undefined) {
          displayValue = displayValue.options[displayValue.correct_index];
          isMCQ = true;
        }
      } else if ('correct_answer' in answerKey) {
        displayValue = answerKey.correct_answer;
        isMCQ = true;
      }
    }

    if (isMCQ || typeof displayValue === 'string') {
      return (
        <div className="mt-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Correct Answer</p>
          <p className="text-sm font-bold text-emerald-900">{String(displayValue)}</p>
        </div>
      );
    }
    
    // Handle list of keywords (Exact Match or Array)
    const answers = Array.isArray(displayValue) ? displayValue : [String(displayValue)];
        
    return (
      <div className="mt-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Target Keywords</p>
        <div className="flex flex-wrap gap-2">
          {answers.map((ans, i) => (
            <span key={i} className="text-xs bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-800 font-bold whitespace-nowrap">
              {String(ans)}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const staggerItem = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 flex flex-col items-center">
      <div className="w-full max-w-3xl space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors group"
          >
            <div className="p-2 bg-white rounded-lg border border-slate-200 group-hover:bg-slate-100">
              <ArrowLeft className="w-5 h-5" />
            </div>
            Back to Results
          </button>
          <div className="text-right">
            <h1 className="text-2xl font-black text-slate-900">Review Answers</h1>
            <p className="text-sm text-slate-500 font-medium">{evaluations.length} Questions Evaluated</p>
          </div>
        </div>

        {/* Question List */}
        <motion.div 
          variants={staggerContainer} 
          initial="hidden" 
          animate="show" 
          className="space-y-6"
        >
          {evaluations.map((ev, idx) => {
            const review = ev.reviewData;
            
            // Fallback for older sessions or if data is missing
            if (!review) {
              const legacyQuestion = getQuestion(ev.taskId);
              const prompt = ev.rawSignals?.prompt as string || legacyQuestion?.prompt;
              if (!prompt) return null;

              return (
                <div key={ev.taskId} className="p-4 bg-slate-100 rounded-xl border border-slate-200 opacity-60">
                   <p className="text-xs font-bold text-slate-400 mb-1">Legacy Record: {ev.taskId}</p>
                   <p className="text-sm font-medium text-slate-700">{prompt}</p>
                </div>
              );
            }

            const isCorrect = review.result === 'correct';
            const isPartial = review.result === 'partial';

            return (
              <motion.div 
                key={ev.taskId} 
                variants={staggerItem}
                className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group"
              >
                {/* Card Header */}
                <div className={`p-5 border-b flex items-center justify-between ${isCorrect ? 'bg-emerald-50/50 border-emerald-100' : isPartial ? 'bg-amber-50/50 border-amber-100' : 'bg-rose-50/50 border-rose-100'}`}>
                  <div className="flex gap-4 items-center flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white px-3 py-1 rounded-full shadow-sm">{review.skill}</span>
                    <div className="flex gap-1.5 items-center">
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Level:</span>
                       <span className="text-[10px] font-black bg-slate-200 text-slate-700 px-2 py-0.5 rounded shadow-sm">{review.questionLevel}</span>
                    </div>
                    <div className="flex gap-1.5 items-center">
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Performance:</span>
                       <span className={`text-[10px] font-black px-2 py-0.5 rounded shadow-sm ${review.answerLevel !== review.questionLevel ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-slate-200 text-slate-700'}`}>{review.answerLevel}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <span className={`text-xs font-black uppercase tracking-widest ${isCorrect ? 'text-emerald-700' : isPartial ? 'text-amber-700' : 'text-rose-700'}`}>
                       {review.result}
                     </span>
                     {isCorrect ? <CheckCircle2 className="w-5 h-5 text-emerald-500"/> : isPartial ? <AlertCircle className="w-5 h-5 text-amber-500"/> : <XCircle className="w-5 h-5 text-rose-500"/>}
                  </div>
                </div>
                
                {/* Card Body */}
                <div className="p-6 space-y-6">
                   <div className="space-y-2">
                     <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Diagnostic Question {idx + 1}</p>
                     <p className="text-slate-800 font-bold text-lg leading-snug">{review.prompt}</p>
                   </div>

                   <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 shadow-inner group-hover:bg-white transition-colors duration-500 ring-1 ring-black/5">
                     <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Student Response</p>
                     <p className="text-slate-900 font-bold font-serif text-[15px] italic leading-relaxed">"{review.userAnswer}"</p>
                   </div>

                   {review.correctAnswer && (
                     <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-100">
                       <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1.5">Expected Target</p>
                       <p className="text-emerald-900 font-black">{review.correctAnswer}</p>
                     </div>
                   )}

                   {/* Explanations Layer */}
                   <div className="space-y-4 mt-6 border-t border-slate-100 pt-6">
                     {review.explanation.whyCorrect && (
                       <div className="flex items-start gap-4">
                         <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-600">
                            <CheckCircle2 className="w-4 h-4 shrink-0"/>
                         </div>
                         <p className="text-slate-700 text-sm leading-relaxed"><strong className="text-slate-900 mr-1">Linguistic Success:</strong>{review.explanation.whyCorrect}</p>
                       </div>
                     )}
                     {review.explanation.whatWentWrong && (
                       <div className="flex items-start gap-4">
                         <div className="p-1.5 bg-rose-100 rounded-lg text-rose-600">
                            <Zap className="w-4 h-4 shrink-0"/>
                         </div>
                         <p className="text-slate-700 text-sm leading-relaxed"><strong className="text-slate-900 mr-1">The Issue:</strong>{review.explanation.whatWentWrong}</p>
                       </div>
                     )}
                     {review.explanation.levelNote && (
                       <div className="flex items-start gap-4 bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100 ring-1 ring-indigo-200/20">
                         <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
                            <BarChart2 className="w-4 h-4 shrink-0"/>
                         </div>
                         <p className="text-indigo-950 text-xs font-semibold leading-relaxed max-w-3xl"><strong className="uppercase tracking-widest text-[9px] block text-indigo-400 mb-1">Pedagogical Insight</strong>{review.explanation.levelNote}</p>
                       </div>
                     )}
                     {review.explanation.modelAnswer && (
                       <div className="flex items-start gap-4">
                         <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500">
                            <Brain className="w-4 h-4 shrink-0"/>
                         </div>
                         <p className="text-slate-700 text-sm leading-relaxed"><strong className="text-slate-900 mr-1">Better Phrasing:</strong>{review.explanation.modelAnswer}</p>
                       </div>
                     )}
                     {review.explanation.improvementTip && (
                       <div className="flex items-start gap-4 bg-amber-50 p-5 rounded-2xl border border-amber-200/50 shadow-sm">
                         <div className="p-2 bg-amber-200 rounded-xl text-amber-700 flex items-center justify-center">
                            <Lightbulb className="w-5 h-5 shrink-0"/>
                         </div>
                         <p className="text-amber-950 text-sm font-bold leading-relaxed max-w-3xl">
                           <span className="text-[10px] uppercase tracking-widest text-amber-500 block mb-1">Improvement strategy</span>
                           {review.explanation.improvementTip}
                         </p>
                       </div>
                     )}
                   </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Final CTA */}
        <div className="flex justify-center pt-8">
           <button 
             onClick={onBack}
             className="bg-slate-900 hover:bg-indigo-600 text-white font-bold py-4 px-12 rounded-2xl transition-all shadow-xl active:scale-95"
           >
             Continue to Learning Journey
           </button>
        </div>
      </div>
    </div>
  );
};
