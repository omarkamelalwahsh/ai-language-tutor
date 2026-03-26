import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic, Send, Brain, ChevronRight, User, Loader2,
  Map as MapIcon, BookOpen, Headphones, Lock,
  MessageSquare, Sparkles, ArrowLeft, Zap,
  Image as ImageIcon, Eye, Focus, Code, X,
  Globe2, Target, Coffee, Briefcase, GraduationCap,
  CheckCircle2, PenTool
} from 'lucide-react';

import { AssessmentAnalysisService } from './services/AnalysisService';
import { LearnerInterpretation } from './components/assessment/AssessmentResults';
import { LearnerModelSnapshot } from './types/learner-model';
import { AdvancedDashboardPayload } from './types/dashboard';
import { AdvancedDashboard } from './components/dashboard/AdvancedDashboard';
import { SharedRuntime } from './components/runtime/SharedRuntime';

type ViewState = 'AUTH' | 'ONBOARDING' | 'DIAGNOSTIC' | 'ANALYZING' | 'RESULTS' | 'DASHBOARD' | 'LEARNING_LOOP';

export interface OnboardingState {
  goal: 'casual' | 'serious' | 'professional' | null;
  nativeLanguage: string;
  targetLanguage: string;
  focusSkills: string[];
}

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  isHint?: boolean;
}

interface TaskModel {
  taskId: string;
  taskType: 'speaking' | 'writing' | 'visual_description' | 'vocabulary_in_context';
  targetSkill: string;
  title: string;
  prompt: string;
}

const ASSESSMENT_TASKS: TaskModel[] = [
  { 
    taskId: '1', taskType: 'speaking', targetSkill: 'speaking', 
    title: 'Self-Introduction',
    prompt: "Please introduce yourself. What is your daily routine and why do you want to learn this language?" 
  },
  { 
    taskId: '2', taskType: 'visual_description', targetSkill: 'vocabulary', 
    title: 'Visual Description',
    prompt: "Describe what people are doing in this picture. Use precise words." 
  },
  { 
    taskId: '3', taskType: 'vocabulary_in_context', targetSkill: 'writing', 
    title: 'Vocabulary in Context',
    prompt: "Tell me about a challenging situation you faced in the past and how you handled it." 
  },
  {
    taskId: '4', taskType: 'writing', targetSkill: 'writing', 
    title: 'Opinion & Argument',
    prompt: "What is your opinion on the impact of Artificial Intelligence on education? Provide a reasoned argument."
  }
];

// -------------------------------------------------------------------------------- //
// Utility Animations & Functions
// -------------------------------------------------------------------------------- //
const FadeTransition: React.FC<{ children: React.ReactNode; className?: string; key?: string }> = ({ children, className }) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -15 }}
    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

// -------------------------------------------------------------------------------- //
// Developer Mode Overlay
// -------------------------------------------------------------------------------- //
const DevModeOverlay = ({ model, show, onClose }: { model: LearnerModelSnapshot | null; show: boolean; onClose: () => void }) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end"
        >
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full max-w-md h-full bg-slate-50 border-l border-slate-200 shadow-2xl flex flex-col pt-6"
          >
            <div className="flex justify-between items-center px-6 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2 text-indigo-600">
                <Code className="w-5 h-5" />
                <h3 className="font-mono font-bold">Data Capture JSON</h3>
              </div>
              <button onClick={onClose} className="p-2 bg-slate-200 rounded-full text-slate-500 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs sm:text-sm text-slate-700">
              <pre>{JSON.stringify({ learnerModelSnapshot: model }, null, 2)}</pre>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// -------------------------------------------------------------------------------- //
// AUTH View (Premium Light Theme)
// -------------------------------------------------------------------------------- //
const AuthView = ({ onLogin }: { key?: string; onLogin: () => void }) => {
  return (
    <FadeTransition className="min-h-screen flex items-center justify-center bg-slate-50 p-6 relative overflow-hidden">
      {/* Soft Ambient Background Elements */}
      <div className="absolute top-0 right-0 w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] bg-indigo-100 blur-[80px] rounded-full translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] bg-blue-100 blur-[80px] rounded-full -translate-x-1/3 translate-y-1/3" />

      <div className="w-full max-w-md bg-white rounded-[2rem] p-10 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] border border-slate-100 relative z-10">
        <div className="text-center mb-10 relative z-10">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-sm border border-indigo-100/50">
            <Sparkles className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Welcome</h1>
          <p className="text-slate-500 text-sm font-medium">Sign in to begin your personalized language journey.</p>
        </div>

        <form className="space-y-5 relative z-10" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Email</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="email"
                defaultValue="learner@fluent.ai"
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-slate-900 placeholder-slate-400"
              />
            </div>
          </div>
          <div className="space-y-1.5 mb-8">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="password"
                defaultValue="••••••••"
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-slate-900 placeholder-slate-400"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-xl transition-all shadow-[0_8px_20px_rgba(79,70,229,0.25)] active:scale-[0.98]"
          >
            Sign In & Continue
          </button>
        </form>
      </div>
    </FadeTransition>
  );
};

// -------------------------------------------------------------------------------- //
// ONBOARDING View
// -------------------------------------------------------------------------------- //
const OnboardingView = ({ onComplete }: { key?: string; onComplete: (state: OnboardingState) => void }) => {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<OnboardingState>({ goal: null, nativeLanguage: 'English', targetLanguage: 'Spanish', focusSkills: [] });
  const totalOnboardingSteps = 3;

  const handleNext = () => {
    if (step < totalOnboardingSteps) {
      setStep(step + 1);
    } else {
      onComplete(state);
    }
  };

  const goals = [
    { id: 'casual', label: 'Casual', icon: <Coffee className="w-6 h-6" />, desc: 'Just for fun or travel' },
    { id: 'serious', label: 'Serious', icon: <GraduationCap className="w-6 h-6" />, desc: 'Academic or personal growth' },
    { id: 'professional', label: 'Professional', icon: <Briefcase className="w-6 h-6" />, desc: 'Business and career focused' }
  ] as const;

  const skills = [
    { id: 'speaking', label: 'Speaking', icon: <Mic className="w-5 h-5" /> },
    { id: 'writing', label: 'Writing', icon: <PenTool className="w-5 h-5" /> },
    { id: 'listening', label: 'Listening', icon: <Headphones className="w-5 h-5" /> },
    { id: 'vocabulary', label: 'Vocabulary', icon: <BookOpen className="w-5 h-5" /> }
  ];

  return (
    <FadeTransition className="min-h-screen bg-slate-50 flex flex-col items-center pt-20 px-4 pb-12 relative">
      <div className="w-full max-w-2xl flex flex-col h-full mt-4">
        {/* Sleek Progress Indicator */}
        <div className="mb-8">
          <div className="flex justify-between text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest">
            <span>Setup Profile</span>
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
        </div>

        <div className="bg-white rounded-[2rem] p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] border border-slate-100 flex-1 min-h-[500px] flex flex-col relative overflow-hidden">
          <AnimatePresence mode="wait">
            
            {step === 1 && (
              <motion.div key="s1" variants={staggerContainer} initial="hidden" animate="show" exit="hidden" className="flex flex-col h-full">
                <motion.h2 variants={staggerItem} className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">What's your primary goal?</motion.h2>
                <motion.p variants={staggerItem} className="text-slate-500 mb-8">This helps us tailor the difficulty and vocabulary of your sessions.</motion.p>
                
                <motion.div variants={staggerItem} className="grid sm:grid-cols-3 gap-4 mb-auto">
                  {goals.map(g => (
                    <button
                      key={g.id}
                      onClick={() => setState({ ...state, goal: g.id })}
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

            {step === 2 && (
              <motion.div key="s2" variants={staggerContainer} initial="hidden" animate="show" exit="hidden" className="flex flex-col h-full">
                <motion.h2 variants={staggerItem} className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">Language Selection</motion.h2>
                <motion.p variants={staggerItem} className="text-slate-500 mb-8">Confirm your native language and the one you want to learn.</motion.p>
                
                <motion.div variants={staggerItem} className="space-y-6 mb-auto">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-2 block">I speak</label>
                    <select
                      value={state.nativeLanguage}
                      onChange={e => setState({ ...state, nativeLanguage: e.target.value })}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-800 font-medium"
                    >
                      <option>English</option>
                      <option>Spanish</option>
                      <option>French</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-2 block">I want to learn</label>
                    <select
                      value={state.targetLanguage}
                      onChange={e => setState({ ...state, targetLanguage: e.target.value })}
                      className="w-full p-4 bg-white border border-indigo-200 shadow-sm shadow-indigo-100/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-900 font-bold text-lg"
                    >
                      <option>English</option>
                      <option>Spanish</option>
                      <option>French</option>
                      <option>German</option>
                      <option>Japanese</option>
                    </select>
                  </div>
                </motion.div>
                
                <motion.button variants={staggerItem} onClick={handleNext} className="mt-8 w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2">
                  Continue <ChevronRight className="w-5 h-5" />
                </motion.button>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="s3" variants={staggerContainer} initial="hidden" animate="show" exit="hidden" className="flex flex-col h-full">
                <motion.h2 variants={staggerItem} className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">Focus Skills</motion.h2>
                <motion.p variants={staggerItem} className="text-slate-500 mb-8">Select the areas you want to prioritize in your learning journey.</motion.p>
                
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
                        className={`p-5 rounded-2xl flex flex-col items-center justify-center gap-3 border-2 transition-all ${isSelected ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:border-indigo-200'}`}
                      >
                        <div className={`${isSelected ? 'text-indigo-600' : 'text-slate-400'}`}>
                          {s.icon}
                        </div>
                        <span className={`font-semibold ${isSelected ? 'text-indigo-900' : 'text-slate-600'}`}>{s.label}</span>
                        {isSelected && <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-indigo-600" />}
                      </button>
                    )
                  })}
                </motion.div>
                
                <motion.button variants={staggerItem} disabled={state.focusSkills.length === 0} onClick={handleNext} className="mt-8 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 shadow-[0_8px_20px_rgba(79,70,229,0.25)] text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2">
                  Complete Setup <ChevronRight className="w-5 h-5" />
                </motion.button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </FadeTransition>
  );
};

// -------------------------------------------------------------------------------- //
// DIAGNOSTIC Assessment Engine View
// -------------------------------------------------------------------------------- //
const TaskQuestion = ({
  task, onCompleteTask
}: {
  key?: string; task: TaskModel; onCompleteTask: (result: any) => void
}) => {
  const [textMode, setTextMode] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const startTime = useRef(Date.now());

  const isVisual = task.taskType === 'visual_description';

  useEffect(() => {
    if (isVisual) {
      setTimeout(() => setScanComplete(true), 2500); 
    }
  }, [isVisual]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const responseTime = Date.now() - startTime.current;
    onCompleteTask({
      taskId: task.taskId,
      answer: inputText.trim(),
      responseTime,
      wordCount: inputText.trim().split(/\s+/).length,
      hintUsage: 0
    });
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col h-full text-slate-900">
      <motion.div variants={staggerItem} className="flex items-center gap-3 mb-5">
        <span className="px-3 py-1 bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold rounded-lg text-sm tracking-wide">{task.title}</span>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800">{task.targetSkill.toUpperCase()}</h2>
      </motion.div>

      <motion.p variants={staggerItem} className="text-slate-600 mb-8 text-lg leading-relaxed font-medium">{task.prompt}</motion.p>

      {isVisual && (
        <motion.div variants={staggerItem} className="w-full aspect-video bg-slate-100 rounded-2xl border border-slate-200 mb-8 flex items-center justify-center overflow-hidden relative shadow-inner">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80')] bg-cover bg-center opacity-80" />
          <div className="absolute inset-0 bg-slate-900/20 z-10" />

          <AnimatePresence>
            {!scanComplete && (
              <motion.div exit={{ opacity: 0 }} className="absolute z-20 flex flex-col items-center">
                <Focus className="w-12 h-12 text-white animate-pulse mb-3 drop-shadow-md" />
                <span className="text-white font-mono text-sm tracking-widest font-bold drop-shadow-md">SCANNING ENVIRONMENT...</span>
              </motion.div>
            )}

            {scanComplete && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute left-4 bottom-4 z-30 flex flex-col gap-2"
              >
                {[
                  { label: "Coffee", accuracy: 98 },
                  { label: "Person", accuracy: 95 }
                ].map((obj, i) => (
                  <motion.div
                    key={obj.label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.2 }}
                    className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-md border border-slate-200/50 flex items-center gap-3 w-max"
                  >
                    <span className="text-slate-900 text-xs font-bold uppercase tracking-wider">{obj.label}</span>
                    <span className="text-emerald-600 text-xs font-mono">{obj.accuracy}%</span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      <motion.div variants={staggerItem} className="mt-auto space-y-4">
        {textMode ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <textarea
              autoFocus
              className="w-full flex-1 min-h-[140px] p-5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none text-slate-900 placeholder-slate-400 shadow-inner"
              placeholder="Type your detailed answer here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setTextMode(false)}
                className="px-6 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-all shadow-sm"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none shadow-[0_8px_20px_rgba(79,70,229,0.25)] border-transparent text-white font-semibold py-3.5 rounded-xl transition-all"
              >
                Submit Answer
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-5">
            <button
              onClick={() => setTextMode(true)}
              className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-slate-200 hover:border-indigo-400 hover:bg-white rounded-2xl transition-all group shadow-sm"
            >
              <div className="w-14 h-14 bg-white group-hover:bg-indigo-50 rounded-full flex items-center justify-center mb-4 transition-colors shadow-sm border border-slate-100">
                <MessageSquare className="w-7 h-7 text-slate-500 group-hover:text-indigo-600 transition-colors" />
              </div>
              <span className="font-semibold text-slate-700 group-hover:text-indigo-900 transition-colors">Text Input</span>
            </button>

            <button
              onClick={() => {
                if (!isRecording) {
                  setIsRecording(true);
                  setTimeout(() => {
                    setIsRecording(false);
                    const responseTime = Date.now() - startTime.current;
                    onCompleteTask({
                      taskId: task.taskId,
                      answer: "[Voice Audio Recorded]",
                      responseTime,
                      wordCount: 15,
                      hintUsage: 0
                    });
                  }, 2500);
                }
              }}
              className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-slate-200 hover:border-indigo-400 hover:bg-white rounded-2xl transition-all group relative overflow-hidden shadow-sm"
            >
              {isRecording && <div className="absolute inset-0 bg-indigo-50 animate-pulse" />}
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-all shadow-sm border border-slate-100 ${isRecording ? 'bg-red-100 text-red-600 scale-110 border-red-200' : 'bg-white group-hover:bg-indigo-50 text-slate-500 group-hover:text-indigo-600'}`}>
                <Mic className="w-7 h-7" />
              </div>
              <span className={`font-semibold transition-colors ${isRecording ? 'text-red-600' : 'text-slate-700 group-hover:text-indigo-900'}`}>
                {isRecording ? 'Recording...' : 'Voice Record'}
              </span>
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

const DiagnosticView = ({ onComplete }: { key?: string; onComplete: (results: any[]) => void }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [taskResults, setTaskResults] = useState<any[]>([]);

  const handleNextTask = (result: any) => {
    const newResults = [...taskResults, result];
    if (stepIndex < ASSESSMENT_TASKS.length - 1) {
      setTaskResults(newResults);
      setStepIndex(stepIndex + 1);
    } else {
      onComplete(newResults);
    }
  };

  const task = ASSESSMENT_TASKS[stepIndex];

  return (
    <FadeTransition className="min-h-screen bg-slate-50 flex flex-col items-center pt-20 px-4 pb-12">
      <div className="w-full max-w-2xl flex flex-col h-full mt-4">
        {/* Sleek Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest">
            <span>Diagnostic Assessment</span>
            <span>Task {stepIndex + 1} of {ASSESSMENT_TASKS.length}</span>
          </div>
          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner flex">
            <motion.div
              className="h-full bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.5)]"
              initial={{ width: `${(stepIndex / ASSESSMENT_TASKS.length) * 100}%` }}
              animate={{ width: `${((stepIndex + 1) / ASSESSMENT_TASKS.length) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] border border-slate-100 flex-1 min-h-[500px] flex flex-col relative overflow-hidden">
          <AnimatePresence mode="wait">
             <TaskQuestion key={task.taskId} task={task} onCompleteTask={handleNextTask} />
          </AnimatePresence>
        </div>
      </div>
    </FadeTransition>
  );
};

// -------------------------------------------------------------------------------- //
// ANALYZING View (Light Theme Brain Thinking)
// -------------------------------------------------------------------------------- //
const AnalyzingView = ({ onboardingState, taskResults, onComplete }: { key?: string; onboardingState: OnboardingState | null, taskResults: any[], onComplete: (model: LearnerModelSnapshot) => void }) => {
  
  useEffect(() => {
    const timer = setTimeout(() => {
      const model = AssessmentAnalysisService.initializeLearnerModel(onboardingState, taskResults);
      onComplete(model);
    }, 4500);
    return () => clearTimeout(timer);
  }, [onboardingState, taskResults, onComplete]);

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
          {/* Framer Motion Brain Thinking rings */}
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

        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6 tracking-tight leading-tight">Analyzing your tasks<br />with the Pedagogical Engine...</h2>

        <div className="flex items-center gap-3 text-indigo-700 font-medium bg-white px-6 py-3.5 rounded-2xl border border-indigo-100 shadow-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Building your Learner Snapshot...</span>
        </div>
      </div>
    </FadeTransition>
  );
};

// -------------------------------------------------------------------------------- //
// DASHBOARD View (Bento Grid)
// -------------------------------------------------------------------------------- //
const DashboardView = ({ learnerModel, onPractice, onToggleDevMode }: { key?: string; learnerModel: LearnerModelSnapshot, onPractice: () => void, onToggleDevMode: () => void }) => {
  return (
    <FadeTransition className="min-h-screen bg-slate-50 p-6 sm:p-10 text-slate-900 relative">
      <div className="max-w-5xl mx-auto pt-10">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-2">Smart Dashboard</h1>
            <p className="text-slate-500 text-lg font-medium">Your personalized learning strategy based on your analysis.</p>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={onToggleDevMode} className="p-3 bg-white hover:bg-slate-100 rounded-2xl border border-slate-200 transition-colors shadow-sm text-indigo-600" title="Developer Mode / View JSON">
              <Code className="w-6 h-6" />
            </button>

            <div className="bg-white px-7 py-5 rounded-[1.5rem] shadow-[0_15px_30px_-10px_rgba(0,0,0,0.08)] border border-slate-100 flex items-center gap-5">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-[1.25rem] flex items-center justify-center text-white font-extrabold text-2xl shadow-lg shadow-indigo-500/30 border border-indigo-400/50">
                {learnerModel.overallLevel.split('+')[0] || "B1"}
              </div>
              <div>
                <p className="text-xs text-indigo-600 font-bold uppercase tracking-widest mb-1">Calculated Level</p>
                <p className="font-bold text-slate-900 text-xl">{learnerModel.overallLevel}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Bento Grid */}
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          
          {/* Skill Dimensions (Glassmorphism Cards) */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-6">
            <motion.div variants={staggerItem} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between h-40">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold tracking-wide flex items-center gap-2"><Mic className="w-4 h-4"/> Speaking</span>
                <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-sm font-bold">{learnerModel.skills.speaking.level}</span>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-slate-900 mb-2">{learnerModel.skills.speaking.score}%</div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${learnerModel.skills.speaking.score}%` }} transition={{ duration: 1 }} className="h-full bg-indigo-500" />
                </div>
              </div>
            </motion.div>
            
            <motion.div variants={staggerItem} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between h-40">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold tracking-wide flex items-center gap-2"><PenTool className="w-4 h-4"/> Writing</span>
                <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg text-sm font-bold">{learnerModel.skills.writing.level}</span>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-slate-900 mb-2">{learnerModel.skills.writing.score}%</div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${learnerModel.skills.writing.score}%` }} transition={{ duration: 1 }} className="h-full bg-emerald-500" />
                </div>
              </div>
            </motion.div>

            <motion.div variants={staggerItem} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between h-40">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold tracking-wide flex items-center gap-2"><Headphones className="w-4 h-4"/> Listening</span>
                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-sm font-bold">{learnerModel.skills.listening.level}</span>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-slate-900 mb-2">{learnerModel.skills.listening.score}%</div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${learnerModel.skills.listening.score}%` }} transition={{ duration: 1 }} className="h-full bg-blue-500" />
                </div>
              </div>
            </motion.div>

            <motion.div variants={staggerItem} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between h-40">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold tracking-wide flex items-center gap-2"><BookOpen className="w-4 h-4"/> Vocabulary</span>
                <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-lg text-sm font-bold">{learnerModel.skills.vocabulary.level}</span>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-slate-900 mb-2">{learnerModel.skills.vocabulary.score}%</div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${learnerModel.skills.vocabulary.score}%` }} transition={{ duration: 1 }} className="h-full bg-amber-500" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Quick Stats / Pacing */}
          <motion.div variants={staggerItem} className="bg-slate-900 text-white rounded-3xl p-8 border border-slate-800 shadow-lg flex flex-col mt-6 lg:mt-0">
            <h3 className="font-bold text-xl mb-6 flex items-center gap-2"><Brain className="w-5 h-5 text-indigo-400"/> Pacing & Confidence</h3>
            <div className="space-y-6 flex-1">
              <div>
                <p className="text-slate-400 text-sm mb-1 uppercase tracking-wider font-bold">Profile Style</p>
                <p className="text-xl capitalize font-semibold">{learnerModel.pacing.profile}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm mb-1 uppercase tracking-wider font-bold">Confidence State</p>
                <p className="text-xl capitalize font-semibold">{learnerModel.confidence.state}</p>
              </div>
               <div>
                <p className="text-slate-400 text-sm mb-1 uppercase tracking-wider font-bold">Avg Latency</p>
                <p className="text-xl capitalize font-semibold">{(learnerModel.pacing.avgLatencyMs / 1000).toFixed(1)}s</p>
              </div>
            </div>
            
            <button
               onClick={onPractice}
               className="mt-6 w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/30"
            >
              Start Session <ChevronRight className="w-5 h-5"/>
            </button>
          </motion.div>

          <motion.div variants={staggerItem} className="lg:col-span-3">
             {/* Uses the Component from AssessmentResults.tsx */}
             <LearnerInterpretation model={learnerModel} onStartSession={onPractice} />
          </motion.div>
          
        </motion.div>

      </div>
    </FadeTransition>
  );
};

// -------------------------------------------------------------------------------- //
// LEARNING LOOP View (Scaffolded Chat)
// -------------------------------------------------------------------------------- //
const LearningLoopView = ({ onBack }: { key?: string; onBack: () => void }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', sender: 'ai', text: `Welcome to your first practice session. Your diagnostic noted some growth zones we can refine. Let's talk about your selected goals!` }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    const newMessages = [...messages, { id: Date.now().toString(), sender: 'user' as const, text: userText }];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const smartNudgeMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: "Wait! Think about using a more advanced connector here.",
        isHint: true
      };

      setMessages(prev => [...prev, smartNudgeMsg]);

      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: (Date.now() + 2).toString(),
          sender: 'ai',
          text: `With that in mind, can you elaborate on your point?`
        }]);
        setIsTyping(false);
      }, 2000);

    }, 800);
  };

  return (
    <FadeTransition className="min-h-screen bg-slate-50 flex flex-col items-center p-4">
      <div className="w-full max-w-4xl bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] rounded-[2rem] overflow-hidden flex flex-col h-[90vh] mt-6 border border-slate-100 relative">
        <header className="px-6 py-5 border-b border-slate-100 flex items-center gap-5 bg-white/80 backdrop-blur-xl sticky top-0 z-10">
          <button onClick={onBack} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors text-slate-500 border border-slate-200">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Practice Session</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-indigo-600 font-bold tracking-widest uppercase">AI Tutor Active</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && !msg.isHint && (
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mr-4 flex-shrink-0 mt-1 border border-indigo-200 text-indigo-700">
                    <Brain className="w-5 h-5" />
                  </div>
                )}

                <div className={`
                  relative max-w-[85%] rounded-[1.5rem] px-6 py-4 
                  ${msg.sender === 'user'
                    ? 'bg-indigo-600 text-white shadow-[0_8px_20px_rgba(79,70,229,0.2)] rounded-tr-sm'
                    : msg.isHint
                      ? 'bg-amber-50 border border-amber-200 text-amber-900 rounded-tl-sm w-full font-medium shadow-sm relative overflow-hidden'
                      : 'bg-white border border-slate-200 text-slate-800 shadow-sm rounded-tl-sm'
                  }
                `}>
                  {msg.isHint && (
                    <div className="flex items-center gap-2 mb-3 text-amber-800 bg-amber-100/50 px-3 py-1.5 rounded-lg w-max border border-amber-200/50">
                      <Zap className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-bold uppercase tracking-widest">Smart Nudge</span>
                    </div>
                  )}
                  <p className={`leading-relaxed ${msg.isHint ? 'text-[15px] tracking-wide text-amber-900' : 'text-[16px]'}`}>
                    {msg.text}
                  </p>
                </div>
              </motion.div>
            ))}

            {isTyping && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-end justify-start"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mr-4 border border-indigo-200 text-indigo-700">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
                <div className="bg-white border border-slate-200 rounded-3xl rounded-tl-sm px-6 py-5 shadow-sm flex gap-2">
                  <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={endOfMessagesRef} />
        </div>

        <div className="p-5 bg-white border-t border-slate-100">
          <form className="relative flex items-center" onSubmit={handleSend}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Type anything to see the Hint-First logic...'
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-full pl-6 pr-16 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-[16px] placeholder-slate-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 border border-transparent disabled:border-slate-200 text-white rounded-full flex items-center justify-center transition-colors shadow-sm disabled:shadow-none"
            >
              <Send className="w-4 h-4 ml-[-2px] mb-[-2px]" />
            </button>
          </form>
        </div>
      </div>
    </FadeTransition>
  );
};

// -------------------------------------------------------------------------------- //
// Dashboard Data Builder (transforms LearnerModel into AdvancedDashboardPayload)
// -------------------------------------------------------------------------------- //
function buildDashboardPayload(model: LearnerModelSnapshot): AdvancedDashboardPayload {
  const currentLevel = model.overallLevel;
  const nextLevelMap: Record<string, string> = { 'Pre-A1': 'A1', 'A1': 'A2', 'A1+': 'A2', 'A2': 'B1', 'A2+': 'B1', 'B1': 'B2', 'B1+': 'B2', 'B2': 'C1', 'B2+': 'C1', 'C1': 'C2', 'C2': 'C2' };
  const targetLevel = nextLevelMap[currentLevel] || 'A2';

  return {
    primaryGoalText: `Solidify your ${currentLevel} foundation and build toward ${targetLevel}.`,
    recommendedNextAction: { label: 'Start Next Session', actionId: 'session_1', reason: 'Based on your diagnostic, structured practice is the best next step.' },
    journey: {
      currentStage: currentLevel, targetStage: targetLevel,
      journeyTitle: `Your Path from ${currentLevel} to ${targetLevel}`,
      currentCapabilitiesSummary: model.interpretation.currentCapacities.join('. '),
      targetCapabilitiesSummary: `Confident everyday communication, clearer sentence building, and stronger follow-up interaction at the ${targetLevel} level.`,
      milestones: [
        { id: 'm1', title: 'Daily Conversation Basics', description: 'Greetings, introductions, simple questions', status: 'completed', estimatedDuration: '~1 week' },
        { id: 'm2', title: 'Practical Vocabulary Growth', description: 'Core nouns, verbs, and connectors for routine use', status: 'current', estimatedDuration: '~2 weeks' },
        { id: 'm3', title: 'Stronger Sentence Building', description: 'Compound sentences, conjunctions, and time markers', status: 'locked', estimatedDuration: '~2 weeks' },
        { id: 'm4', title: 'Routine Communication', description: 'Ordering food, asking directions, making plans', status: 'locked', estimatedDuration: '~2 weeks' },
      ]
    },
    skillAnalytics: [
      { skillId: 'speaking', currentScore: model.skills.speaking.score, progressDirection: 'up', stability: model.skills.speaking.confidence > 0.5 ? 'stable' : 'fragile', isPriority: true, hasReviewPressure: false, confidenceBand: model.skills.speaking.confidence > 0.7 ? 'high' : model.skills.speaking.confidence > 0.4 ? 'medium' : 'low' },
      { skillId: 'writing', currentScore: model.skills.writing.score, progressDirection: 'flat', stability: 'stable', isPriority: false, hasReviewPressure: true, confidenceBand: 'medium' },
      { skillId: 'listening', currentScore: model.skills.listening.score, progressDirection: 'up', stability: 'fragile', isPriority: true, hasReviewPressure: false, confidenceBand: 'low' },
      { skillId: 'vocabulary', currentScore: model.skills.vocabulary.score, progressDirection: 'up', stability: 'stable', isPriority: false, hasReviewPressure: true, confidenceBand: 'medium' },
    ],
    focusAreas: model.interpretation.growthZones,
    reviewQueue: [
      { itemId: 'r1', type: 'grammar', label: 'Past tense conjugation', dueStatus: 'due', fragility: 'medium' },
      { itemId: 'r2', type: 'word', label: '"Look forward to" usage', dueStatus: 'overdue', fragility: 'high' },
    ],
    weeklyRhythm: { streakDays: 1, sessionsThisWeek: 0, momentumState: 'building' }
  };
}

// -------------------------------------------------------------------------------- //
// Main Application Container
// -------------------------------------------------------------------------------- //
export default function App() {
  const [view, setView] = useState<ViewState>('AUTH');
  
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null);
  const [taskResults, setTaskResults] = useState<any[]>([]);
  const [learnerModel, setLearnerModel] = useState<LearnerModelSnapshot | null>(null);
  
  const [devModeActive, setDevModeActive] = useState(false);

  const navigateTo = (newView: ViewState) => {
    setView(newView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="font-sans antialiased text-slate-900 selection:bg-indigo-500/30 selection:text-indigo-900 bg-slate-50 min-h-screen">
      <DevModeOverlay model={learnerModel} show={devModeActive} onClose={() => setDevModeActive(false)} />

      <AnimatePresence mode="wait">
        {view === 'AUTH' && (
          <AuthView key="auth" onLogin={() => navigateTo('ONBOARDING')} />
        )}

        {view === 'ONBOARDING' && (
          <OnboardingView key="onboarding" onComplete={(state) => {
            setOnboardingState(state);
            navigateTo('DIAGNOSTIC');
          }} />
        )}

        {view === 'DIAGNOSTIC' && (
          <DiagnosticView key="diagnostic" onComplete={(results) => {
            setTaskResults(results);
            navigateTo('ANALYZING');
          }} />
        )}

        {view === 'ANALYZING' && (
          <AnalyzingView key="analyzing" onboardingState={onboardingState} taskResults={taskResults} onComplete={(model) => {
            setLearnerModel(model);
            navigateTo('RESULTS');
          }} />
        )}

        {view === 'RESULTS' && learnerModel && (
          <LearnerInterpretation
            key="results"
            model={learnerModel}
            segment={onboardingState?.goal || null}
            onStartSession={() => navigateTo('LEARNING_LOOP')}
            onViewDashboard={() => navigateTo('DASHBOARD')}
          />
        )}

        {view === 'DASHBOARD' && learnerModel && (
          <FadeTransition key="dashboard" className="min-h-screen bg-slate-50">
            <AdvancedDashboard
              learnerModel={learnerModel}
              dashboardData={buildDashboardPayload(learnerModel)}
              onStartSession={() => navigateTo('LEARNING_LOOP')}
            />
          </FadeTransition>
        )}

        {view === 'LEARNING_LOOP' && (
          <SharedRuntime key="learning_loop" onExit={() => navigateTo('DASHBOARD')} />
        )}
      </AnimatePresence>
    </div>
  );
}
