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

        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-8 tracking-tight leading-tight">
          Analyzing your results<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">
            with Pedagogical Precision
          </span>
        </h2>

        <div className="w-full max-w-sm flex flex-col gap-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentMilestone}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-4 text-slate-700 font-medium bg-white px-6 py-4 rounded-2xl border border-indigo-100 shadow-[0_10px_25px_-5px_rgba(79,70,229,0.1)]"
            >
              {React.createElement(MILESTONES[currentMilestone].icon, { 
                className: `w-5 h-5 ${MILESTONES[currentMilestone].color}` 
              })}
              <span>{MILESTONES[currentMilestone].label}</span>
            </motion.div>
          </AnimatePresence>
          
          <div className="flex justify-center gap-1.5 mt-2">
            {MILESTONES.map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === currentMilestone ? 'w-8 bg-indigo-600' : 'w-2 bg-slate-200'
                }`} 
              />
            ))}
          </div>
        </div>
      </div>
    </FadeTransition>
  );
};
