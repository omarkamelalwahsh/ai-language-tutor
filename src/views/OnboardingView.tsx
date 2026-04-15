import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target, Flag, Zap, Award, ChevronRight, BookOpen, 
  CheckCircle2, Coffee, Clock, Flame, Heart, Globe,
  Mic, PenTool, Headphones
} from 'lucide-react';
import { OnboardingState } from '../types/app';
import { DB_SCHEMA } from '../constants/dbSchema';
import { TOPIC_DEFINITIONS, TopicId, getSortedTopicsForGoal, GoalId } from '../data/topics';

const goalContextConfigs: Record<string, {
  question: string;
  options: string[];
}> = {
  casual: {
    question: "What event or situation are you preparing for?",
    options: ["Travel", "Socializing", "Relocation", "Personal Interest", "Games", "Movies & Music"],
  },
  serious: {
    question: "What is your primary field of study?",
    options: ["Medicine", "Engineering", "Business", "CS & IT", "Arts", "Natural Sciences"],
  },
  professional: {
    question: "Which industry do you work in?",
    options: ["IT & Software", "Finance", "Healthcare", "Marketing", "Management", "Design"],
  }
};

interface OnboardingViewProps {
  onComplete: (state: OnboardingState) => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [state, setState] = useState<OnboardingState>({
    goal: 'serious',
    nativeLanguage: 'English',
    targetLanguage: 'English',
    focusSkills: [],
    topics: [],
    sessionIntensity: 'regular',
    goalContext: '',
  });

  const totalSteps = 3;

  const handleNext = async () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      setIsSaving(true);
      const userId = localStorage.getItem('auth_user_id');
      
      try {
        if (userId) {
          const { supabase } = await import('../lib/supabaseClient');
          await supabase
            .from(DB_SCHEMA.TABLES.PROFILES)
            .upsert({ 
               id: userId,
               [DB_SCHEMA.COLUMNS.LEVEL]: 'Pending', 
               [DB_SCHEMA.COLUMNS.ONBOARDING]: true,
               learning_goal: state.goal,
               goal_context: state.goalContext,
               focus_skills: state.focusSkills,
               learning_topics: state.topics,
               session_intensity: state.sessionIntensity,
               native_language: state.nativeLanguage,
               target_language: state.targetLanguage,
               updated_at: new Date().toISOString()
            });
        }
      } catch (err) {
        console.warn("[OnboardingView] Profile upsert failed (non-blocking):", err);
      } finally {
        setIsSaving(false);
        onComplete(state);
      }
    }
  };

  const steps = [
    { id: 1, title: "Your Vision", icon: <Target size={20} /> },
    { id: 2, title: "Language Context", icon: <Flag size={20} /> },
    { id: 3, title: "Skill Focus", icon: <Zap size={20} /> }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 scroll-smooth">
      {/* 1. Progress Indicator */}
      <div className="max-w-md w-full mb-12 flex justify-between relative mt-4">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -z-10 transform -translate-y-1/2" />
        {steps.map((s) => (
          <div key={s.id} className="flex flex-col items-center gap-2">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 shadow-sm ${
              step >= s.id ? 'bg-white border-indigo-600 text-indigo-600' : 'bg-slate-100 border-slate-200 text-slate-400'
            }`}>
              {s.icon}
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${step >= s.id ? 'text-indigo-600' : 'text-slate-400'}`}>
              {s.title}
            </span>
          </div>
        ))}
      </div>

      {/* 2. Main Card */}
      <div className="max-w-xl w-full bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col min-h-[600px] relative overflow-hidden">
        
        <AnimatePresence mode="wait">
          {/* PHASE 1: VISION */}
          {step === 1 && (
            <motion.section 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 flex-1 flex flex-col"
            >
              <header>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">What brings you here?</h2>
                <p className="text-slate-500 font-medium mt-1">We'll tailor your path based on your primary goal.</p>
              </header>
              
              <div className="grid gap-4">
                {[
                  { id: 'casual', label: 'Casual Learning', desc: 'Travel, hobbies, and meeting people.', icon: <BookOpen size={22}/> },
                  { id: 'professional', label: 'Career Growth', desc: 'Workplace communication & networking.', icon: <Award size={22}/> },
                  { id: 'serious', label: 'Full Mastery', desc: 'Academic and deep technical fluency.', icon: <Target size={22}/> }
                ].map((goal) => (
                  <button 
                    key={goal.id}
                    onClick={() => setState({...state, goal: goal.id as any})}
                    className={`flex items-center gap-5 p-5 rounded-2xl border-2 text-left transition-all ${
                      state.goal === goal.id ? 'border-indigo-600 bg-indigo-50/30 ring-4 ring-indigo-50 shadow-inner' : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-4 rounded-2xl border transition-all ${state.goal === goal.id ? 'bg-white border-indigo-200 text-indigo-600 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                      {goal.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-black text-slate-800 text-lg leading-tight">{goal.label}</h3>
                      <p className="text-xs text-slate-500 font-medium">{goal.desc}</p>
                    </div>
                    {state.goal === goal.id && <CheckCircle2 size={24} className="text-indigo-600" />}
                  </button>
                ))}
              </div>

              {state.goal && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">
                      {goalContextConfigs[state.goal].question}
                   </label>
                   <select 
                      value={state.goalContext || ''}
                      onChange={(e) => setState({...state, goalContext: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl text-slate-800 font-bold focus:outline-none focus:border-indigo-500 transition-colors"
                   >
                     <option value="" disabled>Select your context...</option>
                     {goalContextConfigs[state.goal].options.map(o => <option key={o} value={o}>{o}</option>)}
                   </select>
                </motion.div>
              )}
            </motion.section>
          )}

          {/* PHASE 2: CONTEXT & INTERESTS */}
          {step === 2 && (
            <motion.section 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 flex-1 flex flex-col"
            >
              <header>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Language & Interests</h2>
                <p className="text-slate-500 font-medium mt-1">Tell us about your context and what excites you.</p>
              </header>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">I Speak</label>
                    <div className="p-4 bg-slate-50 rounded-xl border-2 border-slate-100 font-black text-slate-800 flex items-center gap-3">
                       <Globe size={18} className="text-blue-500" /> Arabic
                    </div>
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Learning</label>
                    <div className="p-4 bg-indigo-50/50 rounded-xl border-2 border-indigo-100 font-black text-indigo-600 flex items-center gap-3">
                       <Award size={18} className="text-indigo-600" /> English
                    </div>
                 </div>
              </div>

              <div>
                 <div className="flex justify-between items-center mb-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Preferred Topics</label>
                    <span className="text-[10px] font-bold text-indigo-500">Pick any 3+</span>
                 </div>
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[250px] overflow-y-auto pr-1 no-scrollbar">
                    {(() => {
                      const { recommended, other } = getSortedTopicsForGoal(state.goal as GoalId);
                      return [...recommended, ...other].map(topic => {
                        const isSelected = state.topics.includes(topic.id);
                        return (
                          <button
                            key={topic.id}
                            onClick={() => {
                              const newTopics = isSelected 
                                ? state.topics.filter(id => id !== topic.id)
                                : [...state.topics, topic.id];
                              setState({...state, topics: newTopics as TopicId[]});
                            }}
                            className={`p-3 rounded-2xl border-2 text-left transition-all ${
                              isSelected ? 'bg-indigo-600 border-indigo-600 shadow-md shadow-indigo-100' : 'bg-white border-slate-100 hover:border-indigo-200'
                            }`}
                          >
                             <span className="text-lg block mb-1">{topic.emoji}</span>
                             <span className={`text-[10px] font-black leading-tight block ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                               {topic.label}
                             </span>
                          </button>
                        )
                      })
                    })()}
                 </div>
              </div>
            </motion.section>
          )}

          {/* PHASE 3: STRATEGY & PACE */}
          {step === 3 && (
            <motion.section 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 flex-1 flex flex-col"
            >
              <header>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Focus & Pace</h2>
                <p className="text-slate-500 font-medium mt-1">How should we structure your training?</p>
              </header>

              <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-4 block">Focus Skills</label>
                 <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'speaking', label: 'Speaking', icon: <Mic size={20}/> },
                      { id: 'writing', label: 'Writing', icon: <PenTool size={20}/> },
                      { id: 'listening', label: 'Listening', icon: <Headphones size={20}/> },
                      { id: 'vocabulary', label: 'Vocabulary', icon: <BookOpen size={20}/> }
                    ].map(s => {
                      const isSelected = state.focusSkills.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            const newSkills = isSelected 
                              ? state.focusSkills.filter(id => id !== s.id)
                              : [...state.focusSkills, s.id];
                            setState({...state, focusSkills: newSkills});
                          }}
                          className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                            isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-indigo-200'
                          }`}
                        >
                           <div className={`p-2 rounded-xl ${isSelected ? 'bg-slate-800' : 'bg-white shadow-sm'}`}>{s.icon}</div>
                           <span className="text-xs font-black uppercase tracking-wider">{s.label}</span>
                        </button>
                      )
                    })}
                 </div>
              </div>

              <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-4 block">Session Intensity</label>
                 <div className="space-y-3">
                    {[
                      { id: 'light', label: 'Casual Pace', icon: <Coffee size={18}/>, meta: '2-3 sessions/week' },
                      { id: 'regular', label: 'Serious Growth', icon: <Clock size={18}/>, meta: 'Daily 15-min focus' },
                      { id: 'intensive', label: 'Professional Mastery', icon: <Flame size={18}/>, meta: 'Deep full immersion' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setState({...state, sessionIntensity: opt.id as any})}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                          state.sessionIntensity === opt.id ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-50' : 'bg-white border-slate-100'
                        }`}
                      >
                         <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${state.sessionIntensity === opt.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                               {opt.icon}
                            </div>
                            <div className="text-left">
                               <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{opt.label}</p>
                               <p className="text-[10px] text-slate-400 font-bold">{opt.meta}</p>
                            </div>
                         </div>
                         {state.sessionIntensity === opt.id && <CheckCircle2 size={18} className="text-indigo-600" />}
                      </button>
                    ))}
                 </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* 3. Footer Bar */}
        <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-center">
           <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Architecture Step</span>
              <span className="text-sm font-black text-indigo-600">{step} <span className="text-slate-200">/</span> {totalSteps}</span>
           </div>

           <div className="flex items-center gap-3">
              {step > 1 && (
                <button 
                  onClick={() => setStep(step - 1)}
                  className="px-6 py-3 rounded-xl text-xs font-black text-slate-400 hover:text-slate-600 transition"
                >
                  Back
                </button>
              )}
              <button 
                onClick={handleNext}
                disabled={isSaving || (step === 1 && !state.goalContext) || (step === 2 && state.topics.length < 3) || (step === 3 && state.focusSkills.length === 0)}
                className="flex items-center gap-3 bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200 hover:shadow-indigo-200/50 disabled:opacity-30 disabled:grayscale"
              >
                {isSaving ? 'Saving...' : step === 3 ? 'Complete Setup' : 'Continue'} <ChevronRight size={16}/>
              </button>
           </div>
        </div>
      </div>

      <p className="mt-8 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] opacity-50">
        Enterprise AI Personalization Engine v2.0
      </p>
    </div>
  );
};
