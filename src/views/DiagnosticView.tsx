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
  Play,
  Pause,
  RotateCcw,
  Volume2
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';

import { AssessmentQuestion, AssessmentOutcome, ResponseMode, SpeakingSubmissionMeta, LearnerContextProfile, TaskEvaluation } from '../types/assessment';
import { AdaptiveAssessmentEngine, BatteryProgress } from '../services/AdaptiveAssessmentEngine';
import { AssessmentSaveService } from '../services/AssessmentSaveService';
import { TaskResult, OnboardingState } from '../types/app';
import { DifficultyZone } from '../config/assessment-config';
import { SpeakingModule } from '../components/runtime/modules/SpeakingModule';
import { ReadingLayout } from '../components/runtime/modules/ReadingLayout';


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
  grammar:    { icon: <BookOpen size={14} />,    color: 'text-indigo-600',  bg: 'bg-indigo-50 border-indigo-200',  label: 'Grammar' },
};

// Block info - 3 phases across 40 questions
const BLOCK_INFO: Record<number, { label: string; icon: React.ReactNode; color: string }> = {
  1: { label: 'Foundations', icon: <Zap size={16} />, color: 'text-amber-500' },
  2: { label: 'Deep Dive', icon: <TrendingUp size={16} />, color: 'text-blue-500' },
  3: { label: 'Refinement', icon: <Target size={16} />, color: 'text-indigo-600' },
  4: { label: 'Final Sprint', icon: <Sparkles size={16} />, color: 'text-rose-600' },
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
    <div className="mb-10 p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/20 flex flex-col items-center gap-6 text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-blue-50 flex items-center justify-center text-indigo-600 shadow-inner">
        <Headphones size={40} />
      </div>
      
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-slate-800">Listening Task</h3>
        <p className="text-slate-500 text-sm">Listen carefully, then select the best answer below.</p>
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
        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
          {/* Play/Pause Button */}
          <button
            onClick={handlePlayPause}
            className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-lg shadow-indigo-200 transition-all active:scale-95 flex-shrink-0"
          >
            {isPlaying ? <Pause size={22} fill="white" /> : <Play size={22} fill="white" className="ml-0.5" />}
          </button>

          {/* Progress / Info */}
          <div className="flex-1 min-w-0">
            {useTTS ? (
              <div className="space-y-1">
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">AI Text-to-Speech</p>
                <p className="text-[10px] text-slate-400">{isPlaying ? '🔊 Speaking...' : 'Press play to listen'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                    style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 tabular-nums">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Restart Button */}
          <button
            onClick={handleRestart}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all flex-shrink-0"
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
      
      // 🚀 IMMEDIATE TRANSITION: Move to next question regardless of save status
      AssessmentSaveService.log_and_update_assessment(
        currentTask, 
        evaluation, 
        answer, 
        user?.id, 
        time,
        meta?.audioUrl || (currentTask as any).audioUrl
      ).catch(err => console.warn("[DiagnosticView] Background save failed (non-blocking):", err));
      
      // 🚀 IMMEDIATE TRANSITION: Move to next question regardless of save status
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
  if (!engine.hasBattery() || !currentTask) return <PreparingBatteryView />;

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

  // Split Layout for reading tasks with a stimulus
  const isSplitLayout = !!currentTask.stimulus && currentTask.skill === 'reading';

  // Debug values
  const debugLevel = (currentTask as any)._battery?.item?.target_cefr || currentTask.difficulty || '??';
  const debugZone = (currentTask as any)._battery?.zone || '??';
  const DIFF_MAP_DEBUG: Record<string, number> = { 'a1': 0.1, 'a2': 0.2, 'b1': 0.4, 'b2': 0.6, 'c1': 0.8, 'c2': 1.0 };
  const debugNumeric = (currentTask as any)._battery?.item?.difficulty 
    || DIFF_MAP_DEBUG[String(debugLevel).toLowerCase()] 
    || 0.4;

  const renderHeaderAndContext = () => (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* 🔍 DEBUG BADGE */}
          <div className="mr-2 px-2.5 py-1.5 bg-blue-50/80 border border-blue-100 rounded-lg flex items-center gap-1.5 shadow-sm">
             <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">Debug:</span>
             <span className="text-[10px] font-black text-blue-700 uppercase">
               {debugLevel} ({debugZone})
             </span>
             <span className="mx-1 w-px h-2 bg-blue-200" />
             <span className="text-[10px] font-black text-emerald-600">d={debugNumeric}</span>
             <span className="mx-1 w-px h-2 bg-blue-200" />
             <span className="text-[10px] font-bold text-blue-700 uppercase">{currentTask.skill}</span>
             <span className="mx-1 w-px h-2 bg-blue-200" />
             <span className="text-[10px] font-bold text-blue-700 uppercase">{currentTask.response_mode}</span>
          </div>

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

      {/* NON-LISTENING STIMULUS (Reading without split, or grammar context) */}
      {!isSplitLayout && currentTask.stimulus && currentTask.skill !== 'listening' && (
        <div className="mb-10 p-7 bg-white rounded-[2rem] border border-slate-200/60 shadow-sm text-lg italic text-slate-600 leading-relaxed">
          {currentTask.stimulus}
        </div>
      )}

      {/* 🔊 LISTENING: Robust Audio Player */}
      {currentTask.skill === 'listening' && (
        <ListeningAudioPlayer 
          audioUrl={currentTask.audioUrl}
          stimulus={currentTask.stimulus}
          prompt={currentTask.prompt}
        />
      )}
    </>
  );

  const renderQuestionContent = () => (
    <>
      {/* QUESTION PROMPT */}
      <div className="mb-10">
        <h1 className="text-3xl lg:text-4xl font-black text-slate-900 leading-[1.15] tracking-tight">
          {currentTask.prompt}
        </h1>
      </div>

      {/* RESPONSE INPUT AREA */}
      <div className="flex-1">
        {/* ── MCQ TASKS ── */}
        {isMCQTask && hasOptions ? (
          <div className="space-y-4">
            {currentTask.options!.map((opt, i) => (
              <label 
                key={i} 
                className={`block w-full p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedOption === opt 
                    ? 'border-indigo-600 bg-indigo-50 ring-4 ring-indigo-50' 
                    : 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <input 
                    type="radio"
                    name="mcq-option"
                    value={opt}
                    checked={selectedOption === opt}
                    onChange={() => {
                      setSelectedOption(opt);
                      setTimeout(() => handleNextTask(opt), 400);
                    }}
                    className="w-5 h-5 accent-indigo-600"
                    disabled={isEvaluating}
                  />
                  <span className="text-lg font-bold text-slate-700">{opt}</span>
                </div>
              </label>
            ))}
          </div>
        ) : isMCQTask && !hasOptions ? (
          <div className="p-8 bg-amber-50 rounded-[2rem] border border-amber-100 text-center">
             <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
             <p className="text-amber-900 font-black text-lg">Missing Options</p>
             <button className="mt-6 px-8 py-3.5 bg-amber-600 text-white rounded-2xl font-bold" onClick={handleSkip}>Skip Question</button>
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
            <button onClick={() => setUseSpeakingFallback(true)} className="w-full py-3 text-slate-400 text-xs font-bold font-sans">Switch to typing</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative group">
              <textarea 
                value={textValue} 
                onChange={e => setTextValue(e.target.value)} 
                placeholder={isWritingTask ? "Write your answer here..." : "Type your spoken response here..."} 
                className="w-full h-64 p-8 rounded-[2rem] bg-white border-2 border-slate-200 focus:border-indigo-500 outline-none text-slate-700 text-xl font-medium" 
              />
              <div className="absolute bottom-6 right-6 text-[10px] font-black text-slate-300 bg-slate-50 px-3 py-1 rounded-full">{textValue.length} characters</div>
            </div>
            <button 
              onClick={() => handleNextTask(textValue)} 
              disabled={textValue.length < 5 || isEvaluating} 
              className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-lg"
            >
              {isEvaluating ? 'Evaluating...' : 'Submit Answer'}
            </button>
          </div>
        )}
      </div>
    </>
  );

  const renderFooter = () => (
    <div className="mt-12 flex justify-between items-center bg-slate-100/50 p-4 rounded-2xl">
      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
        <Shield size={14} /> Encrypted Session
      </div>
      <button 
        onClick={handleSkip}
        disabled={isEvaluating}
        className="px-4 py-2 text-slate-400 font-black text-xs hover:text-indigo-600 rounded-xl flex items-center gap-1.5"
      >
        <SkipForward size={12} /> Skip Question
      </button>
    </div>
  );

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
            {progress.answered + 1} / {progress.total}
          </span>
        </div>
        {/* SKIP BUTTON */}
        <button 
          onClick={handleSkip}
          disabled={isEvaluating}
          className="flex items-center gap-1.5 px-4 py-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl text-xs font-bold transition-all disabled:opacity-30"
        >
          <SkipForward size={14} /> Skip
        </button>
      </header>

      <AnimatePresence mode="wait">
        {showBlockTransition && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-white/98 backdrop-blur-md">
            <div className="text-center space-y-6">
              <div className="w-28 h-28 rounded-[2.5rem] bg-indigo-50 flex items-center justify-center mx-auto shadow-2xl shadow-indigo-100/50">
                <span className={BLOCK_INFO[showBlockTransition]?.color || "text-indigo-600"}>
                  {BLOCK_INFO[showBlockTransition]?.icon && React.cloneElement(BLOCK_INFO[showBlockTransition]?.icon as React.ReactElement, { size: 48 })}
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

      <main className="flex-1 overflow-hidden">
        {isSplitLayout ? (
          <ReadingLayout 
            stimulus={currentTask.stimulus!} 
            currentQuestionIndex={progress.answered}
            totalInBundle={4}
          >
            {renderQuestionContent()}
          </ReadingLayout>
        ) : (
          <div className="h-full overflow-y-auto bg-[#F7F8FC]">
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
    <h2 className="text-2xl font-bold text-slate-900 mb-2">Building your 40-question assessment</h2>
    <p className="text-slate-500 max-w-xs leading-relaxed text-sm">
      We're selecting specialized questions across 6 skills to build your personalized IELTS-style diagnostic.
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
      <p className="text-slate-500">Aggregating 40-question responses across all skills.</p>
    </div>
  </div>
);

export default DiagnosticView;
