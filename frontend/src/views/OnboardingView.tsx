import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Target, Flag, Zap, Award, ChevronRight, ChevronLeft, BookOpen,
  CheckCircle2, Coffee, Clock, Flame, Globe,
  Mic, PenTool, Headphones, Eye, Check, BookMarked, X
} from 'lucide-react';
import { OnboardingState } from '../types/app';
import { DB_SCHEMA } from '../constants/dbSchema';
import { TOPIC_DEFINITIONS, TopicId, getSortedTopicsForGoal, GoalId } from '../data/topics';
import ThemeToggle from '../components/ThemeToggle';

const SUPPORTED_LANGUAGES = ['Arabic', 'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese'];

const goalContextConfigs: Record<string, { question: string; options: string[] }> = {
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

const goalLabels: Record<string, string> = {
  casual: 'Casual Learning',
  serious: 'Full Mastery',
  professional: 'Career Growth',
};

const paceLabels: Record<string, string> = {
  light: 'Casual Pace',
  regular: 'Serious Growth',
  intensive: 'Professional Mastery',
};

interface OnboardingViewProps {
  onComplete: (state: OnboardingState) => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [showSummary, setShowSummary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [state, setState] = useState<OnboardingState>({
    goal: '' as GoalId,
    nativeLanguage: 'English',
    targetLanguage: 'English',
    focusSkills: [],
    topics: [],
    sessionIntensity: 'regular',
    goalContext: '',
  });

  const totalSteps = 3;

  const canProceed = () => {
    if (step === 1) return !!state.goal && !!state.goalContext;
    if (step === 2) return state.topics.length >= 3;
    if (step === 3) return state.focusSkills.length > 0;
    return true;
  };

  const validationMessage = () => {
    if (step === 1 && !state.goal) return 'Please select a learning goal to continue.';
    if (step === 1 && !state.goalContext) return 'Please select your context to continue.';
    if (step === 2 && state.topics.length < 3) return `Please select at least ${3 - state.topics.length} more topic${3 - state.topics.length > 1 ? 's' : ''} to continue.`;
    if (step === 3 && state.focusSkills.length === 0) return 'Please choose at least one skill to continue.';
    return null;
  };

  const handleNext = async () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else if (!showSummary) {
      setShowSummary(true);
    } else {
      setIsSaving(true);
      const userId = localStorage.getItem('auth_user_id');
      try {
        if (userId) {
          const { supabase } = await import('../lib/supabaseClient');
          const { error } = await supabase.from(DB_SCHEMA.TABLES.PROFILES).upsert({
            id: userId,
            [DB_SCHEMA.COLUMNS.LEVEL]: 'Pending',
            learning_goal: state.goal,
            goal_context: state.goalContext,
            focus_skills: state.focusSkills,
            learning_topics: state.topics,
            session_intensity: state.sessionIntensity,
            native_language: state.nativeLanguage,
            target_language: state.targetLanguage,
            updated_at: new Date().toISOString()
          });
          
          if (error) {
            console.error("[OnboardingView] Upsert error:", error);
          }
        }
      } catch (err) {
        console.warn("[OnboardingView] Profile upsert failed (non-blocking):", err);
      } finally {
        setIsSaving(false);
        // Small delay to ensure state updates propagate before navigation
        setTimeout(() => onComplete(state), 100);
      }
    }
  };

  const steps = [
    { id: 1, title: "Your Vision", icon: <Target size={20} /> },
    { id: 2, title: "Language Context", icon: <Flag size={20} /> },
    { id: 3, title: "Skill Focus", icon: <Zap size={20} /> }
  ];

  const skills = [
    { id: 'speaking', label: 'Speaking', icon: <Mic size={20} /> },
    { id: 'writing', label: 'Writing', icon: <PenTool size={20} /> },
    { id: 'listening', label: 'Listening', icon: <Headphones size={20} /> },
    { id: 'reading', label: 'Reading', icon: <Eye size={20} /> },
  ];

  const paceOptions = [
    { id: 'light', label: 'Casual Pace', subtitle: '10 minutes/day', icon: <Coffee size={18} /> },
    { id: 'regular', label: 'Serious Growth', subtitle: '20 minutes/day', icon: <Clock size={18} /> },
    { id: 'intensive', label: 'Professional Mastery', subtitle: '30 minutes/day', icon: <Flame size={18} /> },
  ];

  const ctaLabel = isSaving
    ? 'Saving...'
    : showSummary
    ? 'Start Assessment'
    : step === totalSteps
    ? 'Review My Plan'
    : 'Build My Plan';

  const validation = validationMessage();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-slate-50 flex flex-col items-center py-12 px-4 transition-colors duration-300 relative">
      
      {/* Exit Button */}
      <button 
        onClick={async () => {
          const { supabase } = await import('../lib/supabaseClient');
          await supabase.auth.signOut();
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = '/auth';
        }}
        className="fixed top-6 left-6 flex items-center gap-2 text-slate-400 hover:text-rose-500 transition-colors font-black uppercase tracking-widest text-[10px] bg-white dark:bg-white/5 px-4 py-2 rounded-xl border border-slate-200 dark:border-transparent shadow-sm z-50"
      >
        <X size={14} /> Exit & Logout
      </button>

      {/* Theme Toggle */}
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Progress Stepper */}
      <div className="max-w-md w-full mb-12 flex justify-between relative mt-4">
        <div className="absolute top-6 left-0 w-full h-[1px] bg-slate-200 dark:bg-gray-800 -z-10" />
        {steps.map((s) => {
          const isCompleted = step > s.id;
          const isActive = step === s.id && !showSummary;
          const isClickable = isCompleted;
          return (
            <div key={s.id} className="flex flex-col items-center gap-3">
              <button
                onClick={() => isClickable ? (setStep(s.id), setShowSummary(false)) : undefined}
                disabled={!isClickable}
                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 shadow-sm
                  ${isActive || isCompleted
                    ? 'bg-white dark:bg-gray-900 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                    : 'bg-slate-50 dark:bg-gray-800 border-slate-200 dark:border-gray-800 text-slate-300 dark:text-slate-600'}
                  ${isClickable ? 'cursor-pointer hover:scale-110 hover:shadow-md' : 'cursor-default'}`}
              >
                {isCompleted ? <Check size={18} className="text-blue-600 dark:text-blue-400" /> : s.icon}
              </button>
              <span className={`text-[10px] font-black uppercase tracking-widest ${isActive || isCompleted ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                {s.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* Main Card */}
      <div className="max-w-xl w-full bg-white dark:bg-gray-900 rounded-[3rem] p-6 md:p-14 shadow-lg dark:shadow-md border border-slate-200 dark:border-gray-800 flex flex-col min-h-[600px] relative overflow-hidden transition-all duration-300">
        
        <AnimatePresence mode="wait">

          {/* STEP 1: VISION */}
          {step === 1 && !showSummary && (
            <motion.section key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 flex-1 flex flex-col">
              <header>
                <h2 className="text-3xl font-black text-slate-800 dark:text-slate-200 tracking-tight">What brings you here?</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">We'll tailor your path based on your primary goal.</p>
              </header>

              <div className="grid gap-4">
                {[
                  { id: 'casual', label: 'Casual Learning', description: 'Travel, hobbies, and meeting people.', icon: <BookOpen size={22} /> },
                  { id: 'professional', label: 'Career Growth', description: 'Workplace communication & networking.', icon: <Award size={22} /> },
                  { id: 'serious', label: 'Full Mastery', description: 'Academic and deep technical fluency.', icon: <Target size={22} /> }
                ].map((goal) => (
                  <button
                    key={goal.id}
                    onClick={() => setState({ ...state, goal: goal.id as GoalId, goalContext: '' })}
                    className={`p-6 rounded-3xl border-2 transition-all text-left hover:scale-[1.01] ${
                      state.goal === goal.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-400'
                        : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700'
                    }`}
                  >
                    <div className={`p-4 rounded-2xl border mb-4 inline-block ${state.goal === goal.id ? 'bg-white border-blue-100 text-blue-600 dark:text-blue-400 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                      {goal.icon}
                    </div>
                    <div className="flex items-center justify-between">
                      <h3 className={`font-black text-xl mb-1 ${state.goal === goal.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>{goal.label}</h3>
                      {state.goal === goal.id && <CheckCircle2 size={24} className="text-blue-600 dark:text-blue-400" />}
                    </div>
                    <p className={`text-sm leading-relaxed ${state.goal === goal.id ? 'text-blue-700/80 dark:text-blue-300/80' : 'text-slate-500 dark:text-slate-400'}`}>{goal.description}</p>
                  </button>
                ))}
              </div>

              {state.goal && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">
                    {goalContextConfigs[state.goal].question}
                  </label>
                  <select
                    value={state.goalContext || ''}
                    onChange={(e) => setState({ ...state, goalContext: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-gray-700 p-4 rounded-2xl text-slate-800 dark:text-white font-semibold text-sm focus:outline-none focus:border-blue-600 transition-colors"
                  >
                    <option value="" disabled>Select your context...</option>
                    {goalContextConfigs[state.goal].options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  {state.goalContext && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-teal-600 dark:text-teal-400 font-medium pl-1">
                      ✓ Great choice — we'll focus your lessons around real-life situations.
                    </motion.p>
                  )}
                </motion.div>
              )}
            </motion.section>
          )}

          {/* STEP 2: LANGUAGE & TOPICS */}
          {step === 2 && !showSummary && (
            <motion.section key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 flex-1 flex flex-col">
              <header>
                <h2 className="text-3xl font-black text-slate-800 dark:text-slate-200 tracking-tight">Language & Interests</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Tell us about your context and what excites you.</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">I Speak</label>
                  <select
                    value={state.nativeLanguage}
                    onChange={(e) => setState({ ...state, nativeLanguage: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl text-slate-800 dark:text-white font-semibold text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    {SUPPORTED_LANGUAGES.map(l => (
                      <option key={l} value={l} disabled={l !== 'English'}>
                        {l} {l !== 'English' ? '(Soon)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">I Want to Learn</label>
                  <select
                    value={state.targetLanguage}
                    onChange={(e) => setState({ ...state, targetLanguage: e.target.value })}
                    className="w-full p-3 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-2xl text-blue-700 dark:text-blue-300 font-semibold text-sm focus:outline-none focus:border-blue-600 transition-colors"
                  >
                    {SUPPORTED_LANGUAGES.map(l => (
                      <option key={l} value={l} disabled={l !== 'English'}>
                        {l} {l !== 'English' ? '(Soon)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Preferred Topics</label>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${state.topics.length >= 3 ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                    {state.topics.length} selected / minimum 3 required
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-[260px] overflow-y-auto pr-1">
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
                            setState({ ...state, topics: newTopics as TopicId[] });
                          }}
                          className={`p-3 rounded-2xl border-2 text-left transition-all hover:scale-[1.02] relative ${
                            isSelected ? 'bg-blue-600 border-blue-600 shadow-md' : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 hover:border-slate-300'
                          }`}
                        >
                          {isSelected && <Check size={12} className="absolute top-2 right-2 text-white" />}
                          <Globe size={14} className={`mb-1 ${isSelected ? 'text-white/80' : 'text-slate-400'}`} />
                          <span className={`text-[10px] font-black leading-tight block uppercase tracking-tighter ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-50'}`}>
                            {topic.label}
                          </span>
                        </button>
                      );
                    });
                  })()}
                </div>
                {state.topics.length >= 3 && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-teal-600 dark:text-teal-400 font-medium mt-2 pl-1">
                    ✓ Perfect — your lessons will be built around these interests.
                  </motion.p>
                )}
              </div>
            </motion.section>
          )}

          {/* STEP 3: SKILLS & PACE */}
          {step === 3 && !showSummary && (
            <motion.section key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 flex-1 flex flex-col">
              <header>
                <h2 className="text-3xl font-black text-slate-800 dark:text-slate-200 tracking-tight">Focus & Pace</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">How should we structure your training?</p>
              </header>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Focus Skills</label>
                  <span className="text-[10px] text-slate-400 font-medium">Choose one or more</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 pl-1">Choose the skills you want to improve. You can select more than one.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all hover:scale-[1.01] relative ${
                          isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-slate-50 dark:bg-gray-800 border-slate-100 dark:border-gray-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <div className={`p-2 rounded-xl transition-colors ${isSelected ? 'bg-blue-700' : 'bg-white dark:bg-gray-900 shadow-sm'}`}>{s.icon}</div>
                        <span className="text-[10px] font-black uppercase tracking-widest">{s.label}</span>
                        {isSelected && <Check size={14} className="absolute top-2 right-2 text-white/80" />}
                      </button>
                    );
                  })}
                </div>
                {state.focusSkills.length > 0 && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-teal-600 dark:text-teal-400 font-medium mt-2 pl-1">
                    ✓ We'll prioritize these skills in every lesson.
                  </motion.p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-4 block">Daily Commitment</label>
                <div className="space-y-3">
                  {paceOptions.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setState({ ...state, sessionIntensity: opt.id as any })}
                      className={`w-full flex items-center justify-between p-5 rounded-3xl border-2 transition-all hover:scale-[1.01] ${
                        state.sessionIntensity === opt.id ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-600 dark:border-blue-400' : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl transition-colors ${state.sessionIntensity === opt.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-50 dark:bg-gray-800 text-slate-400'}`}>
                          {opt.icon}
                        </div>
                        <div className="text-left">
                          <p className={`text-sm font-black uppercase tracking-tight ${state.sessionIntensity === opt.id ? 'text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-white'}`}>{opt.label}</p>
                          <p className="text-[11px] text-slate-400 font-bold mt-0.5">{opt.subtitle}</p>
                        </div>
                      </div>
                      {state.sessionIntensity === opt.id && <CheckCircle2 size={24} className="text-blue-600 dark:text-blue-400" />}
                    </button>
                  ))}
                </div>
              </div>
            </motion.section>
          )}

          {/* SUMMARY STEP */}
          {showSummary && (
            <motion.section key="summary" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col space-y-6">
              <header>
                <h2 className="text-3xl font-black text-slate-800 dark:text-slate-200 tracking-tight">Your Learning Plan</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Here's a summary before we build your path.</p>
              </header>
              <div className="space-y-3 flex-1">
                {[
                  { label: 'Goal', value: goalLabels[state.goal] || state.goal },
                  { label: 'Language', value: `${state.nativeLanguage} → ${state.targetLanguage}` },
                  { label: 'Context', value: state.goalContext },
                  { label: 'Topics', value: state.topics.length > 0 ? `${state.topics.length} topics selected` : '—' },
                  { label: 'Focus Skills', value: state.focusSkills.length > 0 ? state.focusSkills.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ') : '—' },
                  { label: 'Daily Pace', value: `${paceLabels[state.sessionIntensity]} (${paceOptions.find(p => p.id === state.sessionIntensity)?.subtitle})` },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-700">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{row.label}</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-white text-right max-w-[60%]">{row.value}</span>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

        </AnimatePresence>

        {/* Footer Bar */}
        <div className="mt-10 pt-8 border-t border-slate-100 dark:border-gray-800 flex flex-col gap-3">
          {validation && !showSummary && (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium text-center">{validation}</p>
          )}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col w-full md:w-auto text-center md:text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">
                {showSummary ? 'Almost done' : `Step ${step} of ${totalSteps}`}
              </span>
              <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                {showSummary ? 'Review & confirm' : steps[step - 1]?.title}
              </span>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
              {(step > 1 || showSummary) && (
                <button
                  onClick={() => showSummary ? setShowSummary(false) : setStep(step - 1)}
                  className="w-full md:w-auto flex justify-center items-center gap-1 px-5 py-3 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 border border-slate-200 dark:border-gray-700 hover:border-slate-300 transition-all"
                >
                  <ChevronLeft size={16} /> Back
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={isSaving || (!showSummary && !canProceed())}
                className="w-full md:w-auto flex justify-center items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md hover:scale-105 active:scale-95 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
              >
                {ctaLabel} <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-8 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] opacity-50">
        Personalized language learning powered by AI.
      </p>
    </div>
  );
};

export default OnboardingView;
