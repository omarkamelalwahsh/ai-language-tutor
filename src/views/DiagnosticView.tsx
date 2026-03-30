import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MessageSquare, Focus } from 'lucide-react';
import { FadeTransition, staggerContainer, staggerItem } from '../lib/animations';
import { AssessmentQuestion } from '../types/assessment';
import { AdaptiveAssessmentEngine } from '../services/AdaptiveAssessmentEngine';
import { TaskResult } from '../types/app';

const TaskQuestion: React.FC<{
  task: AssessmentQuestion;
  onCompleteTask: (answer: string, responseTime: number) => void;
}> = ({ task, onCompleteTask }) => {
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  
  // Use text mode strictly for writing/grammar, otherwise offer voice/text choice
  const isWritingMode = ['grammar', 'vocabulary', 'writing', 'reading'].includes(task.skill);
  const [textMode, setTextMode] = useState(isWritingMode);
  
  const startTime = useRef(Date.now());

  const isVisual = task.skill === 'vocabulary' && task.id === '2';
  const isListening = task.skill === 'listening_proxy';

  useEffect(() => {
    // Reset state when new task arrives
    setTextMode(isWritingMode);
    setInputText("");
    setIsRecording(false);
    setScanComplete(false);
    startTime.current = Date.now();
    
    if (isVisual) {
      setTimeout(() => setScanComplete(true), 2500); 
    }
  }, [task, isWritingMode, isVisual]);

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

  const variants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
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
      <div className="flex items-center gap-3 mb-5">
        <span className={`px-3 py-1 border font-bold rounded-lg text-sm tracking-wide 
          ${task.difficulty === 'A1' || task.difficulty === 'A2' ? 'bg-green-50 border-green-200 text-green-700' :
            task.difficulty === 'B1' || task.difficulty === 'B2' ? 'bg-blue-50 border-blue-200 text-blue-700' :
            'bg-purple-50 border-purple-200 text-purple-700'}`}>
          Band: {task.difficulty}
        </span>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800 uppercase">{task.skill.replace('_proxy', '')}</h2>
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
        </div>
      )}

      {isListening && (
        <div className="w-full bg-slate-100 rounded-2xl border border-slate-200 p-6 flex items-center gap-4 mb-8 shadow-inner">
          <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-800 text-sm mb-2">Simulated Audio Scenario</p>
            <div className="w-full h-8 bg-slate-200 rounded-md animate-pulse"></div>
          </div>
        </div>
      )}

      <div className="mt-auto space-y-4">
        {task.type === 'multiple_choice' && task.options ? (
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
        ) : (
          textMode ? (
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
                      onCompleteTask("[Voice Audio Recorded]", responseTime);
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
          )
        )}
      </div>
    </motion.div>
  );
};

interface DiagnosticViewProps {
  onComplete: (results: TaskResult[]) => void;
}

export const DiagnosticView: React.FC<DiagnosticViewProps> = ({ onComplete }) => {
  const engine = useMemo(() => new AdaptiveAssessmentEngine("A2", 10), []);
  const [currentTask, setCurrentTask] = useState<AssessmentQuestion | null>(null);
  const [progress, setProgress] = useState(engine.getProgress());

  useEffect(() => {
    // Initial fetch
    setCurrentTask(engine.getNextQuestion());
    setProgress(engine.getProgress());
  }, [engine]);

  const handleNextTask = (answer: string, responseTime: number) => {
    if (!currentTask) return;
    
    // Submit result to adaptive engine which will update internal difficulty banding
    engine.submitAnswer(currentTask, answer, responseTime);
    setProgress(engine.getProgress());

    const nextQ = engine.getNextQuestion();
    
    if (nextQ) {
      setCurrentTask(nextQ);
    } else {
      // Completed the 10 questions!
      const finalTasks = engine.exportResultsForLegacyAnalysis();
      onComplete(finalTasks);
    }
  };

  if (!currentTask) return null; // Defensive check or loading UI could go here

  return (
    <FadeTransition className="min-h-screen bg-slate-50 flex flex-col items-center pt-20 px-4 pb-12">
      <div className="w-full max-w-2xl flex flex-col h-full mt-4">
        <div className="mb-8">
          <div className="flex justify-between text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest">
            <span>Adaptive Assessment</span>
            <span>Task {progress.answered + 1} of {progress.total}</span>
          </div>
          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner flex">
            <motion.div
              className={`h-full transition-colors ${progress.currentBand === 'A1' || progress.currentBand === 'A2' ? 'bg-green-500' : progress.currentBand === 'B1' || progress.currentBand === 'B2' ? 'bg-blue-500' : 'bg-purple-500'}`}
              style={{ boxShadow: '0 0 10px rgba(0,0,0,0.1)' }}
              initial={{ width: `${(Math.max(0, progress.answered)) / progress.total * 100}%` }}
              animate={{ width: `${((progress.answered + 1) / progress.total) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Testing:</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                {currentTask.skill.replace('_proxy', '')}
              </span>
            </div>
            {/* Optional debugger indicator for the band */}
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 opacity-50">
              TARGET BAND: {progress.currentBand}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] border border-slate-100 flex-1 min-h-[500px] flex flex-col relative overflow-hidden">
          <AnimatePresence mode="wait">
            <TaskQuestion key={currentTask.id} task={currentTask} onCompleteTask={handleNextTask} />
          </AnimatePresence>
        </div>
      </div>
    </FadeTransition>
  );
};
