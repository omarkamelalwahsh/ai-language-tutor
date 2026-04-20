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
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-50 dark:bg-blue-900/30 rounded-full blur-[120px] opacity-60" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-50 rounded-full blur-[120px] opacity-60" />
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
                className="inline-flex items-center gap-2 bg-blue-600 dark:bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6 shadow-lg shadow-indigo-200"
              >
                <Sparkles className="w-3 h-3" />
                Stage 2: Proficiency Scan
              </motion.div>
              <h1 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-slate-50 tracking-tight leading-[1.1] mb-6">
                Let's architect your <span className="text-blue-600 dark:text-blue-400">perfect path.</span>
              </h1>
              <p className="text-lg text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-lg">
                Your profile is set! Now, we need 8 minutes of your time to map your current English mastery across all core skills.
              </p>
            </div>

            <div className="space-y-4">
               {outcomes.map((outcome, i) => (
                <div key={i} className="flex items-center gap-4 group">
                  <div className="w-12 h-12 bg-slate-50 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:scale-110 transition-transform shadow-sm">
                    {outcome.icon}
                  </div>
                  <p className="text-slate-700 font-bold">{outcome.text}</p>
                </div>
              ))}
            </div>

            {/* CTA Tablet/Desktop */}
            <div className="hidden lg:flex flex-col gap-4 pt-4">
              <button
                onClick={onStartAssessment}
                className="group relative w-full max-w-sm bg-blue-600 dark:bg-blue-600 hover:bg-indigo-700 text-white font-black py-5 px-8 rounded-2xl transition-all shadow-[0_20px_40px_rgba(79,70,229,0.3)] hover:shadow-[0_25px_50px_rgba(79,70,229,0.4)] active:scale-[0.98] flex items-center justify-center gap-3 text-xl overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                Start Diagnostic
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
            <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 rounded-[3rem] blur-2xl" />
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 md:p-10 shadow-sm dark:shadow-md shadow-slate-200/50 border border-slate-200 dark:border-gray-800 relative">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8">What we'll analyze</h3>
              
              <div className="grid gap-4">
                {assessedSkills.map((skill, idx) => (
                  <motion.div 
                    key={skill.label}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + (idx * 0.1) }}
                    className="flex items-center gap-5 p-5 rounded-3xl bg-white dark:bg-gray-900-hover border border-slate-200 dark:border-gray-800 transition-all group"
                  >
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 border border-slate-100 shadow-sm group-hover:shadow-md transition-all">
                      {skill.icon}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 leading-tight">{skill.label}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{skill.desc}</p>
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
                className="w-full bg-blue-600 dark:bg-blue-600 hover:bg-indigo-700 text-white font-black py-5 px-8 rounded-2xl transition-all shadow-sm dark:shadow-md shadow-indigo-100 flex items-center justify-center gap-3 text-lg"
              >
                Start Diagnostic
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
        <div className="hidden lg:block absolute bottom-10 right-0 left-0 pointer-events-none">
           <div className="flex justify-center gap-20">
              {[
                { label: 'Time estimate', value: '8-10 Mins', icon: <Clock className="w-4 h-4" /> },
                { label: 'CEFR Standard', value: 'A1 - C2', icon: <Award className="w-4 h-4" /> },
                { label: 'AI Powered', value: 'Real-time', icon: <Zap className="w-4 h-4" /> }
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-3 text-slate-400 opacity-60">
                   <div className="p-2 bg-slate-100 rounded-lg">{stat.icon}</div>
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-widest">{stat.label}</p>
                      <p className="text-xs font-bold text-slate-800">{stat.value}</p>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </motion.div>
    </FadeTransition>
  );
};
