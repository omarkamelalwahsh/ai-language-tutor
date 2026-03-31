import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic, PenTool, Headphones, BookOpen, ChevronRight,
  Coffee, Briefcase, GraduationCap, CheckCircle2, Clock, Flame, Heart
} from 'lucide-react';
import { FadeTransition, staggerContainer, staggerItem } from '../lib/animations';
import { OnboardingState } from '../types/app';
import { TOPIC_DEFINITIONS, TopicId, getSortedTopicsForGoal, GoalId } from '../data/topics';
import { GoalFollowUpModal } from '../components/onboarding/GoalFollowUpModal';

interface OnboardingViewProps {
  onComplete: (state: OnboardingState) => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<OnboardingState>({
    goal: null,
    nativeLanguage: 'English',
    targetLanguage: 'English',
    focusSkills: [],
    topics: [],
    sessionIntensity: null,
    goalContext: null,
  });
  const [pendingGoal, setPendingGoal] = useState<string | null>(null);
  const totalOnboardingSteps = 5;

  const handleNext = () => {
    if (step < totalOnboardingSteps) {
      setStep(step + 1);
    } else {
      onComplete(state);
    }
  };

  const goals = [
    { id: 'casual', label: 'Casual', icon: <Coffee className="w-6 h-6" />, desc: 'For fun, travel, or personal curiosity' },
    { id: 'serious', label: 'Serious', icon: <GraduationCap className="w-6 h-6" />, desc: 'Academic study or personal growth' },
    { id: 'professional', label: 'Professional', icon: <Briefcase className="w-6 h-6" />, desc: 'Business, career, and workplace fluency' },
  ] as const;

  const skills = [
    { id: 'speaking', label: 'Speaking', icon: <Mic className="w-5 h-5" />, desc: 'Conversation & pronunciation' },
    { id: 'writing', label: 'Writing', icon: <PenTool className="w-5 h-5" />, desc: 'Grammar, clarity & structure' },
    { id: 'listening', label: 'Listening', icon: <Headphones className="w-5 h-5" />, desc: 'Comprehension & detail' },
    { id: 'vocabulary', label: 'Vocabulary', icon: <BookOpen className="w-5 h-5" />, desc: 'Word recall & contextual use' },
  ];

  const intensityOptions = [
    { id: 'light', label: 'Light', icon: <Coffee className="w-5 h-5" />, desc: '2–3 sessions per week, ~10 min each', subtext: 'Best for casual pace' },
    { id: 'regular', label: 'Regular', icon: <Clock className="w-5 h-5" />, desc: '4–5 sessions per week, ~15 min each', subtext: 'Recommended for steady growth' },
    { id: 'intensive', label: 'Intensive', icon: <Flame className="w-5 h-5" />, desc: 'Daily sessions, ~20 min each', subtext: 'Fast-track to next level' },
  ] as const;

  const stepLabels = ['Goal', 'Languages', 'Skills', 'Topics', 'Intensity'];

  return (
    <FadeTransition className="min-h-screen bg-slate-50 flex flex-col items-center pt-16 px-4 pb-12 relative">
      <div className="w-full max-w-2xl flex flex-col h-full mt-4">
        {/* Progress Indicator with Step Labels */}
        <div className="mb-8">
          <div className="flex justify-between text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest">
            <span>{stepLabels[step - 1]}</span>
            <span>Step {step} of {totalOnboardingSteps}</span>
          </div>
          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner">
            <motion.div
              className="h-full bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.4)]"
              initial={{ width: 0 }}
              animate={{ width: `${(step / totalOnboardingSteps) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          {/* Step dots */}
          <div className="flex justify-between mt-3 px-1">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <div className={`w-2.5 h-2.5 rounded-full transition-colors ${i < step ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                <span className={`text-[10px] font-bold uppercase tracking-widest ${i < step ? 'text-indigo-600' : 'text-slate-300'}`}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] border border-slate-100 flex-1 min-h-[500px] flex flex-col relative overflow-hidden">
          <AnimatePresence mode="wait">

            {/* Step 1: Goal */}
            {step === 1 && (
              <motion.div key="s1" variants={staggerContainer} initial="hidden" animate="show" exit="hidden" className="flex flex-col h-full">
                <motion.h2 variants={staggerItem} className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">What's your primary goal?</motion.h2>
                <motion.p variants={staggerItem} className="text-slate-500 mb-8">This helps us tailor the difficulty, vocabulary, and pacing of your sessions.</motion.p>
                
                <motion.div variants={staggerItem} className="grid sm:grid-cols-3 gap-4 mb-auto">
                  {goals.map(g => (
                    <button
                      key={g.id}
                      onClick={() => setPendingGoal(g.id)}
                      className={`p-6 rounded-2xl border-2 text-left transition-all ${state.goal === g.id ? 'border-indigo-600 bg-indigo-50 shadow-md shadow-indigo-100' : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50'}`}
                    >
                      <div className={`mb-4 w-12 h-12 rounded-full flex items-center justify-center ${state.goal === g.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-100 text-slate-500'}`}>
                        {g.icon}
                      </div>
                      <h3 className={`font-bold mb-1 ${state.goal === g.id ? 'text-indigo-900' : 'text-slate-700'}`}>{g.label}</h3>
                      <p className={`text-xs ${state.goal === g.id ? 'text-indigo-700/80' : 'text-slate-400'}`}>{g.desc}</p>
                    </button>
                  ))}
                </motion.div>
                
                <motion.button variants={staggerItem} disabled={!state.goal} onClick={handleNext} className="mt-8 w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2">
                  Continue <ChevronRight className="w-5 h-5" />
                </motion.button>
              </motion.div>
            )}

            {/* Step 2: Language Selection */}
            {step === 2 && (
              <motion.div key="s2" variants={staggerContainer} initial="hidden" animate="show" exit="hidden" className="flex flex-col h-full">
                <motion.h2 variants={staggerItem} className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Language Selection</motion.h2>
                <motion.p variants={staggerItem} className="text-slate-500 mb-8">Confirm your language selection for the tutoring sessions.</motion.p>
                
                <motion.div variants={staggerItem} className="space-y-6 mb-auto">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-2 block">I speak</label>
                    <div
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                    >
                      English
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-2 block">I want to learn</label>
                    <div
                      className="w-full p-4 bg-white border border-indigo-200 shadow-sm shadow-indigo-100/50 rounded-xl text-slate-900 font-bold text-lg"
                    >
                      English
                    </div>
                  </div>
                </motion.div>
                
                <motion.button variants={staggerItem} onClick={handleNext} className="mt-8 w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2">
                  Continue <ChevronRight className="w-5 h-5" />
                </motion.button>
              </motion.div>
            )}

            {/* Step 3: Focus Skills */}
            {step === 3 && (
              <motion.div key="s3" variants={staggerContainer} initial="hidden" animate="show" exit="hidden" className="flex flex-col h-full">
                <motion.h2 variants={staggerItem} className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Focus Skills</motion.h2>
                <motion.p variants={staggerItem} className="text-slate-500 mb-8">Select the areas you want to prioritize. We'll weight your assessment and learning plan accordingly.</motion.p>
                
                <motion.div variants={staggerItem} className="grid grid-cols-2 gap-4 mb-auto">
                  {skills.map(s => {
                    const isSelected = state.focusSkills.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          const newSkills = isSelected 
                            ? state.focusSkills.filter(id => id !== s.id)
                            : [...state.focusSkills, s.id];
                          setState({ ...state, focusSkills: newSkills });
                        }}
                        className={`p-5 rounded-2xl flex flex-col items-center justify-center gap-2 border-2 transition-all relative ${isSelected ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:border-indigo-200'}`}
                      >
                        <div className={`${isSelected ? 'text-indigo-600' : 'text-slate-400'}`}>
                          {s.icon}
                        </div>
                        <span className={`font-semibold ${isSelected ? 'text-indigo-900' : 'text-slate-600'}`}>{s.label}</span>
                        <span className={`text-[11px] ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`}>{s.desc}</span>
                        {isSelected && <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-indigo-600" />}
                      </button>
                    )
                  })}
                </motion.div>
                
                <motion.button variants={staggerItem} disabled={state.focusSkills.length === 0} onClick={handleNext} className="mt-8 w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2">
                  Continue <ChevronRight className="w-5 h-5" />
                </motion.button>
              </motion.div>
            )}

            {/* Step 4: Topics / Interests */}
            {step === 4 && (
              <motion.div key="s4" variants={staggerContainer} initial="hidden" animate="show" exit="hidden" className="flex flex-col h-full">
                <motion.h2 variants={staggerItem} className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">What topics interest you most?</motion.h2>
                <motion.p variants={staggerItem} className="text-slate-500 mb-2">
                  {state.goal ? `Based on your ${state.goal} goal, we've recommended relevant topics.` : "Choose the subjects you'd like to practice in your lessons."}
                </motion.p>
                <motion.p variants={staggerItem} className="text-xs text-slate-400 font-medium mb-6 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-indigo-400" /> Select at least one. You can mix any topics you like.
                </motion.p>
                
                <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-auto pb-4">
                  {(() => {
                    const { recommended, other } = getSortedTopicsForGoal(state.goal as GoalId | null);
                    return [...recommended, ...other].map(topic => {
                      const isSelected = state.topics.includes(topic.id);
                      const isRecommended = recommended.some(r => r.id === topic.id);
                      
                      return (
                        <button
                          key={topic.id}
                          onClick={() => {
                            const newTopics: TopicId[] = isSelected 
                              ? state.topics.filter(id => id !== topic.id)
                              : [...state.topics, topic.id];
                            setState({ ...state, topics: newTopics });
                          }}
                          className={`p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden ${
                            isSelected 
                              ? 'border-indigo-600 bg-indigo-50 shadow-sm shadow-indigo-100' 
                              : isRecommended 
                                ? 'border-amber-200 bg-amber-50/30 hover:border-indigo-300 hover:bg-white' 
                                : 'border-slate-100 bg-slate-50 hover:border-indigo-200 hover:bg-white'
                          }`}
                        >
                          {isRecommended && !isSelected && (
                            <span className="absolute top-0 right-0 bg-amber-100 text-amber-800 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-bl-lg">
                              Rec
                            </span>
                          )}
                          <span className="text-xl mb-2 block relative z-10">{topic.emoji}</span>
                          <span className={`font-semibold text-sm block relative z-10 ${
                            isSelected ? 'text-indigo-900' : isRecommended ? 'text-amber-900' : 'text-slate-700'
                          }`}>{topic.label}</span>
                          <span className={`text-[10px] leading-tight block mt-0.5 relative z-10 ${
                            isSelected ? 'text-indigo-600/70' : isRecommended ? 'text-amber-700/70' : 'text-slate-400'
                          }`}>{topic.description}</span>
                          {isSelected && <CheckCircle2 className="absolute top-2.5 right-2.5 w-4 h-4 text-indigo-600 z-10" />}
                          
                          {isRecommended && (
                            <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 to-transparent pointer-events-none" />
                          )}
                        </button>
                      );
                    });
                  })()}
                </motion.div>
                
                <motion.button
                  variants={staggerItem}
                  disabled={state.topics.length === 0}
                  onClick={handleNext}
                  className="mt-8 w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  Continue <ChevronRight className="w-5 h-5" />
                </motion.button>
              </motion.div>
            )}

            {/* Step 5: Session Intensity */}
            {step === 5 && (
              <motion.div key="s4" variants={staggerContainer} initial="hidden" animate="show" exit="hidden" className="flex flex-col h-full">
                <motion.h2 variants={staggerItem} className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Session Intensity</motion.h2>
                <motion.p variants={staggerItem} className="text-slate-500 mb-8">How often do you want to practice? This shapes your session length and review schedule.</motion.p>
                
                <motion.div variants={staggerItem} className="space-y-4 mb-auto">
                  {intensityOptions.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setState({ ...state, sessionIntensity: opt.id })}
                      className={`w-full p-5 rounded-2xl border-2 text-left transition-all flex items-start gap-4 ${state.sessionIntensity === opt.id ? 'border-indigo-600 bg-indigo-50 shadow-md shadow-indigo-100' : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50'}`}
                    >
                      <div className={`mt-0.5 w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${state.sessionIntensity === opt.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {opt.icon}
                      </div>
                      <div>
                        <h3 className={`font-bold mb-0.5 ${state.sessionIntensity === opt.id ? 'text-indigo-900' : 'text-slate-700'}`}>{opt.label}</h3>
                        <p className={`text-sm ${state.sessionIntensity === opt.id ? 'text-indigo-700' : 'text-slate-500'}`}>{opt.desc}</p>
                        <p className={`text-xs mt-1 ${state.sessionIntensity === opt.id ? 'text-indigo-500' : 'text-slate-400'}`}>{opt.subtext}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
                
                <motion.button
                  variants={staggerItem}
                  disabled={!state.sessionIntensity}
                  onClick={handleNext}
                  className="mt-8 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 shadow-[0_8px_20px_rgba(79,70,229,0.25)] text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  Complete Setup <ChevronRight className="w-5 h-5" />
                </motion.button>
              </motion.div>
            )}

          </AnimatePresence>

          <AnimatePresence>
            {pendingGoal && (
              <GoalFollowUpModal 
                goalId={pendingGoal}
                onComplete={(context) => {
                  setState({ ...state, goal: pendingGoal as any, goalContext: context });
                  setPendingGoal(null);
                  setStep(2); // Automatically proceed after follow-up
                }}
                onClose={() => setPendingGoal(null)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </FadeTransition>
  );
};
