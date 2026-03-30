import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Target, MapIcon, Compass, Zap, ArrowRight, PlayCircle, BookOpen, Layers } from 'lucide-react';
import { LearnerModelSnapshot } from '../types/learner-model';
import { LearningJourneyPlan } from '../types/journey';

const nextLevelMap: Record<string, string> = {
  'Pre-A1': 'A1', 'A1': 'A2', 'A1+': 'A2', 'A2': 'B1', 'A2+': 'B1',
  'B1': 'B2', 'B1+': 'B2', 'B2': 'C1', 'B2+': 'C1', 'C1': 'C2', 'C2': 'C2'
};

interface LearningJourneyViewProps {
  model: LearnerModelSnapshot;
  onStartSession: () => void;
  onViewDashboard: () => void;
}

export const LearningJourneyView: React.FC<LearningJourneyViewProps> = ({ model, onStartSession, onViewDashboard }) => {
  const targetLevel = nextLevelMap[model.overallLevel] || 'A2';
  
  // Create dynamic journey map
  const plan: LearningJourneyPlan = useMemo(() => {
    return {
      currentLevel: model.overallLevel,
      targetLevel: targetLevel,
      estimatedWeeks: 12, // Arbitrary for MVP
      modules: [
        {
          id: 'mod1',
          title: 'Build basic sentence accuracy',
          focus: ['Grammar', 'Writing'],
          reason: 'Targets your grammatical inconsistency'
        },
        {
          id: 'mod2',
          title: 'Improve listening for details',
          focus: ['Listening', 'Comprehension'],
          reason: 'Addresses your fast pacing and missed signals'
        },
        {
          id: 'mod3',
          title: 'Expand everyday vocabulary',
          focus: ['Vocabulary', 'Speaking'],
          reason: 'Helps overcome lexical repetition'
        }
      ]
    }
  }, [model, targetLevel]);

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.15 } }
  };

  const staggerItem = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 selection:bg-indigo-500/30 font-sans text-slate-900 flex flex-col items-center">
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="w-full max-w-4xl space-y-10">
        
        {/* Header */}
        <motion.div variants={staggerItem} className="text-center space-y-4 pt-6">
          <div className="inline-flex items-center gap-2 bg-indigo-100/50 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-bold border border-indigo-200">
            <Compass className="w-4 h-4" /> Your Learning Roadmap
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">The Path to {plan.targetLevel}</h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto font-medium">
            We've mapped out exactly what you need to focus on to bridge the gap and reach your goal.
          </p>
        </motion.div>

        {/* Path Overview */}
        <motion.div variants={staggerItem} className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60" />
          
          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-8 text-center sm:text-left">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-2">Current Status</p>
              <span className="text-4xl font-black text-slate-800">{plan.currentLevel}</span>
            </div>
            
            <div className="flex-1 flex flex-col items-center w-full">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">~{plan.estimatedWeeks} Weeks Estimated</span>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex items-center shadow-inner relative">
                <div className="h-full bg-indigo-600 rounded-full w-[25%]" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-4 border-slate-200 rounded-full shadow-sm mr-1" />
              </div>
            </div>
            
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-2">Target Goal</p>
              <span className="text-4xl font-black text-indigo-600">{plan.targetLevel}</span>
            </div>
          </div>
        </motion.div>

        {/* Modules Roadmap */}
        <motion.div variants={staggerItem} className="space-y-6">
          <h3 className="font-bold text-slate-800 text-xl flex items-center gap-2 px-2"><Layers className="w-6 h-6 text-indigo-500" /> Your Targeted Modules</h3>
          
          <div className="space-y-4">
            {plan.modules.map((mod, i) => (
              <div key={mod.id} className="group relative bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                {/* Module Number/Status */}
                <div className="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl transition-colors border-2
                  ${i === 0 ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-50 border-slate-200 text-slate-400 group-hover:bg-slate-100'}">
                  {i + 1}
                </div>
                
                {/* Module Details */}
                <div className="flex-1">
                  <h4 className={`font-bold text-lg mb-1 ${i === 0 ? 'text-slate-900' : 'text-slate-700'}`}>{mod.title}</h4>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {mod.focus.map(f => (
                      <span key={f} className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider">{f}</span>
                    ))}
                  </div>
                  <p className="text-sm text-slate-500 font-medium flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-500" /> {mod.reason}</p>
                </div>

                {/* Status indicator */}
                {i === 0 && (
                  <div className="absolute top-6 right-6 lg:static sm:self-center">
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">Up Next</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* CTAs */}
        <motion.div variants={staggerItem} className="pt-8 flex flex-col sm:flex-row gap-5 pb-12 w-full sm:w-auto mx-auto justify-center">
          <button 
            onClick={onStartSession}
            className="group flex flex-1 sm:flex-none items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-bold text-lg transition-all duration-300 shadow-xl shadow-indigo-600/25 active:scale-95"
          >
            Begin your first module
            <PlayCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>
          
          <button 
            onClick={onViewDashboard}
            className="flex flex-1 sm:flex-none items-center justify-center gap-3 bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-700 px-8 py-4 rounded-2xl font-bold transition-all duration-300 active:scale-95"
          >
            Go to dashboard
          </button>
        </motion.div>
        
      </motion.div>
    </div>
  );
};
