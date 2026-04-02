import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MessageSquare, Focus, TrendingUp, TrendingDown, Shield, CheckCircle2, XCircle } from 'lucide-react';
import { FadeTransition } from '../lib/animations';
import { AssessmentQuestion, AssessmentOutcome, TaskEvaluation, ResponseMode, SpeakingSubmissionMeta, LearnerContextProfile } from '../types/assessment';
import { AdaptiveAssessmentEngine } from '../services/AdaptiveAssessmentEngine';
import { TaskResult, OnboardingState } from '../types/app';
import { SessionTask } from '../types/runtime';
import { AudioPlaybackControl } from '../components/shared/AudioPlaybackControl';
import { SpeakingModule } from '../components/runtime/modules/SpeakingModule';

// ============================================================================
// Question Renderer Component
// ============================================================================

const TaskQuestion: React.FC<{
  task: AssessmentQuestion;
  questionNumber: number;
  onCompleteTask: (answer: string, responseTime: number, responseMode?: ResponseMode, speakingMeta?: SpeakingSubmissionMeta) => void;
}> = ({ task, questionNumber, onCompleteTask }) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);

  const isWritingMode = ['grammar', 'vocabulary', 'writing', 'reading'].includes(task.skill);
  const [textMode, setTextMode] = useState(isWritingMode);

  const startTime = useRef(Date.now());

  const isVisual = task.type === 'picture_description';
  const isListening = task.skill === 'listening';
  const isMCQ = ['mcq', 'fill_blank', 'reading_mcq', 'listening_mcq'].includes(task.type);

  useEffect(() => {
    setTextMode(isWritingMode || isMCQ);
    setInputText('');
    setIsRecording(false);
    setScanComplete(false);
    startTime.current = Date.now();

    if (isVisual) {
      setTimeout(() => setScanComplete(true), 2500);
    }
  }, [task, isWritingMode, isVisual, isMCQ]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (inputText.trim()) {
      const responseTime = Date.now() - startTime.current;
      onCompleteTask(inputText.trim(), responseTime);
    }
  };

  const handleOptionSelect = (option: string) => {
    const responseTime = Date.now() - startTime.current;
    onCompleteTask(option, responseTime);
  };

  // Skill color mapping
  const skillColors: Record<string, string> = {
    grammar: 'bg-violet-50 border-violet-200 text-violet-700',
    vocabulary: 'bg-amber-50 border-amber-200 text-amber-700',
    reading: 'bg-blue-50 border-blue-200 text-blue-700',
    writing: 'bg-purple-50 border-purple-200 text-purple-700',
    listening: 'bg-green-50 border-green-200 text-green-700',
    speaking: 'bg-rose-50 border-rose-200 text-rose-700',
  };

  const difficultyColors: Record<string, string> = {
    A1: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    A2: 'bg-green-50 border-green-200 text-green-700',
    B1: 'bg-blue-50 border-blue-200 text-blue-700',
    B2: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    C1: 'bg-purple-50 border-purple-200 text-purple-700',
  };

  const variants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <motion.div
      key={task.id}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-col h-full text-slate-900"
    >
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-1">
          {questionNumber > 1 && task.difficulty > (window as any)._lastBenchmark && (
            <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 border border-amber-200 text-amber-700 font-bold rounded-lg text-[10px] uppercase animate-pulse">
              <TrendingUp className="w-3 h-3" /> Challenge Task
            </span>
          )}
        </div>
        <span className={`px-3 py-1 border font-bold rounded-lg text-sm tracking-wide uppercase ${skillColors[task.skill] || ''}`}>
          {task.skill}
        </span>
        <span className="text-xs text-slate-400 font-mono ml-auto">
          Progress {questionNumber} / 10
        </span>
      </div>

      <p className="text-slate-600 mb-8 text-lg leading-relaxed font-medium">{task.prompt}</p>

      {isVisual && (
        <div className="w-full aspect-video bg-slate-100 rounded-2xl border border-slate-200 mb-8 flex items-center justify-center overflow-hidden relative shadow-inner">
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
                  { label: 'Coffee', accuracy: 98 },
                  { label: 'Person', accuracy: 95 },
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
        </div>
      )}

      {isListening && (
         <div className="mb-8">
           <AudioPlaybackControl 
             audioUrl={task.audioUrl} 
             transcript={task.transcript} 
             allowReplay={true}
             className="shadow-inner bg-slate-100"
           />
         </div>
      )}

      {task.skill === 'speaking' && (
         <div className="mb-2 mt-4">
           <SpeakingModule 
             // Map AssessmentQuestion to SessionTask locally for the module since they are decoupled
             task={{ taskId: task.id, taskType: 'speaking', targetSkill: 'speaking', prompt: task.prompt, learningObjective: '', supportSettings: { allowHints: false, allowReplay: false, maxRetries: 0 }, difficultyTarget: task.difficulty, completionCondition: '' } as SessionTask}
             onSubmit={(payload) => {
               const responseTime = Date.now() - startTime.current;
               onCompleteTask(payload.answer, responseTime, payload.responseMode, payload.speakingMeta);
             }}
             isEvaluating={false}
             feedback={null}
             retryCount={0}
           />
         </div>
      )}

      {task.skill !== 'speaking' && (
      <div className="mt-auto space-y-4">
        {isMCQ && task.options ? (
          <div className="flex flex-col gap-3">
            {task.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleOptionSelect(opt)}
                className="w-full py-4 px-6 text-left bg-white border border-slate-200 hover:border-indigo-400 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-all shadow-sm flex items-center gap-4"
              >
                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold border border-slate-200">
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            ))}
          </div>
        ) : textMode ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <textarea
              autoFocus
              className="w-full flex-1 min-h-[140px] p-5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none text-slate-900 placeholder-slate-400 shadow-inner"
              placeholder="Type your detailed answer here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <div className="flex gap-4">
              {!isWritingMode && (
                <button
                  type="button"
                  onClick={() => setTextMode(false)}
                  className="px-6 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-all shadow-sm"
                >
                  Back
                </button>
              )}
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
                    onCompleteTask('[Voice Audio Recorded]', responseTime);
                  }, 2500);
                }
              }}
              className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-slate-200 hover:border-indigo-400 hover:bg-white rounded-2xl transition-all group relative overflow-hidden shadow-sm"
            >
              {isRecording && <div className="absolute inset-0 bg-indigo-50 animate-pulse" />}
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-all shadow-sm border border-slate-100 ${
                  isRecording
                    ? 'bg-red-100 text-red-600 scale-110 border-red-200'
                    : 'bg-white group-hover:bg-indigo-50 text-slate-500 group-hover:text-indigo-600'
                }`}
              >
                <Mic className="w-7 h-7" />
              </div>
              <span className={`font-semibold transition-colors ${isRecording ? 'text-red-600' : 'text-slate-700 group-hover:text-indigo-900'}`}>
                {isRecording ? 'Recording...' : 'Voice Record'}
              </span>
            </button>
          </div>
        )}
      </div>
      )}
    </motion.div>
  );
};


// ============================================================================
// Feedback Flash Component
// ============================================================================

const AnswerFeedback: React.FC<{
  correct: boolean;
  show: boolean;
}> = ({ correct, show }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.3 }}
        className={`absolute inset-0 z-40 flex items-center justify-center rounded-[2rem] backdrop-blur-sm ${
          correct ? 'bg-emerald-500/10' : 'bg-red-500/10'
        }`}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg ${
            correct ? 'bg-emerald-500 text-white' : 'bg-red-400 text-white'
          }`}
        >
          {correct ? (
            <CheckCircle2 className="w-10 h-10" />
          ) : (
            <XCircle className="w-10 h-10" />
          )}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// Main Diagnostic View
// ============================================================================

interface DiagnosticViewProps {
  onboardingState?: OnboardingState | null;
  onComplete: (results: TaskResult[], outcome: AssessmentOutcome) => void;
}

export const DiagnosticView: React.FC<DiagnosticViewProps> = ({ onComplete, onboardingState }) => {
  const engine = useMemo(() => {
    let startBand: any = 'A2';
    if (onboardingState?.goal === 'casual') startBand = 'A1';
    if (onboardingState?.goal === 'professional') startBand = 'B1';
    
    // Map onboarding state to learner context profile
    const contextProfile: LearnerContextProfile | undefined = onboardingState ? {
      goal: onboardingState.goal || undefined,
      goalContext: onboardingState.goalContext || undefined,
      preferredTopics: (onboardingState.topics || []) as string[],
    } : undefined;

    return new AdaptiveAssessmentEngine(startBand, contextProfile);
  }, [onboardingState]);
  const [currentTask, setCurrentTask] = useState<AssessmentQuestion | null>(null);
  const [progress, setProgress] = useState(engine.getProgress());
  const [feedbackState, setFeedbackState] = useState<{ show: boolean; correct: boolean }>({
    show: false,
    correct: false,
  });
  const [isEvaluating, setIsEvaluating] = useState(false);

  useEffect(() => {
    const firstQ = engine.getNextQuestion();
    setCurrentTask(firstQ);
    const progress = engine.getProgress();
    setProgress(progress);
    (window as any)._lastBenchmark = progress.currentBand;
  }, [engine]);

  const handleNextTask = useCallback(
    async (answer: string, responseTime: number, responseMode?: ResponseMode, speakingMeta?: SpeakingSubmissionMeta) => {
      if (!currentTask || isEvaluating) return;

      setIsEvaluating(true);

      try {
        // Submit to adaptive engine (now async via Groq)
        const { correct } = await engine.submitAnswer(currentTask, answer, responseTime, responseMode, speakingMeta);
        setProgress(engine.getProgress());

        // Show feedback flash
        setFeedbackState({ show: true, correct });

        // After feedback, load next question or complete
        setTimeout(() => {
          setFeedbackState({ show: false, correct: false });
          setIsEvaluating(false);

          const nextQ = engine.getNextQuestion();

          if (nextQ) {
            setCurrentTask(nextQ);
            const nextProgress = engine.getProgress();
            setProgress(nextProgress);
            (window as any)._lastBenchmark = nextProgress.currentBand;
          } else {
            // Assessment complete
            const evaluations = engine.getEvaluations();
            const outcome = engine.getOutcome();
            onComplete(evaluations, outcome);
          }
        }, 600);
      } catch (err) {
        console.error("Evaluation error:", err);
        setIsEvaluating(false);
      }
    },
    [currentTask, engine, isEvaluating, onComplete]
  );

  if (!currentTask) return null;

  // Difficulty indicator colors
  const bandColor = (() => {
    const b = progress.currentBand;
    if (b === 'A1' || b === 'A2') return 'bg-emerald-500';
    if (b === 'B1' || b === 'B2') return 'bg-blue-500';
    return 'bg-purple-500';
  })();

  const confidencePercent = Math.round(progress.confidence * 100);

  return (
    <FadeTransition className="min-h-screen bg-slate-50 flex flex-col items-center pt-20 px-4 pb-12">
      <div className="w-full max-w-2xl flex flex-col h-full mt-4">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex justify-between text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest">
            <span>Adaptive Assessment</span>
            <span>
              Task {progress.answered + 1} · ~{progress.total} estimated
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner flex">
            <motion.div
              className={`h-full transition-colors ${bandColor}`}
              style={{ boxShadow: '0 0 10px rgba(0,0,0,0.1)' }}
              initial={{ width: `${(Math.max(0, progress.answered)) / progress.total * 100}%` }}
              animate={{ width: `${((progress.answered + 1) / progress.total) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>

          {/* Meta indicators */}
          <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Testing:</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                {currentTask.skill}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-slate-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Reliability: {confidencePercent}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-[2rem] p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] border border-slate-100 flex-1 min-h-[500px] flex flex-col relative overflow-hidden">
          {/* Answer feedback overlay */}
          <AnswerFeedback correct={feedbackState.correct} show={feedbackState.show} />

          {isEvaluating && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-30 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                <span className="text-indigo-900 font-bold text-sm">Evaluating...</span>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            <TaskQuestion
              key={currentTask.id}
              task={currentTask}
              questionNumber={progress.answered + 1}
              onCompleteTask={handleNextTask}
            />
          </AnimatePresence>
        </div>
      </div>
    </FadeTransition>
  );
};
