import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCcw,
  Loader2,
  Activity,
  Target,
  Info,
  ShieldCheck,
  Save,
  Mic,
  Headphones,
} from 'lucide-react';
import { AudioPlaybackControl } from '../components/shared/AudioPlaybackControl';
import {
  sessionService,
  SessionBatch,
  SessionTask,
  TaskResult,
  SessionCompleteResponse,
  EvaluateTaskResponse,
} from '../services/sessionService';
import SessionCompleteModal from '../components/session/SessionCompleteModal';

interface DailyMixRuntimeViewProps {
  mode?: 'daily_mix' | 'skill_practice';
  skill?: string;
}

const SLOT_LABELS: Record<string, { label: string; tone: string }> = {
  review: { label: 'Weak Spot Review', tone: 'text-amber-300' },
  journey: { label: 'Journey Step', tone: 'text-indigo-300' },
  maintenance: { label: 'Strength Drill', tone: 'text-emerald-300' },
  targeted: { label: 'Targeted Practice', tone: 'text-indigo-300' },
};

/** Local heuristic scorer — backend will re-score via the Evaluator if needed. */
function evaluateLocally(task: SessionTask, userAnswer: string): { score: number; is_correct: boolean } {
  const target = (task.content.target_response || '').trim().toLowerCase();
  const answer = userAnswer.trim().toLowerCase();

  if (!answer) return { score: 0, is_correct: false };
  if (!target) {
    // Open-ended: reward effort + length up to 1.0
    const lenScore = Math.min(1, answer.split(/\s+/).length / 18);
    return { score: lenScore, is_correct: lenScore >= 0.5 };
  }

  if (answer === target) return { score: 1, is_correct: true };

  const targetWords = new Set(target.split(/\s+/).filter(Boolean));
  const answerWords = answer.split(/\s+/).filter(Boolean);
  const overlap = answerWords.filter((w) => targetWords.has(w)).length;
  const ratio = targetWords.size > 0 ? overlap / targetWords.size : 0;
  return { score: Number(ratio.toFixed(2)), is_correct: ratio >= 0.7 };
}

const DailyMixRuntimeView: React.FC<DailyMixRuntimeViewProps> = ({ mode = 'daily_mix', skill }) => {
  const navigate = useNavigate();

  const [batch, setBatch] = useState<SessionBatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [results, setResults] = useState<TaskResult[]>([]);
  const [lastEvaluation, setLastEvaluation] = useState<
    | (Pick<EvaluateTaskResponse, 'score' | 'is_correct'> & {
        feedback?: string;
        error_category?: string | null;
        corrected_version?: string | null;
        detected_level?: string;
        dimensions?: EvaluateTaskResponse['dimensions'];
        is_ai?: boolean;
      })
    | null
  >(null);
  const [isCheckingAnswer, setIsCheckingAnswer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completionResult, setCompletionResult] = useState<SessionCompleteResponse | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'sync' | 'error'; message: string } | null>(null);

  // --- Persistence Key ---
  const PERSIST_KEY = useMemo(() => `session_recovery_${mode}_${skill || 'default'}`, [mode, skill]);

  const loadBatch = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data =
        mode === 'skill_practice' && skill
          ? await sessionService.buildSkillPractice(skill)
          : await sessionService.buildDailyMix();
      setBatch(data);
      setCurrentIndex(0);
      setResults([]);
      setAnswer('');
      setLastEvaluation(null);
    } catch (err: any) {
      console.error('[DailyMix] load failed:', err);
      setLoadError(err?.message || 'Failed to architect your session.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- 💾 Recovery Logic ---
  useEffect(() => {
    const saved = localStorage.getItem(PERSIST_KEY);
    if (saved) {
      try {
        const { batch: savedBatch, results: savedResults, currentIndex: savedIdx } = JSON.parse(saved);
        if (savedBatch && Array.isArray(savedResults)) {
          setBatch(savedBatch);
          setResults(savedResults);
          setCurrentIndex(savedIdx);
          setIsLoading(false);
          setSyncStatus({ type: 'sync', message: 'Session recovered from previous state.' });
          setTimeout(() => setSyncStatus(null), 3000);
          return;
        }
      } catch (e) {
        console.error('Failed to recover session:', e);
      }
    }
    loadBatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, skill]);

  // --- 🛡️ Navigation Guard ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (batch && !completionResult) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [batch, completionResult]);

  // --- 📝 Save Progress ---
  useEffect(() => {
    if (batch && !completionResult) {
      localStorage.setItem(PERSIST_KEY, JSON.stringify({ batch, results, currentIndex }));
    } else if (completionResult) {
      localStorage.removeItem(PERSIST_KEY);
    }
  }, [batch, results, currentIndex, completionResult, PERSIST_KEY]);

  const currentTask: SessionTask | null = batch?.tasks?.[currentIndex] || null;
  const totalTasks = batch?.tasks?.length || 0;
  const progressPct = totalTasks > 0 ? ((currentIndex) / totalTasks) * 100 : 0;

  const slotMeta = useMemo(() => {
    const role = currentTask?.task_metadata?.slot_role || 'targeted';
    return SLOT_LABELS[role] || SLOT_LABELS.targeted;
  }, [currentTask]);

  const handleCheck = async () => {
    if (!currentTask || !answer.trim()) return;

    // Closed-form tasks (MCQ + fragments) → local string-match is enough and instant.
    const isClosed =
      (currentTask.content.options && currentTask.content.options.length > 0) ||
      (currentTask.content.fragments && currentTask.content.fragments.length > 0);

    if (isClosed) {
      setLastEvaluation({ ...evaluateLocally(currentTask, answer), is_ai: false });
      return;
    }

    // Open-ended → ask the CEFR Evaluator on the backend.
    setIsCheckingAnswer(true);
    try {
      const evalResult = await sessionService.evaluateTask({
        task_metadata: {
          type: currentTask.task_metadata.type,
          skill: currentTask.task_metadata.skill || currentTask.task_metadata.skill_tag,
          level: (currentTask.task_metadata as any).level || batch?.user_level,
          difficulty_score: currentTask.task_metadata.difficulty_score,
        },
        content: {
          instruction: currentTask.content.instruction,
          stimulus: currentTask.content.stimulus,
          task_prompt: currentTask.content.task_prompt,
          target_response: currentTask.content.target_response,
          explanation: currentTask.content.explanation,
        },
        user_response: answer,
      });

      setLastEvaluation({
        score: evalResult.score,
        is_correct: evalResult.is_correct,
        feedback: evalResult.detailed_feedback || evalResult.reasoning_summary,
        error_category: evalResult.error_analysis?.error_category ?? null,
        corrected_version: evalResult.error_analysis?.corrected_version ?? null,
        detected_level: evalResult.detected_level,
        dimensions: evalResult.dimensions,
        is_ai: !evalResult.is_fallback,
      });
    } catch (err) {
      console.warn('[DailyMix] AI evaluator failed, falling back to local match:', err);
      setLastEvaluation({ ...evaluateLocally(currentTask, answer), is_ai: false });
    } finally {
      setIsCheckingAnswer(false);
    }
  };

  const handleNext = async () => {
    if (!currentTask || !lastEvaluation) return;

    const taskResult: TaskResult = {
      skill: (currentTask.task_metadata.skill || currentTask.task_metadata.skill_tag || 'general').toLowerCase(),
      score: lastEvaluation.score,
      is_correct: lastEvaluation.is_correct,
      task_metadata: currentTask.task_metadata,
      error_category: lastEvaluation.is_correct
        ? null
        : lastEvaluation.error_category || currentTask.task_metadata.skill || null,
    };
    const nextResults = [...results, taskResult];
    setResults(nextResults);

    // --- 🔄 Incremental Sync (Zero Data Loss) ---
    try {
      await sessionService.syncTaskResult(taskResult);
      const acc = Math.round(lastEvaluation.score * 100);
      setSyncStatus({ 
        type: 'sync', 
        message: `Skill Level Sync: ${taskResult.skill.charAt(0).toUpperCase() + taskResult.skill.slice(1)} accuracy updated to ${acc}%.` 
      });
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err) {
      console.warn('[DailyMix] Incremental sync failed:', err);
      setSyncStatus({ type: 'error', message: 'Sync connection weak. Progress saved locally.' });
      setTimeout(() => setSyncStatus(null), 4000);
    }

    const isLast = currentIndex >= totalTasks - 1;
    if (!isLast) {
      setCurrentIndex(currentIndex + 1);
      setAnswer('');
      setLastEvaluation(null);
      return;
    }

    // Final task — close the loop on the backend
    setIsSubmitting(true);
    try {
      const response = await sessionService.submitSessionResults({
        session_type: batch?.session_type || mode,
        results: nextResults,
        completed_journey_step_id: batch?.journey_focus?.step_id || null,
      });
      setCompletionResult(response);
      localStorage.removeItem(PERSIST_KEY);
      setShowModal(true);
    } catch (err) {
      console.error('[DailyMix] session-complete failed:', err);
      setLoadError('Could not sync session results. Your progress is saved locally.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ------------------------------------------------------------------
  // Render branches
  // ------------------------------------------------------------------
  if (isLoading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 py-32">
          <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
          <p className="text-white/40 font-black uppercase tracking-[0.2em] text-[10px]">
            Architecting your {mode === 'skill_practice' ? 'skill ladder' : 'daily mix'}…
          </p>
        </div>
      </Shell>
    );
  }

  if (loadError && !batch) {
    return (
      <Shell>
        <div className="max-w-md mx-auto p-8 rounded-[2.5rem] bg-rose-500/10 border border-rose-500/20 text-center">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-4" />
          <p className="text-rose-300 font-bold mb-6">{loadError}</p>
          <button
            onClick={loadBatch}
            className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black uppercase tracking-widest text-xs transition"
          >
            Retry
          </button>
        </div>
      </Shell>
    );
  }

  if (!currentTask || !batch) return null;

  return (
    <Shell>
      {/* Top bar — back + progress */}
      <div className="max-w-4xl mx-auto mb-8 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40">
              Task {currentIndex + 1} / {totalTasks}
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40">
              Level {batch.user_level}
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
            />
          </div>
        </div>
      </div>

      {/* Task card */}
      <div className="max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTask.task_metadata.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
            className="rounded-[3rem] bg-[#0F172A]/40 border border-white/10 backdrop-blur-[40px] p-8 sm:p-10 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden"
          >
            {/* Accents */}
            <div className="absolute -top-32 -right-24 w-80 h-80 bg-indigo-500/20 blur-[140px] rounded-full pointer-events-none" />
            <div className="absolute -bottom-32 -left-24 w-80 h-80 bg-violet-500/15 blur-[140px] rounded-full pointer-events-none" />

            <div className="relative z-10">
              {/* Header chips */}
              <div className="flex items-center gap-3 mb-7 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-400/20">
                  <Brain size={12} className="text-indigo-300" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
                    {(currentTask.task_metadata?.type || 'task').replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                  <Target size={12} className={slotMeta.tone} />
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${slotMeta.tone}`}>
                    {slotMeta.label}
                  </span>
                </div>
                {currentTask.task_metadata.skill && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                    <Activity size={12} className="text-white/50" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 capitalize">
                      {currentTask.task_metadata.skill}
                    </span>
                  </div>
                )}
                {batch.journey_focus?.title && (
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/20">
                    <Sparkles size={12} className="text-emerald-300" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                      Journey · {batch.journey_focus.title}
                    </span>
                  </div>
                )}
              </div>

              {/* Stimulus Surface */}
              <div className="rounded-[2rem] bg-white/5 border border-white/5 p-7 mb-7">
                {currentTask.task_metadata.skill_tag?.toLowerCase() === 'listening' ? (
                  <div className="space-y-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200/60 mb-3">
                      Listening Prompt
                    </p>
                    <AudioPlaybackControl
                      audioUrl={currentTask.content.audio_url}
                      transcript={currentTask.content.stimulus}
                      allowReplay={true}
                      allowSlowAudio={true}
                    />
                  </div>
                ) : (currentTask.task_metadata.type?.toLowerCase().includes('visual') || currentTask.task_metadata.type?.toLowerCase().includes('image_word')) ? (
                  <div className="space-y-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200/60 mb-3">
                      Visual Stimulus
                    </p>
                    <div className="relative w-full aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-2xl group/img">
                      <img 
                        src={currentTask.content.image_url || `https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1000&auto=format&fit=crop`} 
                        alt="Task stimulus" 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-transparent to-transparent opacity-60" />
                      <div className="absolute bottom-4 left-6 right-6">
                         <p className="text-white/70 text-xs font-medium italic line-clamp-2">
                           {currentTask.content.stimulus}
                         </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200/60 mb-3">
                      Scenario
                    </p>
                    <p className="text-white/90 text-lg sm:text-xl leading-relaxed font-medium italic">
                      "{currentTask.content.stimulus}"
                    </p>
                  </>
                )}

                {currentTask.content.task_prompt && (
                  <>
                    <div className="mt-6 pt-6 border-t border-white/5" />
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200/60 mb-3">
                      Your task
                    </p>
                    <p className="text-white text-xl sm:text-2xl font-black tracking-tight leading-snug">
                      {currentTask.content.task_prompt}
                    </p>
                  </>
                )}
              </div>

              {/* Instruction */}
              <p className="text-white/70 text-sm font-medium leading-relaxed mb-4">
                {currentTask.content.instruction}
              </p>

              {/* Answer surface — options vs. textarea */}
              {currentTask.content.options && currentTask.content.options.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentTask.content.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setAnswer(opt)}
                      disabled={!!lastEvaluation}
                      className={`p-5 rounded-2xl text-left text-base font-bold border transition active:scale-[0.99] ${
                        answer === opt
                          ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl shadow-indigo-500/20'
                          : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                      } ${lastEvaluation ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={!!lastEvaluation}
                  placeholder="Type your response…"
                  className="w-full h-48 bg-white/5 border border-white/10 backdrop-blur-2xl rounded-[2rem] p-6 text-white placeholder-white/20 text-lg font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition resize-none disabled:opacity-70 shadow-inner"
                />
              )}

              {/* Evaluation banner */}
              <AnimatePresence>
                {lastEvaluation && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`mt-6 p-5 rounded-2xl border flex items-start gap-3 ${
                      lastEvaluation.is_correct
                        ? 'bg-emerald-500/10 border-emerald-400/20 text-emerald-200'
                        : 'bg-rose-500/10 border-rose-400/20 text-rose-200'
                    }`}
                  >
                    {lastEvaluation.is_correct ? (
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    )}
                    <div className="text-sm leading-relaxed flex-1">
                      <p className="font-black uppercase tracking-widest text-[10px] mb-1 flex items-center gap-2">
                        <span>{lastEvaluation.is_ai ? 'CEFR Score' : 'Local Score'} · {(lastEvaluation.score * 100).toFixed(0)}%</span>
                        {lastEvaluation.detected_level && (
                          <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/80 text-[9px]">
                            Detected · {lastEvaluation.detected_level}
                          </span>
                        )}
                        {lastEvaluation.error_category && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-200 text-[9px]">
                            {lastEvaluation.error_category}
                          </span>
                        )}
                      </p>
                      {lastEvaluation.dimensions && (
                        <div className="flex gap-6 mb-5 bg-white/5 p-3 rounded-xl border border-white/5">
                          {Object.entries(lastEvaluation.dimensions).map(([key, val]) => (
                            <div key={key} className="flex flex-col flex-1">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[8px] font-black uppercase tracking-widest opacity-50">{key}</span>
                                <span className="text-[9px] font-bold text-white/40">{Math.round(val * 100)}%</span>
                              </div>
                              <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${val * 100}%` }}
                                  className={`h-full shadow-[0_0_8px_rgba(255,255,255,0.2)] ${val > 0.7 ? 'bg-emerald-400' : val > 0.4 ? 'bg-amber-400' : 'bg-rose-400'}`}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {lastEvaluation.feedback && (
                        <div className="space-y-5 mb-4">
                          <div className="flex items-center gap-3 mb-2">
                             <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20">
                               <ShieldCheck size={14} className="text-indigo-400" />
                             </div>
                             <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-300/80">
                               Neural Feedback • Profile Synced
                             </p>
                          </div>
                          <p className="font-medium opacity-90 leading-relaxed text-base italic text-white/90">
                            "{lastEvaluation.feedback}"
                          </p>
                          
                          {/* 📊 Premium Actionable Correction Table */}
                          {(!lastEvaluation.is_correct || lastEvaluation.corrected_version) && (
                            <div className="rounded-[2rem] overflow-hidden border border-white/10 bg-black/40 backdrop-blur-2xl shadow-2xl relative">
                              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
                              <div className="grid grid-cols-2 text-[9px] font-black uppercase tracking-[0.3em] text-white/30 border-b border-white/5 bg-white/[0.02]">
                                <div className="p-4 border-r border-white/5 flex items-center gap-2">
                                  <AlertCircle size={10} className="text-rose-400/50" /> Draft Logic
                                </div>
                                <div className="p-4 flex items-center gap-2">
                                  <CheckCircle2 size={10} className="text-emerald-400/50" /> AI Alignment
                                </div>
                              </div>
                              <div className="grid grid-cols-2 text-sm">
                                <div className="p-6 border-r border-white/5 bg-rose-500/[0.02] text-rose-200/50 line-through decoration-rose-500/30 italic font-medium leading-relaxed">
                                  {answer || "—"}
                                </div>
                                <div className="p-6 bg-emerald-500/[0.03] text-emerald-400 font-bold leading-relaxed shadow-[inset_0_0_30px_rgba(16,185,129,0.03)]">
                                  {lastEvaluation.corrected_version || currentTask.content.target_response}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 🧠 Socratic Question */}
                          <div className="pt-4 border-t border-white/5 flex gap-3 italic text-indigo-200/70">
                            <Brain size={16} className="shrink-0 mt-0.5" />
                            <p className="text-sm">
                              {lastEvaluation.is_correct 
                                ? "Excellent control! Can you try expressing this same thought using a slightly more formal tone?"
                                : "Look closely at the refined version. Notice how the structure changed? Why do you think this version flows better?"}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {currentTask.content.explanation && (
                        <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/5 flex gap-3">
                          <Info size={16} className="shrink-0 text-indigo-300/60 mt-0.5" />
                          <p className="text-xs text-white/60 leading-relaxed italic">
                            <span className="font-bold text-indigo-300/80 not-italic uppercase tracking-tighter mr-2">Pro Tip:</span>
                            {currentTask.content.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 🔄 Sync Status Toast */}
              <AnimatePresence>
                {syncStatus && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`absolute bottom-24 right-8 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl ${
                      syncStatus.type === 'sync' 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}
                  >
                    {syncStatus.type === 'sync' ? <ShieldCheck size={16} /> : <Save size={16} />}
                    <span className="text-[10px] font-black uppercase tracking-widest">{syncStatus.message}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action buttons */}
              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                {!lastEvaluation ? (
                  <button
                    onClick={handleCheck}
                    disabled={!answer.trim() || isCheckingAnswer}
                    className="flex-1 py-5 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white font-black text-lg flex items-center justify-center gap-3 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-[0_0_20px_-5px_rgba(79,70,229,0.5)] hover:shadow-[0_0_30px_-5px_rgba(79,70,229,0.8)]"
                  >
                    {isCheckingAnswer ? (
                      <>
                        <RefreshCcw size={18} className="animate-spin" /> CEFR Grading…
                      </>
                    ) : (
                      <>
                        Check Answer <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    disabled={isSubmitting}
                    className="flex-1 py-5 rounded-2xl bg-white text-slate-950 hover:bg-slate-100 font-black text-lg flex items-center justify-center gap-3 transition active:scale-[0.98] shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.5)] disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCcw size={18} className="animate-spin" /> Syncing…
                      </>
                    ) : currentIndex >= totalTasks - 1 ? (
                      <>
                        Finish & Sync <Sparkles size={18} />
                      </>
                    ) : (
                      <>
                        Next Task <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                )}
              </div>

              {loadError && batch && (
                <p className="mt-4 text-xs text-rose-300/80 font-medium">{loadError}</p>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Completion modal */}
      <SessionCompleteModal
        open={showModal}
        result={completionResult}
        onClose={() => setShowModal(false)}
        onContinue={() => navigate('/journey')}
      />
    </Shell>
  );
};

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen w-full bg-[#020617] relative overflow-hidden p-6 selection:bg-indigo-500/30">
    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[140px] animate-pulse" />
    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600/15 rounded-full blur-[160px] animate-pulse [animation-delay:2s]" />
    <div className="relative z-10 max-w-7xl mx-auto py-8">{children}</div>
  </div>
);

export default DailyMixRuntimeView;
