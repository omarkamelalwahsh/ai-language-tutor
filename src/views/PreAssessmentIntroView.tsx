import React from 'react';
import { motion } from 'motion/react';
import {
  Mic, PenTool, Headphones, BookOpen, ChevronRight,
  CheckCircle2, Clock, Award, BarChart2, Target, Sparkles, Shield
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
  { icon: <Sparkles className="w-4 h-4" />, text: 'A personalized learning plan' },
];

export const PreAssessmentIntroView: React.FC<PreAssessmentIntroViewProps> = ({
  onStartAssessment,
  onBack,
}) => {
  return (
    <FadeTransition className="min-h-screen bg-slate-50 flex flex-col items-center pt-12 px-4 pb-12">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="w-full max-w-2xl"
      >
        {/* Header */}
        <motion.div variants={staggerItem} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-5 border border-indigo-100">
            <Clock className="w-3.5 h-3.5" />
            About 5–10 minutes
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4 leading-tight">
            Before we begin, let's find<br />your starting level
          </h1>
          <p className="text-lg text-slate-500 max-w-lg mx-auto leading-relaxed">
            This short pre-assessment helps us understand your current English level so we can build the right learning path for you.
          </p>
        </motion.div>

        {/* Main Card */}
        <motion.div
          variants={staggerItem}
          className="bg-white rounded-[2rem] p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] border border-slate-100 mb-6"
        >
          {/* What we'll assess */}
          <div className="mb-8">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
              What we'll check
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {assessedSkills.map((skill) => (
                <div
                  key={skill.label}
                  className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100"
                >
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 flex-shrink-0">
                    {skill.icon}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{skill.label}</p>
                    <p className="text-xs text-slate-400">{skill.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-100 mb-8" />

          {/* What you'll get */}
          <div className="mb-8">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
              What you'll get after
            </h2>
            <div className="space-y-3">
              {outcomes.map((outcome, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center border border-emerald-100 flex-shrink-0">
                    {outcome.icon}
                  </div>
                  <p className="text-sm font-medium text-slate-700">{outcome.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-100 mb-8" />

          {/* Reassurance */}
          <div className="flex items-start gap-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
            <Shield className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-indigo-900 mb-0.5">This is not an exam</p>
              <p className="text-xs text-indigo-700/70 leading-relaxed">
                There are no grades and no pressure. Just answer naturally — your honest responses help us place you accurately and create a better plan.
              </p>
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div variants={staggerItem} className="flex flex-col gap-3">
          <button
            onClick={onStartAssessment}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-[0_8px_20px_rgba(79,70,229,0.25)] active:scale-[0.98] flex items-center justify-center gap-2 text-lg"
          >
            Start Pre-Assessment
            <ChevronRight className="w-5 h-5" />
          </button>

          {onBack && (
            <button
              onClick={onBack}
              className="w-full text-slate-400 hover:text-slate-600 font-medium py-3 text-sm transition-colors"
            >
              ← Back to preferences
            </button>
          )}
        </motion.div>

        {/* Footer note */}
        <motion.p variants={staggerItem} className="text-center text-xs text-slate-400 mt-6">
          You can retake this assessment later to track your improvement.
        </motion.p>
      </motion.div>
    </FadeTransition>
  );
};
