import React from 'react';
import { motion } from 'motion/react';
import { Rocket, Target, ArrowRight, Star, ShieldCheck, MapPin, Coffee, Clock, Flame, CalendarDays } from 'lucide-react';
import { CEFRLevel, LearnerModelSnapshot } from '../../types/learner-model';
import { getNextBand, normalizeBand } from '../../lib/cefr-utils';

interface NewLearnerJourneyViewProps {
  learnerModel: LearnerModelSnapshot;
  onStartSession: () => void;
}

const intensityMetadata = {
  light: { label: 'Light Pace', icon: <Coffee className="w-5 h-5" />, desc: '2–3 sessions per week', detail: '~10 min each' },
  regular: { label: 'Regular Pace', icon: <Clock className="w-5 h-5" />, desc: '4–5 sessions per week', detail: '~15 min each' },
  intensive: { label: 'Intensive Pace', icon: <Flame className="w-5 h-5" />, desc: 'Daily sessions', detail: '~20 min each' },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const staggerItem = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export const NewLearnerJourneyView: React.FC<NewLearnerJourneyViewProps> = ({ learnerModel, onStartSession }) => {
  const currentLevel = learnerModel.overallLevel;
  const targetLevel = getNextBand(currentLevel);
  const isC2 = normalizeBand(currentLevel) === 'C2';
  const intensity = intensityMetadata[learnerModel.onboardingIntensity || 'regular'];

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-8">
      {/* Welcome Hero */}
      <motion.section variants={staggerItem} className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-8 text-white relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/30 shadow-xl">
             <Rocket className="w-12 h-12 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold mb-2 tracking-tight">Your learning journey begins today.</h2>
            <p className="text-indigo-100 font-medium max-w-xl">
              We've identified your starting point at <span className="text-white font-bold bg-white/20 px-2 py-0.5 rounded">{currentLevel}</span> based on your pre-assessment. 
              As you complete lessons, your progress and consistency will appear here.
            </p>
          </div>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Level & Schedule */}
        <div className="space-y-6">
          {/* Starting Point Card */}
          <motion.div variants={staggerItem} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Starting Point</h3>
            </div>
            
            <div className="flex items-center justify-between mb-8">
              <div className="text-center">
                <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mb-3 mx-auto shadow-xl shadow-indigo-200">
                  <span className="text-2xl font-extrabold text-white">{currentLevel}</span>
                </div>
                <p className="text-sm font-bold text-slate-400 capitalize">Assessed Level</p>
              </div>
              
              <div className="flex-1 px-8">
                 <div className="h-px bg-slate-200 w-full relative">
                   <div className="absolute top-1/2 left-0 -translate-y-1/2 w-2 h-2 rounded-full bg-indigo-600" />
                   <div className="absolute top-1/2 right-0 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-200" />
                 </div>
              </div>

              <div className="text-center">
                <div className="w-20 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center mb-3 mx-auto">
                  <span className="text-2xl font-extrabold text-slate-300">{targetLevel}</span>
                </div>
                <p className="text-sm font-bold text-slate-400 capitalize">Target Level</p>
              </div>
            </div>

            <p className="text-slate-500 text-sm leading-relaxed mb-6">
               Your starting point is set at <span className="font-bold text-slate-700">{currentLevel}</span>. {isC2 
                ? `You've achieved mastery. We'll focus on maintaining your peak performance across all skills.`
                : `We'll strengthen your ${normalizeBand(currentLevel)} foundation before progressing your proficiency toward ${targetLevel}.`}
            </p>

            <button 
              onClick={onStartSession}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all group"
            >
              Start First Lesson <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </div>

        {/* Right Column: Planned Commitment */}
        <div className="space-y-6">
          {/* Planned Schedule Card */}
          <motion.div variants={staggerItem} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl border border-orange-100">
                <CalendarDays className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Planned Commitment</h3>
            </div>
            
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-6">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-orange-600">
                    {intensity.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{intensity.label}</h4>
                    <p className="text-sm text-slate-500 font-medium">{intensity.desc} • {intensity.detail}</p>
                  </div>
               </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                 <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Upcoming Milestone</span>
                 <span className="text-indigo-600 font-bold">Start Your Streak</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                 <div className="h-full bg-slate-200 w-[5%]" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed italic">
                 "Commitment to {intensity.desc.toLowerCase()} will help you reach {targetLevel} twice as fast."
              </p>
            </div>
          </motion.div>

          <motion.div variants={staggerItem} className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
              <div className="flex items-center gap-3 mb-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-emerald-900">Pedagogical Trust</h4>
              </div>
              <p className="text-sm text-emerald-800 font-medium leading-relaxed">
                Your schedule is locked. We'll start tracking your activity calendar and streaks the moment you complete your first lesson. No generic activity—only your real performance counts.
              </p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};
