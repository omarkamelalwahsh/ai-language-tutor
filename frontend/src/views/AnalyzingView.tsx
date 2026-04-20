import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Disc, Fingerprint, Activity, Gauge, CheckCircle2 } from 'lucide-react';
import { FadeTransition } from '../lib/animations';
import { OnboardingState } from '../types/app';
import { AssessmentAnalysisService } from '../services/AnalysisService';
import { AssessmentSessionResult, TaskEvaluation, AssessmentOutcome } from '../types/assessment';

interface AnalyzingViewProps {
  onboardingState: OnboardingState | null;
  taskResults: TaskEvaluation[];
  assessmentOutcome?: AssessmentOutcome | null;
  onComplete: (result: AssessmentSessionResult) => void;
}

const MILESTONES = [
  { id: 'features', label: 'Extracting linguistic features...', icon: Fingerprint, color: 'text-blue-500' },
  { id: 'descriptors', label: 'Matching CEFR 2020 descriptors...', icon: Disc, color: 'text-indigo-500' },
  { id: 'stability', label: 'Verifying evidence stability...', icon: Activity, color: 'text-emerald-500' },
  { id: 'capping', label: 'Calibrating linguistic anchors...', icon: Gauge, color: 'text-amber-500' },
  { id: 'finalizing', label: 'Generating evidence-backed roadmap...', icon: CheckCircle2, color: 'text-purple-500' },
];

export const AnalyzingView: React.FC<AnalyzingViewProps> = ({ onboardingState, taskResults, assessmentOutcome, onComplete }) => {
  const [currentMilestone, setCurrentMilestone] = useState(0);

  useEffect(() => {
    // Cycle milestones for "WOW" effect and transparency
    const interval = setInterval(() => {
      setCurrentMilestone(prev => Math.min(prev + 1, MILESTONES.length - 1));
    }, 1200);

    const timer = setTimeout(() => {
      if (assessmentOutcome) {
        // Use the new deterministic bridge
        const result = AssessmentAnalysisService.fromAssessmentOutcome(
          assessmentOutcome, 
          onboardingState?.userId || 'anonymous', 
          assessmentOutcome?.assessmentId || 'diagnostic_session', 
          onboardingState || {}
        );
        onComplete(result);
      }
    }, 6500);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [onboardingState, taskResults, assessmentOutcome, onComplete]);

  return (
    <FadeTransition className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">
      <motion.div
        animate={{
          background: [
            'radial-gradient(circle at 50% 50%, rgba(248, 250, 252, 1) 0%, rgba(241, 245, 249, 1) 100%)',
            'radial-gradient(circle at 50% 50%, rgba(239, 246, 255, 1) 0%, rgba(241, 245, 249, 1) 100%)',
            'radial-gradient(circle at 50% 50%, rgba(248, 250, 252, 1) 0%, rgba(241, 245, 249, 1) 100%)',
          ]
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0"
      />

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="relative mb-12">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            className="w-44 h-44 rounded-full border-[1px] border-slate-200 dark:border-gray-800 border-t-blue-600 dark:border-t-indigo-600"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
            className="w-36 h-36 rounded-full border-[1px] border-slate-200 dark:border-gray-800 border-b-blue-400 dark:border-b-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-[2rem] flex items-center justify-center shadow-premium">
            <Brain className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <h2 className="text-4xl font-black text-slate-900 dark:text-slate-50 mb-10 tracking-tight leading-[1.1] uppercase italic">
          Calibrating Profile<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500 not-italic">
            Linguistic Synthesis
          </span>
        </h2>

        <div className="w-full max-w-sm flex flex-col gap-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentMilestone}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-5 text-slate-900 dark:text-slate-200 font-black text-[10px] uppercase tracking-widest bg-white dark:bg-gray-900 px-8 py-5 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-premium"
            >
              <div className="p-2 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-transparent">
                {React.createElement(MILESTONES[currentMilestone].icon, { 
                  className: `w-5 h-5 ${MILESTONES[currentMilestone].color}` 
                })}
              </div>
              <span className="flex-1 text-left">{MILESTONES[currentMilestone].label}</span>
            </motion.div>
          </AnimatePresence>
          
          <div className="flex justify-center gap-2 mt-4">
            {MILESTONES.map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-700 ${
                  i === currentMilestone ? 'w-10 bg-blue-600 dark:bg-blue-600' : 'w-2 bg-slate-200 dark:bg-gray-800'
                }`} 
              />
            ))}
          </div>
        </div>
      </div>
    </FadeTransition>
  );
};
