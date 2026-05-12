import React, { useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SessionTask, TaskFeedbackPayload, TaskEvaluationResult } from '../../types/runtime';
import { AssessmentSessionResult } from '../../types/assessment';
import { RuntimeService } from '../../services/RuntimeService';
import { 
  ArrowLeft, 
  Brain, 
  Zap, 
  ChevronRight, 
  CheckCircle2, 
  Trophy, 
  BarChart2, 
  Clock, 
  RotateCcw, 
  XCircle, 
  AlertCircle, 
  Lightbulb, 
  Loader2,
  ArrowRight,
  Target,
  MessageSquare,
  Volume2,
  PenTool,
  Star,
  Sparkles,
  Award
} from 'lucide-react';

// Import modules
import { SpeakingModule } from './modules/SpeakingModule';
import { WritingModule } from './modules/WritingModule';
import { ListeningModule } from './modules/ListeningModule';
import { VocabularyModule } from './modules/VocabularyModule';
import { useSupabaseDashboard } from '../../hooks/useSupabaseDashboard';
import AdaptiveTaskCard from '../assessment/AdaptiveTaskCard';

interface SharedRuntimeProps {
  onExit: () => void;
  result?: AssessmentSessionResult | null;
}

const ComingSoonTasks = ({ currentLevel, onExit }: { currentLevel: string, onExit: () => void }) => {
  // Simple logic to find next level
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const currentIndex = levels.indexOf(currentLevel);
  const nextLevel = currentIndex !== -1 && currentIndex < levels.length - 1 ? levels[currentIndex + 1] : 'the next level';

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] bg-slate-50 dark:bg-gray-950 transition-colors duration-300 p-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white dark:bg-gray-900 p-10 rounded-[2.5rem] shadow-sm dark:shadow-md border border-slate-100 dark:border-gray-800 space-y-8 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/30 rounded-full blur-3xl -mr-16 -mt-16 opacity-60" />

        {/* Icon Animation */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 border-4 border-blue-500/10 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl animate-bounce">🚀</span>
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-3 relative z-10">
          <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">Coming Soon</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            We're fine-tuning your personalized tasks based on your <span className="text-blue-600 dark:text-blue-400 font-bold">{currentLevel} to {nextLevel} roadmap</span>.
          </p>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-full border border-blue-100 dark:border-blue-800 tracking-widest uppercase">
          <Brain className="w-3 h-3" /> AI Journey Engine: Building...
        </div>

        <button
          onClick={onExit}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest transition shadow-sm active:scale-95"
        >
          Back to Journey
        </button>
      </motion.div>
    </div>
  );
};

const LevelUpCelebration = ({ level, onClose }: { level: string, onClose: () => void }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-xl"
  >
    <motion.div 
      initial={{ scale: 0.8, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      className="bg-white dark:bg-slate-900 rounded-[3rem] p-12 max-w-lg w-full text-center border border-white/20 shadow-2xl relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
      
      <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-orange-500/20">
        <Trophy className="w-12 h-12 text-white" />
      </div>

      <h2 className="text-4xl font-black text-slate-900 dark:text-slate-50 mb-4 tracking-tight">Level Up!</h2>
      <p className="text-xl text-slate-500 dark:text-slate-400 mb-8 font-medium">
        Congratulations! You've mastered your goals and reached level <span className="text-blue-500 font-bold">{level}</span>.
      </p>

      <button 
        onClick={onClose}
        className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-3"
      >
        Continue to Journey <ArrowRight className="w-5 h-5" />
      </button>
    </motion.div>
  </motion.div>
);

const SharedRuntime: React.FC<SharedRuntimeProps> = ({ onExit, result }) => {
  const supabaseData = useSupabaseDashboard();

  // 1. Move ALL Hooks to the top (Stably ordered)
  const [tasks, setTasks] = useState<SessionTask[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [feedback, setFeedback] = useState<TaskFeedbackPayload | null>(null);
  const [evaluation, setEvaluation] = useState<TaskEvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationLevel, setCelebrationLevel] = useState('A1');
  const [retryCount, setRetryCount] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [sessionResults, setSessionResults] = useState<TaskEvaluationResult[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [showBatchEnd, setShowBatchEnd] = useState(false);

  const taskStartTime = useRef(Date.now());

  // 2. Active Adaptive Sync fallback (Memoized)
  const activeResult = React.useMemo(() => {
    if (result) return result;
    if (supabaseData.isLoading) return null;

    // Map Supabase DB to AssessmentSessionResult for Runtime Service
    const dbSkills: any = {};
    const skillList = supabaseData.skills && supabaseData.skills.length > 0
      ? supabaseData.skills
      : [{ skillId: 'speaking', masteryScore: 50 }, { skillId: 'reading', masteryScore: 50 }];

    skillList.forEach(s => {
      dbSkills[s.skillId || s.skill] = {
        confidence: { score: (s.confidence || 0.5) },
        descriptors: [{ descriptorId: `desc_${s.skillId}`, strength: (s.masteryScore || 50) / 100, descriptorText: `Focus on ${s.skillId} fluency.` }]
      };
    });

    return {
      overall: {
        estimatedLevel: supabaseData.profile?.overall_level || 'B1',
        confidence: 0.75
      },
      skills: dbSkills
    } as AssessmentSessionResult;
  }, [result, supabaseData]);

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const skillFilter = searchParams.get('skill');
  const taskFilter = searchParams.get('task');
  const sessionId = searchParams.get('session_id');
  const isFetching = useRef(false);

  // 3. Populate tasks once activeResult is ready or skill changes
  React.useEffect(() => {
    // ONLY fetch if we have a result AND no tasks AND not currently fetching
    if (activeResult && tasks.length === 0 && !isFetching.current && !showSummary) {
      const fetchTasks = async () => {
        console.log("[SharedRuntime] 🚀 Initializing session tasks...");
        isFetching.current = true;

        setFeedback(null);
        setEvaluation(null);
        setSessionResults([]);

        try {
          const generatedTasks = await RuntimeService.generateSessionTasks(
            activeResult, 
            skillFilter || undefined,
            taskFilter || undefined
          );
          if (generatedTasks && generatedTasks.length > 0) {
            setTasks(generatedTasks);
            setCurrentTaskIndex(0);
          }
        } catch (err) {
          console.error("[SharedRuntime] Fetch failed:", err);
        } finally {
          isFetching.current = false;
        }
      };

      fetchTasks();
    }
  }, [activeResult, skillFilter, taskFilter, tasks.length, showSummary]);

  // 🎯 Session Tracking: Ensure evaluate-task API knows which session we are in
  React.useEffect(() => {
    if (sessionId) {
      (window as any).__ACTIVE_SESSION_ID__ = sessionId;
      console.log("[SharedRuntime] Session tracked:", sessionId);
    }
    return () => {
      delete (window as any).__ACTIVE_SESSION_ID__;
    };
  }, [sessionId]);

  // Handle fetching 5 more tasks
  const handleContinue = async () => {
    setIsEvaluating(true);
    try {
      const moreTasks = await RuntimeService.generateSessionTasks(activeResult as any, skillFilter || undefined);
      setTasks(prev => [...prev, ...moreTasks]);
      setCurrentTaskIndex(prev => prev + 1);
      setFeedback(null);
      setEvaluation(null);
      taskStartTime.current = Date.now();
    } finally {
      setIsEvaluating(false);
    }
  };

  const currentTask = tasks[currentTaskIndex];

  const handleResponseSubmit = (responsePayload: any) => {
    setIsEvaluating(true);
    setFeedback(null);

    const responseTimeMs = Date.now() - taskStartTime.current;

    setTimeout(async () => {
      try {
        const { feedback: newFeedback, result } = await RuntimeService.evaluateResponse(currentTask, responsePayload);

        if (result) {
          result.responseTimeMs = responseTimeMs;
          result.hintUsage = hintsUsed;
          result.retryCount = retryCount;
          result.supportDependence = hintsUsed > 2 ? 'high' : hintsUsed > 0 ? 'medium' : 'low';
          setEvaluation(result);
          
          if (result.syncState) {
            console.log("[SharedRuntime] 🚀 Live UI Sync Triggered:", result.syncState);
            if (result.syncState.ui_trigger === 'Celebrate') {
              setCelebrationLevel(result.syncState.user_level || 'Next');
              setShowCelebration(true);
            }
          }
        }
        setFeedback(newFeedback);
      } finally {
        setIsEvaluating(false);
      }
    }, 1500);
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setHintsUsed(prev => prev + 1);
    setFeedback(null);
    setEvaluation(null);
    taskStartTime.current = Date.now();
  };

  const handleNextTask = () => {
    if (evaluation) {
      setSessionResults(prev => [...prev, evaluation]);
    }

    // Check if we reached the end of the current batch (5 tasks)
    if ((currentTaskIndex + 1) % 5 === 0 && currentTaskIndex === tasks.length - 1) {
      setShowBatchEnd(true);
      return;
    }

    if (currentTaskIndex < tasks.length - 1) {
      setCurrentTaskIndex(prev => prev + 1);
      setFeedback(null);
      setEvaluation(null);
      taskStartTime.current = Date.now();
      setRetryCount(0);
      setHintsUsed(0);
    } else {
      setShowSummary(true);
    }
  };

  // 4. Return Loading Shell (Must be AFTER all hooks and handlers)
  if (!activeResult || (tasks.length === 0 && !showSummary)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950 transition-colors duration-300 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-blue-600 dark:bg-blue-600 rounded-2xl flex items-center justify-center shadow-sm dark:shadow-md shadow-indigo-100 animate-pulse mb-6">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Architecting Your Tasks...</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium">Building a custom technical curriculum for you.</p>
      </div>
    );
  }

  // Render the appropriate module based on task skill / type.
  // Skill takes precedence so a "Speaking Practice" session always gets the
  // mic-driven SpeakingModule even when the AI tags the task type as
  // fill-in-blank (which would otherwise fall through to VocabularyModule).
  const renderModuleTask = () => {
    if (!currentTask) return null;

    const props = {
      task: currentTask,
      onSubmit: handleResponseSubmit,
      isEvaluating,
      feedback,
      retryCount,
      userId: supabaseData.user?.id,
      assessmentId: searchParams.get('assessment_id') || 'practice-session'
    };

    const skill = (currentTask.targetSkill || '').toLowerCase();
    if (skill === 'speaking') return <SpeakingModule {...props} />;
    if (skill === 'listening') return <ListeningModule {...props} />;
    if (skill === 'writing') return <WritingModule {...props} />;

    switch (currentTask.taskType) {
      case 'speaking': return <SpeakingModule {...props} />;
      case 'writing': return <WritingModule {...props} />;
      case 'listening': return <ListeningModule {...props} />;
      case 'vocabulary': return <VocabularyModule {...props} />;
      case 'visual_vocabulary': return <VocabularyModule {...props} />;
      default: return <WritingModule {...props} />;
    }
  };

  // ---- Intermediate Batch End Screen ---- //
  if (showBatchEnd) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white dark:bg-gray-900 p-10 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-gray-800 text-center space-y-8"
        >
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg animate-bounce">
            <Zap className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50">Batch Complete!</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">You've finished 5 tasks. What's next on your journey?</p>
          </div>
          <div className="flex flex-col gap-4">
            <button
              onClick={() => { setShowBatchEnd(false); handleContinue(); }}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest transition shadow-lg active:scale-95 flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" /> Continue Practice (5 More)
            </button>
            <button
              onClick={() => { setShowBatchEnd(false); setShowSummary(true); }}
              className="w-full py-4 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-900 dark:text-slate-50 rounded-2xl font-black uppercase tracking-widest transition active:scale-95 flex items-center justify-center gap-2"
            >
              <BarChart2 className="w-5 h-5" /> Finish & View Report
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ---- Session Summary Screen ---- //
  if (showSummary) {
    const uniqueResults = sessionResults.filter((r, i, arr) => arr.findIndex(x => x.taskId === r.taskId) === i);
    const avgScore = uniqueResults.length > 0
      ? Math.round(uniqueResults.reduce((sum, r) => sum + r.successScore, 0) / uniqueResults.length)
      : 0;
    const totalTime = uniqueResults.reduce((sum, r) => sum + r.responseTimeMs, 0);

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950 transition-colors duration-300 flex items-center justify-center p-6 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 shadow-sm dark:shadow-md transition-colors duration-300 p-10 rounded-[2.5rem]"
        >
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
              <Trophy className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 mb-2">Answer Review Sheet</h2>
            <p className="text-slate-500 dark:text-slate-400">Let's review your performance in detail.</p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-10">
            <div className="bg-slate-50 dark:bg-gray-950 transition-colors duration-300 p-4 rounded-xl text-center border border-slate-200 dark:border-gray-800 transition-colors duration-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
              <p className="text-2xl font-extrabold text-slate-900">{uniqueResults.length}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tasks</p>
            </div>
            <div className="bg-slate-50 dark:bg-gray-950 transition-colors duration-300 p-4 rounded-xl text-center border border-slate-200 dark:border-gray-800 transition-colors duration-300">
              <BarChart2 className="w-5 h-5 text-indigo-500 mx-auto mb-2" />
              <p className="text-2xl font-extrabold text-slate-900">{avgScore}%</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Avg Score</p>
            </div>
            <div className="bg-slate-50 dark:bg-gray-950 transition-colors duration-300 p-4 rounded-xl text-center border border-slate-200 dark:border-gray-800 transition-colors duration-300">
              <Clock className="w-5 h-5 text-amber-500 mx-auto mb-2" />
              <p className="text-2xl font-extrabold text-slate-900">{(totalTime / 1000 / 60).toFixed(1)}m</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Time</p>
            </div>
          </div>

          <div className="space-y-6 mb-10">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 border-b pb-4">Detailed Task Answers</h3>
            {uniqueResults.map((r, i) => {
              const review = r.reviewData;
              if (!review) return null;

              const isCorrect = review.result === 'correct';
              const isPartial = review.result === 'partial';

              return (
                <div key={r.taskId} className="bg-slate-50 dark:bg-gray-950 transition-colors duration-300 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  {/* Card Header */}
                  <div className={`p-4 border-b flex items-center justify-between ${isCorrect ? 'bg-emerald-50/50 border-emerald-100' : isPartial ? 'bg-amber-50/50 border-amber-100' : 'bg-rose-50/50 border-rose-100'}`}>
                    <div className="flex gap-4 items-center flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-widest bg-slate-800 text-white px-3 py-1 rounded-full">{review.skill}</span>
                      <div className="flex gap-1.5 items-center">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Target Level:</span>
                        <span className="text-xs font-extrabold bg-slate-200 text-slate-700 px-2 py-0.5 rounded shadow-sm">{review.questionLevel}</span>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Your Level:</span>
                        <span className={`text-xs font-extrabold px-2 py-0.5 rounded shadow-sm ${review.answerLevel !== review.questionLevel ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200' : 'bg-slate-200 text-slate-700'}`}>{review.answerLevel}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-extrabold uppercase tracking-widest ${isCorrect ? 'text-emerald-700' : isPartial ? 'text-amber-700' : 'text-rose-700'}`}>
                        {review.result}
                      </span>
                      {isCorrect ? <CheckCircle2 className="w-5 h-5 text-emerald-500 border border-emerald-200 bg-emerald-50 rounded-full" /> : isPartial ? <AlertCircle className="w-5 h-5 text-amber-500 border border-amber-200 bg-amber-50 rounded-full" /> : <XCircle className="w-5 h-5 text-rose-500 border border-rose-200 bg-rose-50 rounded-full" />}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 space-y-5">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Prompt</p>
                      <p className="text-slate-800 dark:text-slate-200 font-medium text-[15px]">{review.prompt}</p>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 transition-colors duration-300 ring-1 ring-black/5">
                      <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1.5">Your Answer</p>
                      <p className="text-slate-900 font-medium">{review.userAnswer}</p>
                    </div>

                    {review.correctAnswer && (
                      <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1.5">Target Answer</p>
                        <p className="text-emerald-900 font-bold">{review.correctAnswer}</p>
                      </div>
                    )}

                    {/* Explanations Layer */}
                    <div className="space-y-3.5 mt-6 border-t border-slate-200 pt-5">
                      {review.explanation.whyCorrect && (
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                          <p className="text-slate-700 text-sm leading-relaxed"><strong className="text-slate-900 mr-1">Why Correct:</strong>{review.explanation.whyCorrect}</p>
                        </div>
                      )}
                      {review.explanation.whatWentWrong && (
                        <div className="flex items-start gap-3">
                          <Zap className="w-5 h-5 text-rose-500 mt-0.5 shrink-0" />
                          <p className="text-slate-700 text-sm leading-relaxed"><strong className="text-slate-900 mr-1">What Went Wrong:</strong>{review.explanation.whatWentWrong}</p>
                        </div>
                      )}
                      {review.explanation.whyIncorrect && (
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5 shrink-0" />
                          <p className="text-slate-700 text-sm leading-relaxed"><strong className="text-slate-900 mr-1">Why Incorrect:</strong>{review.explanation.whyIncorrect}</p>
                        </div>
                      )}
                      {review.explanation.levelNote && (
                        <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/30/50 p-3 rounded-xl border border-indigo-100/50">
                          <BarChart2 className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
                          <p className="text-indigo-900 text-sm leading-relaxed max-w-3xl"><strong className="text-indigo-950 mr-1">Level Note:</strong>{review.explanation.levelNote}</p>
                        </div>
                      )}
                      {review.explanation.modelAnswer && (
                        <div className="flex items-start gap-3">
                          <Brain className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
                          <p className="text-slate-700 text-sm leading-relaxed"><strong className="text-slate-900 mr-1">Model Idea:</strong>{review.explanation.modelAnswer}</p>
                        </div>
                      )}
                      {review.explanation.improvementTip && (
                        <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-xl border border-amber-200/60 mt-3 shadow-sm">
                          <Lightbulb className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                          <p className="text-amber-900 text-sm font-medium leading-relaxed max-w-3xl"><strong className="uppercase tracking-widest text-[10px] bg-amber-200/50 px-2 py-0.5 rounded mr-2 align-middle">Tip</strong>{review.explanation.improvementTip}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={onExit}
            className="w-full bg-foreground text-background font-extrabold tracking-wide uppercase py-4 rounded-xl transition-all shadow-sm dark:shadow-md hover:opacity-90 active:scale-[0.98] transition-colors duration-300"
          >
            Finish Review
          </button>
        </motion.div>
      </div>
    );
  }

  if (!currentTask || tasks.length === 0) {
    const activeTaskId = localStorage.getItem('active_journey_step_id') || 'remediation_session_01';

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950 transition-colors duration-300 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-4xl">
          <AdaptiveTaskCard
            taskId={activeTaskId}
            userId={supabaseData.user?.id || 'learner_prime'}
            onComplete={onExit}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 transition-colors duration-300 flex flex-col items-center p-4 sm:p-6">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-900 shadow-sm dark:shadow-md rounded-[2rem] overflow-hidden flex flex-col h-[90vh] md:h-[85vh] mt-2 border border-slate-200 dark:border-gray-800 relative transition-colors duration-300">

        {/* Universal Task Header */}
        <header className="px-6 py-5 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900/80 backdrop-blur-xl sticky top-0 z-10 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <button onClick={onExit} className="p-2.5 bg-slate-50 dark:bg-gray-950 hover:bg-white dark:bg-gray-900-hover/50 rounded-full transition-colors text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-gray-800 transition-colors duration-300">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold tracking-widest uppercase bg-blue-50 dark:bg-blue-900/30 text-indigo-700 px-2 py-0.5 rounded-md">
                  {currentTask.targetSkill} Practice
                </span>
                <span className="text-xs text-slate-900 dark:text-slate-50 font-extrabold transition-colors duration-300 tracking-widest uppercase">
                  Task {currentTaskIndex + 1} of {tasks.length}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50 tracking-tight">{currentTask.learningObjective}</h2>
            </div>
          </div>

          {/* Progress bar */}
          <div className="hidden sm:block w-32">
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden transition-colors duration-300">
              <div className="h-full bg-indigo-500 transition-all" style={{ width: `${((currentTaskIndex + 1) / tasks.length) * 100}%` }} />
            </div>
          </div>
        </header>

        {/* Dynamic Module Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-slate-50 dark:bg-gray-950 transition-colors duration-300/30 relative">
          
          {/* NEURAL REPAIR INTERVENTION BANNER */}
          {currentTask.metadata?.is_repair && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-4 shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/20">
                <AlertCircle className="text-white" size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest leading-none mb-1">Neural Repair Active</h4>
                <p className="text-xs text-rose-500/80 font-medium leading-relaxed">
                  The AI Architect has detected a persistent linguistic friction. This task is specifically designed to rewire your {currentTask.metadata?.focus || 'chronic error'} patterns.
                </p>
              </div>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentTask.taskId}-${retryCount}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full flex flex-col"
            >
              {/* Task Prompt Framing */}
              <div className="mb-8">
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3">
                  {currentTask.prompt}
                </p>

                {currentTask.payload?.stimulus && currentTask.payload.stimulus !== currentTask.prompt && currentTask.targetSkill?.toLowerCase() !== 'listening' && (
                  <div className="p-8 bg-white dark:bg-gray-900 rounded-3xl border-2 border-slate-100 dark:border-gray-800 shadow-sm mb-6 overflow-hidden">
                    {typeof currentTask.payload.stimulus === 'string' && (currentTask.payload.stimulus.startsWith('http') || currentTask.payload.stimulus.match(/\.(jpeg|jpg|gif|png|webp)$/i)) ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full h-64 md:h-80 rounded-2xl overflow-hidden relative group"
                      >
                        <img 
                          src={currentTask.payload.stimulus} 
                          alt="Task Stimulus"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1000&auto=format&fit=crop';
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.div>
                    ) : (
                      <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100 leading-tight">
                        {currentTask.payload.stimulus}
                      </h3>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  {currentTask.difficultyTarget && <span className="bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-400 px-3 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-gray-800">Target: {currentTask.difficultyTarget}</span>}
                  {retryCount > 0 && <span className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-3 py-1 text-xs font-bold rounded-lg border border-amber-200 dark:border-amber-800/50">Attempt {retryCount + 1}</span>}
                </div>

                {/* 🎯 THE MISSING QUESTION: Render the specific task prompt */}
                {currentTask.payload?.task_prompt && (
                  <div className="mt-8 mb-4">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 leading-tight">
                      {currentTask.payload.task_prompt}
                    </h2>
                  </div>
                )}
              </div>

              {/* Module Instantiation */}
              <div className="flex-1">
                {renderModuleTask()}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Universal Feedback & Transition Panel */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className={`p-6 border-t ${feedback.feedbackType === 'praise' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-200'} shadow-[0_-10px_40px_rgba(0,0,0,0.05)] relative z-20`}
            >
              <div className="flex gap-4 items-start max-w-3xl mx-auto">
                <div className={`mt-1 p-2 rounded-full ${feedback.feedbackType === 'praise' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  {feedback.feedbackType === 'praise' ? <CheckCircle2 className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                  <h4 className={`text-lg font-bold mb-1 ${feedback.feedbackType === 'praise' ? 'text-emerald-900' : 'text-amber-900'}`}>{feedback.feedbackType === 'praise' ? 'Great job!' : 'Let\'s refine this.'}</h4>
                  <p className={`text-base font-medium mb-3 ${feedback.feedbackType === 'praise' ? 'text-emerald-800' : 'text-amber-800'}`}>{feedback.primaryMessage}</p>

                  {/* 🔍 Detailed Error Correction UI */}
                  {evaluation?.reviewData?.explanation && (
                    <div className="mt-3 flex flex-col gap-2">
                      {evaluation.reviewData.explanation.whatWentWrong && (
                        <div className="flex items-start gap-2 bg-rose-50/50 dark:bg-rose-950/20 p-3 rounded-xl border border-rose-100 dark:border-rose-900/30">
                          <span className="text-rose-600 font-bold text-xs uppercase tracking-tighter mt-0.5">Issues:</span>
                          <p className="text-rose-800 dark:text-rose-300 text-sm italic">{evaluation.reviewData.explanation.whatWentWrong}</p>
                        </div>
                      )}
                      {evaluation.reviewData.explanation.improvementTip && (
                        <div className="flex items-start gap-2 bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30">
                          <span className="text-blue-600 font-bold text-xs uppercase tracking-tighter mt-0.5">Correction:</span>
                          <p className="text-blue-800 dark:text-blue-300 text-sm font-medium">{evaluation.reviewData.explanation.improvementTip}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 📊 Multidimensional Scoring Badges */}
                  {evaluation?.dimensions && (
                    <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar pb-1">
                      {Object.entries(evaluation.dimensions).map(([key, val]: [string, any]) => (
                        val > 0 && (
                          <div key={key} className="flex flex-col items-center min-w-[70px] px-2 py-1.5 bg-white/40 dark:bg-black/20 rounded-xl border border-white/50 dark:border-white/5 shadow-sm">
                            <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400 leading-none mb-1">{key}</span>
                            <span className={`text-sm font-black ${val >= 80 ? 'text-emerald-600' : val >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                              {Math.round(val)}%
                            </span>
                          </div>
                        )
                      ))}
                    </div>
                  )}

                  {feedback.suggestedRetryConstraint && (
                    <div className="inline-block bg-amber-500/10 border border-amber-500/20 text-amber-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm mt-3">
                      Constraint: {feedback.suggestedRetryConstraint}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {feedback.canAdvance && (
                    <button onClick={handleNextTask} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-95">
                      Next Task <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                  {!feedback.canAdvance && retryCount < (currentTask.supportSettings.maxRetries || 3) && (
                    <button onClick={handleRetry} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-amber-600/20 active:scale-95">
                      <RotateCcw className="w-4 h-4" /> Try Again
                    </button>
                  )}
                  {!feedback.canAdvance && retryCount >= (currentTask.supportSettings.maxRetries || 3) && (
                    <button onClick={handleNextTask} className="flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold transition-all">
                      Skip <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* 🎉 Level Up Celebration */}
        <AnimatePresence>
          {showCelebration && (
            <LevelUpCelebration 
              level={celebrationLevel} 
              onClose={() => setShowCelebration(false)} 
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SharedRuntime;
