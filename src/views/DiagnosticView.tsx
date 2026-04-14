import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  CheckCircle2, 
  RefreshCcw, 
  SkipForward,
  ChevronRight,
  BookOpen,
  Headphones,
  Pen,
  Mic,
  ArrowRight,
  Zap,
  AlertTriangle,
  Shield,
  TrendingUp,
  Brain,
  MessageSquare
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';

import { AssessmentQuestion, AssessmentOutcome, ResponseMode, SpeakingSubmissionMeta, LearnerContextProfile, TaskEvaluation } from '../types/assessment';
import { AdaptiveAssessmentEngine, BatteryProgress } from '../services/AdaptiveAssessmentEngine';
import { AssessmentSaveService } from '../services/AssessmentSaveService';
import { TaskResult, OnboardingState } from '../types/app';
import { DifficultyZone } from '../config/assessment-config';
import { AudioPlaybackControl } from '../components/shared/AudioPlaybackControl';
import { SpeakingModule } from '../components/runtime/modules/SpeakingModule';

// --- Types ---
interface DiagnosticViewProps {
  onboardingState?: OnboardingState | null;
  taskResults?: TaskEvaluation[]; 
  onSaveComplete: (results: TaskResult[], outcome: AssessmentOutcome, evaluations: TaskEvaluation[]) => void;
}

// Skill badge config
const SKILL_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  reading:    { icon: <BookOpen size={14} />,    color: 'text-violet-600',  bg: 'bg-violet-50 border-violet-200', label: 'Reading' },
  listening:  { icon: <Headphones size={14} />,  color: 'text-sky-600',     bg: 'bg-sky-50 border-sky-200',       label: 'Listening' },
  writing:    { icon: <Pen size={14} />,         color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'Writing' },
  speaking:   { icon: <Mic size={14} />,         color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',    label: 'Speaking' },
  vocabulary: { icon: <Zap size={14} />,         color: 'text-rose-600',    bg: 'bg-rose-50 border-rose-200',      label: 'Vocabulary' },
  grammar:    { icon: <BookOpen size={14} />,    color: 'text-indigo-600',  bg: 'bg-indigo-50 border-indigo-200',  label: 'Grammar' },
};

// Block info
const BLOCK_INFO: Record<number, { label: string; icon: React.ReactNode; color: string }> = {
  1: { label: 'Language Use', icon: <Zap size={16} />, color: 'text-sky-600' },
  2: { label: 'Reading', icon: <BookOpen size={16} />, color: 'text-violet-600' },
  3: { label: 'Writing', icon: <Pen size={16} />, color: 'text-emerald-600' },
  4: { label: 'Speaking', icon: <Mic size={16} />, color: 'text-amber-600' },
};

// Zone badge config
const ZONE_CONFIG: Record<DifficultyZone, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  EASY:   { label: 'Easy', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: <Shield size={12} /> },
  MEDIUM: { label: 'Medium', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: <TrendingUp size={12} /> },
  HARD:   { label: 'Hard', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200', icon: <Brain size={12} /> },
};

export const DiagnosticView: React.FC<DiagnosticViewProps> = ({ onSaveComplete, onboardingState, taskResults }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshData: refreshUserProfile, user } = useData() as any;

  // --- Engine ---
  const engineRef = useRef<AdaptiveAssessmentEngine | null>(null);
  const isInitialized = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [showBlockTransition, setShowBlockTransition] = useState<number | null>(null);
  const prevBlockRef = useRef<number | null>(null);

  if (!engineRef.current) {
    const preFetched = (location.state as any)?.preFetchedBattery;
    const engine = new AdaptiveAssessmentEngine('B1', onboardingState ? {
      goal: onboardingState.goal || undefined,
      preferredTopics: (onboardingState.topics || []) as string[],
    } : undefined, user?.id, preFetched);
    engineRef.current = engine;
  }

  const engine = engineRef.current;
  const [currentTask, setCurrentTask] = useState<AssessmentQuestion | null>(null);
  const [progress, setProgress] = useState<BatteryProgress>(engine.getProgress());
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  
  const [textValue, setTextValue] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [useSpeakingFallback, setUseSpeakingFallback] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  const setTaskWithReset = useCallback((task: AssessmentQuestion | null) => {
    if (task) {
      startTimeRef.current = Date.now();
      setTextValue("");
      setSelectedOption(null);
      setUseSpeakingFallback(false);
      setCurrentTask(task);
      const nextProgress = engine.getProgress();
      
      // Block transition check
      if (nextProgress.currentBlock !== prevBlockRef.current && prevBlockRef.current !== null) {
        setShowBlockTransition(nextProgress.currentBlock);
        setTimeout(() => setShowBlockTransition(null), 2500);
      }
      prevBlockRef.current = nextProgress.currentBlock;
      setProgress(nextProgress);
    } else {
      setCurrentTask(null);
    }
  }, [engine]);

  const handleFinish = useCallback(async () => {
    setIsSaving(true); 
    setIsCompleting(true);
    try {
      const academicOutcome = engine.getOutcome();
      const history = engine.getAnswerHistory();
      const evaluations = engine.getEvaluations();
      await onSaveComplete(history, academicOutcome, evaluations);
    } catch (e) {
      setSaveError('AI analysis failed. Navigating to results...');
      setTimeout(() => navigate('/dashboard'), 2000);
    }
  }, [engine, navigate, onSaveComplete]);

  // 🚀 BOOTSTRAP EFFECT: Runs once on mount
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    console.log("[DiagnosticView] Initializing assessment bootstrap...");
    
    const bootstrap = async () => {
      // Get the first question (might trigger fetch if no battery)
      const q = await engine.getNextQuestion();
      if (q) {
        setTaskWithReset(q);
      } else {
        handleFinish();
      }
    };

    bootstrap();
  }, [engine, handleFinish, setTaskWithReset]);

  const handleNextTask = useCallback(async (answer: string, mode?: ResponseMode, meta?: SpeakingSubmissionMeta) => {
    if (!currentTask || isEvaluating) return;
    const time = Date.now() - startTimeRef.current;
    setIsEvaluating(true);
    try {
      const { evaluation } = await engine.submitAnswer(currentTask, answer, time, mode, meta);
      AssessmentSaveService.log_and_update_assessment(currentTask, evaluation, answer, user?.id);
      const next = await engine.getNextQuestion();
      if (next) setTaskWithReset(next);
      else await handleFinish();
    } catch (err) {
      const next = await engine.getNextQuestion();
      if (next) setTaskWithReset(next);
      else await handleFinish();
    } finally {
      setIsEvaluating(false);
    }
  }, [currentTask, engine, isEvaluating, handleFinish, setTaskWithReset, user?.id]);

  const handleSkip = useCallback(async () => {
    if (!currentTask || isEvaluating) return;
    setIsEvaluating(true);
    const next = await engine.skipQuestion(currentTask.id);
    if (next) setTaskWithReset(next);
    else await handleFinish();
    setIsEvaluating(false);
  }, [currentTask, isEvaluating, engine, handleFinish, setTaskWithReset]);

  if (isCompleting) return <AnalyzingTransitionView isSaving={isSaving} saveError={saveError} />;
  if (!engine.hasBattery() || !currentTask) return <PreparingBatteryView />;

  const skillInfo = SKILL_CONFIG[currentTask.skill] || SKILL_CONFIG.reading;
  const zoneInfo = progress.currentZone ? ZONE_CONFIG[progress.currentZone] : null;

  // Split Layout if in Block 2 or 3 AND has a stimulus
  const isSplitLayout = (progress.currentBlock === 2 || progress.currentBlock === 3) && !!currentTask.stimulus;

  return (
    <div className="flex flex-col h-screen bg-[#F7F8FC] overflow-hidden font-sans">
      <header className="shrink-0 px-6 h-16 flex items-center gap-6 bg-white border-b border-slate-100 z-30">
        <button onClick={() => setShowQuitDialog(true)} className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all">
          <X size={18} />
        </button>
        <div className="flex-1 flex items-center gap-4">
          <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
            <motion.div className="h-full bg-gradient-to-r from-blue-600 to-indigo-700" animate={{ width: `${progress.percentage}%` }} transition={{ duration: 0.5 }} />
          </div>
          <span className="text-xs font-black text-slate-500 tabular-nums tracking-tighter">
            PROG: {progress.answered + 1} / {progress.total}
          </span>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {showBlockTransition && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-white/98 backdrop-blur-md">
            <div className="text-center space-y-6">
              <div className="w-28 h-28 rounded-[2.5rem] bg-indigo-50 flex items-center justify-center mx-auto shadow-2xl shadow-indigo-100/50">
                <span className={BLOCK_INFO[showBlockTransition]?.color || "text-indigo-600"}>
                  {React.cloneElement(BLOCK_INFO[showBlockTransition]?.icon as React.ReactElement, { size: 48 })}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-indigo-500 font-black uppercase tracking-[0.2em] text-[10px]">Entering Phase {showBlockTransition}</p>
                <h2 className="text-5xl font-black text-slate-900 tracking-tight">{BLOCK_INFO[showBlockTransition]?.label}</h2>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className={`flex-1 overflow-hidden flex ${isSplitLayout ? 'flex-row' : 'flex-col'}`}>
        {isSplitLayout && (
          <aside className="w-5/12 overflow-y-auto p-12 bg-white border-r border-slate-100 shadow-[inset_-10px_0_30px_-20px_rgba(0,0,0,0.05)]">
            <div className="max-w-xl ml-auto">
              <label className="inline-flex items-center gap-2 mb-8 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100/50">
                <BookOpen size={14} /> Passage {progress.currentBlock === 3 ? '(Remains)' : ''}
              </label>
              <div className="text-xl text-slate-600 leading-[1.8] font-medium selection:bg-indigo-100">
                {currentTask.stimulus}
              </div>
            </div>
          </aside>
        )}

        <div className={`${isSplitLayout ? 'w-7/12 bg-[#F7F8FC]' : 'w-full'} overflow-y-auto`}>
          <div className="max-w-2xl mx-auto px-8 py-16 flex flex-col min-h-full">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-[11px] font-black uppercase tracking-wider shadow-sm ${skillInfo.bg} ${skillInfo.color}`}>
                  {skillInfo.icon} {skillInfo.label}
                </span>
                {zoneInfo && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-black uppercase tracking-wider shadow-sm ${zoneInfo.bg} ${zoneInfo.color}`}>
                    {zoneInfo.icon} {zoneInfo.label}
                  </span>
                )}
              </div>
              <div className="px-3 py-1 bg-slate-200/50 text-slate-500 rounded-lg text-[10px] font-bold">
                BLOCK {progress.currentBlock}
              </div>
            </div>

            {!isSplitLayout && currentTask.stimulus && currentTask.skill !== 'listening' && (
              <div className="mb-10 p-7 bg-white rounded-[2rem] border border-slate-200/60 shadow-sm text-lg italic text-slate-600 leading-relaxed">
                {currentTask.stimulus}
              </div>
            )}

            {currentTask.skill === 'listening' && (
              <div className="mb-10 p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/20 flex flex-col items-center gap-6 text-center">
                <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
                  <Headphones size={40} />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-800">Listening Task</h3>
                  <p className="text-slate-500 text-sm">Listen carefully to the audio and answer the question below.</p>
                </div>

                {currentTask.audioUrl ? (
                  <audio 
                    controls 
                    src={currentTask.audioUrl} 
                    className="w-full max-w-md h-12"
                  />
                ) : (
                  <button 
                    onClick={() => speakText(currentTask.stimulus || currentTask.prompt)}
                    className="flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-lg transition-all shadow-lg shadow-indigo-200"
                  >
                    <Play size={20} fill="currentColor" /> Play AI Voice
                  </button>
                )}
              </div>
            )}

            <div className="mb-10">
              <h1 className="text-4xl font-black text-slate-900 leading-[1.15] tracking-tight">
                {currentTask.prompt}
              </h1>
            </div>

            <div className="flex-1">
              {currentTask.response_mode === 'mcq' ? (
                <div className="space-y-3.5">
                  {currentTask.options?.map((opt, i) => (
                    <button 
                      key={i} 
                      onClick={() => { setSelectedOption(opt); setTimeout(() => handleNextTask(opt), 350); }} 
                      disabled={isEvaluating}
                      className={`w-full p-6 rounded-[1.5rem] border-2 text-left transition-all group relative overflow-hidden ${
                        selectedOption === opt 
                          ? 'border-indigo-600 bg-indigo-50 ring-4 ring-indigo-50 shadow-md' 
                          : 'bg-white border-slate-200/70 hover:border-indigo-300 hover:shadow-lg hover:shadow-slate-200/50 active:scale-[0.98]'
                      }`}
                    >
                      <div className="flex items-center gap-4 relative z-10">
                        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-black text-sm transition-colors ${
                          selectedOption === opt ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'
                        }`}>
                          {String.fromCharCode(65 + i)}
                        </div>
                        <span className="text-lg font-bold text-slate-700">{opt}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : currentTask.response_mode === 'audio' && !useSpeakingFallback ? (
                <div className="bg-white rounded-[2.5rem] p-1 border border-slate-200 shadow-xl shadow-slate-200/30">
                  <SpeakingModule 
                    userId={user?.id}
                    assessmentId={engine.assessmentId}
                    task={currentTask as any} 
                    isEvaluating={isEvaluating} 
                    feedback={null} 
                    retryCount={0} 
                    onSubmit={(res) => handleNextTask(res.answer, res.responseMode, res.speakingMeta)} 
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="relative group">
                    <textarea 
                      value={textValue} 
                      onChange={e => setTextValue(e.target.value)} 
                      placeholder="Type your response here..." 
                      className="w-full h-64 p-8 rounded-[2rem] bg-white border-2 border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all outline-none text-slate-700 text-xl font-medium" 
                    />
                    <div className="absolute bottom-6 right-6 text-[10px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full">{textValue.length} characters</div>
                  </div>
                  <button 
                    onClick={() => handleNextTask(textValue)} 
                    disabled={textValue.length < 5 || isEvaluating} 
                    className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-lg shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 transition-all active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {isEvaluating ? (
                      <span className="flex items-center justify-center gap-2">
                        <RefreshCcw className="animate-spin" size={20} /> Analyzing Consistency...
                      </span>
                    ) : 'Submit Phase Answer'}
                  </button>
                </div>
              )}
            </div>
            
            <div className="mt-12 flex justify-between items-center bg-slate-100/50 p-4 rounded-2xl">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <Shield size={14} /> Encrypted Session
              </div>
              <button 
                onClick={() => setShowQuitDialog(true)} 
                className="px-4 py-2 text-slate-400 font-black text-xs hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showQuitDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-8 max-w-xs w-full text-center space-y-6">
              <h3 className="text-xl font-black text-slate-900">End Assessment?</h3>
              <p className="text-sm text-slate-500">Leaving will lose your current progress.</p>
              <div className="flex flex-col gap-2">
                <button onClick={() => setShowQuitDialog(false)} className="py-3 bg-indigo-600 text-white rounded-xl font-bold">Resume</button>
                <button onClick={() => navigate('/dashboard')} className="py-3 text-slate-400 font-bold">Quit</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LoadingSkeleton = () => <div className="h-screen flex items-center justify-center bg-[#F7F8FC]"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent animate-spin rounded-full" /></div>;

const PreparingBatteryView = () => (
  <div className="h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
    <motion.div 
      initial={{ scale: 0.8, opacity: 0 }} 
      animate={{ scale: 1, opacity: 1 }}
      className="w-24 h-24 bg-white rounded-[2rem] shadow-xl flex items-center justify-center mb-8 relative"
    >
      <div className="absolute inset-0 bg-blue-600/10 animate-ping rounded-[2rem]" />
      <Zap className="text-blue-600" size={40} fill="currentColor" />
    </motion.div>
    <h2 className="text-2xl font-bold text-slate-900 mb-2">Architecting your proficiency scan</h2>
    <p className="text-slate-500 max-w-xs leading-relaxed text-sm">
      We're selecting specialized questions from our hybrid zones to build your personalized assessment.
    </p>
    <div className="mt-12 flex gap-1.5">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
          className="w-2 h-2 bg-blue-600 rounded-full"
        />
      ))}
    </div>
  </div>
);

const AnalyzingTransitionView = ({ isSaving, saveError }: any) => (
  <div className="h-screen bg-white flex flex-col items-center justify-center space-y-8 p-12 text-center">
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="w-20 h-20 rounded-[2rem] bg-indigo-600 flex items-center justify-center"><Brain color="white" size={40} /></motion.div>
    <div className="space-y-2">
      <h2 className="text-3xl font-black text-slate-900">Calculating precise profile...</h2>
      <p className="text-slate-500">Aggregating responses across hybrid zones.</p>
    </div>
  </div>
);

export default DiagnosticView;
