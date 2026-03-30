import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, ChevronRight, GraduationCap, Briefcase, Coffee } from 'lucide-react';

interface GoalFollowUpModalProps {
  goalId: string;
  onComplete: (context: string) => void;
  onClose: () => void;
}

const goalContextConfigs: Record<string, {
  question: string;
  icon: React.ReactNode;
  options: string[];
  theme: string;
}> = {
  casual: {
    question: "What event or situation are you preparing for?",
    icon: <Coffee className="w-6 h-6" />,
    options: ["Travel", "Social conversations", "Relocation", "Personal interest"],
    theme: "text-amber-600 bg-amber-50 border-amber-100"
  },
  serious: {
    question: "What is your field of study?",
    icon: <GraduationCap className="w-6 h-6" />,
    options: ["Engineering", "Medicine", "Business", "Arts", "Science"],
    theme: "text-indigo-600 bg-indigo-50 border-indigo-100"
  },
  professional: {
    question: "Which industry or field do you work in?",
    icon: <Briefcase className="w-6 h-6" />,
    options: ["Technology", "Finance", "Marketing", "Healthcare", "Education"],
    theme: "text-emerald-600 bg-emerald-50 border-emerald-100"
  }
};

export const GoalFollowUpModal: React.FC<GoalFollowUpModalProps> = ({ goalId, onComplete, onClose }) => {
  const config = goalContextConfigs[goalId];
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  if (!config) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden"
      >
        <div className="relative p-8 sm:p-10">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center">
            <div className={`mb-6 w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm border ${config.theme}`}>
               {config.icon}
            </div>
            
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-widest rounded-full mb-4">
               <Sparkles className="w-3 h-3" /> Personalized Context
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 leading-tight">
              {config.question}
            </h2>
            <p className="text-slate-500 text-sm mb-8">
              Help us understand your goal better so we can personalize your learning experience.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-10">
              {config.options.map(opt => (
                <button
                  key={opt}
                  onClick={() => setSelectedOption(opt)}
                  className={`px-5 py-4 rounded-2xl border-2 text-sm font-bold transition-all text-left flex items-center justify-between group ${
                    selectedOption === opt 
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-md shadow-indigo-100' 
                      : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-indigo-200 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {opt}
                  {selectedOption === opt && (
                    <motion.div layoutId="check" className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                       <ChevronRight className="w-3.5 h-3.5 text-white" />
                    </motion.div>
                  )}
                </button>
              ))}
            </div>

            <button
              disabled={!selectedOption}
              onClick={() => onComplete(selectedOption!)}
              className="w-full bg-slate-900 hover:bg-black disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 group"
            >
              Continue Onboarding <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
