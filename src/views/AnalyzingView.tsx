import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Brain, Loader2 } from 'lucide-react';
import { FadeTransition } from '../lib/animations';
import { OnboardingState } from '../types/app';
import { AssessmentAnalysisService } from '../services/AnalysisService';
import { LearnerModelSnapshot } from '../types/learner-model';

interface AnalyzingViewProps {
  onboardingState: OnboardingState | null;
  taskResults: any[];
  onComplete: (model: LearnerModelSnapshot) => void;
}

export const AnalyzingView: React.FC<AnalyzingViewProps> = ({ onboardingState, taskResults, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      const model = AssessmentAnalysisService.initializeLearnerModel(onboardingState, taskResults);
      onComplete(model);
    }, 4500);
    return () => clearTimeout(timer);
  }, [onboardingState, taskResults, onComplete]);

  return (
    <FadeTransition className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <motion.div
        animate={{
          background: [
            'radial-gradient(circle at 50% 50%, rgba(238, 242, 255, 1) 0%, rgba(248, 250, 252, 1) 50%)',
            'radial-gradient(circle at 50% 50%, rgba(224, 231, 255, 1) 0%, rgba(248, 250, 252, 1) 60%)',
            'radial-gradient(circle at 50% 50%, rgba(238, 242, 255, 1) 0%, rgba(248, 250, 252, 1) 50%)',
          ]
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0"
      />

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="relative mb-12">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="w-36 h-36 rounded-full border-[3px] border-indigo-200 border-t-indigo-600 border-r-indigo-600"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            className="w-28 h-28 rounded-full border-[3px] border-blue-100 border-b-blue-500 border-l-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white border border-indigo-100 rounded-full flex items-center justify-center shadow-[0_15px_30px_rgba(79,70,229,0.2)]">
            <Brain className="w-8 h-8 text-indigo-600" />
          </div>
        </div>

        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6 tracking-tight leading-tight">Analyzing your responses<br />with the Pedagogical Engine...</h2>

        <div className="flex items-center gap-3 text-indigo-700 font-medium bg-white px-6 py-3.5 rounded-2xl border border-indigo-100 shadow-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Building your Learner Snapshot...</span>
        </div>
      </div>
    </FadeTransition>
  );
};
