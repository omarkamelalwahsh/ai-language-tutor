import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MessageSquare, Focus } from 'lucide-react';
import { FadeTransition, staggerContainer, staggerItem } from '../lib/animations';
import { TaskModel, TaskResult } from '../types/app';

const ASSESSMENT_TASKS: TaskModel[] = [
  { 
    taskId: '1', taskType: 'speaking', targetSkill: 'speaking', 
    title: 'Self-Introduction',
    prompt: "Please introduce yourself. What is your daily routine and why do you want to learn this language?",
    targetSubskills: ['fluency', 'task_completion'],
    difficultyTarget: 'adaptive',
  },
  { 
    taskId: '2', taskType: 'visual_description', targetSkill: 'vocabulary', 
    title: 'Visual Description',
    prompt: "Describe what people are doing in this picture. Use precise words.",
    targetSubskills: ['word_choice', 'contextual_use'],
    difficultyTarget: 'adaptive',
  },
  { 
    taskId: '3', taskType: 'vocabulary_in_context', targetSkill: 'writing', 
    title: 'Past Challenge',
    prompt: "Tell me about a challenging situation you faced in the past and how you handled it.",
    targetSubskills: ['grammar_accuracy', 'clarity', 'structure'],
    difficultyTarget: 'adaptive',
  },
  {
    taskId: '4', taskType: 'writing', targetSkill: 'writing', 
    title: 'Opinion & Argument',
    prompt: "What is your opinion on the impact of Artificial Intelligence on education? Provide a reasoned argument.",
    targetSubskills: ['structure', 'register', 'word_choice'],
    difficultyTarget: 'adaptive',
  },
  {
    taskId: '5', taskType: 'listening_comprehension', targetSkill: 'listening', 
    title: 'Listening Comprehension',
    prompt: "Listen to the following scenario: A coworker calls to say they will be 30 minutes late to a meeting. What is the main reason they gave? Write a short summary.",
    targetSubskills: ['gist_understanding', 'detail_capture'],
    difficultyTarget: 'A2+',
  },
  {
    taskId: '6', taskType: 'vocabulary_in_context', targetSkill: 'vocabulary',
    title: 'Vocabulary in Context',
    prompt: "Complete the sentence with the best word: 'Despite the heavy rain, she decided to ______ with her travel plans.' (Options: continue, postpone, abandon, celebrate). Explain your choice.",
    targetSubskills: ['recall', 'contextual_use'],
    difficultyTarget: 'B1',
  },
];

const TaskQuestion: React.FC<{
  task: TaskModel;
  onCompleteTask: (result: TaskResult) => void;
}> = ({ task, onCompleteTask }) => {
  const [textMode, setTextMode] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const startTime = useRef(Date.now());

  const isVisual = task.taskType === 'visual_description';
  const isListening = task.taskType === 'listening_comprehension';

  useEffect(() => {
    if (isVisual) {
      setTimeout(() => setScanComplete(true), 2500); 
    }
  }, [isVisual]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const responseTime = Date.now() - startTime.current;
    onCompleteTask({
      taskId: task.taskId,
      answer: inputText.trim(),
      responseTime,
      wordCount: inputText.trim().split(/\s+/).filter(w => w.length > 0).length,
      hintUsage: 0,
    });
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col h-full text-slate-900">
      <motion.div variants={staggerItem} className="flex items-center gap-3 mb-5">
        <span className="px-3 py-1 bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold rounded-lg text-sm tracking-wide">{task.title}</span>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800">{task.targetSkill.toUpperCase()}</h2>
      </motion.div>

      <motion.p variants={staggerItem} className="text-slate-600 mb-8 text-lg leading-relaxed font-medium">{task.prompt}</motion.p>

      {isVisual && (
        <motion.div variants={staggerItem} className="w-full aspect-video bg-slate-100 rounded-2xl border border-slate-200 mb-8 flex items-center justify-center overflow-hidden relative shadow-inner">
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
        </motion.div>
      )}

      {isListening && (
        <motion.div variants={staggerItem} className="w-full bg-slate-100 rounded-2xl border border-slate-200 p-6 flex items-center gap-4 mb-8 shadow-inner">
          <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-800 text-sm mb-2">Audio Scenario</p>
            <audio controls className="w-full h-10 outline-none" src="https://cdn.pixabay.com/audio/2022/10/25/audio_24911f32a6.mp3">
              Your browser does not support the audio element.
            </audio>
          </div>
        </motion.div>
      )}

      <motion.div variants={staggerItem} className="mt-auto space-y-4">
        {textMode ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <textarea
              autoFocus
              className="w-full flex-1 min-h-[140px] p-5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none text-slate-900 placeholder-slate-400 shadow-inner"
              placeholder="Type your detailed answer here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setTextMode(false)}
                className="px-6 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-all shadow-sm"
              >
                Back
              </button>
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
                    onCompleteTask({
                      taskId: task.taskId,
                      answer: "[Voice Audio Recorded]",
                      responseTime,
                      wordCount: 15,
                      hintUsage: 0,
                    });
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
        )}
      </motion.div>
    </motion.div>
  );
};

interface DiagnosticViewProps {
  onComplete: (results: TaskResult[]) => void;
}

export const DiagnosticView: React.FC<DiagnosticViewProps> = ({ onComplete }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [taskResults, setTaskResults] = useState<TaskResult[]>([]);

  const handleNextTask = (result: TaskResult) => {
    const newResults = [...taskResults, result];
    if (stepIndex < ASSESSMENT_TASKS.length - 1) {
      setTaskResults(newResults);
      setStepIndex(stepIndex + 1);
    } else {
      onComplete(newResults);
    }
  };

  const task = ASSESSMENT_TASKS[stepIndex];

  return (
    <FadeTransition className="min-h-screen bg-slate-50 flex flex-col items-center pt-20 px-4 pb-12">
      <div className="w-full max-w-2xl flex flex-col h-full mt-4">
        <div className="mb-8">
          <div className="flex justify-between text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest">
            <span>Diagnostic Assessment</span>
            <span>Task {stepIndex + 1} of {ASSESSMENT_TASKS.length}</span>
          </div>
          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner flex">
            <motion.div
              className="h-full bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.5)]"
              initial={{ width: `${(stepIndex / ASSESSMENT_TASKS.length) * 100}%` }}
              animate={{ width: `${((stepIndex + 1) / ASSESSMENT_TASKS.length) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          {/* Skill being tested indicator */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Testing:</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{task.targetSkill}</span>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] border border-slate-100 flex-1 min-h-[500px] flex flex-col relative overflow-hidden">
          <AnimatePresence mode="wait">
            <TaskQuestion key={task.taskId} task={task} onCompleteTask={handleNextTask} />
          </AnimatePresence>
        </div>
      </div>
    </FadeTransition>
  );
};
