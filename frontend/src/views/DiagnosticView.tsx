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
  Target,
  AlertTriangle, 
  Shield, 
  TrendingUp, 
  Brain, 
  MessageSquare,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Volume2
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { NeuralPulseLoader } from '../components/common/NeuralPulseLoader';

import { AssessmentQuestion, AssessmentOutcome, ResponseMode, SpeakingSubmissionMeta, LearnerContextProfile, TaskEvaluation } from '../types/assessment';
import { AdaptiveAssessmentEngine, BatteryProgress } from '../services/AdaptiveAssessmentEngine';
import { AssessmentSaveService } from '../services/AssessmentSaveService';
import { TaskResult, OnboardingState } from '../types/app';
import { DifficultyZone } from '../config/assessment-config';
import { SpeakingModule } from '../components/runtime/modules/SpeakingModule';
import { ReadingLayout } from '../components/runtime/modules/ReadingLayout';
import ThemeToggle from '../components/ThemeToggle';


// --- Types ---
interface DiagnosticViewProps {
  onboardingState?: OnboardingState | null;
  taskResults?: TaskEvaluation[]; 
  onSaveComplete: (results: TaskResult[], outcome: AssessmentOutcome, evaluations: TaskEvaluation[]) => void;
}

// ═══════════════════════════════════════════════════════════════
// PRODUCTION vs RECEPTIVE SKILL CLASSIFICATION
// ═══════════════════════════════════════════════════════════════
const MCQ_SKILLS = ['grammar', 'vocabulary', 'reading', 'listening'];
const PRODUCTION_SKILLS = ['writing', 'speaking'];

// Skill badge config
const SKILL_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  reading:    { icon: <BookOpen size={14} />,    color: 'text-violet-600',  bg: 'bg-violet-50 border-violet-200', label: 'Reading' },
  listening:  { icon: <Headphones size={14} />,  color: 'text-sky-600',     bg: 'bg-sky-50 border-sky-200',       label: 'Listening' },
  writing:    { icon: <Pen size={14} />,         color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'Writing' },
  speaking:   { icon: <Mic size={14} />,         color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',    label: 'Speaking' },
  vocabulary: { icon: <Zap size={14} />,         color: 'text-rose-600',    bg: 'bg-rose-50 border-rose-200',      label: 'Vocabulary' },
  grammar:    { icon: <BookOpen size={14} />,    color: 'text-blue-600 dark:text-blue-400',  bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',  label: 'Grammar' },
};

// Block info - 4 sequential skill blocks across 40 questions
const BLOCK_INFO: Record<number, { label: string; icon: React.ReactNode; color: string }> = {
  1: { label: 'Reading & Grammar', icon: <BookOpen size={16} />, color: 'text-blue-600 dark:text-blue-400' },
  2: { label: 'Writing', icon: <Pen size={16} />, color: 'text-emerald-600 dark:text-emerald-400' },
  3: { label: 'Listening', icon: <Headphones size={16} />, color: 'text-sky-600 dark:text-sky-400' },
  4: { label: 'Speaking', icon: <Mic size={16} />, color: 'text-amber-600 dark:text-amber-400' },
};

// دالة لتنظيف النص واستخراج الـ Scenario بأمان
const cleanPromptText = (rawText: string) => {
  if (!rawText) return "";
  
  try {
    // بنحاول نفك الـ JSON
    const parsedData = JSON.parse(rawText);
    
    // لو نجح وفيه كلمة scenario، نعرضها هي بس
    if (parsedData && parsedData.scenario) {
      return parsedData.scenario;
    }
    
    // لو مفيش scenario بس هو JSON، نرجعه كنص احتياطي
    return parsedData.task || parsedData.description || rawText; 
  } catch (error) {
    // لو النص مش JSON أصلاً (نص عادي)، نعرضه زي ما هو
    return rawText.replace(/^(Scenario|Task|Context):\s*/i, '');
  }
};

// ═══════════════════════════════════════════════════════════════
// 🔊 ROBUST AUDIO PLAYER COMPONENT
// ═══════════════════════════════════════════════════════════════
const ListeningAudioPlayer: React.FC<{ audioUrl?: string; stimulus?: string; prompt: string }> = ({ audioUrl, stimulus, prompt }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [useTTS, setUseTTS] = useState(false);

  // Determine audio source
  const audioSrc = audioUrl || (stimulus?.startsWith('http') ? stimulus : null);

  useEffect(() => {
    // If no real audio URL, default to TTS mode
    if (!audioSrc) {
      setUseTTS(true);
    }
  }, [audioSrc]);

  const handlePlayPause = () => {
    if (useTTS) {
      if (isPlaying) {
        window.speechSynthesis?.cancel();
        setIsPlaying(false);
      } else {
        const text = stimulus || prompt;
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.85;
        utterance.pitch = 1.0;
        utterance.lang = 'en-US';
        utterance.onend = () => setIsPlaying(false);
        window.speechSynthesis.speak(utterance);
        setIsPlaying(true);
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {
        // Fallback to TTS if audio fails
        setUseTTS(true);
        handlePlayPause();
      });
      setIsPlaying(true);
    }
  };

  const handleRestart = () => {
    if (useTTS) {
      window.speechSynthesis?.cancel();
      setIsPlaying(false);
      setTimeout(() => handlePlayPause(), 100);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play();
    setIsPlaying(true);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mb-10 p-8 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 rounded-[2.5rem] shadow-premium transition-all">
      <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner mb-6">
        <Headphones size={40} />
      </div>
      
      <div className="space-y-1 mb-8">
        <h3 className="text-xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight">Play Audio</h3>
        <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Listen carefully, then select the best answer below.</p>
      </div>

      {/* Hidden native audio element for real audio files */}
      {audioSrc && (
        <audio 
          ref={audioRef}
          src={audioSrc}
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
          onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
          onEnded={() => setIsPlaying(false)}
          onError={() => setUseTTS(true)}
          preload="auto"
        />
      )}

      {/* Custom Audio Controls */}
      <div className="w-full max-w-md">
        <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/50 dark:border-gray-800">
          {/* Play/Pause Button */}
          <button
            onClick={handlePlayPause}
            className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 text-white flex items-center justify-center shadow-premium dark:shadow-md transition-all active:scale-95 flex-shrink-0"
          >
            {isPlaying ? <Pause size={22} fill="white" /> : <Play size={22} fill="white" className="ml-0.5" />}
          </button>

          {/* Progress / Info */}
          <div className="flex-1 min-w-0">
            {useTTS ? (
              <div className="space-y-1">
                <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">AI Text-to-Speech</p>
                <p className="text-[10px] font-bold text-slate-400">{isPlaying ? '🔊 Speaking...' : 'Press play to listen'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-black text-slate-400 tabular-nums uppercase tracking-widest">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Restart Button */}
          <button
            onClick={handleRestart}
            className="w-10 h-10 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-slate-500 flex items-center justify-center transition-all flex-shrink-0 border border-slate-200/50 dark:border-transparent"
            title="Replay"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* Audio mode indicator */}
        <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <Volume2 size={10} />
          {useTTS ? 'Browser TTS Engine' : 'Audio Track'}
        </div>
      </div>
    </div>
  );
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
  
  // 🛡️ PRE-FLIGHT SYSTEM INTEGRITY STATES
  const [integrityStatus, setIntegrityStatus] = useState<'pending' | 'ok' | 'failed'>('pending');
  const [integrityError, setIntegrityError] = useState<string | null>(null);

  const [textValue, setTextValue] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [useSpeakingFallback, setUseSpeakingFallback] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  const setTaskWithReset = useCallback((task: AssessmentQuestion | null) => {
    if (task) {
      // Stop any ongoing TTS when moving to next question
      window.speechSynthesis?.cancel();
      
      startTimeRef.current = Date.now();
      setTextValue("");
      setSelectedOption(null);
      setUseSpeakingFallback(false);
      setCurrentTask(task);
      const nextProgress = engine.getProgress();
      
      // Block transition check
      if (nextProgress.currentBlock !== prevBlockRef.current && prevBlockRef.current !== null) {
        setShowBlockTransition(nextProgress.currentBlock);
        
        // 🔄 Live Refresh: Pull updated skill states from DB
        if (refreshUserProfile) {
           refreshUserProfile();
        }

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
      const outcome = engine.getOutcome();
      const history = engine.getAnswerHistory();
      const evaluations = engine.getEvaluations();
      
      // Explicitly fetch user to ensure session validity before finalizing
      const { supabase } = await import('../lib/supabaseClient');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("User session lost");

      try {
        await onSaveComplete(history, outcome, evaluations);
        // App.tsx handleAssessmentSave now handles the navigation.
      } catch (saveErr) {
        console.error("Save failure in App context:", saveErr);
        setSaveError('حدث خطأ أثناء حفظ النتائج، برجاء المحاولة مرة أخرى');
      }
    } catch (err: any) {
      console.error("Critical Save Error:", err);
      setSaveError(err?.message || 'AI analysis failed. Please try again or return to dashboard.');
    }
  }, [engine, onSaveComplete]);

  // 🚀 BOOTSTRAP EFFECT: Runs once on mount
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    console.log("[DiagnosticView] Initializing assessment bootstrap...");
    
    const bootstrap = async () => {
      try {
        setIntegrityStatus('pending');
        
        // 1. Audit Auth and DB Link
        const audit = await AssessmentSaveService.checkSystemIntegrity(user?.id);
        
        if (!audit.ok) {
          setIntegrityStatus('failed');
          setIntegrityError(audit.message);
          return; // 🛑 ATOMIC LOCK: DO NOT START EXAM
        }

        setIntegrityStatus('ok');
        console.log("[DiagnosticView] System Integrity Check Passed ✅");

        // 2. ⚓ SESSION ANCHOR: Create parent record to satisfy foreign key constraints
        // We do this BEFORE initialize() so that any background logic in initialize has a valid session ID
        if (user?.id) {
          console.log("[DiagnosticView] Anchoring session in DB...");
          try {
            await AssessmentSaveService.initializeAssessmentSession(engine.assessmentId, user.id);
          } catch (anchorErr: any) {
            console.error("[DiagnosticView] ❌ Atomic Anchor Failed:", anchorErr);
            setIntegrityStatus('failed');
            setIntegrityError(`Session Anchor Failure: ${anchorErr.message}`);
            return;
          }
        }

        // 3. 🟢 [READY] LOG: Final Pre-Flight Confirmation
        console.log(`%c[READY] Assessment ID: ${engine.assessmentId} | User ID: ${user?.id}`, 'color: #22c55e; font-weight: bold; font-size: 14px;');

        // 4. Initialize Engine and fetch first question
        await engine.initialize();
        const q = await engine.getNextQuestion();
        if (q) {
          setTaskWithReset(q);
        } else {
          handleFinish();
        }
      } catch (err: any) {
        console.error("[DiagnosticView] Bootstrap Failure:", err);
        setIntegrityStatus('failed');
        setIntegrityError(err.message || "An unexpected error occurred during initialization.");
      }
    };

    bootstrap();
  }, [engine, handleFinish, setTaskWithReset]);

  // 🚀 AUTH SYNC EFFECT: Monitors the user object and updates the engine reactively
  useEffect(() => {
    if (user?.id) {
      engine.setUserId(user.id);
    }
  }, [user?.id, engine]);

  const handleNextTask = useCallback(async (answer: string, mode?: ResponseMode, meta?: SpeakingSubmissionMeta) => {
    if (!currentTask || isEvaluating) return;
    const time = Date.now() - startTimeRef.current;
    setIsEvaluating(true);
    try {
      const { evaluation } = await engine.submitAnswer(currentTask, answer, time, mode, meta);
      
      // 🚀 ATOMIC SYNC: Block the UI and await persistence before moving forward
      console.log(`[DiagnosticView] Question ${currentTask.id} evaluated. Awaiting DB sync...`);
      
      try {
        await AssessmentSaveService.log_and_update_assessment(
          currentTask, 
          evaluation, 
          answer, 
          user?.id, 
          time,
          meta?.audioUrl || (currentTask as any).audioUrl
        );
        console.log(`[DiagnosticView] ✅ Atomic sync confirmed for ${currentTask.id}`);
      } catch (saveErr) {
        console.error("[DiagnosticView] ⚠️ Atomic sync failed:", saveErr);
        // We continue to next question to avoid blocking the user if save fails after retries
      }
      
      const next = await engine.getNextQuestion();
      if (next) setTaskWithReset(next);
      else await handleFinish();
    } catch (err) {
      console.error("[DiagnosticView] Error during task transition:", err);
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
    window.speechSynthesis?.cancel(); // Stop TTS on skip
    const next = await engine.skipQuestion(currentTask.id);
    if (next) setTaskWithReset(next);
    else await handleFinish();
    setIsEvaluating(false);
  }, [currentTask, isEvaluating, engine, handleFinish, setTaskWithReset]);

  if (isCompleting) return <AnalyzingTransitionView isSaving={isSaving} saveError={saveError} />;
  
  // 🛡️ INTEGRITY FAILURE SCREEN
  if (integrityStatus === 'failed') {
    return (
      <div className="h-screen bg-slate-50 dark:bg-gray-950 flex flex-col items-center justify-center p-12 text-center transition-colors duration-300">
        <div className="w-20 h-20 bg-rose-600 dark:bg-rose-500 rounded-[2rem] flex items-center justify-center mb-8 shadow-premium dark:shadow-md shadow-rose-500/20">
          <AlertTriangle color="white" size={40} />
        </div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 mb-4 italic tracking-tight uppercase">System Integrity Failure</h2>
        <p className="text-slate-400 dark:text-slate-500 max-w-md mx-auto mb-8 font-black uppercase tracking-widest text-[10px]">
          {integrityError || "A critical connection error prevented the assessment from starting."}
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="px-10 py-5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 rounded-2xl font-black uppercase tracking-widest shadow-premium hover:scale-105 transition-all active:scale-95 text-xs border border-slate-200 dark:border-slate-700"
        >
          Retry Connection Audit
        </button>
      </div>
    );
  }

  if (integrityStatus === 'pending' || !engine?.hasBattery() || !currentTask) {
     const statusText = integrityStatus === 'pending' 
      ? "Verifying System Integrity Audit..." 
      : (!engine?.hasBattery() ? "Anchoring Assessment Session & Forging Battery..." : undefined);
      
     return <PreparingBatteryView status={statusText} />;
  }

  const skillInfo = SKILL_CONFIG[currentTask.skill] || SKILL_CONFIG.reading;
  const zoneInfo = progress.currentZone ? ZONE_CONFIG[progress.currentZone] : null;

  // ═══════════════════════════════════════════════════════════════
  // STRICT RESPONSE MODE CLASSIFICATION (matches BatterySelector)
  // MCQ  = grammar, vocabulary, reading, listening (32 questions)
  // typed = writing (4 questions)
  // audio = speaking (4 questions)
  // ═══════════════════════════════════════════════════════════════
  const responseMode = (currentTask.response_mode || 'mcq') as string;
  const isMCQTask = responseMode === 'mcq';
  const isWritingTask = responseMode === 'typed';
  const isSpeakingTask = responseMode === 'audio';
  const hasOptions = currentTask.options && currentTask.options.length > 0;

  // Split Layout for reading/grammar/writing tasks with a stimulus (Blocks 1 & 2)
  const isSplitLayout = !!currentTask.stimulus && 
    (currentTask.skill === 'reading' || currentTask.skill === 'grammar' || currentTask.skill === 'writing');

  // Debug values
  const debugLevel = (currentTask as any)._battery?.item?.level || currentTask.difficulty || '??';
  const debugZone = (currentTask as any)._battery?.zone || '??';
  const DIFF_MAP_DEBUG: Record<string, number> = { 'a1': 0.1, 'a2': 0.2, 'b1': 0.4, 'b2': 0.6, 'c1': 0.8, 'c2': 1.0 };
  const debugNumeric = (currentTask as any)._battery?.item?.difficulty 
    || DIFF_MAP_DEBUG[String(debugLevel).toLowerCase()] 
    || 0.4;

  const renderHeaderAndContext = () => (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* 🔍 DEBUG BADGE (Subtle) */}
          <div className="mr-2 px-2.5 py-1.5 bg-slate-100 dark:bg-blue-900/30 border border-slate-200 dark:border-blue-900/50 rounded-lg flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity">
             <span className="text-[9px] font-black text-slate-400 dark:text-blue-500 uppercase tracking-tighter">BETA_V3</span>
             <span className="mx-1 w-px h-2 bg-slate-300 dark:bg-blue-800" />
             <span className="text-[10px] font-black text-slate-500 dark:text-blue-300 uppercase">
               {debugLevel}
             </span>
          </div>

          <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest shadow-premium ${skillInfo.bg} ${skillInfo.color}`}>
            {skillInfo.icon} {skillInfo.label}
          </span>
          {zoneInfo && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest shadow-premium ${zoneInfo.bg} ${zoneInfo.color}`}>
              {zoneInfo.icon} {zoneInfo.label}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end">
          <div className="px-3 py-1 bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-500/20 shadow-sm">
            Diagnostic Phase
          </div>
          <div className="mt-1 text-[9px] font-black text-slate-400 uppercase tracking-tighter">
            {progress.answered + 1} / {progress.total} Data Points
          </div>
        </div>
      </div>

      {/* NON-LISTENING STIMULUS (Reading without split, or grammar context) */}
      {!isSplitLayout && currentTask.stimulus && currentTask.skill !== 'listening' && (
        <div className="mb-10 p-8 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-[2rem] shadow-premium text-lg italic text-slate-600 dark:text-slate-400 leading-relaxed font-serif">
          {cleanPromptText(currentTask.stimulus)}
        </div>
      )}

      {/* 🔊 LISTENING: Robust Audio Player */}
      {currentTask.skill === 'listening' && (
        <ListeningAudioPlayer 
          audioUrl={currentTask.audioUrl}
          stimulus={cleanPromptText(currentTask.stimulus)}
          prompt={cleanPromptText(currentTask.prompt)}
        />
      )}
    </>
  );

  const renderQuestionContent = () => (
    <>
      {/* QUESTION PROMPT */}
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-800 dark:text-slate-200 leading-[1.2] tracking-tight mb-4">
          {cleanPromptText(currentTask.prompt)}
        </h1>
      </div>

      {/* RESPONSE INPUT AREA */}
      <div className="flex-1">
        {(() => {
          // Debug snippet from user requested
          console.log("Current Task UI Debug:", currentTask, "hasOptions:", hasOptions);
          return null;
        })()}

        {/* ── MCQ TASKS ── */}
        {isMCQTask && hasOptions ? (
          <div className="space-y-4">
            {currentTask.options!.map((opt, i) => (
              <label 
                key={i} 
                className={`block w-full p-4 md:p-6 min-h-[64px] rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedOption === opt 
                    ? 'border-blue-600 dark:border-blue-400 bg-blue-50/80 dark:bg-blue-900/40 shadow-md transform scale-[1.01]' 
                    : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 hover:border-slate-300 dark:hover:border-blue-700/50 hover:bg-slate-50 shadow-sm transition-colors hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedOption === opt ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-slate-300 dark:border-gray-600'
                    }`}>
                      {selectedOption === opt && <div className="w-2.5 h-2.5 bg-white rounded-full shadow-sm" />}
                    </div>
                    <span className="text-xl font-black text-slate-800 dark:text-slate-200 tracking-tight">{opt}</span>
                  </div>
                  <input 
                    type="radio"
                    name="mcq-option"
                    value={opt}
                    checked={selectedOption === opt}
                    onChange={() => {
                      setSelectedOption(opt);
                      setTimeout(() => handleNextTask(opt), 400);
                    }}
                    className="hidden"
                    disabled={isEvaluating}
                  />
                  {selectedOption === opt && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <CheckCircle2 size={24} className="text-blue-600 dark:text-blue-400" />
                    </motion.div>
                  )}
                </div>
              </label>
            ))}
          </div>
        ) : isSpeakingTask && !useSpeakingFallback ? (
          <div className="space-y-4">
            <SpeakingModule 
              userId={user?.id}
              assessmentId={engine.assessmentId}
              task={currentTask as any} 
              isEvaluating={isEvaluating} 
              feedback={null} 
              retryCount={0} 
              onSubmit={(res) => handleNextTask(res.answer, res.responseMode, res.speakingMeta)} 
            />
            <button onClick={() => setUseSpeakingFallback(true)} className="w-full py-3 text-slate-400 text-xs font-bold font-sans hover:text-blue-600 dark:text-blue-400 transition-colors">Switch to typing</button>
          </div>
        ) : (
            <div className="space-y-6">
              <div className="relative group">
                <div className="mb-3 flex items-center justify-between">
                   <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                      Use complete sentences and clear structure.
                   </p>
                   <div className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${textValue.trim().split(/\s+/).filter(w => w.length > 0).length >= 60 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-slate-400'}`}>
                      {textValue.trim().split(/\s+/).filter(w => w.length > 0).length} / 60–80 words
                   </div>
                </div>
                <textarea 
                  value={textValue} 
                  onChange={e => setTextValue(e.target.value)} 
                  placeholder={isWritingTask ? "Write your response here..." : "Your spoken answer will appear here..."} 
                  className="w-full min-h-[200px] h-48 md:h-72 p-6 md:p-10 rounded-[2rem] bg-white dark:bg-gray-900 border-2 border-slate-200 dark:border-gray-800 focus:border-blue-600 dark:focus:border-blue-400 outline-none text-slate-800 dark:text-slate-200 text-xl font-medium resize-none shadow-premium transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600" 
                  disabled={isEvaluating}
                />
                {textValue.trim().length === 0 && !isSpeakingTask && (
                   <div className="text-sm text-amber-600 font-medium mt-2 px-2">
                     Please enter your answer before continuing.
                   </div>
                )}
              </div>
              <button 
                onClick={() => handleNextTask(textValue)} 
                disabled={textValue.trim().length === 0 || isEvaluating} 
                className="w-full md:w-auto md:min-w-[250px] min-h-[56px] py-4 px-8 bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 text-white rounded-2xl font-black text-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-premium hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 ml-auto"
              >
                {isEvaluating ? 'Processing your answer...' : 'Submit Answer'} <ArrowRight size={20} />
              </button>
            </div>
        )}
      </div>
    </>
  );

  const renderFooter = () => (
    <div className="mt-12 flex justify-between items-center bg-blue-50/50 dark:bg-white/5 p-5 rounded-[2rem] border border-blue-100 dark:border-transparent">
      <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 dark:text-slate-500 uppercase tracking-widest">
        <Shield size={14} /> SECURE PROTOCOL v3
      </div>
      <button 
        onClick={handleSkip}
        disabled={isEvaluating}
        title="Skipped questions may affect accuracy of your result."
        className="px-6 py-2.5 min-h-[44px] text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 font-black text-[10px] uppercase tracking-widest rounded-xl flex items-center gap-1.5 transition-all hover:bg-white dark:hover:bg-white/5 shadow-sm hover:shadow-premium"
      >
        <SkipForward size={14} /> Skip Step
      </button>
    </div>
  );

  return (

    <div className="flex flex-col h-screen bg-slate-50 dark:bg-gray-950 overflow-hidden font-sans prestige-gpu transition-colors duration-300">
      <header className="shrink-0 px-8 h-20 flex items-center gap-8 bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 shadow-sm relative z-20">
        <button onClick={() => setShowQuitDialog(true)} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all shadow-sm">
          <X size={20} />
        </button>
        <div className="flex-1 flex items-center gap-6">
          <div className="flex-1 h-3 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden shadow-inner border border-slate-200 dark:border-transparent">
            <motion.div className="h-full bg-blue-600" animate={{ width: `${progress.percentage}%` }} transition={{ duration: 0.5 }} />
          </div>
          <span className="text-xs font-black text-slate-600 dark:text-slate-400 tabular-nums tracking-widest uppercase">
            Question {progress.answered + 1} of {progress.total} • {skillInfo.label}
          </span>
        </div>
        {/* SKIP BUTTON */}
        <button 
          onClick={handleSkip}
          disabled={isEvaluating}
          title="Skipped questions may affect accuracy of your result."
          className="flex items-center justify-center min-h-[44px] gap-2 px-4 md:px-6 py-2.5 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 border border-slate-200 dark:border-transparent shadow-sm"
        >
          <SkipForward size={14} /> Skip
        </button>
        {/* THEME TOGGLE */}
        <ThemeToggle />
      </header>

      <AnimatePresence mode="wait">
        {showBlockTransition && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50">
            <div className="text-center space-y-6">
              <div className="w-28 h-28 rounded-[2.5rem] bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mx-auto shadow-sm dark:shadow-md">
                <span className={BLOCK_INFO[showBlockTransition]?.color || "text-blue-600 dark:text-blue-400"}>
                  {BLOCK_INFO[showBlockTransition]?.icon && React.cloneElement(BLOCK_INFO[showBlockTransition]?.icon as React.ReactElement, { size: 48 })}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-blue-600 dark:text-blue-400 font-black uppercase tracking-[0.2em] text-[10px]">Processing Phase {showBlockTransition} of 4</p>
                <h2 className="text-5xl font-black text-slate-800 dark:text-slate-200 tracking-tight">{BLOCK_INFO[showBlockTransition]?.label}</h2>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-hidden">
        {isSplitLayout ? (
          <ReadingLayout 
            stimulus={currentTask.stimulus!} 
            currentQuestionIndex={progress.answered}
            totalInBundle={progress.currentBlock === 1 ? 15 : 5}
            activeSkill={currentTask.skill as 'reading' | 'grammar' | 'writing'}
          >
            {renderQuestionContent()}
          </ReadingLayout>
        ) : (
          <div className="h-full overflow-y-auto bg-slate-50 dark:bg-gray-950">
            <div className="max-w-2xl mx-auto px-8 py-16 flex flex-col min-h-full">
               {renderHeaderAndContext()}
               {renderQuestionContent()}
               {renderFooter()}
            </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {showQuitDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 max-w-sm w-full text-center space-y-8 shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="w-20 h-20 bg-rose-50 dark:bg-rose-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-2">
                <AlertTriangle className="text-rose-600 dark:text-rose-500" size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight">End Assessment?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">Are you sure you want to exit? Your progress will be lost.</p>
              </div>
              <div className="flex flex-col gap-3">
                <button onClick={() => setShowQuitDialog(false)} className="py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-premium transition-all hover:scale-[1.02] active:scale-95 text-xs">Stay & Finish</button>
                <button onClick={() => navigate('/dashboard')} className="py-4 text-slate-400 hover:text-rose-500 font-black uppercase tracking-widest transition-all text-[10px]">Terminate Session</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PreparingBatteryView = ({ status }: { status?: string }) => (
  <NeuralPulseLoader status={status || "Forging Personalized Assessment Protocol..."} fullscreen />
);

const AnalyzingTransitionView = ({ isSaving, saveError }: any) => {
  if (!saveError) return (
    <NeuralPulseLoader 
      status="Deep Analysis in Progress (Model B Audit)..." 
      subtitle="The 70B Cloud Model is performing a final deep-dive check on your 40-question session for precise CEFR placement."
      fullscreen 
    />
  );
  
  return (
    <div className="h-screen bg-slate-50 dark:bg-gray-950 flex flex-col items-center justify-center space-y-12 p-12 text-center prestige-gpu">
      <motion.div 
        animate={saveError ? { rotate: [0, -10, 10, -10, 10, 0] } : { rotate: 360 }} 
        transition={saveError ? { duration: 0.5 } : { duration: 3, repeat: Infinity, ease: "linear" }} 
        className={`w-28 h-28 rounded-[2.5rem] flex items-center justify-center shadow-premium ${saveError ? 'bg-rose-600 shadow-rose-200' : 'bg-blue-600 shadow-blue-200 dark:shadow-none'}`}
      >
        {saveError ? <AlertTriangle color="white" size={48} /> : <Brain color="white" size={48} />}
      </motion.div>
      <div className="space-y-3">
        <h2 className="text-4xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight">{saveError ? 'ANALYSIS_ERR: 0x51' : 'SYNCHRONIZING PROFILE'}</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed font-black uppercase tracking-widest text-[10px]">
          {saveError || 'AGGREGATING 40-QUESTION METRICS ACROSS LINGUISTIC TWIN MODEL.'}
        </p>
      </div>
      {saveError && (
        <div className="flex flex-col md:flex-row gap-6 pt-8">
          <button 
            onClick={() => window.location.reload()}
            className="px-10 py-5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 rounded-2xl font-black uppercase tracking-widest shadow-premium hover:scale-105 transition-all text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-3"
          >
            <RefreshCcw size={18} /> RELOAD CORE
          </button>
          <a 
            href="/dashboard"
            className="px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-premium hover:scale-105 transition-all text-xs flex items-center gap-3"
          >
            DASHBOARD_RECOVERY <ArrowRight size={18} />
          </a>
        </div>
      )}
    </div>
  );
};

export default DiagnosticView;
