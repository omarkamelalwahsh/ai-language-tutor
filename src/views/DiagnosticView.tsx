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
  AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';

import { AssessmentQuestion, AssessmentOutcome, ResponseMode, SpeakingSubmissionMeta, LearnerContextProfile, TaskEvaluation } from '../types/assessment';
import { AdaptiveAssessmentEngine } from '../services/AdaptiveAssessmentEngine';
import { AssessmentSaveService } from '../services/AssessmentSaveService';
import { TaskResult, OnboardingState } from '../types/app';
import { SessionTask } from '../types/runtime';
import { AudioPlaybackControl } from '../components/shared/AudioPlaybackControl';
import { SpeakingModule } from '../components/runtime/modules/SpeakingModule';

// --- Types ---
interface DiagnosticViewProps {
  onboardingState?: OnboardingState | null;
  taskResults?: TaskEvaluation[]; 
  onSaveComplete: (results: TaskResult[], outcome: AssessmentOutcome) => void;
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

// ============================================================================
// MAIN DIAGNOSTIC VIEW — FOCUSED SINGLE-COLUMN LAYOUT
// ============================================================================
export const DiagnosticView: React.FC<DiagnosticViewProps> = ({ onSaveComplete, onboardingState, taskResults }) => {
  const navigate = useNavigate();
  const { refreshData: refreshUserProfile, logout, user } = useData() as any;

  // --- Engine Persistence ---
  const engineRef = useRef<AdaptiveAssessmentEngine | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showQuitDialog, setShowQuitDialog] = useState(false);

  if (!engineRef.current) {
    const startBand: any = 'B1';
    const contextProfile: LearnerContextProfile | undefined = onboardingState ? {
      goal: onboardingState.goal || undefined,
      goalContext: onboardingState.goalContext || undefined,
      preferredTopics: (onboardingState.topics || []) as string[],
    } : undefined;

    const engine = new AdaptiveAssessmentEngine(startBand, contextProfile, null);
    if (taskResults && taskResults.length > 0) {
      engine.initializeFromHistory(taskResults, []); 
    }
    engineRef.current = engine;
  }

  const engine = engineRef.current;
  const [currentTask, setCurrentTask] = useState<AssessmentQuestion | null>(null);
  const [progress, setProgress] = useState(engine.getProgress());
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  
  // --- Input State ---
  const [textValue, setTextValue] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [useSpeakingFallback, setUseSpeakingFallback] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  // 🚀 Force explicit state reset on every task transition
  const setTaskWithReset = useCallback((task: AssessmentQuestion | null) => {
    if (task) {
      startTimeRef.current = Date.now();
      setTextValue("");
      setSelectedOption(null);
      setUseSpeakingFallback(false);
      setCurrentTask(task);
      setProgress(engine.getProgress());
    } else {
      setCurrentTask(null);
    }
  }, [engine]);

  // --- Handlers ---
  const handleFinish = useCallback(async () => {
    setIsSaving(true); 
    setIsCompleting(true);
    try {
      const ok = await engine.finalizeAssessment(); 
      if (!ok) {
        throw new Error('Finalization failed');
      }
      await refreshUserProfile().catch(err => console.warn('User profile refresh failed:', err)); 
      
      const academicOutcome = engine.getOutcome();
      const history = engine.getAnswerHistory();
      const evaluations = engine.getEvaluations();

      // ⚡ LIGHTNING RELEASE: Pass raw data to App.tsx and let it handle the rest
      await onSaveComplete(history, academicOutcome, evaluations);
    } catch (e) {
      console.error('[Diagnostic] ❌ Finalization aborted.', e);
      setSaveError('A critical failure occurred during AI analysis. Falling back to local scoring.');
      
      try {
        const academicOutcome = engine.getOutcome();
        const evaluations = engine.getEvaluations();
        await onSaveComplete(engine.getAnswerHistory(), academicOutcome, evaluations);
      } catch (innerE) {
        setTimeout(() => navigate('/dashboard', { replace: true }), 3000);
      }
    }
  }, [engine, navigate, refreshUserProfile, onSaveComplete]);

  useEffect(() => {
    let isSubscribed = true;
    if (!currentTask) {
      const loadInitial = async () => {
        const firstQ = await engine.getNextQuestion();
        if (isSubscribed) {
          if (firstQ) {
            setTaskWithReset(firstQ);
          } else {
            await handleFinish();
          }
        }
      };
      loadInitial();
    }
    return () => { isSubscribed = false; };
  }, [engine, currentTask, handleFinish]);

  const handleNextTask = useCallback(
    async (answer: string, responseMode?: ResponseMode, speakingMeta?: SpeakingSubmissionMeta) => {
      if (!currentTask || isEvaluating) return;
      
      const responseTime = Date.now() - startTimeRef.current;
      setIsEvaluating(true);
      
      try {
        const { evaluation } = await engine.submitAnswer(currentTask, answer, responseTime, responseMode, speakingMeta);
        
        // ⚡ OPTIMISTIC LOGGING: Start save in background, don't wait for it
        AssessmentSaveService.log_and_update_assessment(currentTask, evaluation, answer, user?.id);
        
        setProgress(engine.getProgress());
        const nextQ = await engine.getNextQuestion();
        if (nextQ) {
          setTaskWithReset(nextQ);
        } else {
          await handleFinish();
        }
      } catch (err) {
        console.error("⚠️ [DiagnosticView] Error during submission:", err);
        // Attempt recovery to next question anyway
        const nextQ = await engine.getNextQuestion();
        if (nextQ) setTaskWithReset(nextQ);
        else await handleFinish();
      } finally {
        setIsEvaluating(false);
      }
    },
    [currentTask, engine, isEvaluating, handleFinish]
  );

  const handleSkip = useCallback(async () => {
    if (!currentTask || isEvaluating) return;
    setIsEvaluating(true);
    try {
      const nextQ = await engine.skipQuestion(currentTask.id);
      if (nextQ) {
        setTaskWithReset(nextQ);
      } else {
        await handleFinish();
      }
    } finally {
      setIsEvaluating(false);
    }
  }, [currentTask, isEvaluating, engine, handleFinish]);

  // --- Derived ---
  const progressPercent = Math.round(((progress.answered + 1) / progress.total) * 100);
  const skillInfo = SKILL_CONFIG[currentTask?.skill || 'reading'] || SKILL_CONFIG.reading;

  const canSubmitTyped = textValue.trim().length >= 5;
  
  // 🎯 Input Mode Priority Logic:
  // 1. MCQ tasks are always mcq mode
  // 2. Speaking tasks default to audio unless fallback is active
  // 3. Audio mode requires response_mode === 'audio' (with fallback safety)
  // 4. Everything else is typed
  const isMcqMode = currentTask?.response_mode === 'mcq';
  const isAudioMode = !isMcqMode && currentTask?.response_mode === 'audio' && !useSpeakingFallback;
  const isTypedMode = !isMcqMode && !isAudioMode;

  // --- Render ---
  if (isCompleting) return <SyncingView isSaving={isSaving} saveError={saveError} />;
  if (!currentTask) return <LoadingSkeleton />;

  return (
    <div className="flex flex-col h-screen bg-[#F7F8FC] overflow-hidden font-sans selection:bg-blue-500/20">
      
      {/* ══════════ TOP BAR ══════════ */}
      <header className="shrink-0 px-4 sm:px-8 h-16 flex items-center gap-4 bg-white/80 backdrop-blur-xl border-b border-slate-100 z-30">
        {/* Quit Button */}
        <button 
          onClick={() => setShowQuitDialog(true)}
          className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 transition-all active:scale-90"
          aria-label="Quit assessment"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        {/* Progress Bar */}
        <div className="flex-1 flex items-center gap-3">
          <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner relative">
            <motion.div 
              className="h-full rounded-full relative"
              style={{ 
                background: 'linear-gradient(90deg, #6366F1, #3B82F6, #06B6D4)',
                boxShadow: '0 0 12px rgba(99, 102, 241, 0.4)'
              }}
              initial={{ width: `${(progress.answered / progress.total) * 100}%` }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            >
              {/* Inner shimmer */}
              <div className="absolute inset-0 rounded-full overflow-hidden">
                <div 
                  className="absolute inset-0 opacity-30"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
                    animation: 'shimmer 2s infinite',
                  }}
                />
              </div>
            </motion.div>
          </div>
          <span className="text-xs font-bold text-slate-400 tabular-nums whitespace-nowrap">
            {progress.answered + 1} / {progress.total}
          </span>
        </div>
      </header>

      {/* ══════════ MAIN CONTENT (CENTERED) ══════════ */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 flex flex-col min-h-full">

          <AnimatePresence mode="wait">
            <motion.div
              key={currentTask.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex-1 flex flex-col"
            >
              {/* Skill Badge */}
              <div className="mb-6">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider ${skillInfo.bg} ${skillInfo.color}`}>
                  {skillInfo.icon}
                  {skillInfo.label}
                </span>
              </div>

              {/* ── Stimulus / Context ── */}
              {currentTask.stimulus && (currentTask.skill !== 'listening' || !currentTask.audioUrl) && (
                <div className="mb-6">
                  {currentTask.skill === 'listening' && !currentTask.audioUrl && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 mb-3 bg-amber-50 border border-amber-200 text-amber-600 rounded-lg text-[10px] uppercase font-black tracking-widest">
                      <AlertTriangle size={12} />
                      Audio unavailable — Reading Fallback
                    </div>
                  )}
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/60 text-sm text-slate-600 leading-relaxed font-medium">
                    {currentTask.stimulus}
                  </div>
                </div>
              )}

              {/* ── Audio Player Area (Listening / Pronunciation) ── */}
              {currentTask.audioUrl && (
                <div className="mb-6 flex justify-center p-6 bg-indigo-50/50 rounded-2xl border-2 border-dashed border-indigo-200/50 shadow-inner">
                  <div className="max-w-md w-full">
                    <AudioPlaybackControl 
                      audioUrl={currentTask.audioUrl} 
                      className="bg-white rounded-xl shadow-sm border border-slate-100" 
                    />
                  </div>
                </div>
              )}

              {/* ── Question Prompt ── */}
              <div className={`mb-8 transition-all duration-300 ${isEvaluating ? 'opacity-40 blur-[1px]' : ''}`}>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 leading-snug tracking-tight">
                  {currentTask.prompt || (currentTask as any).text}
                </h2>

                {/* Image Support */}
                {(currentTask as any).imageUrl && (
                  <div className="mt-5 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white max-w-lg">
                    <img 
                      src={(currentTask as any).imageUrl} 
                      alt="Question illustration" 
                      className="w-full h-auto max-h-[280px] object-cover" 
                    />
                  </div>
                )}
              </div>

              {/* ══════════ INPUT AREA ══════════ */}
              <div className="flex-1 flex flex-col">

                {/* ── MCQ Options ── */}
                {isMcqMode && currentTask.options && (
                  <div className="grid gap-3">
                    {currentTask.options.map((opt, i) => (
                      <motion.button
                        key={i}
                        onClick={() => {
                          setSelectedOption(opt);
                          // Auto-submit after a brief visual feedback
                          setTimeout(() => handleNextTask(opt), 350);
                        }}
                        disabled={isEvaluating || selectedOption !== null}
                        whileTap={{ scale: 0.98 }}
                        className={`group w-full p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-center gap-4 text-left relative overflow-hidden ${
                          selectedOption === opt
                            ? 'border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-500/10'
                            : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30 hover:shadow-md'
                        } ${isEvaluating || selectedOption !== null ? 'pointer-events-none' : ''}`}
                      >
                        <span className={`w-8 h-8 rounded-xl border-2 font-bold text-sm flex items-center justify-center shrink-0 transition-all ${
                          selectedOption === opt
                            ? 'border-indigo-500 bg-indigo-500 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-500 group-hover:border-indigo-300 group-hover:text-indigo-500'
                        }`}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className={`text-base sm:text-lg font-medium transition-colors ${
                          selectedOption === opt ? 'text-indigo-700' : 'text-slate-700 group-hover:text-slate-900'
                        }`}>
                          {opt}
                        </span>
                        {selectedOption === opt && (
                          <motion.div 
                            initial={{ scale: 0 }} animate={{ scale: 1 }} 
                            className="ml-auto"
                          >
                            <CheckCircle2 size={20} className="text-indigo-500" />
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                )}

                {/* ── Typed Input (Writing / Speaking Fallback) ── */}
                {isTypedMode && (
                  <div className="space-y-3">
                    {useSpeakingFallback && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-600 rounded-lg text-[10px] uppercase font-black tracking-widest">
                        <Pen size={12} />
                        Typing Mode — Speaking skipped
                      </div>
                    )}
                    <textarea
                      value={textValue}
                      onChange={(e) => setTextValue(e.target.value)}
                      placeholder="Type your answer here…"
                      disabled={isEvaluating}
                      autoFocus
                      className="w-full min-h-[160px] sm:min-h-[200px] p-5 sm:p-6 rounded-2xl bg-white border-2 border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none resize-none text-slate-700 text-base font-medium leading-relaxed placeholder:text-slate-300"
                    />
                    <div className="flex justify-between items-center px-1">
                      {textValue.length > 0 && textValue.length < 5 && (
                        <span className="text-xs font-semibold text-amber-500">Keep going…</span>
                      )}
                      <div className="flex-1" />
                      <span className="text-xs font-semibold text-slate-300 tabular-nums">
                        {textValue.length} characters
                      </span>
                    </div>
                  </div>
                )}

                {/* ── Speaking Input (Audio Recorder) ── */}
                {isAudioMode && (
                  <div className="space-y-4">
                    <SpeakingModule 
                      task={currentTask as any}
                      isEvaluating={isEvaluating}
                      feedback={null}
                      retryCount={0}
                      onSubmit={(res) => handleNextTask(res.answer, res.responseMode, res.speakingMeta)}
                    />
                    <div className="flex justify-center pt-2">
                      <button 
                        onClick={() => setUseSpeakingFallback(true)}
                        className="text-xs font-semibold text-slate-400 hover:text-indigo-500 underline underline-offset-4 decoration-dashed transition"
                      >
                        Can't talk right now? Switch to typing
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* ══════════ FOOTER ACTIONS ══════════ */}
          {!isMcqMode && (
            <div className="mt-auto pt-6 pb-4 flex items-center justify-between gap-3 shrink-0">
              <button 
                onClick={handleSkip}
                disabled={isEvaluating}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all disabled:opacity-40"
              >
                Skip
              </button>

              {isTypedMode && (
                <button 
                  onClick={() => handleNextTask(textValue)}
                  disabled={isEvaluating || !canSubmitTyped}
                  className={`px-8 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 flex items-center gap-2 ${
                    canSubmitTyped && !isEvaluating
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 hover:shadow-xl'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  {isEvaluating ? <SubmittingLoader /> : (
                    <>
                      Check Answer
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* MCQ skip only */}
          {isMcqMode && (
            <div className="mt-auto pt-6 pb-4 flex items-center justify-end shrink-0">
              <button 
                onClick={handleSkip}
                disabled={isEvaluating}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all disabled:opacity-40 flex items-center gap-1.5"
              >
                <SkipForward size={14} />
                Skip
              </button>
            </div>
          )}
        </div>
      </main>

      {/* ══════════ QUIT CONFIRMATION DIALOG ══════════ */}
      <AnimatePresence>
        {showQuitDialog && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setShowQuitDialog(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", duration: 0.4 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center space-y-5"
            >
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto">
                <AlertTriangle size={28} className="text-rose-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Quit Assessment?</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Your progress will <strong>not</strong> be saved. You'll need to start over next time.
                </p>
              </div>
              <div className="flex flex-col gap-2.5">
                <button 
                  onClick={() => setShowQuitDialog(false)}
                  className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/20"
                >
                  Continue Learning
                </button>
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="w-full py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 font-semibold text-sm hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all"
                >
                  Quit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shimmer animation keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};


// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const SubmittingLoader = () => (
  <div className="flex items-center gap-2">
    <RefreshCcw size={14} className="animate-spin" />
    <span>Checking…</span>
  </div>
);

const LoadingSkeleton = () => (
  <div className="h-screen w-full bg-[#F7F8FC] flex items-center justify-center">
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <div className="w-16 h-16 border-[4px] border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
      </div>
      <div className="text-center space-y-1.5">
        <p className="text-sm font-bold text-slate-700">Preparing your assessment…</p>
        <p className="text-xs text-slate-400">Building personalized question set</p>
      </div>
    </div>
  </div>
);

const SyncingView = ({ isSaving, saveError }: any) => (
  <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center p-6">
    <div className="flex flex-col items-center gap-6 text-center max-w-sm">
      <div className="relative">
        <div className="w-20 h-20 rounded-3xl bg-white border border-slate-100 shadow-xl flex items-center justify-center">
          <RefreshCcw className={`w-9 h-9 text-indigo-500 ${isSaving ? 'animate-spin' : ''}`} />
        </div>
        <motion.div 
          initial={{ scale: 0 }} animate={{ scale: 1 }} 
          transition={{ delay: 0.3 }}
          className="absolute -top-2 -right-2 w-7 h-7 bg-emerald-500 rounded-full border-4 border-[#F7F8FC] flex items-center justify-center shadow-lg"
        >
          <CheckCircle2 size={14} className="text-white" />
        </motion.div>
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-slate-900 tracking-tight">Analyzing Your Results…</h3>
        <p className="text-sm text-slate-500">Our AI is evaluating your performance and building your learning profile.</p>
      </div>
      <div className="flex flex-col gap-1.5 mt-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-500 animate-pulse">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          Running Scorer Engine
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-500 animate-pulse" style={{ animationDelay: '0.5s' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Running Diagnostic Analyst
        </div>
      </div>
      {saveError && (
        <p className="text-rose-500 text-xs font-semibold mt-3 px-4 py-2 bg-rose-50 rounded-xl border border-rose-200">
          ⚠️ {saveError}
        </p>
      )}
    </div>
  </div>
);

export default DiagnosticView;
