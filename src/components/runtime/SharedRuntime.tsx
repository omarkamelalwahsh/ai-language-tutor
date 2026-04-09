import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SessionTask, TaskFeedbackPayload, TaskEvaluationResult } from '../../types/runtime';
import { AssessmentSessionResult } from '../../types/assessment';
import { RuntimeService } from '../../services/RuntimeService';
import { ArrowLeft, Brain, Zap, ChevronRight, CheckCircle2, Trophy, BarChart2, Clock, RotateCcw, XCircle, AlertCircle, Lightbulb } from 'lucide-react';

// Import modules
import { SpeakingModule } from './modules/SpeakingModule';
import { WritingModule } from './modules/WritingModule';
import { ListeningModule } from './modules/ListeningModule';
import { VocabularyModule } from './modules/VocabularyModule';

interface SharedRuntimeProps {
  onExit: () => void;
  result: AssessmentSessionResult;
}

const ComingSoonTasks = ({ currentLevel, onExit }: { currentLevel: string, onExit: () => void }) => {
  // Simple logic to find next level
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const currentIndex = levels.indexOf(currentLevel);
  const nextLevel = currentIndex !== -1 && currentIndex < levels.length - 1 ? levels[currentIndex + 1] : 'the next level';

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] bg-slate-50 p-6 text-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-8 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-60" />
        
        {/* Icon Animation */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 border-4 border-indigo-500/10 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl animate-bounce">🚀</span>
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-3 relative z-10">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Coming Soon</h2>
          <p className="text-slate-500 font-medium leading-relaxed">
            We're fine-tuning your personalized tasks based on your <span className="text-indigo-600 font-bold">{currentLevel} to {nextLevel} roadmap</span>.
          </p>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-full border border-indigo-100 tracking-widest uppercase">
          <Brain className="w-3 h-3" /> AI Journey Engine: Building...
        </div>

        <button 
          onClick={onExit}
          className="w-full bg-slate-900 hover:bg-black text-white px-8 py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-slate-200"
        >
          Back to Journey
        </button>
      </motion.div>
    </div>
  );
};

export const SharedRuntime: React.FC<SharedRuntimeProps> = ({ onExit, result }) => {
  const [tasks] = useState<SessionTask[]>(RuntimeService.generateSessionTasks(result));
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

    setTimeout(async () => {
      const { feedback: newFeedback, result } = await RuntimeService.evaluateResponse(currentTask, responsePayload);
      
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-6 sm:p-10 rounded-3xl shadow-xl max-w-4xl w-full border border-slate-100 my-8"
        >
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-emerald-100">
              <Trophy className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Answer Review Sheet</h2>
            <p className="text-slate-500">Let's review your performance in detail.</p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-10">
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

          <div className="space-y-6 mb-10">
            <h3 className="text-xl font-bold text-slate-800 border-b pb-4">Detailed Task Answers</h3>
            {uniqueResults.map((r, i) => {
              const review = r.reviewData;
              if (!review) return null;

              const isCorrect = review.result === 'correct';
              const isPartial = review.result === 'partial';
              
              return (
                <div key={r.taskId} className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  {/* Card Header */}
                  <div className={`p-4 border-b flex items-center justify-between ${isCorrect ? 'bg-emerald-50/50 border-emerald-100' : isPartial ? 'bg-amber-50/50 border-amber-100' : 'bg-rose-50/50 border-rose-100'}`}>
                    <div className="flex gap-4 items-center flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-widest bg-slate-800 text-white px-3 py-1 rounded-full">{review.skill}</span>
                      <div className="flex gap-1.5 items-center">
                         <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Level:</span>
                         <span className="text-xs font-extrabold bg-slate-200 text-slate-700 px-2 py-0.5 rounded shadow-sm">{review.questionLevel}</span>
                      </div>
                      <div className="flex gap-1.5 items-center">
                         <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your Level:</span>
                         <span className={`text-xs font-extrabold px-2 py-0.5 rounded shadow-sm ${review.answerLevel !== review.questionLevel ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200' : 'bg-slate-200 text-slate-700'}`}>{review.answerLevel}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className={`text-sm font-extrabold uppercase tracking-widest ${isCorrect ? 'text-emerald-700' : isPartial ? 'text-amber-700' : 'text-rose-700'}`}>
                         {review.result}
                       </span>
                       {isCorrect ? <CheckCircle2 className="w-5 h-5 text-emerald-500 border border-emerald-200 bg-emerald-50 rounded-full"/> : isPartial ? <AlertCircle className="w-5 h-5 text-amber-500 border border-amber-200 bg-amber-50 rounded-full"/> : <XCircle className="w-5 h-5 text-rose-500 border border-rose-200 bg-rose-50 rounded-full"/>}
                    </div>
                  </div>
                  
                  {/* Card Body */}
                  <div className="p-5 space-y-5">
                     <div>
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Prompt</p>
                       <p className="text-slate-800 font-medium text-[15px]">{review.prompt}</p>
                     </div>

                     <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 ring-1 ring-black/5">
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
                           <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0"/>
                           <p className="text-slate-700 text-sm leading-relaxed"><strong className="text-slate-900 mr-1">Why Correct:</strong>{review.explanation.whyCorrect}</p>
                         </div>
                       )}
                       {review.explanation.whatWentWrong && (
                         <div className="flex items-start gap-3">
                           <Zap className="w-5 h-5 text-rose-500 mt-0.5 shrink-0"/>
                           <p className="text-slate-700 text-sm leading-relaxed"><strong className="text-slate-900 mr-1">What Went Wrong:</strong>{review.explanation.whatWentWrong}</p>
                         </div>
                       )}
                       {review.explanation.whyIncorrect && (
                         <div className="flex items-start gap-3">
                           <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5 shrink-0"/>
                           <p className="text-slate-700 text-sm leading-relaxed"><strong className="text-slate-900 mr-1">Why Incorrect:</strong>{review.explanation.whyIncorrect}</p>
                         </div>
                       )}
                       {review.explanation.levelNote && (
                         <div className="flex items-start gap-3 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
                           <BarChart2 className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0"/>
                           <p className="text-indigo-900 text-sm leading-relaxed max-w-3xl"><strong className="text-indigo-950 mr-1">Level Note:</strong>{review.explanation.levelNote}</p>
                         </div>
                       )}
                       {review.explanation.modelAnswer && (
                         <div className="flex items-start gap-3">
                           <Brain className="w-5 h-5 text-slate-400 mt-0.5 shrink-0"/>
                           <p className="text-slate-700 text-sm leading-relaxed"><strong className="text-slate-900 mr-1">Model Idea:</strong>{review.explanation.modelAnswer}</p>
                         </div>
                       )}
                       {review.explanation.improvementTip && (
                         <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-xl border border-amber-200/60 mt-3 shadow-sm">
                           <Lightbulb className="w-5 h-5 text-amber-500 mt-0.5 shrink-0"/>
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
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold tracking-wide uppercase py-4 rounded-xl transition-all shadow-xl shadow-slate-900/20 active:scale-[0.98]"
          >
            Finish Review
          </button>
        </motion.div>
      </div>
    );
  }

  if (!currentTask || tasks.length === 0) {
    return (
      <ComingSoonTasks 
        currentLevel={result.overall.estimatedLevel} 
        onExit={onExit} 
      />
    );
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
