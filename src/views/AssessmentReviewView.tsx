import React from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, CheckCircle2, XCircle, HelpCircle, 
  Mic, PenTool, Headphones, BookOpen, BrainCircuit, Activity
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

  const renderCorrectAnswer = (question: AssessmentQuestion) => {
    if (['mcq', 'reading_mcq', 'listening_mcq'].includes(question.type)) {
      return (
        <div className="mt-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Correct Answer</p>
          <p className="text-sm font-bold text-emerald-900">{question.correctAnswer}</p>
        </div>
      );
    }
    
    if (question.acceptedAnswers || question.correctAnswer) {
      const answers = Array.isArray(question.acceptedAnswers || question.correctAnswer) 
        ? (question.acceptedAnswers || question.correctAnswer) as string[]
        : [question.correctAnswer as string];
        
      return (
        <div className="mt-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Target Keywords</p>
          <div className="flex flex-wrap gap-2">
            {answers.map((ans, i) => (
              <span key={i} className="text-xs bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-800 font-bold whitespace-nowrap">
                {ans}
              </span>
            ))}
          </div>
        </div>
      );
    }

    return null;
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
          className="space-y-4"
        >
          {evaluations.map((ev, idx) => {
            const question = getQuestion(ev.taskId);
            if (!question) return null;

            const isCorrect = ev.validAttempt; // Based on engine's isPass logic

            return (
              <motion.div 
                key={ev.taskId} 
                variants={staggerItem}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all"
              >
                {/* Status bar */}
                <div className={`h-1.5 w-full ${isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                
                <div className="p-6 space-y-4">
                  {/* Meta */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${skillColors[question.skill]}`}>
                         {skillIcons[question.skill]} {question.skill}
                       </span>
                       <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full uppercase tracking-tighter">
                         Level {question.difficulty}
                       </span>
                    </div>
                    {isCorrect ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4" /> Correct
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-rose-600 font-bold text-xs">
                        <XCircle className="w-4 h-4" /> Incorrect
                      </div>
                    )}
                  </div>

                  {/* Question Content */}
                  <div className="space-y-2">
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Question {idx + 1}</p>
                    <p className="font-bold text-slate-900 leading-snug">{question.prompt}</p>
                  </div>

                  {/* User Answer */}
                  <div className={`p-4 rounded-2xl border ${isCorrect ? 'bg-emerald-50/30 border-emerald-100' : 'bg-rose-50/30 border-rose-100'}`}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Your Response</p>
                    <p className={`font-bold ${isCorrect ? 'text-emerald-900' : 'text-rose-900'}`}>{ev.rawSignals?.answer || 'No text answer'}</p>
                    
                    {/* Correction if wrong */}
                    {!isCorrect && renderCorrectAnswer(question)}
                  </div>

                  {/* Engine Notes */}
                  {ev.notes && ev.notes.length > 0 && (
                    <div className="pt-2 flex flex-col gap-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Linguistic Rationale</p>
                      {ev.notes.map((note, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-medium text-slate-600">
                          <Activity className="w-3 h-3 text-indigo-400" />
                          {note}
                        </div>
                      ))}
                    </div>
                  )}
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
