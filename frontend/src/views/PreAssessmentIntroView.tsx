import React from 'react';
import { motion } from 'motion/react';
import {
  Mic, PenTool, Headphones, BookOpen, ChevronRight,
  CheckCircle2, Clock, Award, BarChart2, Target, Sparkles, Shield, ArrowRight, Zap
} from 'lucide-react';
import { FadeTransition, staggerContainer, staggerItem } from '../lib/animations';

interface PreAssessmentIntroViewProps {
  onStartAssessment: () => void;
  onBack?: () => void;
}

const assessedSkills = [
  { icon: <Mic className="w-5 h-5" />, label: 'Speaking', desc: 'Conversation ability & expression' },
  { icon: <PenTool className="w-5 h-5" />, label: 'Writing', desc: 'Grammar, structure & clarity' },
  { icon: <Headphones className="w-5 h-5" />, label: 'Listening', desc: 'Comprehension & detail capture' },
  { icon: <BookOpen className="w-5 h-5" />, label: 'Vocabulary', desc: 'Word range & contextual use' },
];

const outcomes = [
  { icon: <Award className="w-4 h-4" />, text: 'Your estimated starting level' },
  { icon: <BarChart2 className="w-4 h-4" />, text: 'A breakdown of your skill strengths' },
  { icon: <Target className="w-4 h-4" />, text: 'Clear growth areas to focus on' },
  { icon: <Sparkles className="w-4 h-4" />, text: 'A personalized study plan' },
];

export const PreAssessmentIntroView: React.FC<PreAssessmentIntroViewProps> = ({
  onStartAssessment,
  onBack,
}) => {
  return (
    <FadeTransition className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col items-center transition-colors duration-300">
      {/* Dynamic Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/50 dark:bg-blue-900/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-50 dark:bg-blue-900/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="w-full max-w-4xl px-6 py-12 md:py-20 relative z-10"
      >
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Column: Value Prop */}
          <motion.div variants={staggerItem} className="space-y-8">
            <div>
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] mb-8 shadow-premium"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Phase 02: Proficiency Scan
              </motion.div>
              <h1 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-slate-50 tracking-tight leading-[1.1] mb-6">
                Let's architect your <span className="text-blue-600 dark:text-blue-400">perfect path.</span>
              </h1>
              <p className="text-lg text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-lg">
                Your profile is set! Now, we need 8 minutes of your time to map your current English mastery across all core skills.
              </p>
            </div>

            <div className="space-y-5">
               {outcomes.map((outcome, i) => (
                <div key={i} className="flex items-center gap-5 group">
                  <div className="w-12 h-12 bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-gray-800 shadow-premium group-hover:scale-110 transition-all duration-300">
                    {outcome.icon}
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 font-black text-sm uppercase tracking-tight">{outcome.text}</p>
                </div>
              ))}
            </div>

            {/* CTA Tablet/Desktop */}
            <div className="hidden lg:flex flex-col gap-5 pt-8">
              <button
                onClick={onStartAssessment}
                className="group relative w-full max-w-sm bg-blue-600 hover:bg-blue-700 text-white font-black py-6 px-10 rounded-2xl transition-all shadow-premium hover:scale-105 active:scale-95 flex items-center justify-center gap-4 text-xl overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                Initialize Scan
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>
              {onBack && (
                <button onClick={onBack} className="text-slate-400 hover:text-blue-600 dark:text-blue-400 font-bold text-sm transition-colors text-left pl-2">
                  ← Back to goals
                </button>
              )}
            </div>
          </motion.div>

          {/* Right Column: Interactive Card */}
          <motion.div variants={staggerItem} className="relative">
            <div className="absolute -inset-6 bg-blue-500/5 dark:bg-indigo-500/10 rounded-[4rem] blur-3xl" />
            <div className="bg-white dark:bg-gray-900 rounded-[3rem] p-10 md:p-12 shadow-premium dark:shadow-md border border-slate-200 dark:border-gray-800 relative z-10 transition-all duration-300">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-10">Linguistic Analysis Spectrum</h3>
              
              <div className="grid gap-4">
                {assessedSkills.map((skill, idx) => (
                  <motion.div 
                    key={skill.label}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + (idx * 0.1) }}
                    className="flex items-center gap-6 p-6 rounded-[2rem] bg-white dark:bg-white/5 border border-slate-200 dark:border-gray-800 transition-all group shadow-sm hover:shadow-premium"
                  >
                    <div className="w-16 h-16 bg-slate-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 border border-slate-100 dark:border-gray-700 shadow-sm group-hover:scale-105 transition-all">
                      {React.cloneElement(skill.icon as React.ReactElement, { size: 24 })}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 dark:text-slate-100 leading-tight uppercase text-sm tracking-tight">{skill.label}</h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest mt-1">{skill.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-10 p-5 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-4">
                <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 font-semibold leading-relaxed">
                  <span className="font-black">No Pressure Policy:</span> This is not an exam. There are no grades—just a blueprint for your success.
                </p>
              </div>
            </div>

            {/* CTA Mobile only */}
            <div className="lg:hidden mt-8 space-y-4">
              <button
                onClick={onStartAssessment}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-6 px-8 rounded-2xl transition-all shadow-premium flex items-center justify-center gap-3 text-lg"
              >
                Initialize Scan
                <ArrowRight className="w-5 h-5" />
              </button>
              {onBack && (
                <button onClick={onBack} className="w-full text-slate-400 font-bold text-sm">
                  ← Back to goals
                </button>
              )}
            </div>
          </motion.div>
          
        </div>

        {/* Floating Stat badges */}
        <div className="hidden lg:block absolute bottom-12 right-0 left-0 pointer-events-none">
           <div className="flex justify-center gap-24">
              {[
                { label: 'Time estimate', value: '8-10 Mins', icon: <Clock className="w-4 h-4" /> },
                { label: 'CEFR Standard', value: 'A1 - C2', icon: <Award className="w-4 h-4" /> },
                { label: 'AI Powered', value: 'Real-time', icon: <Zap className="w-4 h-4" /> }
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-4 text-slate-400">
                   <div className="p-3 bg-white dark:bg-gray-900 rounded-xl shadow-premium border border-slate-200 dark:border-gray-800">{stat.icon}</div>
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 dark:text-slate-600 leading-none mb-1">{stat.label}</p>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-tight">{stat.value}</p>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </motion.div>
    </FadeTransition>
  );
};
