import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SessionTask, TaskFeedbackPayload, TaskEvaluationResult } from '../../types/runtime';
import { RuntimeService } from '../../services/RuntimeService';
import { ArrowLeft, Brain, Zap, ChevronRight, CheckCircle2, Trophy, BarChart2, Clock, RotateCcw } from 'lucide-react';

// Import modules
import { SpeakingModule } from './modules/SpeakingModule';
import { WritingModule } from './modules/WritingModule';
import { ListeningModule } from './modules/ListeningModule';
import { VocabularyModule } from './modules/VocabularyModule';

interface SharedRuntimeProps {
  onExit: () => void;
}

export const SharedRuntime: React.FC<SharedRuntimeProps> = ({ onExit }) => {
  const [tasks] = useState<SessionTask[]>(RuntimeService.generateSessionTasks());
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  
  const [feedback, setFeedback] = useState<TaskFeedbackPayload | null>(null);
  const [evaluation, setEvaluation] = useState<TaskEvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Retry state
  const [retryCount, setRetryCount] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);

  // Behavioral tracking
  const taskStartTime = useRef(Date.now());

  // Session-level stats
  const [sessionResults, setSessionResults] = useState<TaskEvaluationResult[]>([]);
  const [showSummary, setShowSummary] = useState(false);

  const currentTask = tasks[currentTaskIndex];

  const handleResponseSubmit = (responsePayload: any) => {
    setIsEvaluating(true);
    setFeedback(null);
    
    const responseTimeMs = Date.now() - taskStartTime.current;

    setTimeout(() => {
      const { feedback: newFeedback, result } = RuntimeService.evaluateResponse(currentTask, responsePayload.answer);
      
      // Enrich result with actual behavioral signals
      if (result) {
        result.responseTimeMs = responseTimeMs;
        result.hintUsage = hintsUsed;
        result.retryCount = retryCount;
        result.supportDependence = hintsUsed > 2 ? 'high' : hintsUsed > 0 ? 'medium' : 'low';
      }

      setFeedback(newFeedback);
      if (result) {
        setEvaluation(result);
      }
      setIsEvaluating(false);
    }, 1500);
  };

  // Retry handler — allows resubmission on the same task
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
    
    if (currentTaskIndex < tasks.length - 1) {
      setCurrentTaskIndex(currentTaskIndex + 1);
      setFeedback(null);
      setEvaluation(null);
      setRetryCount(0);
      setHintsUsed(0);
      taskStartTime.current = Date.now();
    } else {
      // Show session summary before exiting
      if (evaluation) {
        setSessionResults(prev => [...prev, evaluation]);
      }
      setShowSummary(true);
    }
  };

  // Render the appropriate module based on task type
  const renderModuleTask = () => {
    if (!currentTask) return null;
    
    const props = {
      task: currentTask,
      onSubmit: handleResponseSubmit,
      isEvaluating,
      feedback,
      retryCount,
    };

    switch (currentTask.taskType) {
      case 'speaking': return <SpeakingModule {...props} />;
      case 'writing': return <WritingModule {...props} />;
      case 'listening': return <ListeningModule {...props} />;
      case 'vocabulary': return <VocabularyModule {...props} />;
      default: return <div>Unknown task type</div>;
    }
  };

  // ---- Session Summary Screen ---- //
  if (showSummary) {
    const uniqueResults = sessionResults.filter((r, i, arr) => arr.findIndex(x => x.taskId === r.taskId) === i);
    const avgScore = uniqueResults.length > 0
      ? Math.round(uniqueResults.reduce((sum, r) => sum + r.successScore, 0) / uniqueResults.length)
      : 0;
    const totalTime = uniqueResults.reduce((sum, r) => sum + r.responseTimeMs, 0);

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-10 rounded-3xl shadow-xl max-w-lg w-full border border-slate-100"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-emerald-100">
              <Trophy className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Session Complete!</h2>
            <p className="text-slate-500">Great work. Here's how you did.</p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
              <p className="text-2xl font-extrabold text-slate-900">{uniqueResults.length}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tasks</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
              <BarChart2 className="w-5 h-5 text-indigo-500 mx-auto mb-2" />
              <p className="text-2xl font-extrabold text-slate-900">{avgScore}%</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Avg Score</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
              <Clock className="w-5 h-5 text-amber-500 mx-auto mb-2" />
              <p className="text-2xl font-extrabold text-slate-900">{(totalTime / 1000 / 60).toFixed(1)}m</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Time</p>
            </div>
          </div>

          {/* Per-task breakdown */}
          <div className="space-y-3 mb-8">
            {uniqueResults.map(r => (
              <div key={r.taskId} className="flex justify-between items-center bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-widest bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md">{r.taskType}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${r.successScore >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>{r.successScore}%</span>
                  {r.meaningSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={onExit}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-indigo-600/20"
          >
            Return to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  if (!currentTask) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 sm:p-6">
      <div className="w-full max-w-4xl bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] rounded-[2rem] overflow-hidden flex flex-col h-[90vh] md:h-[85vh] mt-2 border border-slate-100 relative">
        
        {/* Universal Task Header */}
        <header className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={onExit} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors text-slate-500 border border-slate-200">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold tracking-widest uppercase bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                   {currentTask.targetSkill} Practice
                </span>
                <span className="text-xs text-slate-400 font-bold tracking-widest uppercase">
                   Task {currentTaskIndex + 1} of {tasks.length}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">{currentTask.learningObjective}</h2>
            </div>
          </div>

          {/* Progress bar */}
          <div className="hidden sm:block w-32">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all" style={{ width: `${((currentTaskIndex + 1) / tasks.length) * 100}%` }} />
            </div>
          </div>
        </header>

        {/* Dynamic Module Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-slate-50/30 relative">
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
                <h3 className="text-2xl font-bold text-slate-800 leading-relaxed mb-4">{currentTask.prompt}</h3>
                <div className="flex gap-2">
                   {currentTask.difficultyTarget && <span className="bg-slate-100 text-slate-600 px-3 py-1 text-xs font-bold rounded-lg border border-slate-200">Target: {currentTask.difficultyTarget}</span>}
                   {retryCount > 0 && <span className="bg-amber-50 text-amber-700 px-3 py-1 text-xs font-bold rounded-lg border border-amber-200">Attempt {retryCount + 1}</span>}
                </div>
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
                   {feedback.suggestedRetryConstraint && (
                     <div className="inline-block bg-amber-100/50 border border-amber-200 text-amber-900 px-4 py-2 rounded-xl text-sm font-bold shadow-sm">
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
        
      </div>
    </div>
  );
};
